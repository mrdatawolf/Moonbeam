# TASK-007: Board UI: user select, projects, task board, decision queue

Owner role: UX specialist
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001, CONTRACT-002
Related ADRs: ADR-002, ADR-003
Dependencies: TASK-006 (overlapping paths: `packages/shared`)

## Desired outcome

A board member picks who they are, sees projects and their tasks by state,
performs the human transitions (approve, accept, return, cancel, claim,
release), and sees a decision queue of everything that needs a human.

## Context

Phase 2 board surface. Follow Paperclip's layered disclosure and systematic
status vocabulary. Paperclip's code may be adapted under its MIT license with
attribution.

## Scope

### Included

- A user picker persisted per browser.
- A project list and project creation or registration.
- A task list and board by state, with task detail.
- Proposing tasks from the UI.
- Transition actions.
- The decision queue.

### Excluded

- The dashboard (TASK-008). Run and review views (phase 3).

### Paths

- `ui/`
- `packages/shared/`

## Plan

## Acceptance criteria

- [ ] Every human transition is available only when the API allows it.
- [ ] The decision queue lists proposed tasks awaiting approval, tasks in
      review, and blocked tasks.

## Validation requirements

Manual walkthrough of a task from proposed to completed. UI build passes.

## Risks and assumptions

If shadcn/Radix is introduced, record it in `docs/DEVELOPMENT.md`.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
