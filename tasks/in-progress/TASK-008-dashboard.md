# TASK-008: Dashboard

Owner role: UX specialist
Assigned agent: openai-coder (Codex)
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001
Related ADRs: ADR-002
Dependencies: TASK-007 (overlapping paths: `ui/`)

## Desired outcome

A cross-project dashboard that answers: what is happening, what needs me, and
what changed recently. It shows task counts by state per project, the decision
queue summary, active claims, and recent audit events.

## Context

The board named the dashboard a top-priority screen, modeled on Paperclip's.

## Dispatch clarifications (dispatcher, 2026-09-28)

These describe the task against the current code. They do not widen it.

- CONTRACT-005 superseded CONTRACT-001. Use CONTRACT-005's state and
  decision-queue vocabulary, and CONTRACT-003's status vocabulary (SV) and
  status badge, as the board UI already does.
- Build on the accepted board UI (TASK-007, TASK-016). Reuse the existing
  decision-queue and task endpoints where they are enough.
- `packages/shared/` is not in this task's paths. If a new aggregate route
  needs a shared response schema, stop and ask; don't add one silently.
- The dashboard is for humans and viewers. Any new route must still give
  agents no user e-mail addresses (TASK-017 N1).
- Replace the placeholder `ui/src/pages/Dashboard.tsx`. Its "System health"
  card may stay.

## Scope

### Included

- A dashboard page.
- Any read-only aggregate API endpoints it needs.

### Excluded

Costs and run activity (added once runs exist).

### Paths

- `ui/`
- `server/` (read-only aggregate routes only)

## Plan

## Acceptance criteria

- [ ] The dashboard reflects state changes without a manual reload (polling or
      realtime).

## Validation requirements

Manual check against seeded data.

## Risks and assumptions

Keep the widget set small. Runs will add more later.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
