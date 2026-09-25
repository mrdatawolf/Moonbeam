# CONTRACT-002: Identity and permission interface

Status: Approved
Approved by: Patrick
Approved date: 2026-09-24
Revised: 2026-09-24 (TASK-012; TASK-013); 2026-09-25 (TASK-014), see "Revision
history"
Related tasks: TASK-005, TASK-012, TASK-013, TASK-014
Related ADRs: ADR-003, ADR-007 (Proposed) (context: ADR-001, ADR-005 as
amended, ADR-006)
Related contracts: CONTRACT-001 (consumes this contract; see its Q13),
CONTRACT-004 (uses each user's name and e-mail address for the authorship of
merges they request)

## Revision history

### 2026-09-25 — TASK-014: project administration is human-only (Q9)

The board answered CONTRACT-004 Q24 on 2026-09-25, which also resolves Q9. This
revision applies it. It does not change the approval; the status word is now
"Approved", as in the other contracts.

- **Human-only actions:** setting or changing the projects root, registering a
  project, and relinking a project are added (CONTRACT-004 B13). An agent
  attempt is an audited `authority_violation`.
- **Accept anyway:** the "accept anyway" override for a known conflict
  (CONTRACT-001 T9, Q25) is named as part of accepting, so it is human-only
  like the rest of the accept.
- Q9 moved to "Resolved questions".

### 2026-09-24 — TASK-013: merge and push are human-only

The board amended ADR-005 (acceptance and merge are separate human steps) and
approved ADR-006 (Moonbeam never pushes unless a human asks). This revision
applies them. It does not change the approval.

- **Human-only actions:** "Merge a completed task into main" (CONTRACT-001 M1)
  and "Push main to its remote" (CONTRACT-004 B16) are added. The accept row no
  longer includes the merge and permanent record; they belong to the merge.
- **User registry and first-run setup:** a user's name and e-mail address are
  the git author of the merges that user requests (CONTRACT-004 B8, interim
  reading pending CONTRACT-004 Q22), rather than of the merges they accept.
- **System actor:** the examples include hand-merge detection (CONTRACT-001
  M2).
- New open question Q9, a cross-reference to CONTRACT-004 Q24(c).

### 2026-09-24 — TASK-012: board answers, round 1 sheet

The board answered `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`, following
every recommendation. This revision applies the answers that concern this
contract and aligns it with CONTRACT-001 as revised the same day. The contract
stays Proposed until the board approves it.

- **User registry (Board B1, C3):** the initial users are entered at first-run
  setup and are not named in this contract. Each user now has an e-mail address.
  Renamed users show their current name in history. Any human may manage users.
- **Viewing (Board B2):** anyone can view without choosing a user. Every action
  requires one.
- **Agent reads (Board A8):** an agent run may read its whole project and no
  other project.
- **Identity mode (Board A8):** audit records with a human actor record the
  identity mode `selected`.
- **Known limit (Board A8):** an agent that ignores its credential can pose as
  the UI. Accepted for V1, with no extra measure.
- **Alignment with CONTRACT-001 (Board A8):** the human-only list now matches
  CONTRACT-001's transitions: reopen is removed; review waiver and "move task in
  project queue" (D1) are added. CONTRACT-001 lists `unidentified` and states
  the order of checks.
- **Answering a pause** is listed as human-only. This follows from
  CONTRACT-001's definition of a pause as a question awaiting a human and from
  Board C5 ("the person answering"). It is called out here so the board can
  confirm it when approving.
- Q1–Q8 moved to "Resolved questions". No new open questions.

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

- The user registry: who the human users are, their display names and e-mail
  addresses, first-run setup, and how users are added, edited, deactivated, and
  reactivated.
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
- Git and repository credentials for task branches (ADR-005; CONTRACT-004). The
  agent run credential defined here is a credential for Moonbeam's own
  interface only.
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
| Human | user id (stable, never reused), display name, e-mail address, identity mode (`selected` in V1) |
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
2. The user registry contains at least one active user, except during
   first-run setup (see "User registry").
3. Every agent process that talks to Moonbeam was started as part of a run that
   a human started (CONTRACT-001, I14), and holds only that run's credential.

