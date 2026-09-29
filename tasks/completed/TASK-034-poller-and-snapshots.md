# TASK-034: Poll projects, keep the mirror and snapshot, and report source status

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008, ADR-010
Dependencies: TASK-029, TASK-030, TASK-033

## Desired outcome

Moonbeam polls every registered project on an interval and on request. It keeps
the project's mirror current, derives and stores the snapshot atomically,
evaluates flags, detects rewritten history, and reports source status. All of it
is read-only toward GitHub.

## Context

This task joins the TASK-032 primitives to the dbc engine (TASK-029, TASK-030).
Flag persistence goes behind a `FlagSink` interface that TASK-035 implements.
This task ships a sink that records nothing.

## Scope

### Included

- **`server/src/poller/chain-source.ts`:** adapts `Mirror.readChain`, the commit-login cache (`commit_logins`), and `Mirror.readFile` plus `decodeFile` into dbc's `ChainCommit[]` and `FileReader`.
- **`server/src/poller/poll.ts`:** one poll of one project.
  1. Token lookup. Missing or unreadable gives the `token_missing` or `token_config_unreadable` status.
  2. `getRepository` with the ETag:
     - an ID mismatch gives `identity_changed` and no read (S8, F4)
     - a redirect keeps reading and stores `redirected_full_name` (F4)
     - write scopes are stored (S4)
  3. `getBranchHead` (F5).
  4. If the head equals the last processed head: re-evaluate the condition flags only (S6).
  5. Otherwise:
     - fetch the mirror
     - the ancestry check against the last processed head: a rewrite builds FL-10 with `compareSnapshots` (F6)
     - update the commit logins for new commits
     - `deriveSnapshot`, then `evaluateFlags`
  6. One transaction: replace the snapshot, update `project_sources`, call `FlagSink.apply(...)` (S6).
  7. Pin `refs/moonbeam/last-processed`.
- **Status mapping:** F1 unreachable, with backoff (5, 10, 20, then at most 30 minutes after repeated failures), and rate limited until T; F2 token rejected; F3 not found or not accessible; F5 branch missing; `baseline_needs_reset` from the evaluation (F6). The last snapshot is never deleted (S7).
- **`server/src/poller/scheduler.ts`:**
  - `MOONBEAM_POLL_INTERVAL_SECONDS`, default 300 (S5)
  - one poll at a time per project: an in-process mutex plus `pg_try_advisory_lock`
  - honors `rate_limited_until`
  - on startup, polls every project (F10). A missing mirror is recreated. A snapshot with an old `snapshot_version` is rebuilt without raising FL-10.
  - a failure in one project never affects the others (N4)
- **`POST /api/projects/:id/refresh`:** any viewer, no selected user needed (S5). It joins a running poll and returns the source status.
- `packages/shared/src/source.ts`: the source status schema.
- Wiring in `index.ts`, with a clean stop on shutdown.
- Harness support for fixture remotes and the fake API.
- `docs/DEVELOPMENT.md`.

### Excluded

- Flag records and dismissals (TASK-035).
- View endpoints (TASK-036).
- The UI.

### Paths

- `server/src/poller/`
- `server/src/index.ts`
- `server/src/routes.ts`
- `server/src/test/harness.ts`
- `server/src/test/poller.test.ts`
- `server/src/test/source-failures.test.ts`
- `packages/shared/src/source.ts`
- `packages/shared/src/index.ts`
- `docs/DEVELOPMENT.md`

## Plan

1. The chain-source adapter and its tests against a fixture repository.
2. `poll.ts` with its status mapping, driven by a fake API and a fixture remote.
3. The scheduler, concurrency, and startup.
4. The refresh route, wiring, and documentation.

## Acceptance criteria

