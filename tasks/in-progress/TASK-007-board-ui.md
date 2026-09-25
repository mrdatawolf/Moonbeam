# TASK-007: Board UI: user select, projects, task board, decision queue

Owner role: UX specialist
Assigned agent: interface-designer
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001 (being superseded by CONTRACT-005), CONTRACT-002, CONTRACT-003 (status vocabulary, decision-queue groups, reusable parts)
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

## Scope boundaries at dispatch (dispatcher clarification, 2026-09-25)

These clarifications describe what this task means against the current
contracts and the API built in TASK-006. They do not widen it.

- **Build against the TASK-006 API.** See `docs/DEVELOPMENT.md` for the
  endpoints and the error mapping.
- **Editing a proposed task is out of scope.** CONTRACT-005 adds it, and
  TASK-016 builds it.
- **Follow CONTRACT-003 where it covers board screens:**
  - the status vocabulary (SV): tone, label, and glyph
  - the decision-queue groups that exist in phase 2: proposed tasks awaiting
    approval, tasks in review, blocked tasks, agent authority violations, and
    accepted but not merged
  - the reusable status badge
  - the accessibility and responsive rules
- **Out of scope:** runs, pauses, review content (phase 3), and the merge and
  push actions.
- **First-run setup and project registration screens are in scope,** using the
  TASK-006 endpoints.

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
