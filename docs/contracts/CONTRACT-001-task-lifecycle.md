# CONTRACT-001: Task lifecycle, claims, and splits

Status: Approved
Approved by: Patrick
Approved date: 2026-09-24
Revised: 2026-09-24 (TASK-004), see "Revision history"
Related tasks: TASK-002, TASK-004
Related ADRs: ADR-001, ADR-003, ADR-005 (context: ADR-004)

## Revision history

### 2026-09-24 — TASK-004: board answers A1–A13 and ADR-005

The board approved this contract and answered its open questions (now under
"Resolved questions"). ADR-005 was approved after the contract was written. This
revision brings the body into line with both. It does not change the approval.

Changed transitions:

- **T3 Claim:** now requires that no earlier-approved task with overlapping
  paths is unfinished (ADR-005). Only agent-run claims get an expiry deadline
  (A1).
- **T5 Claim ends automatically:** the expiry trigger applies only to agent-run
  claims. Human claims never expire (A1).
- **T7 Record review:** if the reviewer uses the same model as the implementing
  run, the review is flagged. A different model is recommended but not required
  (A11).
- **T8 Subtask completes on review:** confirmed as final. A subtask is done once
  its agent review is recorded, and it is never reopened. Findings are handled
  through new subtasks (A2).
- **T9 Accept:** now includes merging the task's work. Merge mechanics are in
  CONTRACT-004 (ADR-005). A top-level leaf task still needs an agent review, and
  a human may waive it with a reason (A5).
- **T10 Return:** a returned leaf goes to `approved`, unclaimed, with return
  notes (A4). A returned split parent gets new subtasks instead of reopened ones
  (A2, A3).
- **T11 Split:** agents may add subtasks to a split parent within its scope
  envelope without human involvement (A10). Only top-level tasks split (A6).
  Narrowing now covers paths (ADR-005).
- **T12 Parent enters review:** can now be triggered by an agent cancelling a
  subtask (A7).
- **T13 Reopen subtask:** removed (A2, A3). The ID is retired and will not be
  reused.
- **T15 Cancel:** agents may cancel subtasks they created (A7).
- **C1 Blocked:** unblocking a parent unblocks its subtasks (A9). Claim-expiry
  suspension now applies only to agent-run leases (A1).
- **C2 Paused:** expiry suspension now applies only to agent-run leases (A1).
- **New action — reorder path dependency:** human only (ADR-005).

Other changes:

- Scope envelope includes paths. Path dependencies are recorded at approval and
  shown on both tasks (ADR-005). The envelope stays fixed after approval (A8).
- Invariants: I2 no longer mentions reopening, I12 has no exception, and I13 is
  reworded. New invariants: I17 (path dependency) and I18 (main branch holds only
  accepted work).
- Audit: claim renewals and non-authority rejections are not recorded (A12).
  Same-model reviews and path dependencies are recorded.
- Identity dependency confirmed (A13).
- New open questions Q14–Q21 cover points this revision uncovered but could not
  decide.

## Purpose

Define the observable behavior of a Moonbeam task from creation to a terminal
state:

- the lifecycle states and the transitions between them
- who may perform each transition
- the claim that grants the exclusive right to work a task
- the split of a task into subtasks within its scope envelope
- the path dependencies that make overlapping tasks sequential
- the blocked and paused conditions
- the audit record every transition produces

Moonbeam's database is the single authority for this state (ADR-001). The data
model, the server API, and the decision queue UI are built against this
contract. One gate is enforced regardless of identity mode: agents never approve
and never accept (ADR-003). It is specified here as an invariant.

## Scope

### Included

- Lifecycle states: `proposed`, `approved`, `in_progress`, `in_review`,
  `completed`, `cancelled`.
- Conditions (not states): `blocked`, `paused`.
- Every transition: preconditions, postconditions, allowed actors, audit record.
- Claims: exclusivity, release, expiry of agent-run leases, and interaction
  with conditions.
- Path dependencies between tasks with overlapping paths (ADR-005): recording,
  the effect on claiming, and reordering.
- Splits:
  - subtask creation, including subtasks added later by humans or agents
  - scope-envelope narrowing
  - automatic approval
  - subtask review and completion
  - parent entry into review and parent acceptance
  - parent return with new subtasks
- Cancellation, including cascade to subtasks.
- That acceptance includes the merge, as a boundary with CONTRACT-004.
- Failure behavior: illegal transitions, authority violations, concurrent races.

### Excluded (boundaries only)

- **Runs**: how an agent run is started, observed, stopped, and ended. This
  contract relies only on these points:
  - An agent acts only within a run.
  - A run is started by a human action.
  - A run is bound to one task.
  - A run can end with or without a handoff.
  - A run has a known model.

  These are defined by a future runs contract.
- **Run branches, the merge on acceptance, and write-back** (CONTRACT-004,
  ADR-005): branch naming and creation, updating a stale branch, conflicts, the
  merge itself, commit and author policy, the permanent task record, and
  cleanup. This contract states only that T9 includes the merge, that a return
  does not merge, and invariant I18.
- **Review surface** (ADR-005 point 2): what Moonbeam displays for a task in
  review. This includes flagging changed files that fall outside the task's
  paths, which is a display matter, not a lifecycle gate.
- **Pauses in detail**: categories, questions, answers, and pause review. This
  contract defines only how the `paused` condition interacts with the lifecycle
  and with claims. These are defined by a future pauses contract.
- **Identity and permission interface**: how the server knows the current actor
  and whether it is a human or an agent (ADR-003 follow-up contract). This
  contract assumes that interface exists and reports actor *kind* reliably
  (A13).
- Handoff and review document content, beyond their existence as records.
- Scope-envelope editing workflows beyond what is stated in "Scope envelope".
- Visual design of the dashboard and decision queue.

## Actors

| Actor kind | Who | Identified by |
|---|---|---|
| **Human** | Any board member. In V1 every user is a board member with full authority (ADR-003). | The user chosen in the user select. |
| **Agent** | A specialist AI worker acting inside a run. Never a board member. | The server-recognized agent credential, the run it acts in, and that run's model. |
| **System** | Moonbeam itself, performing only the automatic transitions this contract names. | A system actor plus the named trigger. |

Rules for actor kind:

- The server determines actor kind from how the request is authenticated. It
  never uses a value the caller declares. A request made with agent credentials
  is an agent action even if it names a human user.
- The system actor never performs, on its own initiative, a transition this
  contract reserves for humans: approving a top-level task, accepting,
  returning, reordering a path dependency, or cancelling an approved task. Its
  automatic subtask approval is derived from a human approval of the parent and
  is recorded as such.

