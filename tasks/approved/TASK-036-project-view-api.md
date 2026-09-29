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

Not started.

## Review

Not reviewed.
