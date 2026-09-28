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

Not started.

## Review

Not reviewed.
