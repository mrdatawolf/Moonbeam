# CONTRACT-001: Task lifecycle, claims, and splits

Status: Proposed
Approved by:
Approved date:
Related tasks: TASK-002
Related ADRs: ADR-001, ADR-003 (context: ADR-004)

## Purpose

Define the observable behavior of a Moonbeam task from creation to a terminal
state: the lifecycle states, the transitions between them, who may perform each
transition, the claim that grants exclusive right to work a task, the split of a
task into subtasks within its scope envelope, the blocked and paused conditions,
and the audit record every transition produces.

Moonbeam's database is the single authority for this state (ADR-001). The data
model, the server API, and the decision queue UI are built against this
contract. The one gate that is enforced regardless of identity mode — agents
never approve and never accept (ADR-003) — is specified here as an invariant.

## Scope

### Included

- Lifecycle states: `proposed`, `approved`, `in_progress`, `in_review`,
  `completed`, `cancelled`.
- Conditions (not states): `blocked`, `paused`.
- Every transition: preconditions, postconditions, allowed actors, audit record.
- Claims: exclusivity, release, expiry, and interaction with conditions.
- Splits: subtask creation, scope-envelope narrowing, automatic approval,
  subtask review and completion, parent entry into review, parent acceptance,
  parent return with optional subtask reopening.
- Cancellation, including cascade to subtasks.
- Failure behavior: illegal transitions, authority violations, concurrent races.

### Excluded (boundaries only)

- **Runs** — how an agent run is started, observed, stopped, and ended. This
  contract only relies on: an agent acts only within a run; a run is started by
  a human action; a run is bound to one task; a run can end with or without a
  handoff. (Future runs contract.)
- **Pauses in detail** — categories, questions, answers, and pause review. This
  contract only defines how the `paused` condition interacts with lifecycle and
  claims. (Future pauses contract.)
- **Repository write-back** — writing the task file into a working checkout
  and writing the permanent record at acceptance, including commit policy and
  write failures. (Future write-back contract.)
- **Identity and permission interface** — how the server knows the current
  actor and whether it is a human or an agent (ADR-003 follow-up contract). This
  contract assumes that interface exists and is trustworthy about actor *kind*.
- Handoff and review document content, beyond their existence as records.
- Scope-envelope editing workflows beyond what is stated in "Scope envelope".
- Visual design of the dashboard and decision queue.

## Actors

| Actor kind | Who | Identified by |
|---|---|---|
| **Human** | Any board member. In V1 every user is a board member with full authority (ADR-003). | The user chosen in the user select. |
| **Agent** | A specialist AI worker acting inside a run. Never a board member. | The server-recognized agent credential plus the run it acts in. |
| **System** | Moonbeam itself, performing only the automatic transitions this contract names. | A system actor plus the named trigger. |

Rules for actor kind:

- Actor kind is determined by the server from how the request is authenticated,
  never from a value the caller declares. A request made with agent
  credentials is an agent action even if it names a human user.
- The system actor never performs a transition that this contract reserves for
  humans (approve a top-level task, accept, return, reopen, cancel an approved
  task on its own initiative). Its automatic subtask approval is derived from a
  human approval of the parent, and is recorded as such.

Roles referenced below:

- **Claimant** — the human or agent run that holds the active claim on a task.
- **Author** — the actor that created a task.
- **Reviewer** — an agent run that records a review of a handed-off task. It
  must not be the claimant whose work it reviews.

## Inputs and outputs

Inputs are **actions** requested by an actor against a task (see
"Interfaces"). Every action is evaluated against the task's current state at the
moment it is applied.

Outputs for every action are one of:

- **Success** — the resulting task state and conditions, the claim (if any), the
  affected subtasks/parent, and the audit record(s) produced.
- **Rejection** — a failure category (see "Failure behavior") with a
  human-readable reason. A rejected action changes nothing.

## Definitions

- **Top-level task** — a task with no parent.
- **Subtask** — a task created by a split. In V1 splits are one level deep (see
  Open questions).
- **Split parent** — a task that has at least one subtask.
- **Leaf task** — a task with no subtasks.
- **Terminal state** — `completed` or `cancelled`.
- **Subtask done** — a subtask in a terminal state.
- **Active claim** — a claim that has not been released, expired, or ended.
- **Scope envelope** — a task's inclusions, exclusions, linked contracts, and
  constraints (PROJECT.md domain language).
