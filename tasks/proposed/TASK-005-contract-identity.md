# TASK-005: CONTRACT-002: identity and permission interface

Owner role: Contract designer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by:
Approved date:
Related contracts: CONTRACT-002 (to be produced)
Related ADRs: ADR-003
Dependencies: None

## Desired outcome

An approved contract for how Moonbeam knows who is acting: how a human user is
selected in the UI, how an agent run authenticates, and the permission check
every action goes through. It must be replaceable later by global login.

## Context

CONTRACT-001 (Q13/A13) depends on the server reliably telling agent
credentials apart from UI user selection. V1 uses honor-system user select on
the LAN (ADR-003).

## Scope

### Included

- The user registry (the six team members; how users are added or removed).
- Session selection in the UI and how the actor is attached to requests.
- Agent run credentials: issued per run, scoped to the run's task, expiring
  when the run ends.
- The actor kinds (human, agent, system) and how the server determines them.
- The permission-check interface, all-allow for humans in V1.
- The replacement seam for a future login API.

### Excluded

- Roles and RBAC. Login integration.

### Paths

- `docs/contracts/CONTRACT-002-identity.md`

## Plan

## Acceptance criteria

- [ ] An agent credential can never be used to perform a human-only action.
- [ ] The interface is small enough that a future login integration replaces
      only it.

## Validation requirements

Board review.

## Risks and assumptions

Keep it minimal. The goal is the agent/human boundary, not security theatre.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