## Required behavior

### User registry

- The registry lists the human users. Each user has a stable user id, a display
  name, and an **e-mail address** (Board C3). The name and e-mail address are
  used as the git author of the merges into main that the user requests
  (CONTRACT-004 B8).
- Display names are unique among active users, ignoring case and surrounding
  whitespace. The e-mail address is required and must be a syntactically valid
  address.
- **First-run setup (Board B1):** when the registry has no users at all,
  Moonbeam offers first-run setup and nothing else. The person setting up enters
  the initial users (for this team, its six board members), each with a display
  name and e-mail address. This contract does not name them. Setup ends when at
  least one user exists; from then on, users are managed only through the
  operations below. Registry changes made during setup are recorded with the
  actor "first-run setup", because no user can be selected yet.
- **Add user:** any human may add a user by giving a display name and e-mail
  address (Board B1). The new user is active and immediately selectable.
- **Edit user:** any human may change a user's display name or e-mail address.
  The user id does not change. Past records in Moonbeam show the user's
  **current** display name (Board B1). Git commits already made keep the name
  and address they were made with, because repository history is never
  rewritten (CONTRACT-004).
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
- Agents may not add, edit, deactivate, or reactivate users, and cannot perform
  first-run setup.
- Every registry change is recorded with the acting human (or "first-run
  setup"), the time, and the change (before and after values).

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
- **Viewing without a selected user (Board B2):** anyone on the LAN can view
  every screen without selecting a user. Every action requires a selection.

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
    example the subtasks it adds to its task's parent, as a claimant or as a
    reviewer, and new task proposals arising from it);
  - within the same project only.
  Any other target is denied `not_permitted`. The exact relationship rules per
  action (claimant, author, reviewer) are owned by CONTRACT-001.
- **Read access (Board A8):** an agent credential may read everything in the
  project its run belongs to (other tasks, contracts, pause history), and
  nothing in any other project.
- **Ends with the run.** The credential stops working the moment the run ends,
  whether it finishes, fails, or is stopped. Every later request with it is
  rejected `unidentified` and is not re-evaluated as a human request (R3).
- **No renewal, no reuse.** A credential cannot be extended, transferred to
  another run, or reissued. A new run gets a new credential.
- **Self-inspection.** An agent may ask Moonbeam who it is acting as. The answer
  is its resolved actor (run, task, project, role, model).

### System actor

- The system actor exists only inside Moonbeam, for the automatic actions that
  other contracts name (for example CONTRACT-001 T5, T8, T12, T14, T16, the
  integration blocker in C1, and hand-merge detection in M2).
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
   target, lifecycle state, input validation, and any repository step).

Because the agent gate (step 2) comes before target and lifecycle evaluation,
an agent attempt at a human-only action is always rejected
`authority_violation`, whatever the target's state, and it is always recorded
as a rejected attempt (CONTRACT-001, "Audit record"). If the target does not
exist, the recorded attempt names the requested target. CONTRACT-001 states
the same order in its "Failure behavior".

#### V1 policy

- **Human:** allow every action. The permission check never denies a human in
  V1. (Lifecycle rules can still reject the action in step 3.)
- **Agent:** deny every **human-only action** with `authority_violation`. For
  every other action, allow only when the target is within the run's binding
  (see "Agent run credentials"); otherwise deny `not_permitted`.
- **System:** not evaluated through client requests.

#### Human-only actions

The following actions are human-only. This list is fixed. No configuration,
identity mode, or future roles model may grant any of them to an agent. It
matches CONTRACT-001 and CONTRACT-004 as revised on 2026-09-24 (TASK-012,
TASK-013) and 2026-09-25 (TASK-014).