- **Blocker** — a record stating what is needed, who can resolve it, and its
  effect. A task is `blocked` while it has at least one open blocker, or while
  its parent is blocked ("effectively blocked", see C1).
- **Paused** — a run on the task has an open pause (question awaiting a human).

## Preconditions

Global preconditions for any action:

1. The task exists and belongs to a registered project.
2. The actor kind is resolved by the server (human, agent, or system).
3. An agent action names the run it is acting in, the run is active, and the run
   is bound to the task being acted on (or, for creation, to the task from
   which the proposal arises). Runs are started only by a human action; there
   are no scheduled or self-waking agents.

Action-specific preconditions are in the transition table.

## Required behavior

### States

| State | Meaning | Claim |
|---|---|---|
| `proposed` | A plan exists. Work is not authorized. | Never |
| `approved` | A human authorized the scope (directly, or via the parent for subtasks). Ready to be claimed. | None |
| `in_progress` | Being worked. For a leaf task: exactly one active claim. For a split parent: no claim; work proceeds through non-done subtasks. | Leaf: exactly one. Split parent: see invariant I4. |
| `in_review` | Work has been handed off (leaf) or all subtasks are done (split parent). Awaiting review and, for top-level tasks, human decision. | None |
| `completed` | Top-level: a human accepted it. Subtask: an independent agent review was recorded. | None |
| `cancelled` | Work stopped by decision. | None |

`completed` and `cancelled` are terminal. The only exit from a terminal state is
**reopen subtask** (T13), which applies to completed subtasks of a non-terminal
parent.

### Transition table

"Human" means any board member. "Claimant" means the actor holding the active
claim. Every transition produces an audit record (see "Audit record"). Unless
stated otherwise, a transition is rejected when its preconditions do not hold.