- [ ] S2 and S3 (V2): a full poll cycle against a fixture uses only GET requests and allowlisted git subcommands, recorded by test doubles. Nothing is written to the remote.
- [ ] S5: the interval is configurable and defaults to 300 seconds. A refresh is available without a selected user. Polls of the same project never overlap (a concurrent test).
- [ ] S5 and F1: when rate-limited, no request is made before the reset. The status shows "rate limited until T". Backoff is capped at 30 minutes.
- [ ] S6: an unchanged head re-evaluates only condition flags. A changed head replaces the snapshot and status in one transaction. A reader during a poll sees the whole old or the whole new snapshot.
- [ ] S7: after any failure, the previous snapshot, its head, and its poll time remain.
- [ ] S8 and F4: a redirect to the same ID reads and records the new name. A different ID gives `identity_changed` and reads nothing.
- [ ] F2, F3, F5: each gives its status with its since-time. A replaced token is used at the next poll.
- [ ] F6 and FL-10: a `reset --hard` rewrite produces an FL-10 input for the sink, with its evidence, and a full re-derivation. A fast-forward produces none. If the baseline commit leaves the chain, `baseline_needs_reset` is set.
- [ ] F10: after a restart with the mirror deleted, the next poll rebuilds it. The snapshot and all Moonbeam data survive.
- [ ] H9, N3, V3: polling a fixture after each of five commits, and polling a fresh registration once at the end, give deep-equal snapshots and flag sets (rule, subject key, evidence).
- [ ] N4 and V4: unreachable, timeout, rate limit, 401, 404, a redirect to the same ID, a different ID, a missing branch, and a force push are simulated. Each gives its F behavior and keeps the last known state. A second project keeps polling normally.

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`). Record the counts.

## Risks and assumptions

- A tracked-branch change resets the last processed head without raising FL-10
  (TASK-023 question 3).
- Logins come from REST. If that lookup fails, the poll fails as F1.

## Blocker

None.

## Implementation handoff

Implemented TASK-034 in the shared `main` checkout. Ready for dispatcher review; not marked accepted or moved.

Files changed:

- `server/src/poller/chain-source.ts`
- `server/src/poller/lock.ts`
- `server/src/poller/poll.ts`
- `server/src/poller/scheduler.ts`
- `server/src/poller/scheduler.test.ts`
- `server/src/poller/status.ts`
- `server/src/index.ts`
- `server/src/routes.ts`
- `server/src/test/harness.ts`
- `server/src/test/poller.test.ts`
- `server/src/test/source-failures.test.ts`
- `packages/shared/src/source.ts`
- `packages/shared/src/index.ts`
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-034-poller-and-snapshots.md` (Implementation handoff only).

Public API and endpoints:

- `POST /api/projects/:id/refresh`: viewer-accessible; joins an active poll and returns `SourceView`. Unknown or removed projects return `not_found`.
- `sourceStatusSchema`, `sourceViewSchema`, `SourceStatus`, and `SourceView`: validated source status, timestamps, processed head, reset time, redirect, scope warning, failures, and baseline-reset notice.
- `Poller.poll(projectId, manual?)`; `PollScheduler.start()`, `pollAll()`, `refresh(id)`, and `stop()`; configurable `pollIntervalMs()`.
- `FlagSink.apply(transaction, FlagInput)` receives full/conditions mode, snapshot, evaluation, and optional FL-10 evidence. `nullFlagSink` persists nothing. `chainSource()` and `cachedLogins()` adapt the existing mirror and cache.
- Harness additions: fixture remotes/mirrors, injectable sink and interval, fixed clock, `poller`, `newScheduler()`, and `fixtureGitHub()` with stubbed HTTP through the real REST decoder.

Validation:

- Commands used `/home/patrick/.nvm/versions/node/v24.16.0/bin` prepended to PATH.
- `pnpm typecheck`: passed across all five packages. An earlier test-fixture inference error was corrected before the final run.
- `pnpm -r --reporter=append-only run test`: passed, 345 tests across 31 files: db 6, dbc 182, shared 4, server 132, UI 21. No reported failures; per-package results inspected.
- `pnpm --filter @moonbeam/server exec vitest run`: passed separately, 132 tests across 11 files, including the real database/API suite. This task adds 29 tests.
- `pnpm build`: passed across all five packages.
- `git diff --check`: passed. Tests used temporary homes, local git fixtures, and stubbed REST; no real GitHub or real `~/.moonbeam`. Test servers, timers, database processes, and fixture subprocesses stopped.

