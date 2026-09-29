# TASK-039: Cross-project dashboard

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: TASK-036, TASK-038

## Desired outcome

The dashboard at `/` gives the top-down view across projects that ADR-008 asks
for. It summarizes only data that CONTRACT-006 defines.

## Context

CONTRACT-006 excludes the dashboard but allows it to summarize the contract's
data under its own task. The content below is a proposal for the board to
adjust.

## Scope

### Included

- `GET /api/dashboard`, one row per project:
  - name, lead developer
  - source status, head, and last poll
  - proposed and approved counts
  - the count of stale approvals (open FL-5)
  - the open flag count
  - completions in the last 30 days
- The 10 most recent acceptances and the 10 most recently raised flags, across projects.
- The dashboard page, which replaces the TASK-026 placeholder and links into the project views.
- Tests.
- `docs/DEVELOPMENT.md`.

### Excluded

- New data or rules.
- Cosmetic polish.

### Paths

- `server/src/views/dashboard.ts`
- `server/src/routes.ts`
- `server/src/test/dashboard.test.ts`
- `packages/shared/src/dashboard.ts`
- `packages/shared/src/index.ts`
- `ui/src/pages/Dashboard.tsx`
- `ui/src/pages/dashboard.test.tsx`
- `ui/src/api/queries.ts`
- `docs/DEVELOPMENT.md`

## Plan

1. Server aggregation from snapshots, sources, and flags.
2. Shared schema.
3. The UI page and its tests.

## Acceptance criteria

- [ ] Every value comes from a snapshot, source status, flag record, or registration. No task state is kept beyond these (N2).
- [ ] Each project row shows its head and poll time, and says when the data isn't current (UX1, N6). Source status and flags are distinct (UX2).
- [ ] A project that has never been polled, or that is failing, appears with its status and doesn't hide other projects (N4).
- [ ] There are no controls that imply repository actions (D10, UX6).
- [ ] The UI tests pass, including axe checks. The server tests pass.

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`).

## Risks and assumptions

- The dashboard content is a proposal. The board may reshape it before approval.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