| ID | Action | From → To | Allowed actors | Key preconditions |
|---|---|---|---|---|
| T1 | Create | (none) → `proposed` | Human; Agent (in a run) | Required fields present. |
| T2 | Approve | `proposed` → `approved` | **Human only** | Top-level task; scope envelope and acceptance criteria present. |
| T3 | Claim | `approved` → `in_progress` | Human; Agent (in a run) | No active claim; not a split parent with non-done subtasks; agent: not blocked. |
| T4 | Release claim | `in_progress` → `approved` | Claimant (human or agent); any Human (breaking another's claim) | Active claim exists. |
| T5 | Claim ends automatically | `in_progress` → `approved` | System | Claim expired, or the claiming run ended without handoff. |
| T6 | Hand off | `in_progress` → `in_review` | Claimant only | Handoff record present; not blocked; not paused. |
| T7 | Record review | `in_review` → `in_review` (top-level) | Agent reviewer (in a run) | Reviewer is not the claimant whose work is reviewed. |
| T8 | Subtask completes on review | `in_review` → `completed` (subtask) | System | T7 recorded on a subtask; subtask not blocked. |
| T9 | Accept | `in_review` → `completed` | **Human only** | Top-level task; no non-done subtasks; not blocked; review requirement met (see T9). |
| T10 | Return | `in_review` → `approved` or `in_progress` | **Human only** | Reason given. See T10 for split parents. |
| T11 | Split | parent: `approved`/`in_progress` → `in_progress`; subtasks: (none) → `approved` | Claimant (human or agent); any Human if the task is unclaimed | Top-level task; subtask envelopes narrow the parent's; agent: not blocked. |
| T12 | Parent enters review | `in_progress` → `in_review` (split parent) | System | Last non-done subtask became done and at least one subtask is `completed`. |
| T13 | Reopen subtask | `completed` → `approved` (subtask) | **Human only** | Parent is `in_progress`, or the reopen is part of returning the parent (T10). |
| T14 | Parent falls back | `in_progress` → `approved` (split parent) | System | All subtasks are `cancelled`. |
| T15 | Cancel | any non-terminal → `cancelled` | Human; Agent only for a `proposed` task it authored | Reason given. Cascades to subtasks (T16). |
| T16 | Cascade cancel | any non-terminal → `cancelled` (subtask) | System | Parent was cancelled. |
| C1 | Block / unblock | condition only | Human; Agent only on the task its run is bound to | See C1. |
| C2 | Pause / resume | condition only | Defined by the pauses contract | See C2. |

Any (state, action) pair not in this table is an illegal transition and is
rejected (see "Failure behavior").

### T1 Create

- **Actors:** Human; Agent acting in a run.
- **Preconditions:** Title, desired outcome, and a draft scope envelope and
  acceptance criteria may be incomplete, but a title and desired outcome are
  required.
- **Postconditions:** A new top-level task exists in `proposed`, with its author
  recorded. No claim. Subtasks are never created through T1 (only through T11).
- **Note:** A human may create and immediately approve a task. That is two
  actions (T1 then T2) and produces two audit records, even if the UI combines
  them into one gesture.
- **Audit:** `created`, actor, author kind, run (if agent).

### T2 Approve

- **Actors:** Human only. An agent attempt is rejected as an authority violation
  and the attempt itself is audited.
- **Preconditions:** State `proposed`; top-level task; the scope envelope has at
  least one inclusion; at least one acceptance criterion exists.
- **Postconditions:** State `approved`; approver and time recorded; the scope
  envelope is fixed (see "Scope envelope").
- **Audit:** `approved`, human actor.

### T3 Claim

- **Actors:** Human (for themselves); Agent acting in a run (the claimant is the
  run, attributed to the agent and model).
- **Preconditions:**
  - State `approved`; no active claim.
  - The task is not a split parent with non-done subtasks (its work is claimed
    through its subtasks).
  - Agent claims only: the task is not blocked or effectively blocked.
  - Agent claims only: the run does not already hold a claim on another task (a
    run works one task).
- **Postconditions:** State `in_progress`; exactly one active claim naming the
  claimant, claim start time, and — if expiry applies — the claim's expiry
  deadline.
- **Race:** If two claims are attempted concurrently, exactly one succeeds; every
  other attempt is rejected with `conflict` and is told the current claimant.
- **Audit:** `claimed`, claimant, expiry deadline if any.

### T4 Release claim

- **Actors:** The claimant (human or agent run) for its own claim. Any human
  may release another claimant's claim ("break claim"); a reason is required
  when breaking someone else's claim.
- **Preconditions:** State `in_progress`; active claim exists.
- **Postconditions:** State `approved`; no active claim; work artifacts and
  history remain attached to the task. If the released claimant is an agent run,
  Moonbeam requests that the run stop (runs contract). Any open pause of that
  run is closed as superseded (pauses contract).
- **Audit:** `claim_released`, actor, former claimant, reason, whether it was a
  break.

### T5 Claim ends automatically

- **Actor:** System.
- **Triggers:**
  - **Expiry:** the claim's expiry deadline passes without renewal (see "Claim
    expiry").
  - **Run ended without handoff:** the run holding the claim ends (completed,
    failed, or stopped) without performing T6.
- **Preconditions:** State `in_progress`; the claim that triggered it is still
  the active claim.
- **Postconditions:** As T4. The task becomes claimable by anyone.
- **Audit:** `claim_expired` or `claim_ended_run_finished`, system actor, former
  claimant, deadline or run outcome.

### T6 Hand off

- **Actors:** The claimant only. Another human who wants to hand off must first
  break the claim (T4) and claim it (T3).
- **Preconditions:** State `in_progress`; the actor is the claimant; a handoff
  record exists for this attempt (what changed, what was validated, deviations,
  risks); the task is not blocked or effectively blocked; the task is not paused.
- **Postconditions:** State `in_review`; the claim ends (in-review tasks have no
  claimant); the handoff and the former claimant are recorded as the work under
  review. For an agent run, the run may then end normally.
- **Audit:** `handed_off`, claimant, handoff reference.

### T7 Record review

- **Actors:** An agent acting in a reviewer run.
- **Preconditions:** State `in_review`; the reviewer run is not the run whose
  handoff is under review (when the work was claimed by a human, any agent
  reviewer run qualifies; see Q11). For a split parent in review, an optional
  integration review may be recorded under the same rule.
- **Postconditions:**
  - A review record exists with its verdict and findings, linked to the handoff
    it reviews.
  - Findings are presented to humans (decision queue). There is **no automatic
    reviewer-to-implementer loop**: no review ever moves a task back to
    `approved` or `in_progress`, and no review starts a run.
  - Top-level task: state unchanged (`in_review`), awaiting T9 or T10.
  - Subtask: triggers T8.
- **Audit:** `review_recorded`, reviewer, verdict, findings reference.

### T8 Subtask completes on review (proposed behavior; see Open question Q2)

- **Actor:** System.
- **Preconditions:** A review (T7) was recorded on a subtask in `in_review`; the
  subtask is not blocked or effectively blocked (if it is, completion happens
  automatically when the last blocker is cleared).
- **Postconditions:** Subtask state `completed`, whatever the review verdict.
  The review's findings remain attached to the subtask and are carried forward
  to the parent's review so the human deciding on the parent sees them. A human
  may act on findings at any time before the parent is accepted by reopening the
  subtask (T13). Subtasks are **never** individually accepted by a human.
- **Audit:** `subtask_completed_on_review`, system actor, review reference.
- **Follow-on:** May trigger T12.

### T9 Accept

- **Actors:** Human only. Agent attempts are rejected as authority violations and
  the attempt is audited. A human may accept work they claimed themselves
  (ADR-003).
- **Preconditions:**
  - State `in_review`; top-level task (subtasks cannot be accepted).
  - No subtask is non-done.
  - Not blocked.
  - Review requirement (proposed; see Q5): a leaf top-level task has at least one
    review recorded against its latest handoff, **or** the accepting human
    explicitly waives review with a reason. A split parent needs no parent-level
    review because each subtask was reviewed.
- **Postconditions:** State `completed`; acceptor and time recorded. Moonbeam
  begins writing the permanent task record to the repository (write-back
  contract). Acceptance is not rolled back if write-back fails; write-back
  failure handling belongs to that contract.
- **Audit:** `accepted`, human actor, review references or waiver reason.

### T10 Return

- **Actors:** Human only (agent attempts rejected as authority violations).
- **Preconditions:** State `in_review`; a reason (return notes) is given.
- **Postconditions by task kind:**
  - **Leaf task (top-level or subtask):** state `approved`, unclaimed; the return
    notes and the prior claimant are shown to whoever claims next. (See Q4 for
    the alternative of returning straight to `in_progress` with the prior
    claimant.)
  - **Split parent, with reopening:** the human selects one or more `completed`
    subtasks to reopen (each undergoes T13 to `approved`) and/or adds new
    subtasks (T11 by a human). Parent state becomes `in_progress` with no claim.
  - **Split parent, without reopening or new subtasks:** parent state becomes
    `approved` and is directly claimable for integration or fix-up work
    (proposed; see Q3). Its subtasks stay `completed`. When its claimant hands
    off (T6), the parent returns to `in_review`.
- **Audit:** `returned`, human actor, reason, reopened subtask list, new subtask
  list.

### T11 Split

- **Actors:**
  - The claimant of the task (human or agent run).
  - Any human when the task is `approved` and unclaimed, or when it is a split
    parent `in_progress` with no claim (adding subtasks).
  - Agents may not add subtasks to a split parent they do not hold a claim on.
- **Preconditions:**
  - Task is top-level (no nested splits in V1; see Q6).
  - Task state is `approved` (unclaimed, human actor) or `in_progress`
    (actor is the claimant, or a human adding subtasks to an unclaimed split
    parent).
  - Agent actor: task is not blocked.
  - At least one subtask is defined, each with a title, desired outcome,
    acceptance criteria, and a scope envelope that satisfies the narrowing rules
    (see "Scope envelope").
- **Postconditions:**
  - Each subtask exists, linked to the parent, in state `approved` (T11 includes
    the system's automatic approval; there is no `proposed` subtask).
  - Parent state is `in_progress` with **no** active claim. If the splitter held
    a claim on the parent, that claim ends as part of the split.
  - Existing subtasks (when adding) are unaffected.
  - The whole split is atomic: either every subtask is created and the parent
    updated, or nothing changes.
- **Audit:** `split` on the parent (actor, subtask list); on each subtask
  `created_by_split` and `auto_approved` (system actor, citing the parent's
  approval record and the splitting actor).

### T12 Parent enters review

- **Actor:** System.
- **Trigger:** A subtask of a split parent becomes done through T8 (completion
  on review) or T15 (a human cancels that subtask), and as a result every
  subtask is done. (T16 never triggers T12, because the parent itself is being
  cancelled.)
- **Preconditions:** Parent state `in_progress`; parent has no claim; every
  subtask is done; at least one subtask is `completed`.
- **Postconditions:** Parent state `in_review`; all subtask handoffs, reviews,
  and findings are presented with it in the decision queue.
- **Race:** If two subtasks become done concurrently, the parent enters
  `in_review` exactly once.
- **Audit:** `entered_review_all_subtasks_done`, system actor, the triggering
  subtask.

### T13 Reopen subtask

- **Actors:** Human only.
- **Preconditions:** Subtask state `completed`; parent state `in_progress`, or the
  reopen is performed as part of T10 on the parent. Cancelled subtasks cannot be
  reopened (a human adds a new subtask instead).
- **Postconditions:** Subtask state `approved`, unclaimed, with reopen notes;
  its previous handoffs and reviews remain in its history. The parent is (or
  becomes, via T10) `in_progress`.
- **Audit:** `subtask_reopened`, human actor, reason.

### T14 Parent falls back

- **Actor:** System.
- **Trigger:** The last non-done subtask is cancelled and no subtask is
  `completed`.
- **Postconditions:** Parent state `approved`, unclaimed, flagged in the decision
  queue for human attention. It may be claimed, split again, or cancelled.
- **Audit:** `split_abandoned_all_subtasks_cancelled`, system actor.

### T15 Cancel

- **Actors:**
  - Human: any non-terminal task, top-level or subtask.
  - Agent: only a `proposed` task it authored (withdrawal), from within a run.
- **Preconditions:** State is non-terminal; a reason is given.
- **Postconditions:**
  - State `cancelled`.
  - Any active claim ends; if the claimant is an agent run, Moonbeam requests
    that the run stop (runs contract). Open pauses on the task are closed as
    cancelled (pauses contract). Open blockers are closed as moot.
  - If the task is a split parent: every non-done subtask is cancelled (T16).
    `completed` subtasks remain `completed` as history.
  - If the task is a subtask: the parent is re-evaluated; this may trigger T12
    or T14.
- **Audit:** `cancelled`, actor, reason.

### T16 Cascade cancel

- **Actor:** System.
- **Postconditions:** As T15 for each affected subtask, in the same atomic
  operation as the parent's cancellation.
- **Audit:** `cancelled_by_parent`, system actor, parent cancellation reference.

### C1 Blocked condition

- **Set (add blocker):** Human on any non-terminal task. Agent only on the task
  its run is bound to (as claimant or reviewer). A blocker must state what is
  needed, who can resolve it, and its effect.
- **Clear (resolve blocker):** Any human; or the agent run that added it, while
  that run is active.
- **Effect on state:** None. `blocked` never changes the lifecycle state.
- **Effective blocking:** Non-done subtasks of a blocked parent are effectively
  blocked. This is derived and displayed; it does not create blocker records on
  the subtasks.
- **While blocked or effectively blocked:**
  - Rejected: agent claim (T3), hand off (T6), accept (T9), agent split (T11),
    and subtask completion (T8 is deferred until unblocked).
  - Allowed: human claim, release (T4), automatic claim end (T5), record review
    (T7), return (T10), reopen (T13), cancel (T15), and blocker management.
  - Claim expiry: the claim's expiry clock is suspended while the task has an
    open blocker and resumes, with its remaining time, when the last blocker is
    cleared (proposed; see Q9).
- **Audit:** `blocker_added` / `blocker_resolved`, actor, blocker content.

### C2 Paused condition (boundary)

The pauses contract defines how pauses are opened, answered, and categorized.
For lifecycle purposes:

- A task is `paused` while any active run on it has an open pause.
- `paused` never changes the lifecycle state.
- The claim is retained while paused, and its expiry clock is suspended.
- The paused claimant cannot hand off (T6) until the pause is resolved.
- Release (T4), automatic claim end (T5, run-ended trigger only), return, and
  cancel remain allowed; they close the open pause as superseded or cancelled.
- **Audit:** `paused` / `resumed`, with a reference to the pause record.

### Claim expiry (proposed; values are a board decision, see Q1)

- **Agent-run claims** carry a lease that the run renews through activity. If the
  lease is not renewed within the **agent claim lease** (proposed: 30 minutes),
  the claim expires (T5). A run ending without handoff ends its claim
  immediately (T5), regardless of lease.
- **Human claims** expire after the **human claim inactivity period**
  (proposed: 7 days) with no claimant activity on the task. Activity includes
  any action by the claimant on the task and an explicit "still working"
  renewal. (Alternative: human claims never expire and are only released or
  broken; see Q1.)
- Expiry clocks are suspended while the task is paused or blocked.
- The server's clock is authoritative. From the deadline onward the claim is
  treated as expired by every action and view, even if the `claim_expired`
  audit record is written slightly later; that record carries the deadline as
  its effective time.
- The claimant's expiry deadline is visible wherever the claim is shown.

### Scope envelope

- The envelope is set while the task is `proposed` and is fixed at approval.
  After approval it cannot be widened by anyone. In V1 it cannot be edited at
  all after approval; a human who needs different scope cancels and proposes a
  new task (proposed; see Q8).
- A subtask inherits its parent's envelope and may only narrow it:
  - it includes every parent exclusion (it may add more);
  - it includes every parent constraint (it may add more);
  - it links every contract the parent links, and adds none;
  - each of its inclusions derives from a named parent inclusion, and is no
    broader than it.
- The server enforces the structural rules it can check (presence of every
  parent exclusion, constraint, and contract; every inclusion referencing a
  parent inclusion; no added contracts). Whether an inclusion's wording is
  actually no broader than its source cannot be checked mechanically; it is
  verified by the subtask's agent review and by the human deciding on the
  parent.

### Audit record

Every successful transition and every condition change produces exactly one
audit record per affected task (a split or cascade produces one per task
touched). Each record contains:

- project and task identifiers, and parent identifier for subtasks
- action identifier (the names used above)
- from-state and to-state (equal for condition changes and T7)
- actor kind: human, agent, or system
- actor identity: the selected user; or the agent, model, and run; or, for the
  system, the named trigger
- server timestamp (effective time for expiry)
- required reason or notes (release when breaking, return, reopen, cancel,
  review waiver, blockers)
- references to related records: claim, handoff, review, blocker, pause,
  parent or subtask records, originating action for automatic transitions

Audit records are append-only and immutable. Rejected authority violations (an
agent attempting to approve, accept, return, or reopen) are also recorded, as
rejected attempts, with the same actor information.

## Postconditions and invariants

These hold after every action, at every observable moment.

- **I1 — One state.** Every task is in exactly one lifecycle state.
- **I2 — Human gates.** No `approved`, `accepted`, `returned`, or
  `subtask_reopened` audit record has an agent actor. No agent action ever
  succeeds at approving, accepting, returning, or reopening, regardless of
  identity mode.
- **I3 — Approval lineage.** Every task that has ever been `approved` has either
  a human `approved` record or, for a subtask, an `auto_approved` record that
  cites a parent that was human-approved.
- **I4 — Claim exclusivity.** A task has at most one active claim. A leaf task
  is `in_progress` if and only if it has exactly one active claim. A split
  parent in `in_progress` either has no claim and at least one non-done subtask,
  or has exactly one claim and every subtask done (the post-return integration
  case). No task in any other state has an active claim.
- **I5 — One task per run.** An agent run holds at most one active claim.
- **I6 — Acceptance.** Every `completed` top-level task has exactly one human
  `accepted` record for its latest entry into review. No subtask has an
  `accepted` record.
- **I7 — Subtask review.** Every `completed` subtask has an agent review recorded
  by a reviewer other than its claimant, against its latest handoff.
- **I8 — Subtasks are born approved.** No subtask is ever in `proposed`.
- **I9 — Parent review readiness.** A split parent in `in_review` has every
  subtask done and at least one `completed`.
- **I10 — Parent completion.** A `completed` or `cancelled` parent has no non-done
  subtask.
- **I11 — Envelope narrowing.** Every subtask's envelope satisfies the narrowing
  rules against its parent's envelope.
- **I12 — Terminal finality.** A task in a terminal state never leaves it, except
  a `completed` subtask reopened by a human while its parent is non-terminal.
- **I13 — No automatic rework loop.** No transition into `approved` or
  `in_progress` is ever triggered by a review. Only humans return or reopen
  work.
- **I14 — No self-starting agents.** Every agent action occurs within a run that
  was started by a human action.
- **I15 — Audit completeness.** Every state change and condition change has an
  audit record, and each task's current state equals the to-state of its most
  recent state-changing audit record.
- **I16 — Conditions are not states.** Setting or clearing `blocked` or
  `paused` never changes the lifecycle state.

## Failure behavior

All rejections leave every task, claim, subtask, and condition unchanged, and
return one of these categories with a human-readable reason:

| Category | When |
|---|---|
| `not_found` | Task, project, run, or referenced subtask does not exist. |
| `authority_violation` | An agent attempts a human-only action (approve, accept, return, reopen, cancel beyond its own proposal, break another's claim). Always audited as a rejected attempt. |
| `not_permitted` | The actor kind is allowed but the actor lacks the required relationship (not the claimant, run not bound to this task, not the blocker's author). |
| `invalid_transition` | The action is not defined for the task's current state or kind (e.g. accepting a subtask, claiming a `completed` task, approving an `approved` task). |
| `conflict` | Another action changed the task first (e.g. concurrent claim, accept racing cancel, handoff racing claim expiry). The response states the current state and claimant. |
| `blocked` | The action is disallowed while the task is blocked, effectively blocked, or paused. The response lists the open blockers or pause. |
| `validation` | Required input missing or invalid (missing reason, missing handoff record, envelope fails narrowing, approval without acceptance criteria). The response identifies each failing rule. |

Concurrency rules:

- Each action is atomic across the task, its parent, and its subtasks. The
  observable outcome of concurrent actions equals some sequential order of them.
- Concurrent claims: exactly one succeeds (I4); the rest receive `conflict`.
- Accept vs. cancel, return vs. accept, handoff vs. expiry: the first applied
  wins; the other receives `conflict` (or `invalid_transition` if the state has
  already changed when it is evaluated).
- Last-subtask races: the parent enters `in_review` exactly once (T12).
- Idempotence: repeating an action that already took effect is rejected with
  `invalid_transition` or `conflict` and produces no second state change.

## Interfaces

The server exposes the following actions. Names are illustrative; the required
behavior is the semantics above, identical whether invoked from the UI or by
an agent. Internal representation, endpoints, and validators are implementation
choices.

| Action | Transition(s) |
|---|---|
| create task | T1 |
| approve task | T2 |
| claim task | T3 |
| release claim / break claim | T4 |
| renew claim | extends expiry (no transition; audited only if the board wants renewals recorded, see Q12) |
| hand off | T6 |
| record review | T7 (→ T8, T12) |
| accept task | T9 |
| return task (optionally reopening subtasks and adding subtasks) | T10 (→ T13, T11) |
| split task / add subtasks | T11 |
| reopen subtask | T13 |
| cancel task | T15 (→ T16, T12, T14) |
| add blocker / resolve blocker | C1 |

System transitions (T5, T8, T12, T14, T16) are not requestable by any client.

Every task view exposes: state, conditions (with open blockers and pause
references), claimant and expiry deadline, parent/subtasks with their states,
scope envelope, and full audit history.

## UX expectations

- Human-only actions (approve, accept, return, reopen) are never offered in an
  agent context and are visibly attributed to the selected user.
- The decision queue shows at least: `proposed` tasks awaiting approval;
  `in_review` top-level tasks awaiting acceptance or return; subtasks whose
  review recorded findings; blocked tasks; split parents that fell back (T14);
  rejected authority-violation attempts.
- A split parent in review shows every subtask's handoff, review verdict, and
  findings in one place, and the return action lets the human select subtasks
  to reopen and add new ones.
- The claimant and claim expiry are visible wherever a task in `in_progress` is
  shown. Breaking a claim requires confirmation and a reason.
- `blocked` and `paused` are shown as badges on top of the state, never as a
  state.
- Rejections are shown with their category and reason; a `conflict` refreshes
  the task to its current state.
- Accepting without a recorded review (if the waiver is approved, Q5) requires
  an explicit waiver step with a reason.

## Validation requirements

Implementation is accepted against this contract when automated tests show:

1. **Transition matrix:** for every state × action × actor kind (human, agent,
   system-only), the action either succeeds as specified or is rejected with the
   specified category, and rejections change nothing.
2. **Agent gate:** agent attempts to approve, accept, return, or reopen are
   rejected with `authority_violation` and recorded, including when the request
   names a human user.
3. **Claim race:** many concurrent claims on one task produce exactly one claim
   and `conflict` for all others.
4. **Expiry:** agent and human claims expire at their deadlines, are suspended
   while blocked or paused, and a run ending without handoff ends its claim.
5. **Split:** envelope narrowing rules are enforced; subtasks are born
   `approved` with correct audit lineage; the split is atomic; nested splits are
   rejected.
6. **Subtask flow:** handoff, review, and automatic completion of subtasks; the
   parent enters `in_review` exactly once when the last subtask is done,
   including under concurrent completion; the parent falls back when all
   subtasks are cancelled.
7. **Return:** leaf return, parent return with reopen/new subtasks, and parent
   return without either, each producing the specified states.
8. **Cancel cascade:** cancelling a parent cancels every non-done subtask, ends
   claims, and leaves completed subtasks unchanged, atomically.
9. **Conditions:** blocked and paused never change state and disallow exactly
   the listed actions.
10. **Audit:** every successful action produces the specified audit records
    with correct actor kind; each task's state matches its latest
    state-changing record (I15).
11. **Invariants I1–I16** are checked after each step of a randomized sequence of
    actions (property-style test recommended, not required).

Board review of this contract is the validation for TASK-002 itself.

## Open questions

Each item states the proposed default used in this contract. The board may
accept or change it before approving the contract.

- **Q1 — Claim expiry values.** Proposed: agent-run lease 30 minutes renewed by
  run activity; human claim 7 days of inactivity. Alternative: human claims never
  expire. Should an expiring human claim warn the claimant first (no
  notifications exist in V1)?
- **Q2 — Subtask review with findings.** Proposed (A): the subtask completes on
  any recorded review and findings are carried to the parent's review; humans
  can reopen a subtask earlier. Alternative (B): a review with findings holds
  the subtask in `in_review` until a human disposes of it — closer to "findings
  go to a human" per subtask, but it is effectively a per-subtask human decision,
  which the 2026-09-24 decision avoided.
- **Q3 — Returning a split parent without reopening.** Proposed: the parent goes
  to `approved` and becomes directly claimable for integration work.
  Alternative: require reopening at least one subtask or adding one.
- **Q4 — Where a returned leaf task goes.** Proposed: `approved`, unclaimed, with
  return notes. Alternative: `in_progress` with the prior claimant retained
  (matches the classic DbC folder flow, but agent runs usually end at handoff).
- **Q5 — Review before acceptance.** Proposed: a leaf top-level task needs a
  recorded review of its latest handoff, or an explicit human waiver with a
  reason. Alternatives: review is never required, or never waivable.
- **Q6 — Nested splits.** Proposed: not allowed in V1 (only top-level tasks
  split). Allowing nesting raises the question of how a mid-level subtask gets
  reviewed and completed.
- **Q7 — Agent cancellation.** Proposed: agents may only withdraw `proposed`
  tasks they authored. Should an agent claimant be able to cancel a subtask it
  finds redundant, or must it raise a blocker for a human?
- **Q8 — Scope envelope after approval.** Proposed: fixed; changing scope means
  cancelling and re-proposing. Alternative: a human may edit it, which then
  requires re-checking existing subtasks against the edited envelope.
- **Q9 — Blocked vs. claims.** Proposed: blocking suspends claim expiry; agents
  cannot claim a blocked task but humans can; a blocked parent effectively
  blocks its subtasks. Confirm each point.
- **Q10 — Adding subtasks after a split.** Proposed: humans may add subtasks to
  an unclaimed split parent in `in_progress`; agents may not (they propose a new
  task or raise a blocker). Confirm.
- **Q11 — Reviewer independence for human-claimed work.** Proposed: any agent
  reviewer satisfies independence when the claimant was a human. Should the
  reviewer also be required to use a different model than the implementing run?
- **Q12 — Audit granularity.** Are claim renewals recorded in the audit trail
  (proposed: no, only the latest renewal time is visible), and are rejected
  actions other than authority violations recorded (proposed: no)?
- **Q13 — Identity dependency.** This contract assumes the identity and
  permission interface (ADR-003 follow-up) reliably distinguishes agent
  credentials from UI user selection. That contract should be produced before
  or alongside implementation of this one.
