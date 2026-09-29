# TASK-036: Per-project view API

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008, ADR-003
Dependencies: TASK-035

## Desired outcome

Read-only endpoints provide everything the per-project view shows (D1 to D10),
built from the stored snapshot, the flag records, and the current identity
mapping. File contents are read from the mirror at the snapshot's head.

## Context

The information is fixed by D1 to D9. The layout belongs to TASK-038. Every value
is as of the last successful poll (S7, N6).

## Scope

### Included

- **`server/src/views/project.ts`**, served at `GET /api/projects/:id/view`:
  - **D1:** name, GitHub link, tracked branch, head, last successful poll, source status and notices (F1 to F7: redirect, baseline needs resetting, write scopes, no DbC directories), lead developer or none, open flag count, v1 and non-v1 counts
  - **D2:** proposed tasks, with their first proposed entry and age
  - **D3:** approved tasks, with the most recent approved entry, the wait, whether FL-5 applies, `Assigned agent`, and each dependency's current state
  - **D4:** completed tasks from the last 30 days, and at least the 10 most recent; each with its acceptance commit (merged or direct), the acceptor, and the time from approval to acceptance
  - **D5:** tasks in `in-progress/` or `review/` on main, and removed tasks
  - **D6:** 12 weekly buckets of proposed, approved, and completed entries, commits, and flags raised
  - **D7:** open flags first
- **`GET /api/projects/:id/tasks`:** every task, including the full completed list.
- **`GET /api/projects/:id/tasks/:taskId`** (D8): parsed fields with their parse problems, labeled pre-v1 where they are (UX5); the full event history with mapped authors; the task's flags; a file reference.
- **`GET /api/projects/:id/documents`** (D9): project goals and the contract and ADR lists.
- **`GET /api/projects/:id/file?path=`** (R4): raw text at the snapshot head, with its head SHA and GitHub URL.
  - Only task files, contracts, ADRs, and `docs/PROJECT.md` known to the snapshot are served. Any other path is `not_found`.
  - Served as JSON, never as HTML.
- **R5:** related contract, ADR, and task IDs link when found on main. Otherwise they are marked "not found on main".
- **I6 and I7:** authors and recorded names are mapped at read time, and unmatched ones are shown as recorded.
- Before the first successful poll, the view reports "not yet read".
- `packages/shared/src/project-view.ts`.
- Tests against fixture repositories through the poller.
- `docs/DEVELOPMENT.md`.

### Excluded

- The UI (TASK-038).
- The cross-project dashboard (TASK-039).
- Any write endpoint.

### Paths

- `server/src/views/`
- `server/src/routes.ts`
- `server/src/test/project-view.test.ts`
- `packages/shared/src/project-view.ts`
- `packages/shared/src/index.ts`
- `docs/DEVELOPMENT.md`

## Plan

1. Shared schemas for each section.
2. Build the view from the snapshot, flags, identities, registration, and source status.
3. The task detail, documents, and file endpoints.
4. Tests for each D rule, then documentation.

## Acceptance criteria

- [ ] D1 to D7 are each present with the fields listed in CONTRACT-006. D4 applies both the 30-day rule and the at-least-10 rule (Q15).
- [ ] D8 returns all parsed fields and problems, the H3 and H4 history, the task's flags, and a file reference.
- [ ] D9 lists goals, contracts, and ADRs with their status. A missing `PROJECT.md` gives "No project definition found" (R3). Unreadable artifacts are marked, not flagged (R6).
- [ ] D10: the API adds no endpoint that changes a repository or GitHub.
- [ ] S7, N6, UX1: every response carries the head SHA and last successful poll time, plus a not-current indicator when the source status isn't `ok`.
- [ ] R4: file contents are returned as text in JSON, with the head and GitHub URL. Paths outside the snapshot's known files are refused.
- [ ] R5: links resolve, or are marked "not found on main".
- [ ] I6: changing identities changes the attribution shown on the next read, without a poll. I7: unmatched authors are marked "not a board member".
- [ ] UX5: pre-v1 files are labeled wherever their fields appear.
- [ ] The D6 buckets are rolling 7-day windows ending now (assumption, TASK-023 question 10).

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`). Record the counts.

## Risks and assumptions

- Reading file contents depends on the mirror, which the pinned ref keeps. If
  the mirror is missing, the file endpoint answers "not available until the
  next poll", and the rest of the view works.

## Blocker

None.

## Implementation handoff

Implemented TASK-036 in the shared `main` checkout. Ready for independent review; the task remains in-progress for the dispatcher and is not marked accepted.

Files changed:

- `server/src/views/project.ts`
- `server/src/routes.ts`
- `server/src/test/project-view.test.ts`
- `packages/shared/src/project-view.ts`
- `packages/shared/src/index.ts`
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-036-project-view-api.md` (Implementation handoff only).

