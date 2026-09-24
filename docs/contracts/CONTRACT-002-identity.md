# CONTRACT-002: Identity and permission interface

Status: Proposed
Approved by:
Approved date:
Related tasks: TASK-005
Related ADRs: ADR-003 (context: ADR-001, ADR-005)
Related contracts: CONTRACT-001 (consumes this contract; see its Q13)

## Purpose

Define how Moonbeam knows who is acting on every request, and how it decides
whether that actor may perform the requested action.

V1 has no login (ADR-003). A human chooses who they are from a user select, on
the honor system. The one boundary that must hold is between humans and
agents: an agent can never perform a human-only action, in any identity mode.
This contract makes that boundary reliable and keeps the identity layer small,
so a later global login integration replaces only this layer.

This contract is intentionally minimal. It does not try to make human
attribution trustworthy in V1. It makes the actor kind trustworthy for every
request that uses an agent credential, and it states plainly where that
guarantee ends (see "Known limits in V1").

## Scope

### Included

- The user registry: who the human users are, and how users are added,
  renamed, deactivated, and reactivated.
- Human user selection in the UI, and how the selected user is attached to
  requests.
- Agent run credentials: issued per run, bound to the run's task and project,
  and ending when the run ends.
- Actor kinds (human, agent, system) and how the server determines them.
- The permission check every action goes through, and its V1 policy
  (all-allow for humans, a fixed gate for agents).
- The replacement seam for a future login integration.

### Excluded

- Authentication of humans, login, passwords, PINs, and single sign-on (a
  future ADR and contract).
- Roles, RBAC, and any restriction of what a human may do.
- How runs are started, observed, and stopped, and how a runner delivers a
  credential to an agent process (future runs contract). This contract only
  requires that a run's credential reaches that run and nothing else.
- Git and repository credentials for run branches (ADR-005; future run
  branches contract). The agent run credential defined here is a credential
  for Moonbeam's own interface only.
- Lifecycle rules: which state transitions exist and their preconditions
  (CONTRACT-001).
- Network exposure. Moonbeam is deployed only on the office LAN (ADR-003); how
  that is enforced is a deployment concern.

## Actors

| Actor kind | Who | Determined by |
|---|---|---|
| **Human** | A board member. In V1 every active user in the registry is a board member with full authority (ADR-003). | A request that carries no agent credential and names an active user selected in the UI. |
| **Agent** | A specialist AI worker acting inside one run. Never a board member, never a user in the registry. | A request that carries an agent run credential. |
| **System** | Moonbeam itself, performing the automatic actions other contracts name. | Internal only. No request from any client ever resolves to the system actor. |

Rules:

- **R1 — Kind comes from the credential, not from a claim.** The server
  determines actor kind from how the request is made, never from a value the
  caller declares. There is no request field that sets the actor kind.
- **R2 — An agent credential always means agent.** A request that carries an
  agent credential is an agent request, even if it also names a human user. The
  named user is ignored for identity and authority purposes.
- **R3 — No fallback to human.** A request that carries an agent credential that
  is invalid, expired, or belongs to an ended run is rejected. It is never
  re-evaluated as a human request.
- **R4 — Agents are not users.** Agent identities never appear in the user
  registry or in the user select, and a user can never be given agent status or
  the reverse.

## Inputs and outputs

This contract has two core operations. Every other part of Moonbeam consumes
only their outputs.

### Resolve actor

- **Input:** an incoming request.
- **Output:** either a resolved **actor**, or rejection `unidentified`.

A resolved actor contains:

| Kind | Fields |
|---|---|
| Human | user id (stable, never reused), display name, identity mode (`selected` in V1) |
| Agent | run id, the task the run is bound to, project, agent role, model |
| System | the named trigger (for example `claim_expired`) |

### Check permission

- **Input:** a resolved actor, an action name, and the action's target (a
  project, a task, a user record, or a run).
- **Output:** `allow`, or `deny` with a failure category
  (`authority_violation` or `not_permitted`) and a human-readable reason.

The permission check answers only "may this actor perform this kind of action
on this target?" It does not evaluate lifecycle state. Lifecycle preconditions
are evaluated afterwards by the contract that owns the action (for example
CONTRACT-001).

## Preconditions

1. Moonbeam is reachable only from the office LAN (ADR-003).
2. The user registry contains at least one active user.
3. Every agent process that talks to Moonbeam was started as part of a run that
   a human started (CONTRACT-001, I14), and holds only that run's credential.

## Required behavior

### User registry

- The registry lists the human users. At setup it contains the six team
  members (names supplied by the board; see Q1).
