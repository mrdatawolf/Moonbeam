# TASK-005: CONTRACT-002: identity and permission interface

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-002 (Proposed, `docs/contracts/CONTRACT-002-identity.md`); CONTRACT-001 (consumer, see its Q13)
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

Contract designer (contract-architect), 2026-09-24.

- **Changed:** created `docs/contracts/CONTRACT-002-identity.md` with
  `Status: Proposed`. No other files were changed apart from this task file's
  "Related contracts" line and this section.
- **Contents:** actor kinds and rules R1 to R4 (kind comes from the credential;
  an agent credential always means agent; no fallback to human; agents are not
  users); the user registry (add, rename, deactivate, and reactivate, with no
  deletion); per-browser user selection; per-run agent credentials bound to the
  run's task and project and ending with the run; the two core operations
  (resolve actor and check permission) and their evaluation order; the V1
  policy (all-allow for humans, plus a fixed human-only list that no agent can
  ever be granted); the replacement seam for global login; invariants ID1 to
  ID9; the new `unidentified` failure category; validation requirements; and
  a section on known V1 limits.
- **Validated:** checked for consistency against ADR-003, ADR-005, PROJECT.md,
  and CONTRACT-001 as approved, including its board answers. Board review is
  the validation for this task.
- **Deviations or assumptions:** the human-only list follows CONTRACT-001 as
  approved. CONTRACT-001 is being revised in parallel, so the list may need to
  be realigned (see Q7 in the contract). "Start a run" and user management are
  classed as human-only, based on CONTRACT-001 I14 and ADR-003.
- **Risks:** an agent process that deliberately omits its credential can pose
  as a UI user. This cannot be prevented without human authentication. It is
  documented as a known V1 limit, and the board has options in Q2.
- **Open questions for the board:** Q1 to Q8 in the contract.

## Review

Not reviewed.