Public API and endpoints:

- `ProjectViewsService.view/tasks/task/documents/file` builds read models using a read-only repeatable-read transaction and existing snapshot, identity, flag, and mirror APIs.
- `GET /api/projects/:id/view`: project header/notices, proposed and approved tasks, recently completed tasks, other states, weekly activity, and flags with open first.
- `GET /api/projects/:id/tasks`: every historical task, including the complete completed list.
- `GET /api/projects/:id/tasks/:taskId`: parsed files/problems, full event history, historical approval/completion entries, and task flags, including file-keyed FL-7.
- `GET /api/projects/:id/documents`: goals and contract/ADR metadata with file references.
- `GET /api/projects/:id/file?path=`: raw text in JSON from the snapshot head, or a read/cache availability status.
- Shared exports include response schemas/types for all five endpoints and their attribution, task, document, file, flag, and activity components. DEVELOPMENT.md documents response semantics and edge cases.

Validation performed with the instructed Node/pnpm PATH:

- `pnpm typecheck`: passed across all five packages.
- `pnpm -r --reporter=append-only run test`: 376 passed across 33 files: db 6, dbc 182, shared 4, server 163, UI 21. Per-package results inspected; no failures.
- `pnpm --filter @moonbeam/server exec vitest run`: separately passed, 163 tests across 13 files, including the database/API suite.
- `pnpm --filter @moonbeam/server exec vitest run src/test/project-view.test.ts`: 17 passed. The initial run had one timestamp-format assertion failure, corrected before final validation.
- `pnpm build`: passed across all five packages.
- `git diff --check`: passed. Tests used local git/HTTP fixtures, temporary homes, and isolated Postgres. No real GitHub or real `~/.moonbeam` access. All task-started servers, timers, and processes stopped.

Acceptance criteria evidence:

1. D1–D7: all sections are present, with source notices, lead developer, file/flag counts, recorded fields, proposal/approval entries and durations, dependencies, acceptance facts, other states, activity, and flag evidence/notes. Tests verify both completed-selection rules, including the exact 30-day boundary and the ten-task minimum.
2. D8: detail preserves all parsed fields, unknown fields, raw headers, Paths, parse problems, complete H3/H4 events with authors/committers, historical entry files, task flags, and file references. Re-approval tests verify duration uses the latest approval preceding first acceptance.
3. D9/R3/R6: goals, contracts, and ADRs expose metadata/status and file references; missing goals say `No project definition found`. Invalid UTF-8, oversized files, and unparseable documents are marked without creating artifact flags.
4. D10: only GET endpoints were added. Reads use no database mutations or GitHub calls; tests verify unchanged audits, source records, and remote refs.
5. S7/N6/UX1: responses carry head, last successful poll time, source status, and `notCurrent`. Tests cover pre-poll reads, incompatible caches, failures retaining prior data, and reads during atomic poll publication.
6. R4: exact snapshot allowlisting rejects arbitrary, ignored, traversal, malformed, and missing paths. Files return JSON text and immutable head/GitHub references. Missing mirrors leave other views usable.
7. R5: related contracts, ADRs, and task dependencies resolve against head files; missing and removed targets say `not found on main`.
8. I6/I7: current identity mapping applies on every read without polling, including historical authors, recorded names, and flag attribution. Tests cover inactive and ambiguous members; unmatched identities retain recorded values and say `not a board member`.
9. UX5: current and historical parsed task files carry explicit v1/non-v1 labels; unreadable task files remain visible.
10. D6: twelve rolling seven-day windows end at the request clock. Boundary tests verify `(start, end]` membership, entry/commit counts, and flag raises without double counting.

Assumptions and deviations:

- No scope/dependency deviations, installs, pnpm-store changes, or repository git write commands. Existing GitHub, DbC, schema, registration, identity, poller, and flag implementations were reused unchanged. The unrelated TASK-035 move from review to completed was left untouched.
- Ages/waits and FL-5 condition display use the last successful poll time; FL-5 uses the current registration threshold independently of dismissal. Completed recency and activity windows use the request clock. Recorded negative durations are preserved.
- Historical file references carry their historical SHA/GitHub URL; their API href is null unless they refer to the current snapshot head. Markdown rendering remains TASK-038.
- Unknown/removed projects return `not_found`. Missing/incompatible caches await the next poll; these read endpoints do not rebuild them.

Unresolved risks: no implementation blocker remains. Independent review, dispatcher commit/lifecycle movement, and board acceptance are outstanding.

**Dispatcher check:**

- Changes are within the task's paths.
- The route diff adds no POST, PUT, PATCH, or DELETE route, only GETs (D10).
- Re-ran `pnpm typecheck` (passes) and `pnpm -r run test`: 376 passed (db
  6, shared 4, dbc 182, ui 21, server 163).

## Review

Not reviewed.