- Each user has a stable user id and a display name. Display names are unique
  among active users, ignoring case and surrounding whitespace.
- **Add user:** any human may add a user by giving a display name. The new user
  is active and immediately selectable.
- **Rename user:** any human may change a user's display name. The user id does
  not change. Past records show the current display name (see Q6).
- **Deactivate user:** any human may deactivate a user. A deactivated user:
  - no longer appears in the user select and cannot act;
  - is still shown, marked inactive, wherever past records name them;
  - keeps any claims they hold. Those claims remain visible, marked with the
    inactive claimant, and any human may break them (CONTRACT-001, T4).
- **Reactivate user:** any human may reactivate a deactivated user, provided
  the display name is still unique among active users.
- **No deletion.** Users are never deleted, because the audit trail references
  them.
- **Last active user:** deactivating the only remaining active user is
  rejected.
- Agents may not add, rename, deactivate, or reactivate users.
- Every registry change is recorded with the acting human, the time, and the
  change (before and after values).

### Human user selection

- Before a person can perform any action in the UI, they must select a user
  from the list of active users. No password or PIN is asked for (ADR-003).
- The selection belongs to the browser it was made in. It persists across page
  reloads and restarts of that browser until the person changes it, clears it,
  or the selected user is deactivated.
- The currently selected user is visible at all times in the UI, and switching
  user is always one step away.
- Several browsers may have the same user selected at once.
- Every action a human performs through the UI carries the selected user. The
  server records that user as the actor (ADR-003, decision 1).
- If the selected user has been deactivated, the next action is rejected
  `unidentified` and the UI asks the person to select again.
- Viewing without a selected user: proposed, reading is allowed without a
  selection and every action requires one (see Q3).

### Agent run credentials

- **Issued per run.** When a run starts, Moonbeam issues exactly one credential
  for it. The credential identifies that run and, through it, the task the run
  is bound to, the project, the agent role, and the model.
- **Delivered only to the run.** The credential is handed to that run's agent
  process and to nothing else. Moonbeam never displays a credential value in any
  view, including the run view and transcripts (where it is masked if it
  appears), and never writes it into an audit record or a repository.
- **Bound to the run's task and project.** An agent request is permitted to act
  only on:
  - the task its run is bound to;
  - tasks that CONTRACT-001 lets an agent act on from that binding (for
    example the subtasks it creates by splitting its task, and new task
    proposals arising from it);
  - within the same project only.
  Any other target is denied `not_permitted`. The exact relationship rules per
  action (claimant, author, reviewer) are owned by CONTRACT-001.
- **Read access.** An agent credential may read the project its run belongs
  to, and no other project (proposed; see Q4).
- **Ends with the run.** The credential stops working the moment the run ends,
  whether it completes, fails, or is stopped. Every later request with it is
  rejected `unidentified` and is not re-evaluated as a human request (R3).
- **No renewal, no reuse.** A credential cannot be extended, transferred to
  another run, or reissued. A new run gets a new credential.
- **Self-inspection.** An agent may ask Moonbeam who it is acting as. The answer
  is its resolved actor (run, task, project, role, model).

### System actor

- The system actor exists only inside Moonbeam, for the automatic actions that
  other contracts name (for example CONTRACT-001, T5, T8, T12, T14, T16).
- No credential, header, selection, or other client input can produce a system
  actor. System actions are not requestable by any client.

### Permission check

Every action, from the UI or from an agent, goes through these steps in this
order:

1. **Resolve actor.** If it fails, reject `unidentified`. Nothing is evaluated
   further.
2. **Check permission.** If it denies, reject with its category. Nothing is
   evaluated further.
3. **Evaluate the action** under the contract that owns it (existence of the
   target, lifecycle state, and input validation).

Because the agent gate (step 2) comes before target and lifecycle evaluation,
an agent attempt at a human-only action is always rejected
`authority_violation`, whatever the target's state, and it is always recorded
as a rejected attempt (CONTRACT-001, "Audit record"). If the target does not
exist, the recorded attempt names the requested target.

#### V1 policy

- **Human:** allow every action. The permission check never denies a human in
  V1. (Lifecycle rules can still reject the action in step 3.)
- **Agent:** deny every **human-only action** with `authority_violation`. For
  every other action, allow only when the target is within the run's binding
  (see "Agent run credentials"); otherwise deny `not_permitted`.
- **System:** not evaluated through client requests.

#### Human-only actions

The following actions are human-only. This list is fixed. No configuration,
identity mode, or future roles model may grant any of them to an agent.