| Action | Source |
|---|---|
| Approve a task | ADR-003; CONTRACT-001 T2 |
| Accept a task, including "accept anyway" for a known conflict (a recorded override, ADR-007). Accepting does not merge (ADR-005 amendment). | ADR-003; CONTRACT-001 T9 (Q25) |
| Merge a completed task into main, including the permanent record written with the merge | ADR-005 amendment; ADR-006; CONTRACT-001 M1; CONTRACT-004 B7, B9 |
| Push main to its remote | ADR-006; CONTRACT-004 B16 |
| Waive the agent review when accepting | CONTRACT-001 T9 (A5) |
| Return a task, including adding subtasks as part of the return | CONTRACT-001 T10 |
| Move a task in the project queue | CONTRACT-001 D1 (Board A3) |
| Break another claimant's claim | CONTRACT-001 T4 |
| Cancel a task, beyond the cases CONTRACT-001 allows agents | CONTRACT-001 T15 |
| Start a run | CONTRACT-001, I14 |
| Answer a pause, including correcting its category | CONTRACT-001 definition of "paused" (a question awaiting a human); Board C5 |
| First-run setup; add, edit, deactivate, or reactivate a user | This contract |
| Set or change the projects root; register a project; relink a project | CONTRACT-004 B13 (Board, 2026-09-25, Q24; resolves Q9) |

Reopening a subtask is no longer an action: CONTRACT-001 removed T13.

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

Every audit record with a human actor also records the identity mode (Board
A8): `selected` in V1, `authenticated` after global login. History can then
tell honor-system attribution apart from authenticated attribution.
CONTRACT-001's audit record carries this field.

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
  and that actor is what the audit trail records, with the identity mode for a
  human.
- **ID7 — Stable users.** A user id is never deleted or reused. Every user named
  in a record remains resolvable to a current display name.
- **ID8 — At least one active user.** Once first-run setup has ended, the
  registry never has zero active users.
- **ID9 — Secrecy of credential values.** No credential value appears in any
  view, audit record, or repository write that Moonbeam produces.

## Failure behavior

Rejections change nothing. Categories are shared with CONTRACT-001, which lists
all of them, including `unidentified` defined here:

| Category | When |
|---|---|
| `unidentified` | No agent credential and no selected user; the selected user does not exist or is inactive; the agent credential is unknown, malformed, or belongs to a run that has ended. |
| `authority_violation` | An agent attempts a human-only action. Always recorded as a rejected attempt. |
| `not_permitted` | An agent targets something outside its run's binding (another task, another project, a user record). |
| `validation` | Registry input is invalid: empty display name, duplicate display name among active users, missing or malformed e-mail address, deactivating the last active user. |
| `not_found` | The user record being changed does not exist. |
| `invalid_transition` | First-run setup is requested when the registry already has users. |

Consistent with CONTRACT-001 (A12), `unidentified` rejections are not recorded
in the audit trail. Only `authority_violation` attempts are.

## Interfaces

Names are illustrative. Endpoints, storage, token format, and session mechanics
are implementation choices.

| Operation | Who may call | Result |
|---|---|---|
| resolve actor | internal, on every request | actor or `unidentified` |
| check permission | internal, on every action | allow, or deny with category |
| who am I | any request | the resolved actor (human: user, e-mail, and identity mode; agent: run, task, project, role, model) |
| first-run setup | anyone, only while the registry has no users | the initial user records |
| list users | any human, and any viewer (Board B2) | active users (and, on request, inactive ones) |
| add / edit / deactivate / reactivate user | human only | the updated user record |
| select user / clear selection | UI, per browser | the selected user, or none |
| issue run credential | internal, at run start (runs contract) | one credential, delivered only to the run |
| end run credential | internal, at run end (runs contract) | the credential stops resolving |

## UX expectations

- The selected user's name is always visible in the UI header, with a one-step
  switch. Viewing needs no selection; action controls without a selection say
  "Choose who you are to take this action".
- Human-only actions show the acting user in their confirmation, for example
  "Approve as Patrick". This guards against acting as someone else on a shared
  machine.
- Human-only actions are never offered in an agent context (CONTRACT-001).
- When a selection becomes invalid (the user was deactivated), the UI asks the
  person to select again, and does not silently switch to another user.
- Records by inactive users show the current name with an "inactive" marker.
- The user list is ordered by display name. Inactive users are hidden from the
  select and shown separately in user management, which also shows e-mail
  addresses.
- First-run setup explains that the users entered become the board members who
  approve and accept work, and that each e-mail address is used as the git
  author of the merges into main that person requests.
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
   stops working immediately when the run finishes, fails, or is stopped.
