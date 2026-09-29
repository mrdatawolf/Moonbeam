# TASK-033: Project registration, lead developer, and identities API

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-008, ADR-003, ADR-010
Dependencies: TASK-028, TASK-031, TASK-032

## Desired outcome

Board members can do the following through the API, every change audited with
the selected user:
- register GitHub repositories (S1, S8)
- change or remove a registration
- assign a lead developer (L1)
- manage identities (I1)
- see identity conflicts (I4)
- see configured token labels in masked form (S4)

## Context

This is the re-pointed registration that ADR-008 describes. Registration reads
GitHub once, through the TASK-032 `GitHubApi`, to record the repository ID and
the default baseline. Reads need no selected user. Actions do.

## Scope

### Included

- **`packages/shared/src/projects.ts` (new):** the registration view and input schemas.
- **`packages/shared/src/identities.ts`:** identity and conflict schemas.
- **`errors.ts`:** add `github_unavailable` (503).
- **`index.ts`:** exports.
- **`server/src/projects/service.ts`:**
  - `register({ owner, repo, name?, trackedBranch?, tokenLabel?, leadDeveloperUserId?, baselineSha?, exemptPaths?, staleThresholdDays? })`:
    - the token label defaults to the owner's label
    - resolves the repository with that token, recording the ID and the canonical owner and name
    - checks the branch exists
    - the baseline defaults to the head, or a given SHA is checked with `getCommit`; records `baseline_committed_at`
    - refuses a duplicate ID
  - `update`:
    - name, branch, token label, baseline, exempt paths, threshold
    - owner and name only when they resolve to the recorded ID (F4, Q16)
    - a branch change resets the baseline to the new head unless one is given
  - `setLeadDeveloper(userId | null)` (L1): must be an active user
  - `remove`: sets `removed_at` and hides the project from lists
  - every change writes an audit record with before and after
- **`server/src/identities/service.ts`:**
  - list members with their identities: the CONTRACT-002 e-mail marked automatic, plus stored e-mails, logins, and aliases
  - add an identity (validation: e-mail format; login `^[A-Za-z0-9-]{1,39}$`; alias non-empty, at most 200 characters)
  - remove an identity
  - conflicts from `findConflicts` (dbc)
  - each change audited
- **Routes:**
  - `GET /api/github/tokens` gives `{ state, tokens: [{ label, masked }] }`
  - `GET` and `POST /api/projects`
  - `GET`, `PATCH`, and `DELETE /api/projects/:id`
  - `PUT /api/projects/:id/lead-developer`
  - `GET /api/identities`
  - `POST /api/users/:id/identities`
  - `DELETE /api/identities/:id`
- Harness: an injectable fake `GitHubApi` and a temporary tokens file.
- `server/package.json` adds `@moonbeam/dbc`.
- Tests.
- `docs/DEVELOPMENT.md`: the endpoints and categories.

### Excluded

- Polling and source status (TASK-034).
- Flags and re-evaluation hooks (TASK-035).
- The UI (TASK-037).

### Paths

- `packages/shared/src/projects.ts`
- `packages/shared/src/identities.ts`
- `packages/shared/src/errors.ts`
- `packages/shared/src/index.ts`
- `server/src/projects/`
- `server/src/identities/`
- `server/src/registry.ts`
- `server/src/routes.ts`
- `server/src/index.ts`
- `server/src/test/harness.ts`
- `server/src/test/projects.test.ts`
- `server/src/test/identities.test.ts`
- `server/package.json`
- `pnpm-lock.yaml`
- `docs/DEVELOPMENT.md`
- `ui/src/lib/format.ts` and `server/src/test/identity.test.ts`: one-line
  fallout fixes only (board, 2026-09-29)

## Plan

1. Shared schemas and the new failure category.
2. The projects service, using the fake API in tests.
3. The identities service.
4. Routes, wiring, and documentation.

## Acceptance criteria

- [ ] S1: registration stores every S1 field with its default: branch `main`, baseline at head (Q3), no exempt paths, threshold 14.
- [ ] S1: registration and every change write an audit record with the selected user, and with before and after.
- [ ] S8: the numeric ID is recorded. Registering the same ID twice is `validation`.
- [ ] F4 and Q16: changing owner or name to a repository with a different ID is `validation` ("repository identity differs"). Moonbeam never updates a registration by itself.
- [ ] S4:
  - an unknown token label is `validation`
  - `GET /api/github/tokens` shows labels and masked values only
  - no response or audit record contains a token