| Action | Source |
|---|---|
| Approve a task | ADR-003; CONTRACT-001 T2 |
| Accept a task, including waiving review and the merge that acceptance performs | ADR-003; CONTRACT-001 T9; ADR-005 |
| Return a task | CONTRACT-001 T10 |
| Reopen a subtask (if CONTRACT-001 keeps this action) | CONTRACT-001 T13 |
| Break another claimant's claim | CONTRACT-001 T4 |
| Cancel a task, beyond the cases CONTRACT-001 allows agents | CONTRACT-001 T15 |
| Start a run | CONTRACT-001, I14 |
| Add, rename, deactivate, or reactivate a user | This contract |

Other contracts may add actions to this list. They may not remove any.

### Replacement seam

The identity layer consists only of **resolve actor**, **check permission**,
the **user registry**, and **agent run credentials**. Everything else in
Moonbeam relies only on the resolved actor and the permission decision.

When global login is integrated:

- Only the way a **human** is resolved changes: a logged-in identity replaces
  the selected user, and the identity mode becomes `authenticated`.
- User ids stay stable. Existing users are linked to their global login
  identities, so past records keep pointing at the same people.
- The permission check may start restricting humans (roles). It may never
  allow an agent any human-only action.
- Agent run credentials, the system actor, and rules R1 to R4 do not change.
- No other contract's required behavior changes, except where a roles model
  deliberately restricts which humans may act.

### Recording the identity mode

Proposed (see Q5): every audit record with a human actor also records the
identity mode (`selected` in V1). Later, history can tell honor-system
attribution apart from authenticated attribution.

## Postconditions and invariants

- **ID1 — Agent gate.** No human-only action ever succeeds for a request that
  carries an agent credential, valid or not, whatever user it names and whatever
  identity mode is in effect.
- **ID2 — No kind escalation.** No request resolves to a more privileged actor
  kind than its credential allows. Agent credentials never resolve to human;
  no request resolves to system.
- **ID3 — Credential lifetime.** An agent credential resolves only while its run
  is active. After the run ends, it never resolves again.
- **ID4 — One run, one credential.** Each run has exactly one credential, and
  each credential identifies exactly one run.
- **ID5 — Binding.** A successful agent action targets only the run's own
  project and a task within the run's binding.
- **ID6 — Attribution.** Every successful action has exactly one resolved actor,
  and that actor is what the audit trail records.
- **ID7 — Stable users.** A user id is never deleted or reused. Every user named
  in a record remains resolvable to a display name.
- **ID8 — At least one active user.** The registry never has zero active users.
- **ID9 — Secrecy of credential values.** No credential value appears in any
  view, audit record, or repository write that Moonbeam produces.

## Failure behavior

Rejections change nothing. Categories are shared with CONTRACT-001, plus one
new category:

| Category | When |
|---|---|
| `unidentified` | No agent credential and no selected user; the selected user does not exist or is inactive; the agent credential is unknown, malformed, or belongs to a run that has ended. **New in this contract** (CONTRACT-001 needs to list it; see Q7). |
| `authority_violation` | An agent attempts a human-only action. Always recorded as a rejected attempt. |
| `not_permitted` | An agent targets something outside its run's binding (another task, another project, a user record). |
| `validation` | Registry input is invalid: empty display name, duplicate display name among active users, deactivating the last active user. |
| `not_found` | The user record being changed does not exist. |

Consistent with CONTRACT-001 (A12), `unidentified` rejections are not recorded
in the audit trail. Only `authority_violation` attempts are.

## Interfaces

Names are illustrative. Endpoints, storage, token format, and session mechanics
are implementation choices.

| Operation | Who may call | Result |
|---|---|---|
| resolve actor | internal, on every request | actor or `unidentified` |
| check permission | internal, on every action | allow, or deny with category |
| who am I | any request | the resolved actor (human: user and identity mode; agent: run, task, project, role, model) |
| list users | any human | active users (and, on request, inactive ones) |
| add / rename / deactivate / reactivate user | human only | the updated user record |
| select user / clear selection | UI, per browser | the selected user, or none |
| issue run credential | internal, at run start (runs contract) | one credential, delivered only to the run |
| end run credential | internal, at run end (runs contract) | the credential stops resolving |

## UX expectations

- The selected user's name is always visible in the UI header, with a one-step
  switch.
- Human-only actions show the acting user in their confirmation, for example
  "Approve as Patrick". This guards against acting as someone else on a shared
  machine.
- Human-only actions are never offered in an agent context (CONTRACT-001).
- When a selection becomes invalid (the user was deactivated), the UI asks the
  person to select again, and does not silently switch to another user.
