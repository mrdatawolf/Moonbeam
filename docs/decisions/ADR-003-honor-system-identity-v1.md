# ADR-003: Honor-system identity and full board authority in V1

Status: Approved; superseded in part by ADR-008 (2026-09-28), see the amendment at the end
Date: 2026-09-24
Decision owners: Board
Related tasks and contracts: none yet

## Context

Moonbeam runs on the office LAN for a six-person team. Roles and abilities have
not been formalized yet. A global login system exists or is planned and will
later be integrated through an API.

## Decision

1. V1 has no authentication. The UI offers a simple user select, and the chosen
   user is recorded as the actor on every action.
2. Every user is a board member with full authority: propose, approve, claim,
   work, return, and accept, including accepting work they claimed themselves.
3. **Agents are never board members.** The server rejects approval and
   acceptance actions from agent credentials regardless of identity mode. This
   is the one gate that is enforced in V1.
4. Identity sits behind a small interface (current actor plus a permission
   check), so a later login integration and a roles model replace only that
   layer.

## Alternatives considered

- **PINs on approve and accept actions.** Deferred. It adds friction without
  real security while the network is trusted.
- **Formal roles now.** Deferred until the team has used the workflow.

## Consequences

### Benefits

- Zero login friction. Everyone can act immediately.
- The audit trail still records the claimed actor for each decision.

### Costs and risks

- Attribution is honest only by convention. "Approved by X" proves that
  someone selected X.
- Moonbeam must not be exposed beyond the LAN until authentication exists.

## Follow-up work

- A contract for the identity and permission interface.
- A future ADR for global login integration and roles.

## Amendment — 2026-09-28: superseded in part by ADR-008

Recorded by TASK-022. The decision text above is left as approved. ADR-008
(Approved, 2026-09-28) amends this ADR:

- **Decision 1 stands.** Honor-system identity and the user select stay.
- **Decision 2 no longer describes Moonbeam actions.** Under ADR-008, board
  members propose, approve, and accept in the project repository, not in
  Moonbeam. Moonbeam is read-only toward repositories. Actions inside Moonbeam
  (registering a project, assigning a lead developer, managing identities,
  dismissing a flag) still need a selected user (CONTRACT-006).
- **Decision 3 no longer has an object.** Agents do not use Moonbeam at all, so
  there are no agent credentials for the server to refuse.
- **Decision 4 stands.** The identity seam is kept (CONTRACT-002, kept parts).