Roles referenced below:

- **Claimant**: the human or agent run that holds the active claim on a task.
- **Author**: the actor that created a task. For a subtask, this is the actor
  that performed the split or added the subtask.
- **Reviewer**: an agent run that records a review of a handed-off task. It
  must not be the claimant whose work it reviews.
- **Implementing run**: the agent run whose handoff is under review. There is
  none when the claimant was a human.

## Inputs and outputs

Inputs are **actions** requested by an actor against a task (see
"Interfaces"). Every action is evaluated against the task's current state at the
moment it is applied.

The output of every action is one of:

- **Success**: the resulting task state and conditions, the claim (if any), the
  affected subtasks or parent, and the audit records produced.
- **Rejection**: a failure category (see "Failure behavior") with a
  human-readable reason. A rejected action changes nothing.

## Definitions

- **Top-level task**: a task with no parent.
- **Subtask**: a task created by a split. Splits are one level deep: only
  top-level tasks split (A6).
- **Split parent**: a task that has at least one subtask.
- **Leaf task**: a task with no subtasks.
- **Terminal state**: `completed` or `cancelled`.
- **Subtask done**: a subtask in a terminal state.
- **Active claim**: a claim that has not been released, expired, or ended.
- **Scope envelope**: a task's inclusions, exclusions, paths, linked contracts,
  and constraints (PROJECT.md domain language, ADR-005).
- **Paths**: the files and directories a task may change. They are part of the
  scope envelope.
- **Overlapping paths**: two tasks overlap when any path of one names the same
  file or directory as a path of the other, or one path is a directory that
  contains the other. (Interim reading; see Q21.)
- **Path dependency**: a recorded relationship between two tasks with
  overlapping paths. The later-approved task depends on the earlier-approved
  one unless a human has reordered it (ADR-005).
- **Unfinished**: in a non-terminal state.
- **Blocker**: a record stating what is needed, who can resolve it, and its
  effect. A task is `blocked` while it has at least one open blocker. It is
  "effectively blocked" while its parent is blocked (see C1).
- **Paused**: a run on the task has an open pause (a question awaiting a human).

## Preconditions

Global preconditions for any action:

1. The task exists and belongs to a registered project.
2. The server has resolved the actor kind (human, agent, or system).
3. An agent action names the run it is acting in, and that run is active. The
   run must be bound to the task being acted on. For creation, the run is bound
   to the task the proposal arises from. There is one exception: a run bound to
   a subtask may add subtasks to that subtask's parent (T11) and may cancel
   subtasks of that parent that it created (T15), as those sections specify.
   Runs are started only by a human action. There are no scheduled or
   self-waking agents.

Action-specific preconditions are in the transition table.

## Required behavior

### States

| State | Meaning | Claim |
|---|---|---|
| `proposed` | A plan exists. Work is not authorized. | Never |
| `approved` | A human authorized the scope, directly or through the parent for subtasks. Ready to be claimed once its path dependencies are finished. | None |
| `in_progress` | Being worked. A leaf task has exactly one active claim. A split parent has no claim, and work proceeds through its non-done subtasks. | Leaf: exactly one. Split parent: see invariant I4. |
| `in_review` | Work has been handed off (leaf), or all subtasks are done (split parent). Awaiting review and, for top-level tasks, a human decision. | None |
| `completed` | Top-level: a human accepted it, which includes the merge (T9). Subtask: an independent agent review was recorded. | None |
| `cancelled` | Work stopped by decision. | None |

`completed` and `cancelled` are terminal. Nothing leaves a terminal state.
Subtasks are never reopened: T13 was removed on 2026-09-24 (A2).

### Transition table

"Human" means any board member. "Claimant" means the actor holding the active
claim. Every transition produces an audit record (see "Audit record"). A
transition is rejected when its preconditions do not hold, unless stated
otherwise.