- Records by inactive users show the name with an "inactive" marker.
- The user list is ordered by display name. Inactive users are hidden from the
  select and shown separately in user management.
- The run view shows which agent, role, and model a run acts as, never the
  credential value.

## Validation requirements

Implementation is accepted against this contract when automated tests show:

1. **Agent gate:** for every human-only action, a request with a valid agent
   credential is rejected `authority_violation` and recorded, including when the
   request also names a human user, and whatever the target's state.
2. **No fallback:** requests with an expired, ended-run, unknown, or malformed
   agent credential are rejected `unidentified`, including when they name a
   valid human user, and never succeed as a human.
3. **Credential lifetime:** a credential works while its run is active and
   stops working immediately when the run completes, fails, or is stopped.
4. **Binding:** an agent credential is denied `not_permitted` on another task
   outside its binding and on any other project.
5. **Human resolution:** an action with an active selected user succeeds as that
   user; with no selection or an inactive user it is rejected `unidentified`.
6. **Registry:** add, rename, deactivate, and reactivate behave as specified;
   duplicate names and deactivating the last active user are rejected
   `validation`; agents cannot change the registry; no user can be deleted.
7. **System actor:** no client input produces a system actor.
8. **Order of checks:** an agent attempt at a human-only action on a missing or
   wrongly-stated task returns `authority_violation`, not `not_found` or
   `invalid_transition`.
9. **Secrecy:** credential values do not appear in API responses other than the
   one that delivers them to the run, in audit records, or in rendered run
   views.
10. **Seam:** the rest of the server obtains the actor and permission decision
    only through resolve actor and check permission (verified by review of the
    implementation, not by test).

Board review of this contract is the validation for TASK-005 itself.

## Known limits in V1

These are accepted consequences of ADR-003, stated so nobody mistakes the V1
design for security.

- **Human attribution is honor-system.** "Approved by X" proves that someone
  selected X in a browser on the LAN.
- **An agent that ignores its credential can pose as the UI.** The agent gate
  (ID1) holds for every request that carries an agent credential. An agent
  process with network access that deliberately calls Moonbeam without its
  credential and names a human user cannot be told apart from a person in V1,
  because there is no human authentication. The mitigations in V1 are that
  runs are given only their own credential, that agent instructions forbid
  this, and that every such action is attributed to a named human who can see
  it. Closing this gap fully requires human authentication (global login).
  See Q2.

## Open questions

Each item states the proposed default used in this contract. The board may
accept or change it before approving the contract.

- **Q1 — Initial users.** The registry is seeded at setup with the six team
  members. Please supply the display names to seed (the owner, the office
  manager, two primary developers, two part-time developers).
- **Q2 — Agents posing as the UI.** Proposed: accept this as a known V1 limit
  (see "Known limits in V1"), as ADR-003 implies. Options for a cheap extra
  measure:
  - (A) **No extra measure** (proposed default).
  - (B) **Record the request origin** (the client's network address) on every
    human-only action, so an action coming from a dev box that runs agents is
    visible in the audit trail. Cheap, but it does not help when a developer
    also uses a browser on that dev box.
  - (C) **An office passphrase per browser**, entered once when a browser first
    selects a user, and never given to agents. This is lightweight
    authentication and would amend ADR-003 ("V1 has no authentication").
- **Q3 — Viewing without a selected user.** Proposed: anyone on the LAN can view
  the dashboard without selecting a user (useful for a wall display), and
  every action requires a selection. Alternative: require a selection even to
  view.
- **Q4 — Agent read scope.** Proposed: an agent run can read everything in its
  own project (other tasks, contracts, pause history) but nothing in other
  projects. Alternative: restrict reads to its own task and its linked
  contracts.
- **Q5 — Recording the identity mode.** Proposed: audit records with a human
  actor also record the identity mode (`selected` now, `authenticated` after
  login), so history distinguishes honor-system attribution. This adds a field
  to CONTRACT-001's audit record.
- **Q6 — Renamed users in history.** Proposed: past records show a user's
  current display name. Alternative: records keep the name as it was at the
  time of the action.
- **Q7 — Alignment with CONTRACT-001.** CONTRACT-001 is being revised in
  parallel. For consistency it needs to: list the `unidentified` failure
  category; confirm that the agent gate is evaluated before lifecycle state (so
  agent attempts on a human-only action always yield `authority_violation`);
  and settle whether "reopen subtask" still exists after its answer A2. The
  human-only list here follows CONTRACT-001 as approved and should be updated
  to match its revision.
- **Q8 — Who may manage users.** Proposed: any human, consistent with full
  authority for every board member in V1. Is that acceptable, or should user
  management wait for roles?
