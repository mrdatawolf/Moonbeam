# TASK-016: Implement the CONTRACT-005 changes (edit a proposed task)

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick
Approved date: 2026-09-25
Related contracts: CONTRACT-005
Related ADRs: ADR-002
Dependencies: TASK-015 (CONTRACT-005 approved), TASK-007 (overlapping paths: `packages/shared`, `ui/`), TASK-017 (overlapping paths: `server/`, `packages/shared`; runs first)

## Desired outcome

The server and UI implement CONTRACT-005's changes relative to CONTRACT-001,
chiefly the "edit a proposed task" action. The code references CONTRACT-005
instead of CONTRACT-001.

## Scope additions (board, 2026-09-25)

The board added two items after approval, answering TASK-007's handoff
questions 1 and 2. They are included below.

## Scope

### Included

- The edit-proposed-task API, with its validation, authority, and audit.
- An edit form in the task detail UI for proposed tasks.
- Tests.
- Update contract references in code comments and docs.
- Confirm that the I9 behavior and the other recorded readings match
  CONTRACT-005. TASK-006 already built them, so only adjust them if they
  differ.
- **Allowed actions from the API (TASK-007 Q1):** the API reports, per task
  and acting user, which actions are allowed and the reason for each one that
  is not (CONTRACT-003 "Data each view needs"). The UI uses this instead of
  its own copy of the rules in `ui/src/lib/actions.ts`, which is removed.
- **Decision-queue groups (TASK-007 Q2):** the decision queue also shows the
  "Subtask findings" and "Fell back" groups that the API already returns.

### Excluded

- Anything else in CONTRACT-005 that is unchanged from CONTRACT-001.

### Paths

- `packages/shared/`
- `server/`
- `ui/`
- `docs/DEVELOPMENT.md`

## Plan

## Acceptance criteria

- [ ] A human or the authoring agent run can edit a proposed task. Everyone
      else is refused, and the refusal category matches CONTRACT-005.
- [ ] Edits after approval are refused.
- [ ] The UI takes allowed actions and refusal reasons from the API, including
      for the new edit action, and keeps no client-side copy of the rules.
- [ ] The decision queue shows the "Subtask findings" and "Fell back" groups.
- [ ] All tests pass.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. Manually edit a proposed task
in the UI.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