4. **Binding:** an agent credential is denied `not_permitted` on another task
   outside its binding and on any other project, for reads and writes. Reads
   within its own project are allowed.
5. **Human resolution:** an action with an active selected user succeeds as that
   user and is recorded with identity mode `selected`; with no selection or an
   inactive user it is rejected `unidentified`. Reading without a selection is
   allowed.
6. **Registry:** first-run setup is available only while the registry is empty;
   add, edit, deactivate, and reactivate behave as specified; duplicate names,
   missing or malformed e-mail addresses, and deactivating the last active user
   are rejected `validation`; agents cannot change the registry; no user can be
   deleted; a renamed user's current name appears on past records.
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
- **An agent that ignores its credential can pose as the UI (Board A8: accepted
  as a known V1 limit).** The agent gate (ID1) holds for every request that
  carries an agent credential. An agent process with network access that
  deliberately calls Moonbeam without its credential and names a human user
  cannot be told apart from a person in V1, because there is no human
  authentication. V1 adds no extra measure. The mitigations are that runs are
  given only their own credential, that agent instructions forbid this, and
  that every such action is attributed to a named human who can see it. The
  real fix is human authentication (global login).

## Open questions

None. All questions have been answered by the board (see "Resolved
questions").

## Resolved questions

- **Q9 — Project administration actions.** Asked whether setting the projects
  root, registering a project, and relinking a moved project are added to the
  human-only list (CONTRACT-004 Q24(c)). Proposed default: yes.
  Board, 2026-09-25: registering and relinking projects, and changing the
  projects root, are human-only actions.
  *Applied (TASK-014):* Human-only actions; CONTRACT-004 B13, Interfaces.

- **Q1 — Initial users.** Please supply the display names to seed (the owner,
  the office manager, two primary developers, two part-time developers).
  Board B1, 2026-09-24: "follow the recommendation". No names were supplied.
  *Applied:* User registry. The users are entered at first-run setup, with
  display names and e-mail addresses, and are not named in this contract.
- **Q2 — Agents posing as the UI.** Options: (A) no extra measure; (B) record
  the request origin; (C) an office passphrase per browser.
  Board A8, 2026-09-24: (A), accept this as a known V1 limit. Global login is
  the real fix.
  *Applied:* Known limits in V1.
- **Q3 — Viewing without a selected user.** Proposed: anyone on the LAN can view
  without selecting a user, and every action requires a selection.
  Board B2, 2026-09-24: follow the recommendation. Anyone can view; every action
  requires choosing a user.
  *Applied:* Human user selection, Interfaces, UX, validation item 5.
- **Q4 — Agent read scope.** Proposed: an agent run can read everything in its
  own project but nothing in other projects.
  Board A8, 2026-09-24: an agent may read its whole project, and no other
  project.
  *Applied:* Agent run credentials (read access), validation item 4.
- **Q5 — Recording the identity mode.** Proposed: audit records with a human
  actor also record the identity mode.
  Board A8, 2026-09-24: yes, audit records note that the identity was
  "selected".
  *Applied:* Resolve actor, Recording the identity mode, ID6, validation item
  5; CONTRACT-001 "Audit record".
- **Q6 — Renamed users in history.** Proposed: past records show a user's
  current display name.
  Board B1, 2026-09-24: yes.
  *Applied:* User registry (edit user), ID7, UX. Git history keeps the name it
  was written with.
- **Q7 — Alignment with CONTRACT-001.** CONTRACT-001 needs to list
  `unidentified`, confirm that the agent gate is evaluated before lifecycle
  state, and settle whether "reopen subtask" still exists.
  Board A8, 2026-09-24: just apply it in TASK-012.
  *Applied:* Human-only actions (reopen removed; review waiver and queue move
  added; the list matches CONTRACT-001), Permission check, Failure behavior;
  CONTRACT-001 "Failure behavior" lists `unidentified` and the order of checks.
- **Q8 — Who may manage users.** Proposed: any human.
  Board B1, 2026-09-24: yes (full authority in V1).
  *Applied:* User registry.
