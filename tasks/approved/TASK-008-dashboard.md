# TASK-008: Dashboard

Owner role: UX specialist
Assigned agent:
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