Acceptance criteria evidence:

1. S2/S3/V2: full fixture polling records GET-only HTTP and allowlisted git commands, excludes other branches/tags from the mirror, and verifies unchanged remote refs.
2. S5: default 300-second interval and configured scheduling are tested. Refresh works without selection. Same-instance callers share a promise; another instance waits for the active database transaction. Tests prove no overlapping source reads.
3. S5/F1: persisted rate limits suppress requests until the exact reset, including manual refresh and another scheduler. Unreachable retries use 5/10/20/30-minute backoff, capped at 30 minutes.
4. S6: unchanged heads skip fetch/history derivation and event-rule evaluation. Snapshot, source success, login cache, and sink writes commit together. A concurrent reader sees the complete old result while replacement is pending; a failing sink rolls all its writes back.
5. S7: failure tests compare the complete prior snapshot row, processed head, and successful poll time. Failure status changes neither the snapshot nor successful timestamps.
6. S8/F4: same-ID renames use the canonical location and record it without editing registration. Replacement IDs produce `identity_changed`, with no branch/content read.
7. F2/F3/F5: token rejection, inaccessible/missing repository, and missing branch retain stable since-times. Token replacement takes effect on the next poll. Missing versus unreadable configuration is distinguished without requests or flags.
8. F6/FL-10: reset/force-push fixtures produce both heads, detection time, dropped-commit count, changed-task IDs, and a fully rebuilt snapshot. Fast-forwards produce no FL-10; a removed baseline sets `baselineNeedsReset`.
9. F10: startup recreates deleted mirrors while preserving snapshots and Moonbeam data. Old snapshot versions rebuild without FL-10; intentional tracked-branch changes likewise reset without FL-10.
10. H9/N3/V3: five incremental fixture polls and a fresh registration at the final head produce deep-equal snapshots and evaluated flags, including subjects and evidence.
11. N4/V4: unreachable, timeout, rate limit, 401, 404, renamed/replaced repository, missing branch, and force push are simulated. Malformed files remain tolerable; another project keeps polling after a project failure. Shutdown drains active work and removes timers; SQL-error tests verify advisory locks are released.

Assumptions, deviations, and remaining limits:

- No path or dependency changes outside the authorized scope. Existing GitHub, DbC, schema, project, and identity implementations were reused unchanged. No installation, pnpm-store changes, or repository git write commands were performed.
- Repository lookup follows ADR-010's numeric-ID resolution with an ETag. Because the existing client maps an ID mismatch to `not_found`, a failed ID lookup performs a name-only metadata check to distinguish `identity_changed`.
- Source rows are initialized on first poll. Manual refresh bypasses unreachable backoff but never a rate limit; an absent rate-limit reset uses five minutes. A REST/fetch head race preserves the previous result and retries as unreachable.
- Pinning occurs after commit under the project lock with a cursor recheck. A pin failure emits a generic warning and retries on the next poll; the committed snapshot remains visible. Database and filesystem updates cannot be one atomic transaction.
- Flag records, dismissals, reconciliation, and their audits remain TASK-035. No implementation blockers remain. Independent review and board acceptance are outstanding.

**Dispatcher check:**

- Changes are within the task's paths. `node_modules` still uses the default
  pnpm store.
- Re-ran `pnpm typecheck` (passes) and `pnpm -r run test` (per-package counts
  below). No Postgres process left running.
- **Note for review:** a failed lookup by repository ID falls back to a
  name-only metadata check, to tell `identity_changed` from `not_found`. This
  fits S8: the repository is still never read under a different ID.

## Review

Not reviewed.