| ID | Action | From → To | Allowed actors | Key preconditions |
|---|---|---|---|---|
| T1 | Create | (none) → `proposed` | Human; Agent (in a run) | Required fields present. |
| T2 | Approve | `proposed` → `approved` | **Human only** | Top-level task; scope envelope and acceptance criteria present. Records path dependencies. |
| T3 | Claim | `approved` → `in_progress` | Human; Agent (in a run) | No active claim; not a split parent with non-done subtasks; no unfinished path dependency; agent: not blocked. |
| T4 | Release claim | `in_progress` → `approved` | Claimant (human or agent); any Human (breaking another's claim) | Active claim exists. |
| T5 | Claim ends automatically | `in_progress` → `approved` | System | Agent-run lease expired, or the claiming run ended without handoff. |
| T6 | Hand off | `in_progress` → `in_review` | Claimant only | Handoff record present; not blocked; not paused. |
| T7 | Record review | `in_review` → `in_review` (top-level) | Agent reviewer (in a run) | Reviewer is not the claimant whose work is reviewed. Same-model reviews are flagged. |
| T8 | Subtask completes on review | `in_review` → `completed` (subtask) | System | T7 recorded on a subtask; subtask not blocked. |
| T9 | Accept | `in_review` → `completed` | **Human only** | Top-level task; no non-done subtasks; not blocked; review requirement met. Includes the merge (CONTRACT-004). |
| T10 | Return | `in_review` → `approved` or `in_progress` | **Human only** | Reason given. Leaf → `approved`. Split parent: see T10. |
| T11 | Split / add subtasks | parent: `approved`/`in_progress` → `in_progress`; subtasks: (none) → `approved` | Claimant (human or agent); any Human if the task is unclaimed; Agent run bound to a non-done subtask (adding) | Top-level task; subtask envelopes narrow the parent's; agent: parent not blocked. |
| T12 | Parent enters review | `in_progress` → `in_review` (split parent) | System | Last non-done subtask became done and at least one subtask is `completed`. |
| T13 | *Removed 2026-09-24 (A2): subtasks are never reopened.* | — | — | — |
| T14 | Parent falls back | `in_progress` → `approved` (split parent) | System | All subtasks are `cancelled`. |
| T15 | Cancel | any non-terminal → `cancelled` | Human; Agent only for a `proposed` task it authored or a subtask it created | Reason given. Cascades to subtasks (T16). |
| T16 | Cascade cancel | any non-terminal → `cancelled` (subtask) | System | Parent was cancelled. |
| C1 | Block / unblock | condition only | Human; Agent only on the task its run is bound to | See C1. |
| C2 | Pause / resume | condition only | Defined by the pauses contract | See C2. |
| D1 | Reorder path dependency | no state change | **Human only** | A recorded path dependency exists. See "Path dependencies". |

Any (state, action) pair not in this table is an illegal transition and is
rejected (see "Failure behavior").

### T1 Create

- **Actors:** Human; Agent acting in a run.
- **Preconditions:** A title and a desired outcome are required. The draft
  scope envelope and acceptance criteria may be incomplete.
- **Postconditions:** A new top-level task exists in `proposed` with its author
  recorded. It has no claim. Subtasks are never created through T1, only
  through T11.
- **Note:** A human may create and immediately approve a task. That is two
  actions (T1 then T2) and produces two audit records, even if the UI combines
  them into one gesture.
- **Audit:** `created`, actor, author kind, run (if agent).

### T2 Approve

- **Actors:** Human only. An agent attempt is rejected as an authority violation
  and the attempt itself is audited.
- **Preconditions:**
  - State `proposed`.
  - Top-level task.
  - The scope envelope has at least one inclusion.
  - At least one acceptance criterion exists.
  - Whether at least one path is required is open (Q21). Until then, T2 does
    not require paths.
- **Postconditions:**
  - State `approved`, with the approver and time recorded.
  - The scope envelope, including its paths, is fixed (see "Scope envelope").
  - Moonbeam records a path dependency on every unfinished task that was
    approved earlier and whose paths overlap this task's paths (see "Path
    dependencies").
- **Audit:** `approved`, human actor, and the list of path dependencies
  recorded.

### T3 Claim

- **Actors:** A human, claiming for themselves. An agent acting in a run: the
  claimant is the run, attributed to the agent and model.
- **Preconditions:**
  - State `approved`, with no active claim.
  - The task is not a split parent with non-done subtasks. Its work is claimed
    through its subtasks.
  - **No unfinished path dependency** (ADR-005). Every task this task depends
    on through overlapping paths is in a terminal state. This applies to human
    and agent claims alike. A subtask never depends on its own parent. How path
    dependencies apply to subtasks otherwise is open (Q14).
  - Agent claims only: the task is not blocked or effectively blocked.
  - Agent claims only: the run does not already hold a claim on another task. A
    run works one task.
- **Postconditions:** State `in_progress`, with exactly one active claim naming
  the claimant and the claim start time. For an agent-run claim, the claim also
  records its lease deadline. Human claims have no deadline (A1).
- **Race:** If two claims are attempted at the same time, exactly one succeeds.
  Every other attempt is rejected with `conflict` and told the current
  claimant.
- **Audit:** `claimed`, claimant, and the lease deadline if any.

### T4 Release claim

- **Actors:** The claimant (human or agent run), for its own claim. Any human
  may release another claimant's claim ("break claim"). Breaking someone else's
  claim requires a reason.
- **Preconditions:** State `in_progress`; an active claim exists.
- **Postconditions:**
  - State `approved`, with no active claim.
  - Work artifacts and history stay attached to the task.
  - If the released claimant is an agent run, Moonbeam asks that run to stop
    (runs contract).
  - Any open pause of that run is closed as superseded (pauses contract).
- **Audit:** `claim_released`, actor, former claimant, reason, and whether it
  was a break.

### T5 Claim ends automatically

- **Actor:** System.
- **Triggers:**
  - **Lease expiry (agent-run claims only):** the lease deadline passes without
    renewal (see "Claim expiry").
  - **Run ended without handoff:** the run holding the claim ends (completed,
    failed, or stopped) without performing T6.
- Human claims never end automatically. They end only through T4, T6, T10,
  T11, or T15.
- **Preconditions:** State `in_progress`, and the claim that triggered this is
  still the active claim.
- **Postconditions:** As T4. Anyone may then claim the task, subject to T3.
- **Audit:** `claim_expired` or `claim_ended_run_finished`, system actor, former
  claimant, and the deadline or run outcome.

### T6 Hand off

- **Actors:** The claimant only. Another human who wants to hand off must first
  break the claim (T4) and then claim it (T3).
- **Preconditions:**
  - State `in_progress`, and the actor is the claimant.
  - A handoff record exists for this attempt, stating what changed, what was
    validated, deviations, and risks.
  - The task is not blocked or effectively blocked.
  - The task is not paused.
- **Postconditions:**
  - State `in_review`.
  - The claim ends: in-review tasks have no claimant.
  - The handoff and the former claimant are recorded as the work under review.
    For an agent run, this includes the run's model.
  - An agent run may then end normally.
- **Audit:** `handed_off`, claimant, handoff reference.

### T7 Record review

- **Actors:** An agent acting in a reviewer run.
- **Preconditions:** State `in_review`. The reviewer run is not the run whose
  handoff is under review. When a human claimed the work, any agent reviewer
  run qualifies. For a split parent in review, an optional integration review
  may be recorded under the same rule.
- **Model independence (A11):** The reviewer run should use a different model
  from the implementing run. This is recommended, not required. A review whose
  run uses the same model as the implementing run is accepted, but it is
  flagged as a **same-model review**. The flag is stored with the review, shown
  wherever the review is shown (see "UX expectations"), and included in the
  audit record. A review of human-claimed work is never flagged.
- **Postconditions:**
  - A review record exists with its verdict, findings, and same-model flag. It
    is linked to the handoff it reviews.
  - Findings are presented to humans in the decision queue. There is **no
    automatic loop from reviewer to implementer**. No review ever moves a task
    back to `approved` or `in_progress`, and no review starts a run.
  - Top-level task: the state stays `in_review`, awaiting T9 or T10.
  - Subtask: triggers T8.
- **Audit:** `review_recorded`, reviewer (agent, model, run), verdict, findings
  reference, and same-model flag.

### T8 Subtask completes on review

- **Actor:** System.
- **Preconditions:** A review (T7) was recorded on a subtask in `in_review`, and
  the subtask is not blocked or effectively blocked. If it is blocked,
  completion happens automatically when it is no longer blocked or effectively
  blocked (see C1).
- **Postconditions:**
  - Subtask state is `completed`, whatever the review verdict (A2).
  - The review's findings stay attached to the subtask. They are carried
    forward to the parent's review so the human deciding on the parent sees
    them.
  - The subtask is done and is **never reopened**. If a problem needs fixing,
    the fix is a new subtask. Before the parent enters review, a human or an
    eligible agent run can add it (T11). After the parent enters review, the
    human adds it when returning the parent (T10).
  - A human never accepts a subtask individually.
- **Audit:** `subtask_completed_on_review`, system actor, review reference.
- **Follow-on:** May trigger T12.

### T9 Accept

- **Actors:** Human only. Agent attempts are rejected as authority violations
  and audited. A human may accept work they claimed themselves (ADR-003).
- **Preconditions:**
  - State `in_review`, and the task is top-level. Subtasks cannot be accepted.
  - No subtask is non-done.
  - The task is not blocked.
  - **Review requirement (A5):** a top-level leaf task has at least one agent
    review recorded against its latest handoff, **or** the accepting human
    explicitly waives review and gives a reason. A split parent needs no
    parent-level review, because each subtask was reviewed. Q16 covers the case
    of a returned parent worked directly.
  - Any merge preconditions defined by CONTRACT-004.
- **Postconditions:**
  - State `completed`, with the acceptor and time recorded.
  - **Merge (ADR-005):** acceptance includes merging the task's work into the
    project's main branch. For a split parent, this includes its subtasks'
    work. CONTRACT-004 defines how the merge is performed and how subtask
    branches are combined.
  - Moonbeam writes the permanent task record to the repository (CONTRACT-004).
    A write-back failure does not roll back acceptance.
  - What happens to the lifecycle when the merge cannot be completed is open
    (Q17) and must be aligned with CONTRACT-004.
- **Audit:** `accepted`, human actor, review references or waiver reason, and a
  reference to the merge outcome.

### T10 Return

- **Actors:** Human only. Agent attempts are rejected as authority violations.
- **Preconditions:** State `in_review`, and a reason (return notes) is given.
- **Postconditions by task kind:**
  - **Leaf task, top-level or subtask (A4):** state `approved`, unclaimed. The
    return notes and the prior claimant are shown to whoever claims next.
  - **Split parent, with new subtasks (A2, A3):** as part of the return, the
    human adds one or more new subtasks through T11. Parent state becomes
    `in_progress` with no claim. The existing subtasks stay `completed` and are
    never reopened.
  - **Split parent, without new subtasks:** parent state becomes `approved` and
    can be claimed directly. Its subtasks stay `completed`. Its claimant, human
    or agent, may add new subtasks (T11, A10). When its claimant hands off
    (T6), the parent returns to `in_review`. This keeps the approved Q3
    default. Whether a returned parent may also be worked directly, without new
    subtasks, is open (Q16).
- A return merges nothing into the main branch. Where the returned work
  continues is defined by CONTRACT-004 (ADR-005: a returned task continues on
  its branch).
- **Audit:** `returned`, human actor, reason, and the list of new subtasks.

### T11 Split / add subtasks

- **Actors:**
  - The claimant of the task, human or agent run.
  - Any human, when the task is `approved` and unclaimed, when it is a split
    parent in `in_progress` with no claim, or as part of T10.
  - **An agent run adding subtasks to a split parent (A10).** The run is the
    claimant of one of that parent's non-done subtasks. No human is involved.
    This is an interim reading; see Q19.
- **Preconditions:**
  - The task is top-level (A6). Splitting a subtask is rejected.
  - One of the following holds:
    - The task is `approved` and unclaimed, and the actor is human.
    - The task is `in_progress` and the actor is its claimant.
    - The task is a split parent in `in_progress` with no claim, and the actor
      is a human or an eligible agent run.
    - The action is part of T10, performed by a human.
  - Agent actor: the parent is not blocked.
  - At least one subtask is defined. Each has a title, a desired outcome,
    acceptance criteria, and a scope envelope that satisfies the narrowing
    rules (see "Scope envelope").
- **Postconditions:**
  - Each subtask exists, linked to the parent, in state `approved`. T11
    includes the system's automatic approval, so there is no `proposed`
    subtask.
  - Parent state is `in_progress` with **no** active claim. If the splitter held
    a claim on the parent, that claim ends as part of the split.
  - When adding, the existing subtasks are unaffected.
  - The split is atomic: either every subtask is created and the parent is
    updated, or nothing changes.
- **Audit:**
  - On the parent: `split`, with the actor (including agent, model, and run for
    an agent) and the subtask list.
  - On each subtask: `created_by_split` and `auto_approved`, with the system
    actor, citing the parent's approval record and the splitting actor.

### T12 Parent enters review

- **Actor:** System.
- **Trigger:** A subtask of a split parent becomes done through T8 (completion
  on review) or T15 (a human or an eligible agent cancels that subtask), and as
  a result every subtask is done. T16 never triggers T12, because the parent
  itself is being cancelled.
- **Preconditions:** Parent state `in_progress`; the parent has no claim; every
  subtask is done; at least one subtask is `completed`.
- **Postconditions:** Parent state `in_review`. All subtask handoffs, reviews,
  findings, and same-model flags are presented with it in the decision queue.
- **Race:** If two subtasks become done at the same time, the parent enters
  `in_review` exactly once. If a subtask is added (T11) at the same time as the
  last subtask becomes done, the two are ordered. Either the parent enters
  review and the add is rejected, or the subtask is added and the parent stays
  `in_progress`.
- **Audit:** `entered_review_all_subtasks_done`, system actor, and the
  triggering subtask.

### T13 Reopen subtask — removed

Removed on 2026-09-24 (A2, A3). Subtasks are never reopened. A problem found in
a completed subtask is fixed by a new subtask (T8, T10, T11). The ID T13 is
retired and will not be reused. Any request to reopen a terminal task is an
illegal transition (`invalid_transition`).

### T14 Parent falls back

- **Actor:** System.
- **Trigger:** The last non-done subtask is cancelled and no subtask is
  `completed`.
- **Postconditions:** Parent state `approved`, unclaimed, and flagged in the
  decision queue for human attention. It may be claimed (subject to T3), split
  again, or cancelled.
- **Audit:** `split_abandoned_all_subtasks_cancelled`, system actor.

### T15 Cancel

- **Actors:**
  - Human: any non-terminal task, top-level or subtask.
  - Agent, from within a run:
    - a `proposed` task it authored (withdrawal)
    - **a subtask it created (A7)**. The acting run must be bound to that
      subtask's parent or to one of the parent's subtasks. Interim reading:
      "it created" means the subtask's recorded author is the same run. See
      Q18.
- **Preconditions:** The state is non-terminal, and a reason is given.
- **Postconditions:**
  - State `cancelled`.
  - Any active claim ends. If the claimant is an agent run, Moonbeam asks that
    run to stop (runs contract). Open pauses on the task are closed as
    cancelled (pauses contract). Open blockers are closed as moot.
  - If the task is a split parent, every non-done subtask is cancelled (T16).
    `completed` subtasks stay `completed` as history.
  - If the task is a subtask, the parent is re-evaluated. This may trigger T12
    or T14.
  - Nothing is merged into the main branch (I18).
- **Audit:** `cancelled`, actor, reason.

### T16 Cascade cancel

- **Actor:** System.
- **Postconditions:** As T15 for each affected subtask, in the same atomic
  operation as the parent's cancellation.
- **Audit:** `cancelled_by_parent`, system actor, parent cancellation reference.

### C1 Blocked condition

- **Set (add blocker):** A human may add a blocker to any non-terminal task. An
  agent may add one only to the task its run is bound to, as claimant or
  reviewer. A blocker must state what is needed, who can resolve it, and its
  effect.
- **Clear (resolve blocker):** Any human, or the agent run that added the
  blocker while that run is active.
- **Effect on state:** None. `blocked` never changes the lifecycle state.
- **Effective blocking (A9):**
  - The non-done subtasks of a blocked parent are effectively blocked. This is
    derived and displayed. It does not create blocker records on the subtasks.
  - When the parent's last blocker is cleared, its subtasks stop being
    effectively blocked in the same action.
  - A subtask that has no open blockers of its own is then unblocked. Any
    deferred T8 completion takes effect, which may trigger T12.
  - Blockers recorded on a subtask itself stay open until they are resolved.
    This is an interim reading; see Q20.
- **While blocked or effectively blocked:**
  - Rejected:
    - agent claim (T3)
    - hand off (T6)
    - accept (T9)
    - agent split or agent add-subtasks (T11)
    - subtask completion (T8 is deferred until unblocked)
  - Allowed:
    - human claim (T3, still subject to path dependencies)
    - release (T4)
    - automatic claim end (T5)
    - record review (T7)
    - return (T10)
    - human split (T11)
    - cancel (T15)
    - blocker management
  - Claim expiry: an agent-run lease is suspended while the task has an open
    blocker. When the last blocker is cleared, the lease resumes with its
    remaining time. Human claims have no expiry to suspend (A1).
- **Audit:** `blocker_added` / `blocker_resolved`, actor, blocker content.
  Unblocking a parent produces no audit records on its subtasks, because their
  effective blocking is derived. Any T8 or T12 it triggers is audited as
  usual.

### C2 Paused condition (boundary)

The pauses contract defines how pauses are opened, answered, and categorized.
For lifecycle purposes:

- A task is `paused` while any active run on it has an open pause.
- `paused` never changes the lifecycle state.
- The claim is kept while paused, and an agent-run lease is suspended.
- The paused claimant cannot hand off (T6) until the pause is resolved.
- These remain allowed:
  - release (T4)
  - automatic claim end (T5, run-ended trigger only)
  - return
  - cancel

  They close the open pause as superseded or cancelled.
- **Audit:** `paused` / `resumed`, with a reference to the pause record.

### Claim expiry

- **Agent-run claims** carry a lease that the run renews through activity. If
  the lease is not renewed within the **agent claim lease** (30 minutes, the
  approved default, unchanged by A1), the claim expires (T5). A run that ends
  without handoff ends its claim immediately (T5), whatever its lease.
- **Human claims never expire (A1).** They end only when released or broken
  (T4), handed off (T6), ended by a split (T11), or ended by cancellation (T15).
  There is no expiry warning, because there is no expiry.
- Agent-run leases are suspended while the task is paused or blocked.
- The server's clock is authoritative. From the deadline onward, every action
  and view treats the claim as expired, even if the `claim_expired` audit
  record is written slightly later. That record carries the deadline as its
  effective time.
- The lease deadline of an agent-run claim is visible wherever the claim is
  shown. Only the latest renewal time is kept visible. Renewals are not audited
  (A12).

### Scope envelope

- The envelope is set while the task is `proposed` and is fixed at approval.
  After approval, nobody can widen or edit it, including its paths. A human who
  needs a different scope cancels the task and proposes a new one (A8).
- A subtask inherits its parent's envelope and may only narrow it:
  - It includes every parent exclusion, and may add more.
  - It includes every parent constraint, and may add more.
  - It links every contract the parent links, and adds none.
  - Each of its inclusions derives from a named parent inclusion and is no
    broader than it.
  - **Each of its paths is equal to, or contained in, a parent path**
    (ADR-005). It adds no path outside the parent's paths.
- The server enforces the structural rules it can check:
  - every parent exclusion, constraint, and contract is present
  - every inclusion references a parent inclusion
  - no contracts are added
  - every path lies within a parent path

  The server cannot mechanically check whether an inclusion's wording is no
  broader than its source. That is verified by the subtask's agent review and
  by the human deciding on the parent.
- Changes a run makes outside its task's paths are flagged on the review
  surface (ADR-005). They are not a lifecycle gate: they do not block T6 or T9.

### Path dependencies (ADR-005)

- **Recording:** When a task is approved (T2), Moonbeam records a path
  dependency on every unfinished task that was approved earlier and whose
  paths overlap. "Earlier" means an earlier approval time. The dependency is
  shown on both tasks. Paths are fixed at approval (A8), so dependencies are
  never recomputed from edited paths.
- **Effect:** A task with an unfinished path dependency cannot be claimed (T3)
  by a human or an agent. The dependency is finished when the task it points to
  reaches a terminal state:
  - `completed`, which means merged (ADR-005)
  - `cancelled`, which means nothing will be merged
- **Not a blocker:** A path dependency is not a blocker record and not the
  `blocked` condition. It affects only T3. It is shown alongside conditions so
  that the reason a task cannot be claimed is visible.
- **Subtasks:** A subtask never depends on its own parent. How dependencies
  apply to subtasks otherwise is open (Q14):
  - whether subtasks inherit their parent's dependencies
  - whether sibling subtasks with overlapping paths depend on each other
- **Reorder (D1):** A human may reorder a recorded dependency so that the other
  task goes first (ADR-005).
  - Actors: human only. An agent attempt is an authority violation and is
    audited.
  - Effect: the dependency's direction is reversed. No lifecycle state changes.
  - Constraints are open (Q15): whether a reorder may make an already-claimed
    task depend on an unfinished one, and how cycles are prevented.
  - Audit: `path_dependency_reordered` on both tasks, with the human actor.

### Audit record

Every successful transition, condition change, and reorder produces exactly one
audit record per affected task. A split or cascade produces one per task
touched. Each record contains:

- project and task identifiers, and the parent identifier for subtasks
- the action identifier (the names used above)
- from-state and to-state (equal for condition changes, T7, and D1)
- actor kind: human, agent, or system
- actor identity: the selected user; or the agent, model, and run; or, for the
  system, the named trigger
- server timestamp (the effective time, for expiry)
- the required reason or notes: for breaking a claim, return, cancel, review
  waiver, and blockers
- references to related records: claim, handoff, review, blocker, pause,
  parent or subtask records, path dependencies, merge outcome, and the
  originating action for automatic transitions
- for `review_recorded`: the same-model flag (A11)

Audit records are append-only and immutable.

Rejected authority violations are also recorded, as rejected attempts, with the
same actor information. These are agent attempts to approve, accept, return,
reorder a path dependency, break another's claim, or cancel beyond what T15
allows.

Two things are **not** recorded (A12):

- claim renewals
- rejections other than authority violations

## Postconditions and invariants

These hold after every action, at every observable moment.

- **I1 — One state.** Every task is in exactly one lifecycle state.
- **I2 — Human gates.** No `approved`, `accepted`, `returned`, or
  `path_dependency_reordered` audit record has an agent actor. No agent action
  ever succeeds at approving, accepting, returning, or reordering, regardless
  of identity mode.
- **I3 — Approval lineage.** Every task that has ever been `approved` has either
  a human `approved` record or, for a subtask, an `auto_approved` record that
  cites a human-approved parent.
- **I4 — Claim exclusivity.**
  - A task has at most one active claim.
  - A leaf task is `in_progress` if and only if it has exactly one active
    claim.
  - A split parent in `in_progress` has either no claim and at least one
    non-done subtask, or exactly one claim with every subtask done (the case of
    a parent returned without new subtasks).
  - No task in any other state has an active claim.
- **I5 — One task per run.** An agent run holds at most one active claim.
- **I6 — Acceptance.** Every `completed` top-level task has exactly one human
  `accepted` record for its latest entry into review. No subtask has an
  `accepted` record.
- **I7 — Subtask review.** Every `completed` subtask has an agent review against
  its latest handoff, recorded by a reviewer other than its claimant.
- **I8 — Subtasks are born approved.** No subtask is ever in `proposed`.
- **I9 — Parent review readiness.** A split parent in `in_review` has every
  subtask done and at least one `completed`.
- **I10 — Parent completion.** A `completed` or `cancelled` parent has no
  non-done subtask.
- **I11 — Envelope narrowing.** Every subtask's envelope, including its paths,
  satisfies the narrowing rules against its parent's envelope.
- **I12 — Terminal finality.** A task in a terminal state never leaves it. There
  are no exceptions (A2).
- **I13 — No automatic rework loop.** No review ever triggers a transition into
  `approved` or `in_progress`. Only humans return work. New subtasks are
  created only by an explicit human or agent action (T11), never as an
  automatic effect of a review.
- **I14 — No self-starting agents.** Every agent action occurs within a run
  that a human action started.
- **I15 — Audit completeness.** Every state change and condition change has an
  audit record. Each task's current state equals the to-state of its most
  recent state-changing audit record.
- **I16 — Conditions are not states.** Setting or clearing `blocked` or
  `paused` never changes the lifecycle state.
- **I17 — Path dependency.** A claim (T3) is granted only when every path
  dependency of the task, in its direction at that moment, points to a task in
  a terminal state.
- **I18 — Main holds only accepted work (boundary with CONTRACT-004).** A
  task's work reaches the project's main branch only through T9 on that task,
  or on its top-level parent if it is a subtask. T10, T15, and T16 never merge.

## Failure behavior

Every rejection leaves every task, claim, subtask, dependency, and condition
unchanged. It returns one of these categories with a human-readable reason:

| Category | When |
|---|---|
| `not_found` | The task, project, run, referenced subtask, or path dependency does not exist. |
| `authority_violation` | An agent attempts a human-only action: approve, accept, return, reorder a path dependency, break another's claim, or cancel beyond what T15 allows. Always audited as a rejected attempt. |
| `not_permitted` | The actor kind is allowed, but the actor lacks the required relationship: not the claimant, run not bound to this task (or, where T11 or T15 allow, to a sibling subtask), not the blocker's author, or not the subtask's author. |
| `invalid_transition` | The action is not defined for the task's current state or kind. Examples: accepting a subtask, claiming a `completed` task, approving an `approved` task, reopening any terminal task, splitting a subtask. |
| `conflict` | Another action changed the task first. Examples: concurrent claims, accept racing cancel, handoff racing lease expiry, adding a subtask racing the parent's entry into review. The response states the current state and claimant. |
| `blocked` | The action is disallowed while the task is blocked, effectively blocked, or paused, or (for T3) while it has an unfinished path dependency. The response lists the open blockers, the pause, or the unfinished dependencies. |
| `validation` | Required input is missing or invalid. Examples: a missing reason, a missing handoff record, an envelope or path that fails narrowing, approval without acceptance criteria. The response identifies each failing rule. |

Rejections other than `authority_violation` are returned to the caller but not
audited (A12).

Concurrency rules:

- Each action is atomic across the task, its parent, and its subtasks. The
  observable outcome of concurrent actions equals some sequential order of
  them.
- Concurrent claims: exactly one succeeds (I4). The rest receive `conflict`.
- Accept vs. cancel, return vs. accept, handoff vs. expiry, and add subtask vs.
  parent entering review: the first action applied wins. The other receives
  `conflict`, or `invalid_transition` if the state has already changed when it
  is evaluated.
- Last-subtask races: the parent enters `in_review` exactly once (T12).
- A claim racing the completion of the task it depends on is evaluated against
  the dependency's state at the moment the claim is applied.
- Idempotence: repeating an action that already took effect is rejected with
  `invalid_transition` or `conflict` and produces no second state change.

## Interfaces

The server exposes the following actions. The names are illustrative. The
required behavior is the semantics above, and it is identical whether an action
is invoked from the UI or by an agent. Internal representation, endpoints, and
validators are implementation choices.

| Action | Transition(s) |
|---|---|
| create task | T1 |
| approve task | T2 (records path dependencies) |
| claim task | T3 |
| release claim / break claim | T4 |
| renew claim | Extends an agent-run lease. No transition, and not audited (A12). |
| hand off | T6 |
| record review | T7 (→ T8, T12) |
| accept task | T9 (includes the merge, CONTRACT-004) |
| return task (optionally adding new subtasks) | T10 (→ T11) |
| split task / add subtasks | T11 |
| cancel task | T15 (→ T16, T12, T14) |
| add blocker / resolve blocker | C1 (→ deferred T8, T12 on unblock) |
| reorder path dependency | D1 |

No client can request a system transition (T5, T8, T12, T14, T16). There is no
reopen action (T13 removed).

Every task view exposes:

- state and conditions, with open blockers and pause references
- claimant, and the lease deadline for agent-run claims
- parent and subtasks, with their states
- the scope envelope, including paths
- path dependencies in both directions, with each one's state
- for reviews, the same-model flag
- the full audit history

## UX expectations

- Human-only actions (approve, accept, return, reorder a path dependency, and
  break claim) are never offered in an agent context. They are visibly
  attributed to the selected user.
- The decision queue shows at least:
  - `proposed` tasks awaiting approval
  - `in_review` top-level tasks awaiting acceptance or return
  - subtasks whose review recorded findings (for information: a human may add
    a new subtask or block the parent; subtasks cannot be reopened)
  - blocked tasks
  - split parents that fell back (T14)
  - rejected authority-violation attempts
- A split parent in review shows every subtask's handoff, review verdict,
  findings, and same-model flag in one place. The return action lets the human
  add new subtasks. It offers no subtask reopening.
- **Same-model reviews (A11)** carry a visible indicator wherever the review
  appears: the task view, the decision queue, and the parent's review summary.
  The indicator shows that the reviewer used the same model as the
  implementing run. It does not prevent acceptance.
- The claimant is visible wherever a task in `in_progress` is shown. For an
  agent-run claim, the lease deadline is visible too. Breaking a claim requires
  confirmation and a reason.
- A task with an unfinished path dependency shows which task it is waiting for.
  The earlier task shows which tasks are waiting on it. Reordering requires
  confirmation.
- `blocked` and `paused` are shown as badges on top of the state, never as a
  state.
- Rejections are shown with their category and reason. A `conflict` refreshes
  the task to its current state.
- Accepting a top-level leaf task without a recorded review requires an
  explicit waiver step with a reason (A5).

## Validation requirements

Implementation is accepted against this contract when automated tests show the
following:

1. **Transition matrix:** For every state × action × actor kind (human, agent,
   system-only), the action either succeeds as specified or is rejected with the
   specified category, and rejections change nothing. T13 and any other
   reopen attempt are `invalid_transition`.
2. **Agent gate:** Agent attempts to approve, accept, return, or reorder a path
   dependency are rejected with `authority_violation` and recorded. This holds
   even when the request names a human user.
3. **Claim race:** Many concurrent claims on one task produce exactly one claim,
   and every other attempt receives `conflict`.
4. **Expiry:** Agent-run leases expire at their deadlines and are suspended
   while the task is blocked or paused. A run that ends without handoff ends its
   claim. Human claims never expire, however long they are inactive.
5. **Split:**
   - Envelope narrowing rules, including paths, are enforced.
   - Subtasks are born `approved`, with correct audit lineage.
   - The split is atomic.
   - Nested splits are rejected.
   - An eligible agent run can add subtasks to a split parent with no human
     action. An ineligible run is rejected with `not_permitted`.
6. **Subtask flow:**
   - Subtasks are handed off, reviewed, and completed automatically, whatever
     the verdict.
   - The parent enters `in_review` exactly once when the last subtask is done,
     including under concurrent completion and when that races an added
     subtask.
   - The parent falls back when all its subtasks are cancelled.
7. **Return:**
   - A returned leaf goes to `approved`, unclaimed, with return notes.
   - A parent returned with new subtasks goes to `in_progress`, and its
     completed subtasks stay `completed`.
   - A parent returned without new subtasks goes to `approved`.
8. **Cancel:**
   - Cancelling a parent cancels every non-done subtask and ends their claims
     atomically. Completed subtasks are unchanged.
   - An agent can cancel a subtask it created, and cannot cancel any other
     subtask.
   - An agent cancel can trigger T12 or T14.
9. **Conditions:**
   - `blocked` and `paused` never change the state, and they disallow exactly
     the listed actions.
   - Clearing a parent's last blocker unblocks its subtasks in the same action
     and releases deferred T8 completions.
10. **Review independence:** A same-model review is accepted and flagged. A
    different-model review is not flagged. A review of human-claimed work is
    not flagged.
11. **Path dependencies:**
    - Approval records a dependency on every unfinished, earlier-approved task
      with overlapping paths.
    - A claim is rejected with `blocked` while a dependency is unfinished.
    - Completion or cancellation of the earlier task allows the claim.
    - Reorder reverses the dependency and is human-only.
12. **Accept boundary:** T9 invokes the merge defined by CONTRACT-004. T10, T15,
    and T16 never merge (I18).
13. **Audit:**
    - Every successful action produces the specified audit records with the
      correct actor kind.
    - Each task's state matches its latest state-changing record (I15).
    - Claim renewals and non-authority rejections produce no audit records
      (A12).
14. **Invariants I1–I18** are checked after each step of a randomized sequence
    of actions. A property-style test is recommended but not required.

Board review of this contract was the validation for TASK-002. Board review of
the 2026-09-24 revision diff is the validation for TASK-004.

## Open questions

These were uncovered by the 2026-09-24 revision (TASK-004) and are **not
decided**. Where this contract needed an interim reading to stay coherent, it
is marked "interim" in the body and repeated here. The board may confirm or
change each one.

- **Q14 — Path dependencies within a split.** ADR-005 defines dependencies
  between tasks by approval order. A subtask is approved at split time, and it
  completes on review without being merged: its work reaches main only when the
  parent is accepted. This contract states only that a subtask never depends on
  its own parent. It does not decide:
  - (a) whether subtasks inherit their parent's dependencies. Without
    inheritance, a human could split a parent that is waiting on an earlier
    task, and its subtasks could be claimed before that task merges.
  - (b) whether sibling subtasks with overlapping paths depend on each other.
    If they do, what finishes the dependency, given that a completed sibling is
    not yet on main? This needs to be aligned with CONTRACT-004's branch model.
- **Q15 — Reordering constraints.** ADR-005 says a board member may reorder a
  dependency. This contract reverses the pair. It does not decide:
  - whether a reorder may make a task that is already `in_progress` (or
    further along) depend on an unfinished task
  - how cycles among three or more overlapping tasks are prevented or resolved
- **Q16 — Returned split parent without new subtasks.** A3 says rework uses new
  subtasks. This contract keeps the approved Q3 default: a parent returned
  without new subtasks goes to `approved`, and its claimant may either add
  subtasks or do the fix-up work directly. Should direct work on a returned
  parent be disallowed, so that all rework goes through new subtasks? If direct
  work stays, does the parent's own handoff need an agent review before
  acceptance, as a leaf's does?
- **Q17 — Merge failure at acceptance.** ADR-005 says merging is acceptance. If
  the merge cannot be completed (for example, a conflict or a stale branch),
  which of these happens?
  - The accept is rejected, and the task stays `in_review`.
  - The task becomes `completed` with the merge pending, as with a write-back
    failure.
  - Something else.

  This must be answered together with CONTRACT-004, which defines conflict
  handling. This contract does not specify it.
- **Q18 — Which agent "created" a subtask (A7).** Interim reading: only the run
  that created the subtask may cancel it, while that run is active and bound to
  the parent or a sibling subtask. Should a later run of the same agent or role
  also qualify? May an agent cancel a subtask it created when another run has
  claimed that subtask? Under the interim reading, it may, and the other run is
  asked to stop.
- **Q19 — Which agent runs may add subtasks (A10).** Interim reading: the
  claimant run of the parent, or the claimant run of one of the parent's
  non-done subtasks. Should a reviewer run whose subtask review has findings
  also be able to add a fix subtask? Note that recording that review completes
  the subtask immediately, which may send the parent into review first.
- **Q20 — Scope of unblocking (A9).** Interim reading: clearing the parent's last
  blocker ends the derived "effectively blocked" condition on its subtasks.
  Blockers recorded on a subtask itself stay open. Did the board mean that
  unblocking a parent should also resolve its subtasks' own blockers?
- **Q21 — Paths at approval and overlap.**
  - Must a task declare at least one path to be approved?
  - How is a task with no declared paths treated for overlap? The interim
    shared-checkout rule in the root `AGENTS.md` treats unknown paths as
    overlapping.
  - Is the interim overlap definition (same file or directory, or one
    directory containing the other) right?
  - What path syntax is allowed? For example, are glob patterns allowed?

## Resolved questions

The board's answers are preserved as written. Where an answer was corrected or
clarified, both versions are kept.

- **Q1 — Claim expiry values.** Proposed: agent-run lease 30 minutes renewed by
  run activity; human claim 7 days of inactivity. Alternative: human claims never
  expire. Should an expiring human claim warn the claimant first (no
  notifications exist in V1)?
  A1 - human claims never expire.
  *Applied:* Claim expiry, T3, T5, C1, C2. The agent-run lease is unchanged at
  30 minutes. The warning question is moot.
- **Q2 — Subtask review with findings.** Proposed (A): the subtask completes on
  any recorded review and findings are carried to the parent's review; humans
  can reopen a subtask earlier. Alternative (B): a review with findings holds
  the subtask in `in_review` until a human disposes of it — closer to "findings
  go to a human" per subtask, but it is effectively a per-subtask human decision,
  which the 2026-09-24 decision avoided.
  A2 - similar to DbC ideals, a subtask once the agent(s) mark it as completed are done.  no reopening, instead if a problem is found a new subtask is created, run, closed.
  *Applied:* T8, T10, T13 removed, I2, I12, I13, UX, and validation items 1, 6,
  and 7.
- **Q3 — Returning a split parent without reopening.** Proposed: the parent goes
  to `approved` and becomes directly claimable for integration work.
  Alternative: require reopening at least one subtask or adding one.
  a3 - I think a2 answers this as the subtask won't reopen it would create new ones.
  *Applied:* T10. Remaining ambiguity is raised as Q16.
- **Q4 — Where a returned leaf task goes.** Proposed: `approved`, unclaimed, with
  return notes. Alternative: `in_progress` with the prior claimant retained
  (matches the classic DbC folder flow, but agent runs usually end at handoff).
  a4 - again I think there should not be returned leafs.
  a4 (corrected 2026-09-24) - leaf tasks can be returned. The proposed default
  stands: back to `approved`, unclaimed, with return notes.
  *Applied:* T10.
- **Q5 — Review before acceptance.** Proposed: a leaf top-level task needs a
  recorded review of its latest handoff, or an explicit human waiver with a
  reason. Alternatives: review is never required, or never waivable.
  a5 - is this still a question with a1-a4 answered?
  a5 (clarified 2026-09-24) - yes. A top-level leaf task needs an agent review
  before acceptance, and a human may override that with a recorded reason (the
  proposed default).
  *Applied:* T9, UX.
- **Q6 — Nested splits.** Proposed: not allowed in V1 (only top-level tasks
  split). Allowing nesting raises the question of how a mid-level subtask gets
  reviewed and completed.
  a6 - I agree only top level spilts.  if another layer of splits is needed then I think we failed on the initial planning stage.
  *Applied:* Definitions, T11.
- **Q7 — Agent cancellation.** Proposed: agents may only withdraw `proposed`
  tasks they authored. Should an agent claimant be able to cancel a subtask it
  finds redundant, or must it raise a blocker for a human?
  a7 - agents can close subtasks it created.
  *Applied:* T15, T12, global precondition 3, failure categories. The
  authorship reading is raised as Q18.
- **Q8 — Scope envelope after approval.** Proposed: fixed; changing scope means
  cancelling and re-proposing. Alternative: a human may edit it, which then
  requires re-checking existing subtasks against the edited envelope.
  a8 - yes cancel and repropose.
  *Applied:* Scope envelope, Path dependencies.
- **Q9 — Blocked vs. claims.** Proposed: blocking suspends claim expiry; agents
  cannot claim a blocked task but humans can; a blocked parent effectively
  blocks its subtasks. Confirm each point.
  a9 - yes agents cannot claim a blocked task and blocking the parent effectively blocks all subtasks. but also unblocking the parent unblocks all subtasks
  *Applied:* C1. The scope of unblocking is raised as Q20.
- **Q10 — Adding subtasks after a split.** Proposed: humans may add subtasks to
  an unclaimed split parent in `in_progress`; agents may not (they propose a new
  task or raise a blocker). Confirm.
  a10 - I don't think the person should have to be involved in raising/blocking subtasks.
  *Applied:* T11, global precondition 3. Run eligibility is raised as Q19.
- **Q11 — Reviewer independence for human-claimed work.** Proposed: any agent
  reviewer satisfies independence when the claimant was a human. Should the
  reviewer also be required to use a different model than the implementing run?
  a11 - strngly suggested to have a different model then the implementing one.  But I don't think we can go as far as requiring.
  *Applied:* T7, T12, Audit record, Interfaces, UX, and validation item 10.
- **Q12 — Audit granularity.** Are claim renewals recorded in the audit trail
  (proposed: no, only the latest renewal time is visible), and are rejected
  actions other than authority violations recorded (proposed: no)?
  a12 - no and no
  *Applied:* Claim expiry, Audit record, Failure behavior, Interfaces, and
  validation item 13.
- **Q13 — Identity dependency.** This contract assumes the identity and
  permission interface (ADR-003 follow-up) reliably distinguishes agent
  credentials from UI user selection. That contract should be produced before
  or alongside implementation of this one.
  a13 - that makes sense and I agree.
  *Applied:* Scope (Excluded).