- [ ] Registration failures are reported, and nothing is stored:
  - not found or inaccessible: `validation`, naming both causes (F3 wording)
  - branch missing: `validation`
  - token rejected: `validation`
  - GitHub unreachable or rate-limited: `github_unavailable`
- [ ] L1: assigning or clearing the lead developer is audited. Assigning an inactive or unknown user is refused.
- [ ] I1: identities are added and removed per member and audited. The CONTRACT-002 e-mail is listed as automatic and can't be removed here.
- [ ] I4: `GET /api/identities` lists every conflict with the members involved.
- [ ] Actions without a selected user are `unidentified`. Reads work without one.
- [ ] Removal hides the project. Its data and audit trail are kept (assumption, TASK-023 question 4).

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`). Record the counts.

## Risks and assumptions

- The branch-change and removal semantics are assumptions (TASK-023 questions 3 and 4).

## Blocker

None.

## Implementation handoff

Implemented API work; **blocked, not ready for review**. Implementation stopped when validation identified required changes outside the allowed paths, as instructed.

Required scope additions:
- `ui/src/lib/format.ts`: add the required `github_unavailable` category label to its exhaustive mapping. Without it, workspace typechecking fails.
- `server/src/test/identity.test.ts:143`: update the obsolete assertion that `/projects` is a removed route returning 404. The new authorized endpoint correctly returns 200.

Neither file was changed. `docs/DEVELOPMENT.md` endpoint/category documentation remains unfinished because implementation stopped at the first scope blocker.

Files changed:
- `packages/shared/src/projects.ts` (new)
- `packages/shared/src/identities.ts` (new)
- `packages/shared/src/errors.ts`
- `packages/shared/src/index.ts`
- `server/src/projects/service.ts` (new)
- `server/src/identities/service.ts` (new)
- `server/src/registry.ts`
- `server/src/routes.ts`
- `server/src/index.ts`
- `server/src/test/harness.ts`
- `server/src/test/projects.test.ts` (new)
- `server/src/test/identities.test.ts` (new)
- `server/package.json`
- `pnpm-lock.yaml`
- This task's Implementation handoff section only.

Public API:
- `GET /api/github/tokens`: `{ state: "ok" | "missing" | "unreadable", tokens: [{ label, masked }] }`.
- `GET /api/projects`: `{ projects: ProjectView[] }`; `GET /api/projects/:id`: a project view.
- `POST /api/projects`: accepts the assigned registration fields; returns a project view with HTTP 201.
- `PATCH /api/projects/:id`: accepts name, owner, repo, trackedBranch, tokenLabel, baselineSha, exemptPaths, and staleThresholdDays; returns the updated view.
- `DELETE /api/projects/:id`: soft removal, HTTP 204.
- `PUT /api/projects/:id/lead-developer`: `{ userId: UUID | null }`; returns the updated view.
- `GET /api/identities`: `{ members, conflicts }`; includes inactive members and automatic registry e-mails with `id: null` and `automatic: true`.
- `POST /api/users/:id/identities`: `{ kind: "email" | "login" | "alias", value }`; returns the stored identity with HTTP 201.
- `DELETE /api/identities/:id`: removes a stored identity, HTTP 204.
- Project views serialize `githubRepoId` as a decimal string and timestamps as ISO strings. `github_unavailable` maps to HTTP 503. Reads allow anonymous viewers; mutations use the existing selected-human actor seam.

Validation performed:
- Prepended `/home/patrick/.nvm/versions/node/v24.16.0/bin` to PATH. Initial pnpm installation/default dependency checks failed because the default store's SQLite file was unwritable. Installation succeeded with `CI=true pnpm install --store-dir /tmp/moonbeam-pnpm-store`; subsequent validation used `pnpm_config_verify_deps_before_run=false` (or the equivalent command option) to prevent automatic installation against the unwritable default store.
- `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts`: 53 passed, 4 files.
- `pnpm --filter @moonbeam/server exec vitest run src/test/projects.test.ts src/test/identities.test.ts`: 38 passed, 2 files.
- `pnpm typecheck`: failed on two TS2741 diagnostics in `ui/src/lib/format.ts` for the missing category. Shared, database, DbC, and server typechecks passed.
- `pnpm test`: 315 passed, 1 failed across 28 files. Breakdown: database 6, DbC 182, shared 4, UI 21 passed; server 102 passed and 1 failed. The failure is the obsolete `/projects` assertion above. The command returned exit 0 despite the reported failure; this is not a passing suite.
- `pnpm build`: passed for all five workspace packages.
- `pnpm --filter @moonbeam/server exec vitest run`: 102 passed, 1 failed across 8 files; the same obsolete route assertion. This command also returned exit 0 despite the reported failure.
- `git diff --check`: passed. No test server, Vitest, or Postgres process remained after validation.

Acceptance-criteria evidence:
- S1 defaults: registration stores canonical owner/repository, numeric ID, branch `main`, owner token label, head baseline and commit time, empty exempt paths, threshold 14, and optional lead developer. Explicit settings and supplied baseline lookups are tested.
- S1 audit: every registration mutation writes selected-user before/after values atomically with its data change. Creation uses `before: null`; removal retains the archived row as `after`.
- S8: active duplicate IDs are rejected as `validation`, including concurrent registrations through different names.
- F4/Q16: explicit owner/repository edits must resolve to the stored ID or return `repository identity differs`. Other remote checks resolve by numeric ID and do not silently rename the registration.
- S4: unknown labels are validation failures; token listing exposes only labels/masked values. Tests cover token replacement, missing/invalid configuration, response/audit secrecy, and exceptions containing a credential without logging or returning it.
- Failure handling: repository not-found errors name both absence and inaccessibility; missing branches/baselines and rejected credentials are validation failures; unreachable/rate-limited GitHub produces `github_unavailable`. Failed registration stores nothing; failed updates preserve prior fields and audit.
- L1: lead assignment and clearing are audited; inactive/unknown lead users are refused under the registry transaction lock.
- I1: validated e-mails, logins, and aliases can be added/removed with audits. Automatic registry e-mails are read dynamically and have no removable identity ID.
- I4: `findConflicts` supplies every conflict and involved members, including inactive members and conflicts with automatic e-mails/display names.
- Identity gate: mutation routes require a selected active user before parsing action input; reads work without selection.
- Removal: sets `removed_at`, hides the registration, retains snapshots and audits, and permits re-registration of the numeric ID.

Assumptions and deviations:
- Uses the approved branch-change reading: reset baseline to the new head unless supplied, clear the prior polling cursor/ETag, and retain the last snapshot. No polling, flag evaluation, mirror, matcher, or schema implementation was changed.
- Display name defaults to canonical `owner/repo`. Removed project detail/mutation requests return `not_found`. Duplicate stored identities for the same member/kind are validation failures; identities shared across members are allowed and reported as conflicts.
- Baseline validation uses `getCommit` as assigned; first-parent ancestry verification is not added here.
- Tests use an injectable GitHub stub, temporary token files/home directories, and the existing isolated embedded database harness. No real GitHub or real `~/.moonbeam` was used.
- No repository git write commands were run. Task lifecycle and acceptance remain with the dispatcher/board.

Unresolved work: authorize the two additional paths, fix the obsolete route test and missing UI label, finish `docs/DEVELOPMENT.md`, and rerun validation before review. Existing implementation remains in the shared checkout for continuation.

### Completion by the dispatcher (2026-09-29)

The board allowed the two out-of-path fixes, and Claude finished the task.

- `ui/src/lib/format.ts`: added the `github_unavailable` label ("GitHub
  unavailable").
- `server/src/test/identity.test.ts`: removed `/projects` from TASK-026's
  "removed routes return 404" list.
- `docs/DEVELOPMENT.md`: the endpoint table for tokens, projects, lead
  developer, and identities, plus the new failure details and the
  `github_unavailable` category.
- **Environment repair.** Codex's install used
  `--store-dir /tmp/moonbeam-pnpm-store`, because its sandbox can't write the
  default pnpm store. That left `node_modules` pointing at the temporary
  store, and every later `pnpm` run tried to reinstall and failed. The
  dispatcher deleted every `node_modules` (gitignored) and reinstalled offline
  from the default store. `pnpm-lock.yaml` changes only by the
  `@moonbeam/dbc` workspace link.
- **Validated:**
  - `pnpm typecheck`: passes.
  - `pnpm -r run test`: 316 passed (db 6, shared 4, dbc 182, ui 21, server
    103 across 8 files, including the database suite).
  - `pnpm build`: passes.

## Review

Not reviewed.
