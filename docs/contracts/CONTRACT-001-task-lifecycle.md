# CONTRACT-001: Task lifecycle, claims, and splits

Status: Approved (to be superseded by CONTRACT-005 once CONTRACT-005 is approved)
Approved by: Patrick
Approved date: 2026-09-24
Revised: 2026-09-24 (TASK-004; TASK-012; TASK-013); 2026-09-25 (TASK-014), see
"Revision history"
Related tasks: TASK-002, TASK-004, TASK-012, TASK-013, TASK-014
Related ADRs: ADR-001, ADR-003, ADR-005 (as amended), ADR-006, ADR-007
(Proposed) (context: ADR-004)
Related contracts: CONTRACT-002 (identity), CONTRACT-003 (run and review
views), CONTRACT-004 (task branches, worktrees, and integration into main)

## Revision history

### 2026-09-25 — TASK-014: board answers, round 2 (Q24, Q25, CONTRACT-004 Q19, Q20)

The board answered the questions TASK-013 raised on 2026-09-25. The principle
behind the answers is ADR-007 (Proposed): gates bind agents, humans may
override, and every override is recorded. This revision applies the answers
that concern this contract. It does not change the approval.

- **Q24 (decision queue):** completed top-level tasks whose work is not on main
  appear in the decision queue as their own group, "Accepted, not merged", with
  refused merges first. *Changed:* UX expectations.
- **Q25 (known conflict at acceptance):** refuses the accept with
  `merge_conflict` by default. A human may use "accept anyway", which is
  recorded as an override. *Changed:* transition table (T9), T9, Audit record,
  Failure behavior, Interfaces, validation item 12.
- **CONTRACT-004 Q19 (hand merges are fact):** a hand merge is always accepted
  as fact. A hand merge made while a top-level task is `in_review` makes it
  `completed` through the new system transition **M3 Accepted by early merge**,
  with the note "accepted by early merge; review skipped". *Changed:*
  Definitions (integration status), transition table (M3), M1, M2, new M3,
  Audit record, I6, I22, Interfaces, validation item 15.
- **CONTRACT-004 Q20 (record after a hand merge):** the hand merge stands; the
  task record is written or updated, with a note, in the next merge Moonbeam
  performs in that project. *Changed:* M1, M2.
- **Overrides (ADR-007 point 4):** new "Overrides" subsection of the audit
  record: who, when, what was bypassed, and the reason when one was given, on
  the task and in its task record.
- Q24 and Q25 moved to "Resolved questions". New open question Q26 (hand
  merges before acceptance outside `in_review`).

### 2026-09-24 — TASK-013: ADR-006, the ADR-005 amendment, Q22 and Q23

The board approved ADR-006, amended ADR-005 so that acceptance and merge are
separate human steps, and answered Q22 and Q23 when approving TASK-013. This
revision applies them. It does not change the approval.

Changed transitions and actions:

- **T9 Accept:** no longer merges and no longer changes the repository. It
  records the accepted commit. The Board A4 rule "if the merge fails at
  acceptance, the accept is rejected and the task stays `in_review`" is removed
  from T9 and re-expressed at merge time in M1: a merge that cannot be made is
  refused, and the task stays `completed` with integration status "Merge
  refused". A merge conflict known at acceptance is a warning, not a refusal
  (interim reading, Q25; superseded by TASK-014, which restores the refusal
  with an "accept anyway" override). T9 no longer raises `merge_conflict`; it raises
  `repository_unavailable` only when the changed-file set cannot be
  determined.
- **New M1 Merge into main:** human only, for a completed top-level task whose
  work is not on main. Refused with `merge_conflict`, `working_folder_unsafe`
  (new, ADR-006 decision 4), or `repository_unavailable`. The permanent record
  is written as part of the merge.
- **New M2 Merge by hand detected:** system. Records that a completed task's
  work reached main by hand.
- **Path dependencies (ADR-005 amendment):** a queue or inherited dependency on
  a top-level task is finished when that task is cancelled or its work is on
  main, not when it is completed. Completed tasks stay in the queue until their
  work is on main.
- **D1 (Board Q22):** a human may also move a subtask among its siblings.
  Sibling order starts as creation order.
- **T2 (Board Q23):** the interim reading is confirmed. There is no separate
  "changes no files" declaration.
- Pushing main is a human-only action defined by CONTRACT-004 B16. It has no
  lifecycle effect.

Other changes:

- States (`completed`), Definitions (project queue, sibling order, path
  dependency, accepted commit, on main, integration status), Actors (system),
  Audit record, Failure behavior, Concurrency, Interfaces, UX, and validation
  items 2, 11, 12, 14, and 15.
- Invariants: I2, I17, I18, and I19 reworded; new I21 (acceptance leaves the
  repository unchanged) and I22 (merges follow acceptance).
- Q22 and Q23 moved to "Resolved questions". Q17's resolution carries a
  supersession note. New open questions Q24 (ADR-005 amendment, open point 3)
  and Q25. The amendment's other two open points are CONTRACT-004 Q19 and Q20.

### 2026-09-24 — TASK-012: board answers, round 1 sheet

The board answered `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`, following
every recommendation. This revision applies the answers that concern this
contract and aligns it with CONTRACT-002, CONTRACT-003, and CONTRACT-004. It
does not change the approval.

Citation convention: **"Board A4"** (or B1, C3, …) refers to an item on that
answer sheet. A bare **"A4"** still refers to the answer to this contract's own
Q4 (TASK-004 revision).

Changed transitions and conditions:

- **T2 Approve:** a task that changes files must declare paths. Paths are plain
  file and directory paths, with no globs. Approval places the task at the end
  of its project's queue (Board A1, A3).
- **T3 Claim:** path dependencies now include those inherited from the parent
  and those on earlier sibling subtasks (Board A2). Branch creation can reject a
  claim (CONTRACT-004).
- **T5:** a run ends as finished, failed, or stopped (Board C5).
- **T6 Hand off:** the branch must merge cleanly into its integration target.
  A split parent that has a completed subtask cannot be handed off (Board A4,
  A5).
- **T7 Record review:** a reviewer run of a subtask may add fix subtasks to the
  parent in the same atomic step, when its review has findings (Board A6). "Same
  model" is defined (Board C6).
- **T8:** completion integrates the subtask into the parent's branch. An
  integration failure raises a system blocker on the parent (Board A4).
- **T9 Accept:** the review requirement is keyed to how the task entered review.
  Out-of-scope files need a written reason. The merge and the permanent record
  succeed or fail together with acceptance; a failed merge rejects the accept
  and the task stays `in_review` (Board A4, C3, C4).
- **T10 Return:** a split parent returned without new subtasks goes to
  `approved`, and its claimant may only add subtasks (Board A5).
- **T11:** eligible agent runs confirmed; reviewer runs added (Board A6).
- **T15 Cancel:** an agent may cancel only a subtask its own run created, and
  only while the subtask has never been claimed (Board A6).
- **C1 Blocked:** the system may add one kind of blocker, for subtask
  integration failure (Board A4). The scope of unblocking is confirmed (Board
  A7).
- **D1:** pairwise reordering of a dependency is replaced by moving a task's
  position in the per-project queue (Board A3).

Other changes:

- Definitions: overlap and path syntax are decided (Board A1); new terms
  "project queue", "inherited" and "sibling" path dependencies.
- The "Path dependencies" section is rewritten around the queue (Board A2, A3).
- Failure behavior lists `unidentified` (CONTRACT-002) and the repository
  categories of CONTRACT-004, and states the order in which checks apply (Board
  A8).
- Audit records carry the identity mode `selected` for human actors (Board A8).
  The acceptance record carries the out-of-scope reason and the warnings
  confirmation (Board C4).
- Invariants: I2, I13, I17, and I18 reworded; new I19 (queue order) and I20
  (returned split parents are not worked directly).
- Q14–Q21 moved to "Resolved questions". New open questions Q22 and Q23.

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
- the per-project queue and the path dependencies that make overlapping tasks
  sequential
- the human-only merge of a completed task into main, and detection of a merge
  done by hand (ADR-005 as amended)
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
- The per-project queue and path dependencies between tasks with overlapping
  paths (ADR-005, Board A2, A3): ordering, inherited and sibling dependencies,
  the effect on claiming, and moving a task in the queue or a subtask among its
  siblings (Board Q22).
- Splits:
  - subtask creation, including subtasks added later by humans, claimant runs,
    or reviewer runs
  - scope-envelope narrowing
  - automatic approval
  - subtask review and completion
  - parent entry into review and parent acceptance
  - parent return with new subtasks, and what a returned parent's claimant may
    do
- Cancellation, including cascade to subtasks.
- The one blocker the system raises: a completed subtask whose work cannot be
  integrated into its parent's branch (Board A4).
- That handoff requires a cleanly mergeable branch, that acceptance changes
  nothing in the repository, and that the merge into main (with the permanent
  record) is a separate human action on a completed task (M1), as boundaries
  with CONTRACT-004.
- Detection of a completed task's work reaching main by hand (M2), and its
  effect on path dependencies.
- Failure behavior: illegal transitions, authority violations, concurrent races,
  and the order in which identity, lifecycle, and repository checks apply.

### Excluded (boundaries only)

- **Runs**: how an agent run is started, observed, stopped, and ended. This
  contract relies only on these points:
  - An agent acts only within a run.
  - A run is started by a human action.
  - A run is bound to one task.
  - A run can end with or without a handoff. A run ends as `finished`,
    `failed`, or `stopped` (Board C5; CONTRACT-003 names these statuses for the
    future runs contract).
  - A run has a known model.

  These are defined by a future runs contract.
- **Task branches, the merge into main, pushing, and the permanent record**
  (CONTRACT-004, ADR-005 as amended, ADR-006): the projects root and project
  registration, branch naming and creation, task worktrees, updating a stale
  branch, conflicts, subtask integration, the merge itself and its project
  folder safety check, commit and author policy, the permanent task record,
  pushing main, integration status, and cleanup. This contract states only
  where those outcomes gate or follow a lifecycle action or a merge: T3, T6,
  T8, T9, T10, T11, T15/T16, M1, M2, the system blocker in C1, and invariants
  I18, I21, and I22.
- **Review surface** (ADR-005 point 2, CONTRACT-003): what Moonbeam displays for
  a task in review, including the flag on changed files that fall outside the
  task's paths. The flag itself is a display matter. This contract only requires
  a written reason at acceptance when such files exist (T9, Board C4).
- **Pauses in detail**: categories, questions, answers, and pause review. This
  contract defines only how the `paused` condition interacts with the lifecycle
  and with claims. These are defined by a future pauses contract.
- **Identity and permission interface** (CONTRACT-002): how the server knows the
  current actor and whether it is a human or an agent. This contract relies on
  that interface to report actor *kind* reliably (A13) and to reject
  unidentified requests before any rule here applies.
- Handoff and review document content, beyond their existence as records.
- Scope-envelope editing workflows beyond what is stated in "Scope envelope".
- Visual design of the dashboard and decision queue.

## Actors

| Actor kind | Who | Identified by |
|---|---|---|
| **Human** | Any board member. In V1 every user is a board member with full authority (ADR-003). | The user chosen in the user select, with identity mode `selected` (CONTRACT-002). |
| **Agent** | A specialist AI worker acting inside a run. Never a board member. | The server-recognized agent credential, the run it acts in, and that run's model. |
| **System** | Moonbeam itself, performing only the automatic transitions and the one system blocker this contract names. | A system actor plus the named trigger. |

Rules for actor kind:

- The server determines actor kind from how the request is authenticated. It
  never uses a value the caller declares. A request made with agent credentials
  is an agent action even if it names a human user (CONTRACT-002, R1–R3).
- The system actor never performs, on its own initiative, a transition this
  contract reserves for humans: approving a top-level task, accepting,
  returning, moving a task in the queue, cancelling an approved task, or
  merging into main (M1). It never pushes (CONTRACT-004 B16). Its automatic
  subtask approval is derived from a human approval of the parent and is
  recorded as such. The only blocker it adds is the subtask integration blocker
  (C1), and it never resolves blockers. Its only action toward main is
  detecting a merge done by hand (M2).

Roles referenced below:

- **Claimant**: the human or agent run that holds the active claim on a task.
- **Author**: the actor that created a task. For a subtask, this is the actor
  that performed the split or added the subtask. For a subtask added by an agent,
  the author is that specific run.
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
  scope envelope. Each path is a plain file or directory path relative to the
  repository root. Glob patterns are not allowed (Board A1).
- **Overlapping paths** (Board A1): two tasks overlap when any path of one names
  the same file or directory as a path of the other, or one path is a directory
  that contains the other. A task with no paths never overlaps any task.
- **Project queue** (Board A3, ADR-005 amendment): each project's ordering of
  its approved top-level tasks that are unfinished, or `completed` with their
  work not yet on main. A task joins the end of the queue when it is approved
  (T2), keeps its position through every later state, and leaves the queue
  when it is cancelled or when its work is on main. Only D1 changes the order.
- **Sibling order** (Board A2, Q22): the order of a split parent's subtasks. It
  starts as creation order: subtasks created in the same split or addition are
  ordered as listed in that action, and new subtasks join the end. A human may
  change it with D1.
- **Path dependency** (ADR-005 as amended, Board A2, A3): a derived
  relationship that makes one task wait for another. A task has three kinds:
  - **Queue dependency** (top-level task): on every task ahead of it in the
    project queue whose paths overlap its paths.
  - **Inherited dependency** (subtask): every path dependency its parent has.
  - **Sibling dependency** (subtask): on every sibling subtask ahead of it in
    sibling order whose paths overlap its paths.

  A queue or inherited dependency is **finished** when the task it points to is
  `cancelled`, or is `completed` with its work on main (ADR-005 amendment).
  A sibling dependency is finished when the sibling is in a terminal state
  (`completed` means its work was integrated into the parent's branch). A
  dependency that is not finished is **unfinished**.
- **Accepted commit**: the commit a human accepted at T9 (CONTRACT-004): the
  latest handoff commit, or for a split parent that entered review by
  subtasks, its branch head.
- **On main**: a completed task's accepted commit is contained in the project's
  main branch, through a Moonbeam merge (M1) or a merge done by hand (M2).
- **Integration status**: for a completed top-level task, whether its work is
  not merged, merged by Moonbeam, or merged by hand (including accepted by
  early merge, M3), the outcome of its latest refused merge request, whether
  its task record is written, and whether it is pushed (CONTRACT-004 B17).
- **Unfinished**: in a non-terminal state.
- **Blocker**: a record stating what is needed, who can resolve it, and its
  effect. A task is `blocked` while it has at least one open blocker. It is
  "effectively blocked" while its parent is blocked (see C1).
- **System blocker**: the one blocker the system raises, on a split parent, when
  a completed subtask's work cannot be integrated into the parent's branch (C1,
  Board A4).
- **Paused**: a run on the task has an open pause (a question awaiting a human).
- **Entered review by handoff / by subtasks**: a task's latest entry into
  `in_review` was through T6 (a handoff), or through T12 (all subtasks done).

## Preconditions

Global preconditions for any action:

1. The server has resolved the actor through CONTRACT-002: human (with the
   selected user), agent, or system. A request whose actor cannot be resolved is
   rejected `unidentified` before anything in this contract is evaluated.
2. The task exists and belongs to a registered project.
3. An agent action names the run it is acting in, and that run is active. The
   run must be bound to the task being acted on. For creation, the run is bound
   to the task the proposal arises from. There are these exceptions, as the
   named sections specify:
   - a run bound to a subtask may add subtasks to that subtask's parent (T11);
   - a reviewer run recording a review of a subtask may, in the same action, add
     subtasks to that subtask's parent (T7, T11);
   - a run bound to the parent or to one of its subtasks may cancel a subtask
     that this same run created, while that subtask has never been claimed
     (T15).

   Runs are started only by a human action. There are no scheduled or
   self-waking agents.

Action-specific preconditions are in the transition table.

## Required behavior

### States

| State | Meaning | Claim |
|---|---|---|
| `proposed` | A plan exists. Work is not authorized. | Never |
| `approved` | A human authorized the scope, directly or through the parent for subtasks. Ready to be claimed once it has no unfinished path dependency. | None |
| `in_progress` | Being worked. A leaf task has exactly one active claim. A split parent has no claim while work proceeds through its non-done subtasks. | Leaf: exactly one. Split parent: see invariant I4. |
| `in_review` | Work has been handed off (leaf, or a split parent with no completed subtask), or all subtasks are done (split parent). Awaiting review and, for top-level tasks, a human decision. | None |
| `completed` | Top-level: a human accepted it (T9). Accepting does not merge: the work reaches main later, by a human-requested merge (M1) or by hand (M2), shown as integration status. Subtask: an independent agent review was recorded. | None |
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
| T2 | Approve | `proposed` → `approved` | **Human only** | Top-level task; scope envelope and acceptance criteria present; paths are plain paths. Joins the end of the project queue. |
| T3 | Claim | `approved` → `in_progress` | Human; Agent (in a run) | No active claim; not a split parent with non-done subtasks; no unfinished path dependency (queue, inherited, or sibling); agent: not blocked. |
| T4 | Release claim | `in_progress` → `approved` | Claimant (human or agent); any Human (breaking another's claim) | Active claim exists. |
| T5 | Claim ends automatically | `in_progress` → `approved` | System | Agent-run lease expired, or the claiming run ended without handoff. |
| T6 | Hand off | `in_progress` → `in_review` | Claimant only | Handoff record present; not blocked; not paused; not a split parent with a completed subtask; branch merges cleanly into its integration target. |
| T7 | Record review | `in_review` → `in_review` (top-level) | Agent reviewer (in a run) | Reviewer is not the claimant whose work is reviewed. Same-model reviews are flagged. On a subtask, may add fix subtasks to the parent in the same action. |
| T8 | Subtask completes on review | `in_review` → `completed` (subtask) | System | T7 recorded on a subtask; subtask not blocked. Integrates into the parent's branch. |
| T9 | Accept | `in_review` → `completed` | **Human only** | Top-level task; no non-done subtasks; not blocked; review requirement met; out-of-scope reason if needed; no known conflict with main unless "accept anyway" (Q25). Changes nothing in the repository. |
| T10 | Return | `in_review` → `approved` or `in_progress` | **Human only** | Reason given. Leaf → `approved`. Split parent: see T10. |
| T11 | Split / add subtasks | parent: `approved`/`in_progress` → `in_progress`; subtasks: (none) → `approved` | Claimant (human or agent); any Human if the task is unclaimed; Agent run bound to a non-done subtask; Agent reviewer run with T7 | Top-level task; subtask envelopes narrow the parent's; agent: parent not blocked. |
| T12 | Parent enters review | `in_progress` → `in_review` (split parent) | System | Last non-done subtask became done and at least one subtask is `completed`. |
| T13 | *Removed 2026-09-24 (A2): subtasks are never reopened.* | — | — | — |
| T14 | Parent falls back | `in_progress` → `approved` (split parent) | System | All subtasks are `cancelled`. |
| T15 | Cancel | any non-terminal → `cancelled` | Human; Agent only for a `proposed` task it authored or a never-claimed subtask its run created | Reason given. Cascades to subtasks (T16). |
| T16 | Cascade cancel | any non-terminal → `cancelled` (subtask) | System | Parent was cancelled. |
| C1 | Block / unblock | condition only | Human; Agent only on the task its run is bound to; System (adds the integration blocker only) | See C1. |
| C2 | Pause / resume | condition only | Defined by the pauses contract | See C2. |
| D1 | Move task in project queue, or subtask among its siblings | no state change | **Human only** | Top-level task in the queue, or a subtask (Board Q22); no started task gains an unfinished path dependency. See "Project queue and path dependencies". |
| M1 | Merge into main | no state change (`completed`) | **Human only** | Top-level `completed` task whose work is not on main; project folder safe; merges cleanly. See M1. |
| M2 | Merge by hand detected | no state change (`completed`) | System | Main contains the accepted commit of a completed top-level task that has no Moonbeam merge. See M2. |
| M3 | Accepted by early merge | `in_review` → `completed` | System | Main contains the review commit of a top-level `in_review` task, merged by hand before acceptance (CONTRACT-004 Q19). See M3. |

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
  - **Paths (Board A1):** every task that changes files must declare the paths
    it may change. A task with no paths, such as a pure planning or review task,
    is approved as a task that changes no files. Every path is a plain file or
    directory path relative to the repository root. A path that is a glob
    pattern, is absolute, or leaves the repository root is rejected with
    `validation`. The server cannot tell whether a task will change files.
    Approving a task with no paths approves it as a task that changes no
    files; any file it does change is outside its paths and needs a written
    reason at acceptance (T9). No separate declaration is required (Board
    Q23).
- **Postconditions:**
  - State `approved`, with the approver and time recorded.
  - The scope envelope, including its paths, is fixed (see "Scope envelope").
  - The task joins the **end of its project's queue** (Board A3). Its queue
    dependencies are therefore on every earlier-approved task still in the
    queue whose paths overlap: unfinished, or completed with its work not yet
    on main (ADR-005 as amended).
- **Audit:** `approved`, human actor, the queue position assigned, and the list
  of path dependencies the task has at that moment.
- **Note:** A task approved without paths never overlaps, so it has no path
  dependencies and no task depends on it.

### T3 Claim

- **Actors:** A human, claiming for themselves. An agent acting in a run: the
  claimant is the run, attributed to the agent and model.
- **Preconditions:**
  - State `approved`, with no active claim.
  - The task is not a split parent with non-done subtasks. Its work is claimed
    through its subtasks.
  - **No unfinished path dependency** (ADR-005, Board A2): no queue dependency,
    and for a subtask no inherited or sibling dependency, points to an
    unfinished task. This applies to human and agent claims alike. A subtask
    never depends on its own parent.
  - Agent claims only: the task is not blocked or effectively blocked.
  - Agent claims only: the run does not already hold a claim on another task. A
    run works one task.
  - The task branch can be created or reused (CONTRACT-004 B1, B2). Otherwise
    the claim is rejected with the repository category CONTRACT-004 names.
- **Postconditions:** State `in_progress`, with exactly one active claim naming
  the claimant and the claim start time. For an agent-run claim, the claim also
  records its lease deadline. Human claims have no deadline (A1).
- **Claiming a returned split parent (Board A5):** the claim authorizes only
  adding subtasks (T11), releasing (T4), and blocker management. The claimant
  cannot hand off (T6) and does not change the parent's files (CONTRACT-004).
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
  - **Run ended without handoff:** the run holding the claim ends (`finished`,
    `failed`, or `stopped`, Board C5) without performing T6.
- Human claims never end automatically. They end only through T4, T6, T10,
  T11, or T15.
- **Preconditions:** State `in_progress`, and the claim that triggered this is
  still the active claim.
- **Postconditions:** As T4. Anyone may then claim the task, subject to T3.
  Uncommitted work in the run's checkout is not published (CONTRACT-004, Board
  C5).
- **Audit:** `claim_expired` or `claim_ended_run_finished`, system actor, former
  claimant, and the deadline or run outcome.

### T6 Hand off

- **Actors:** The claimant only. Another human who wants to hand off must first
  break the claim (T4) and then claim it (T3).
- **Preconditions:**
  - State `in_progress`, and the actor is the claimant.
  - The task is a leaf task, or a split parent none of whose subtasks is
    `completed` (for example after T14). A split parent with a completed subtask
    is never handed off: its rework goes through new subtasks (Board A5).
    Otherwise `invalid_transition`.
  - A handoff record exists for this attempt, stating what changed, what was
    validated, deviations, and risks.
  - The task is not blocked or effectively blocked.
  - The task is not paused.
  - **Mergeable (Board A4):** the task branch, at the handoff commit, merges
    cleanly into its integration target: main for a top-level task, the
    parent's branch for a subtask (CONTRACT-004 B6). Otherwise the handoff is
    rejected with `merge_conflict`, naming the conflicting files. The handoff is
    also rejected if its commit cannot be recorded (`repository_unavailable`) or
    the branch's published history was rewritten (`history_rewritten`).
- **Postconditions:**
  - State `in_review`.
  - The claim ends: in-review tasks have no claimant.
  - The handoff, its handoff commit, and the former claimant are recorded as
    the work under review. For an agent run, this includes the run's model.
  - An agent run may then end normally.
- **Audit:** `handed_off`, claimant, handoff reference, handoff commit.

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
- **Same model (Board C6):** two runs use the same model when they report the
  same model identifier, regardless of endpoint or runner. Two quantizations of
  one model count as the same model. Different versions of a model family are
  different models. The server decides the flag, so every view agrees.
- **Adding fix subtasks with the review (Board A6):** when the review is of a
  subtask and records at least one finding, the reviewer run may add one or
  more subtasks to that subtask's parent as part of the same action (T11). The
  review, the added subtasks, and the reviewed subtask's completion (T8) take
  effect atomically. Because the added subtasks are not done, the parent does
  not enter review (T12) in between. If any part is rejected, nothing changes;
  the reviewer may then record the review alone.
- **Postconditions:**
  - A review record exists with its verdict, findings, and same-model flag. It
    is linked to the handoff it reviews.
  - Findings are presented to humans in the decision queue. There is **no
    automatic loop from reviewer to implementer**. No review ever moves a task
    back to `approved` or `in_progress`, and no review starts a run.
  - Top-level task: the state stays `in_review`, awaiting T9 or T10.
  - Subtask: triggers T8.
- **Audit:** `review_recorded`, reviewer (agent, model, run), verdict, findings
  reference, same-model flag, and any subtasks added with it.

### T8 Subtask completes on review

- **Actor:** System.
- **Preconditions:** A review (T7) was recorded on a subtask in `in_review`, and
  the subtask is not blocked or effectively blocked. If it is blocked,
  completion happens automatically when it is no longer blocked or effectively
  blocked (see C1).
- **Postconditions:**
  - Subtask state is `completed`, whatever the review verdict (A2).
  - **Integration (CONTRACT-004 B3):** as part of the completion, Moonbeam
    merges the subtask's branch into the parent's branch. If that merge fails,
    the subtask is still `completed`, its work is not integrated, and the system
    adds the integration blocker to the parent in the same action (C1, Board
    A4).
  - The review's findings stay attached to the subtask. They are carried
    forward to the parent's review so the human deciding on the parent sees
    them.
  - The subtask is done and is **never reopened**. If a problem needs fixing,
    the fix is a new subtask. Before the parent enters review, a human or an
    eligible agent run can add it (T7, T11). After the parent enters review, the
    human adds it when returning the parent (T10).
  - A human never accepts a subtask individually.
- **Audit:** `subtask_completed_on_review`, system actor, review reference, and
  the integration outcome.
- **Follow-on:** May trigger T12.

### T9 Accept

- **Actors:** Human only. Agent attempts are rejected as authority violations
  and audited. A human may accept work they claimed themselves (ADR-003).
- **Preconditions:**
  - State `in_review`, and the task is top-level. Subtasks cannot be accepted.
  - No subtask is non-done.
  - The task is not blocked.
  - **Review requirement (A5, Board A5):**
    - A task that **entered review by handoff** (T6) has at least one agent
      review recorded against its latest handoff, **or** the accepting human
      explicitly waives review and gives a reason. This covers every top-level
      leaf task.
    - A split parent that **entered review by subtasks** (T12) needs no
      parent-level review, because each subtask was reviewed.
  - **Out-of-scope files (Board C4):** if the work to be merged changes any file
    outside the task's paths (CONTRACT-004 changed-file set), the accepting
    human gives a written reason. For a task with no paths, every changed file
    is outside its paths. A missing reason is rejected with `validation`.
  - **No merge (ADR-005 amendment).** Accepting does not merge and does not
    change the project repository. Until the TASK-013 revision, T9 included
    the merge, and a failed merge rejected the accept (Board A4). That rule now
    applies to the merge action (M1). The out-of-scope check needs the task's
    changed-file set (CONTRACT-004). If it cannot be determined, the accept is
    rejected with `repository_unavailable`.
  - **Known conflict (Board, 2026-09-25, Q25).** If the task branch is known
    not to merge cleanly into current main (for example because main moved
    since the handoff), the accept is refused by default with
    `merge_conflict`, naming the conflicting files. Returning the task (T10)
    resolves the conflict on the branch. A human may instead use **"accept
    anyway"**, an explicit override (ADR-007 point 3): the accept then
    proceeds, the override is recorded (see "Overrides" under Audit record),
    and a merge requested later is refused until the conflict is resolved
    (CONTRACT-004 B7). The interim reading (conflict as a warning only) is
    withdrawn.
  - Main having moved since the handoff or review does not prevent acceptance.
    It is shown as a warning (Board C4, CONTRACT-003).
- **Postconditions:**
  - State `completed`, with the acceptor and time recorded.
  - The accepted commit is recorded (CONTRACT-004).
  - Integration status is Not merged. The project repository, including main,
    the task branch, and the project folder, is unchanged (I21).
  - Tasks with a path dependency on this task keep waiting until its work is
    on main (M1, M2).
- **Audit:** `accepted`, human actor, review references or waiver reason, the
  out-of-scope reason if any, whether the human confirmed the warnings shown at
  acceptance (CONTRACT-003 A-1), the accepted commit, and, when "accept anyway"
  was used, the override (known conflict bypassed, with the conflicting
  files).

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
  - **Split parent, without new subtasks (Board A5):** parent state becomes
    `approved`, unclaimed, with the return notes. Its subtasks stay
    `completed`. Whoever claims it may only add subtasks (T11), following the
    return notes, or release it. It may not be worked directly and cannot be
    handed off (T6). No parent-level review is needed afterwards, because each
    new subtask gets its own review.
- A return merges nothing into the main branch. The returned work continues on
  its task branch (CONTRACT-004 B10, ADR-005).
- **Audit:** `returned`, human actor, reason, and the list of new subtasks.

### T11 Split / add subtasks

- **Actors:**
  - The claimant of the task, human or agent run.
  - Any human, when the task is `approved` and unclaimed, when it is a split
    parent in `in_progress` with no claim, or as part of T10.
  - **An agent run that has claimed one of the parent's non-done subtasks**
    (A10, Board A6). No human is involved.
  - **An agent reviewer run, as part of recording its review (T7) of one of the
    parent's subtasks**, when that review has at least one finding (Board A6).
- **Preconditions:**
  - The task is top-level (A6). Splitting a subtask is rejected.
  - One of the following holds:
    - The task is `approved` and unclaimed, and the actor is human.
    - The task is `in_progress` and the actor is its claimant.
    - The task is a split parent in `in_progress` with no claim, and the actor
      is a human or the claimant run of one of its non-done subtasks.
    - The action is part of T7 on one of the parent's subtasks, performed by
      that review's reviewer run, and the review records at least one finding.
      The parent is a split parent in `in_progress` with no claim.
    - The action is part of T10, performed by a human.
  - Agent actor: the parent is not blocked.
  - At least one subtask is defined. Each has a title, a desired outcome,
    acceptance criteria, and a scope envelope that satisfies the narrowing
    rules (see "Scope envelope").
  - If the parent has no task branch yet, one can be created (CONTRACT-004 B2).
- **Postconditions:**
  - Each subtask exists, linked to the parent, in state `approved`. T11
    includes the system's automatic approval, so there is no `proposed`
    subtask. Its author is the splitting human or the specific agent run.
  - New subtasks join the end of the sibling order, in the order listed. Each
    new subtask's sibling dependencies are determined by sibling order (see
    "Project queue and path dependencies").
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
- **Postconditions:** Parent state `in_review`, entered by subtasks. All subtask
  handoffs, reviews, findings, and same-model flags are presented with it in the
  decision queue.
- **Race:** If two subtasks become done at the same time, the parent enters
  `in_review` exactly once. If a subtask is added (T11) at the same time as the
  last subtask becomes done, the two are ordered. Either the parent enters
  review and the add is rejected, or the subtask is added and the parent stays
  `in_progress`. A reviewer run's addition made together with its review (T7) is
  never separated from it, so it always keeps the parent in `in_progress`.
- **Note:** If the parent carries the integration blocker when it enters review,
  it cannot be accepted until that blocker is resolved (T9). The human returns
  it with a fix subtask (T10) and resolves the blocker.
- **Audit:** `entered_review_all_subtasks_done`, system actor, and the
  triggering subtask.

### T13 Reopen subtask — removed

Removed on 2026-09-24 (A2, A3). Subtasks are never reopened. A problem found in
a completed subtask is fixed by a new subtask (T7, T8, T10, T11). The ID T13 is
retired and will not be reused. Any request to reopen a terminal task is an
illegal transition (`invalid_transition`).

### T14 Parent falls back

- **Actor:** System.
- **Trigger:** The last non-done subtask is cancelled and no subtask is
  `completed`.
- **Postconditions:** Parent state `approved`, unclaimed, and flagged in the
  decision queue for human attention. It may be claimed (subject to T3), split
  again, or cancelled. Because none of its subtasks is completed, its claimant
  may work it directly and hand it off (T6).
- **Audit:** `split_abandoned_all_subtasks_cancelled`, system actor.

### T15 Cancel

- **Actors:**
  - Human: any non-terminal task, top-level or subtask.
  - Agent, from within a run:
    - a `proposed` task it authored (withdrawal)
    - **a subtask its own run created (A7, Board A6)**, only while that subtask
      is `approved` and has never been claimed. The acting run must be the
      subtask's recorded author and must be bound to the parent or to one of
      the parent's subtasks. A later run of the same agent or role does not
      qualify.
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
  - Nothing is merged into the main branch or into a parent's branch (I18,
    CONTRACT-004 B11).
- **Audit:** `cancelled`, actor, reason.

### T16 Cascade cancel

- **Actor:** System.
- **Postconditions:** As T15 for each affected subtask, in the same atomic
  operation as the parent's cancellation.
- **Audit:** `cancelled_by_parent`, system actor, parent cancellation reference.

### M1 Merge into main (ADR-005 amendment, ADR-006)

- **Actors:** Human only. Moonbeam performs the merge. An agent attempt is
  rejected as an authority violation and audited. The system never merges on
  its own initiative.
- **Preconditions:**
  - The task is top-level and `completed`. Otherwise `invalid_transition`:
    subtasks never merge into main, and main holds only accepted work.
  - Its work is not on main: no Moonbeam merge is recorded and no hand merge
    has been detected. Otherwise `invalid_transition`.
  - The repository step succeeds (CONTRACT-004 B7, B15): the main checkout is
    safe to update, the accepted commit merges cleanly into main, and the
    project repository can be written. Otherwise the merge is refused with
    `working_folder_unsafe`, `merge_conflict`, or `repository_unavailable`.
- **Postconditions:**
  - The lifecycle state stays `completed`.
  - The accepted commit is merged into main, and the permanent record is
    written in that same merge commit (CONTRACT-004 B7, B9). For a split
    parent, this includes its subtasks' integrated work and records.
  - The same merge commit also writes or updates, with a note, the task
    record of every task in the project that was merged by hand (M2, M3) and
    whose record is not yet written (Board, 2026-09-25, CONTRACT-004 Q20;
    CONTRACT-004 B9). Their record status becomes written.
  - Integration status is Merged by Moonbeam.
  - The task leaves the project queue, and path dependencies on it are
    finished.
- **Refusal (Board A4, re-expressed at merge time):** before the ADR-005
  amendment, a failed merge rejected the accept and the task stayed
  `in_review`. Now the merge itself is refused. Main, the project folder, and
  the task are unchanged. The task stays `completed`, and its integration
  status shows Merge refused, with the category and details, until the next
  request. That status is informational: it is not a lifecycle state or
  condition, and not an audit record (A12). After a conflict, a board member
  may request the merge again later, or merge the branch by hand in the
  project folder, resolving the conflict there. A hand merge is accepted as
  fact and detected by M2 (Board, 2026-09-25, CONTRACT-004 Q19).
- Main having moved since the review or acceptance does not prevent a clean
  merge. It is shown as a warning (Board C4, CONTRACT-003).
- **Audit:** `merged`, human actor, from-state and to-state `completed`, and
  the merge commit.

### M2 Merge by hand detected

- **Actor:** System.
- **Trigger:** Moonbeam observes that main contains the accepted commit of a
  completed top-level task that has no Moonbeam merge (CONTRACT-004 B14).
- **Postconditions:**
  - The lifecycle state stays `completed`.
  - Integration status is Merged by hand, with the main commit at which it was
    detected.
  - The task leaves the project queue, and path dependencies on it are
    finished.
  - The hand merge stands (ADR-007 point 2). Moonbeam never reverts it.
  - The permanent record is not written by the hand merge. It is written or
    updated, with a note that the task was merged by hand, in the next merge
    Moonbeam performs in the project (M1; Board, 2026-09-25, CONTRACT-004
    Q20). Until then its record status is "Record not written".
  - The hand merge is recorded as an override (see "Overrides" under Audit
    record): the Moonbeam merge step was bypassed. If a merge of the task was
    refused earlier, that refusal is named in the override.
  - If the merge's author, as git records it, is not the acceptor, this is
    noted on the task and in its record (Board, 2026-09-25, CONTRACT-004 Q22).
- **Audit:** `merge_detected`, system actor, the main commit, and the override.

### M3 Accepted by early merge

Board, 2026-09-25 (CONTRACT-004 Q19): a hand merge is always accepted as fact.
If it happens before acceptance, the task is treated as accepted.

- **Actor:** System.
- **Trigger:** Moonbeam observes that main contains the review commit of a
  top-level task in `in_review`: the handoff commit of its latest handoff
  (T6), or, for a split parent that entered review by T12, its branch head
  recorded at that entry (CONTRACT-004 B14). Whether this also applies to
  tasks in other states is open (Q26).
- **Preconditions:** none beyond the trigger. The hand merge is fact, so the
  T9 preconditions (review requirement, out-of-scope reason, known conflict)
  are not checked. Their absence is recorded in the override.
- **Postconditions:**
  - State `completed`. The acceptor is recorded as none, with the note
    "accepted by early merge; review skipped". The accepted commit is the
    review commit.
  - Integration status is Merged by hand, with the main commit at which it was
    detected. Everything M2 states about the record, the override, the
    author note, the project queue, and path dependencies applies.
- **Override record:** the human acceptance (T9) and its review requirement
  were bypassed, together with the Moonbeam merge step.
- **Audit:** `accepted_by_early_merge`, system actor, from-state `in_review`,
  to-state `completed`, the main commit, the review commit, and the override.
  It stands in place of both `accepted` and `merge_detected` for this task.

### C1 Blocked condition

- **Set (add blocker):**
  - A human may add a blocker to any non-terminal task.
  - An agent may add one only to the task its run is bound to, as claimant or
    reviewer.
  - **The system (Board A4)** adds exactly one kind of blocker: the
    **integration blocker**, on a split parent, when a completed subtask's work
    cannot be merged into the parent's branch (T8, CONTRACT-004 B3). It states
    which subtask's work is missing and the conflicting files (what is needed),
    that a board member resolves it, typically by adding a fix subtask that
    redoes or ports the work (who and how), and that the parent cannot be
    accepted and agents cannot claim or add its subtasks until it is resolved
    (effect).

  Every blocker must state what is needed, who can resolve it, and its effect.
- **Clear (resolve blocker):** Any human, or the agent run that added the
  blocker while that run is active. The integration blocker is resolved only by
  a human; the system never resolves a blocker.
- **Effect on state:** None. `blocked` never changes the lifecycle state.
- **Effective blocking (A9, Board A7):**
  - The non-done subtasks of a blocked parent are effectively blocked. This is
    derived and displayed. It does not create blocker records on the subtasks.
  - When the parent's last blocker is cleared, its subtasks stop being
    effectively blocked in the same action.
  - A subtask that has no open blockers of its own is then unblocked. Any
    deferred T8 completion takes effect, which may trigger T12.
  - Blockers recorded on a subtask itself stay open until someone resolves
    them. Unblocking the parent does not resolve them (Board A7).
- **While blocked or effectively blocked:**
  - Rejected:
    - agent claim (T3)
    - hand off (T6)
    - accept (T9)
    - agent split or agent add-subtasks (T11, including a reviewer run's
      addition with T7)
    - subtask completion (T8 is deferred until unblocked)
  - Allowed:
    - human claim (T3, still subject to path dependencies)
    - release (T4)
    - automatic claim end (T5)
    - record review (T7, without adding subtasks)
    - return (T10)
    - human split (T11)
    - cancel (T15)
    - blocker management
  - Claim expiry: an agent-run lease is suspended while the task has an open
    blocker. When the last blocker is cleared, the lease resumes with its
    remaining time. Human claims have no expiry to suspend (A1).
- **Audit:** `blocker_added` / `blocker_resolved`, actor (for the integration
  blocker, the system actor and the triggering subtask), blocker content.
  Unblocking a parent produces no audit records on its subtasks, because their
  effective blocking is derived. Any T8 or T12 it triggers is audited as usual.

### C2 Paused condition (boundary)

The pauses contract defines how pauses are opened, answered, and categorized.
For lifecycle purposes:

- A task is `paused` while any active run on it has an open pause. Each pause is
  answered separately, and the run resumes when all its pauses are answered
  (Board C5).
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
  needs a different scope cancels the task and proposes a new one (A8). A pause
  answer cannot widen it either.
- Paths follow the syntax in "Definitions": plain file and directory paths, no
  globs (Board A1).
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
  - every path lies within a parent path, and no path is a glob

  The server cannot mechanically check whether an inclusion's wording is no
  broader than its source. That is verified by the subtask's agent review and
  by the human deciding on the parent.
- Changes a run makes outside its task's paths are flagged on the review
  surface (ADR-005, CONTRACT-003). They do not block T6. At T9 they require a
  written reason (Board C4).

### Project queue and path dependencies (ADR-005, Board A2, A3)

- **Queue:** each project has one queue of its approved top-level tasks that
  are unfinished, or completed with their work not yet on main (ADR-005
  amendment). Approval (T2) appends a task. A task leaves the queue when it is
  cancelled or when its work is on main (M1, M2). Returned tasks (T10),
  fallen-back parents (T14), and accepted tasks not yet on main keep their
  position. Subtasks have no queue position of their own; they have a sibling
  order.
- **Queue dependencies:** a top-level task depends on every task ahead of it in
  the queue whose paths overlap its paths. Without reordering, "ahead" means
  approved earlier, as ADR-005 states. Dependencies are derived from the queue
  and the fixed paths (A8); they are never recomputed from edited paths.
- **Inherited dependencies (Board A2):** a subtask has every path dependency of
  its parent. If the parent is waiting on an earlier task, its subtasks wait
  too. A parent may be split while it waits.
- **Sibling dependencies (Board A2):** a subtask depends on every sibling
  ahead of it in sibling order whose paths overlap its paths. Overlapping
  siblings therefore run in sibling order, which is creation order unless a
  human changed it (D1, Board Q22). The dependency is finished when the earlier
  sibling is terminal: `completed`, which means its work was merged into the
  parent's branch (CONTRACT-004 B3), or `cancelled`, which means nothing will
  be. If a completed sibling's work could not be integrated, the integration
  blocker on the parent (C1) holds agent work until a human resolves it.
- **A subtask never depends on its own parent.**
- **Effect:** A task with an unfinished path dependency of any kind cannot be
  claimed (T3), by a human or an agent. A queue or inherited dependency is
  finished when the task it points to is:
  - `completed` with its work on main, merged by Moonbeam (M1) or by hand (M2)
    (ADR-005 amendment). Acceptance alone does not finish it.
  - `cancelled`, which means nothing will be merged
- **Not a blocker:** A path dependency is not a blocker record and not the
  `blocked` condition. It affects only T3. It is shown alongside conditions so
  that the reason a task cannot be claimed is visible, on both the waiting task
  and the task it waits for.
- **Move in queue (D1, Board A3):** a human may move a top-level task to a new
  position in its project's queue.
  - Actors: human only. An agent attempt is an authority violation and is
    audited.
  - Effect: the task's queue position changes, and every task's queue
    dependencies follow the new order. No lifecycle state changes. Because the
    queue is a single order, a move cannot create a dependency cycle.
  - Constraint: a move is rejected with `invalid_transition` if, as a result, a
    task that is `in_progress` or `in_review` would gain an unfinished path
    dependency it did not have before: that is, it would end up behind a task
    with overlapping paths that has not finished it (unfinished, or completed
    but not on main) and was not already ahead of it.
    This covers moving a started task back, and moving another task ahead of a
    started one. The rejection names the started task. (A parent split while it
    waited is `in_progress` with an unfinished dependency already; that existing
    dependency does not by itself make other moves fail.)
  - **Sibling order (Board Q22):** a human may likewise move a subtask to a new
    position among its siblings. The same constraint applies to siblings that
    are `in_progress` or `in_review`. A move never changes a subtask's parent.
  - Audit: `queue_reordered` on the moved task, with its old and new position
    (in the queue, or among its siblings),
    and `path_dependencies_changed` on every other task whose dependencies
    changed, each with the human actor and the dependencies gained and lost.

### Audit record

Every successful transition, condition change, queue move, merge (M1),
detected hand merge (M2), and acceptance by early merge (M3) produces exactly one audit record per affected task. A split or cascade produces one per task
touched. Each record contains:

- project and task identifiers, and the parent identifier for subtasks
- the action identifier (the names used above)
- from-state and to-state (equal for condition changes, T7, D1, M1, and M2)
- actor kind: human, agent, or system
- actor identity: the selected user and the identity mode (`selected` in V1,
  CONTRACT-002, Board A8); or the agent, model, and run; or, for the system,
  the named trigger
- server timestamp (the effective time, for expiry)
- the required reason or notes: for breaking a claim, return, cancel, review
  waiver, out-of-scope files at acceptance, and blockers
- references to related records: claim, handoff and handoff commit, review,
  blocker, pause, parent or subtask records, path dependencies, merge commit,
  and the originating action for automatic transitions
- for `review_recorded`: the same-model flag (A11) and any subtasks added with
  the review
- for `accepted`: whether the human confirmed the warnings shown at acceptance

Audit records are append-only and immutable.

Rejected authority violations are also recorded, as rejected attempts, with the
same actor information. These are agent attempts to approve, accept, return,
move a task in the queue, merge into main, push main, break another's claim,
or cancel beyond what T15 allows (and any other human-only action in
CONTRACT-002).

Two things are **not** recorded (A12):

- claim renewals
- rejections other than authority violations

#### Overrides (ADR-007 point 4; Board, 2026-09-25)

An override is a human action that bypasses a gate: inside Moonbeam, "accept
anyway" (T9); outside Moonbeam, a hand merge detected by M2 or M3. Moonbeam
never blocks or reverts an override made outside it (ADR-007 point 2). Every
override is recorded, as part of the audit record of the action that carries
it (`accepted`, `merge_detected`, or `accepted_by_early_merge`), with:

- **who:** for "accept anyway", the selected user; for a hand merge, the merge
  commit's author and committer as git records them, matched to a registry user
  by e-mail address where possible (honor-system, ADR-003)
- **when:** the server time of the action or detection, and for a hand merge
  also the merge commit's time
- **what was bypassed:** the known conflict and its files; the Moonbeam merge
  step (and any earlier refused merge); or, for M3, human acceptance and review
- **the reason**, when one was given. "Accept anyway" offers an optional reason
  field. A hand merge carries no reason; its commit message is kept.

The override is shown on the task and written into the task's record in the
repository (CONTRACT-004 B9). Listing overrides for review (ADR-007 point 5) is
phase 4 work and not part of this contract.

## Postconditions and invariants

These hold after every action, at every observable moment.

- **I1 — One state.** Every task is in exactly one lifecycle state.
- **I2 — Human gates.** No `approved`, `accepted`, `returned`, `merged`, or
  `queue_reordered` audit record has an agent actor. No agent action ever
  succeeds at approving, accepting (including waiving review), returning,
  moving a task in the queue, merging into main, or pushing main, regardless
  of identity mode.
- **I3 — Approval lineage.** Every task that has ever been `approved` has either
  a human `approved` record or, for a subtask, an `auto_approved` record that
  cites a human-approved parent.
- **I4 — Claim exclusivity.**
  - A task has at most one active claim.
  - A leaf task is `in_progress` if and only if it has exactly one active
    claim.
  - A split parent in `in_progress` has either no claim and at least one
    non-done subtask, or exactly one claim with every subtask done (a parent
    returned without new subtasks, or one that fell back under T14, and was
    then claimed).
  - No task in any other state has an active claim.
- **I5 — One task per run.** An agent run holds at most one active claim.
- **I6 — Acceptance.** Every `completed` top-level task has, for its latest
  entry into review, exactly one of: a human `accepted` record, or a system
  `accepted_by_early_merge` record (M3, Board 2026-09-25). No subtask has
  either record.
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
  created only by an explicit human or agent action (T11), including a reviewer
  run's explicit addition made with its review (T7), never as an automatic
  effect of a review.
- **I14 — No self-starting agents.** Every agent action occurs within a run
  that a human action started.
- **I15 — Audit completeness.** Every state change and condition change has an
  audit record. Each task's current state equals the to-state of its most
  recent state-changing audit record.
- **I16 — Conditions are not states.** Setting or clearing `blocked` or
  `paused` never changes the lifecycle state.
- **I17 — Path dependency.** A claim (T3) is granted only when every path
  dependency of the task (queue, inherited, and sibling), in the queue and
  sibling order at that moment, is finished: the task it points to is
  `cancelled`, or `completed` (sibling), or `completed` with its work on main
  (queue and inherited).
- **I18 — Main holds only accepted work (boundary with CONTRACT-004).** Moonbeam
  puts a task's work on the project's main branch only through M1 on that
  task, or on its top-level parent if it is a subtask, after that task was
  accepted (T9), and only together with its permanent record. T6, T8, T9, T10,
  T15, and T16 never merge into main. (Before the TASK-013 revision, the merge
  was part of T9.) Commits and merges a person makes to main by hand, outside
  Moonbeam, are outside this invariant and are shown as a warning
  (CONTRACT-004, Board C3).
- **I19 — Queue order.** Each project's queue is a single total order of its
  queued top-level tasks, and each split parent's sibling order is a single
  total order of its subtasks. Path dependencies derived from them never form
  a cycle.
- **I20 — Returned split parents are not worked directly.** A split parent with
  at least one `completed` subtask never has a handoff (T6) of its own (Board
  A5).
- **I21 — Acceptance leaves the repository unchanged.** T9 changes no branch,
  not main, and not the project folder (ADR-005 amendment).
- **I22 — Merges follow acceptance.** Every successful M1 is on a `completed`
  top-level task, and a task has at most one of: a Moonbeam merge (M1), a
  detected hand merge (M2), or an acceptance by early merge (M3).

## Failure behavior

Every rejection leaves every task, claim, subtask, queue position, and condition
unchanged, and leaves the repository unchanged (CONTRACT-004). It returns one of
these categories with a human-readable reason.

Lifecycle and identity categories:

| Category | When |
|---|---|
| `unidentified` | The actor cannot be resolved (CONTRACT-002): no selected user, an inactive user, or an invalid, expired, or ended-run agent credential. Evaluated before anything else. Not audited. |
| `not_found` | The task, project, run, or referenced subtask does not exist. |
| `authority_violation` | An agent attempts a human-only action (CONTRACT-002 list): approve, accept (including a review waiver), return, move a task in the queue, merge into main, push main, break another's claim, or cancel beyond what T15 allows. Always audited as a rejected attempt. |
| `not_permitted` | The actor kind is allowed, but the actor lacks the required relationship: not the claimant, run not bound to this task (or, where T7, T11, or T15 allow, to a sibling subtask), not the blocker's author, not the subtask's creating run, or the subtask has been claimed. |
| `invalid_transition` | The action is not defined for the task's current state or kind. Examples: accepting a subtask, claiming a `completed` task, approving an `approved` task, reopening any terminal task, splitting a subtask, handing off a split parent that has a completed subtask, a queue move that would give a started task a new unfinished path dependency, merging a task that is not `completed`, is a subtask, or is already on main. |
| `conflict` | Another action changed the task first. Examples: concurrent claims, accept racing cancel, handoff racing lease expiry, adding a subtask racing the parent's entry into review. The response states the current state and claimant. |
| `blocked` | The action is disallowed while the task is blocked, effectively blocked, or paused, or (for T3) while it has an unfinished path dependency of any kind. The response lists the open blockers, the pause, or the unfinished dependencies. |
| `validation` | Required input is missing or invalid. Examples: a missing reason, a missing handoff record, an envelope or path that fails narrowing, a glob or absolute path, approval without acceptance criteria, acceptance with out-of-scope files and no reason, a reviewer's subtask addition with a review that has no findings. The response identifies each failing rule. |

Repository categories (defined by CONTRACT-004, raised by lifecycle actions):

| Category | Raised by | When |
|---|---|---|
| `merge_conflict` | T6, T9, M1 | The branch does not merge cleanly into its integration target. The conflicting files are named. For T9, only when the conflict with main is known and "accept anyway" was not used (Q25; T9 raised it until the TASK-013 revision, not at all between TASK-013 and TASK-014, and again since). |
| `working_folder_unsafe` | M1 | Main is checked out in a folder that is not safe to update: uncommitted changes, an operation in progress, or untracked files in the merge's way (CONTRACT-004 B15, ADR-006). The folder and what to fix are named. |
| `repository_unavailable` | T3, T6, T9, T11, M1 | The project repository cannot be read or written when the action needs it (for T9, to determine the changed-file set), or its registered folder is missing. |
| `branch_name_taken` | T3, T11 | The task's branch name exists without a Moonbeam record for this task. |
| `history_rewritten` | T6 | The published task branch history was rewritten. |

Order of evaluation (Board A8, CONTRACT-002): identity (`unidentified`), then
permission (`authority_violation`, and `not_permitted` for targets outside an
agent run's binding), then the lifecycle rules of this contract, then the
repository step. An agent attempt at a human-only action is therefore always
`authority_violation`, whatever the task's state and even if the task does not
exist. A repository failure is reported only when every lifecycle precondition
holds.

Rejections other than `authority_violation` are returned to the caller but not
audited (A12).

Concurrency rules:

- Each action is atomic across the task, its parent, its subtasks, and the
  repository step it includes. The observable outcome of concurrent actions
  equals some sequential order of them.
- Concurrent claims: exactly one succeeds (I4). The rest receive `conflict`.
- Accept vs. cancel, return vs. accept, handoff vs. expiry, and add subtask vs.
  parent entering review: the first action applied wins. The other receives
  `conflict`, or `invalid_transition` if the state has already changed when it
  is evaluated. (Before the TASK-013 revision, an acceptance whose merge had
  landed on main won over a concurrent return or cancel. Acceptance no longer
  merges, so first-applied-wins applies.)
- Merges (M1) into one project's main branch are applied one at a time
  (CONTRACT-004 B7). Of concurrent merge requests for the same task, exactly
  one succeeds; the others receive `conflict` or `invalid_transition`. A merge
  request racing a detected hand merge (M2) is evaluated against whether the
  work is on main when it is applied.
- Last-subtask races: the parent enters `in_review` exactly once (T12).
- A claim racing the completion of the task it depends on, or a queue move, is
  evaluated against the dependency's state and the queue order at the moment
  the claim is applied.
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
| approve task | T2 (joins the project queue) |
| claim task | T3 |
| release claim / break claim | T4 |
| renew claim | Extends an agent-run lease. No transition, and not audited (A12). |
| hand off | T6 |
| record review (optionally adding fix subtasks to the parent) | T7 (→ T11, T8, T12) |
| accept task (with waiver reason, out-of-scope reason, warnings confirmation, and "accept anyway" with an optional reason, as needed) | T9 (no merge; records the accepted commit) |
| merge task into main | M1 (includes the permanent record, CONTRACT-004 B7, B9) |
| return task (optionally adding new subtasks) | T10 (→ T11) |
| split task / add subtasks | T11 |
| cancel task | T15 (→ T16, T12, T14) |
| add blocker / resolve blocker | C1 (→ deferred T8, T12 on unblock) |
| move task in project queue / move subtask among its siblings | D1 |

Pushing main is a project action defined by CONTRACT-004 B16. It has no
lifecycle effect.

No client can request a system transition (T5, T8, T12, T14, T16, M2, M3) or add
the integration blocker. There is no reopen action (T13 removed).

Every task view exposes:

- state and conditions, with open blockers (including who raised each, and the
  integration blocker) and pause references
- claimant, and the lease deadline for agent-run claims
- parent and subtasks, with their states
- the scope envelope, including paths
- queue position (top-level tasks) and path dependencies in both directions, by
  kind (queue, inherited, sibling), with each one's state
- for reviews, the same-model flag
- for a completed top-level task, the accepted commit and the integration
  status (CONTRACT-004 B17)
- the full audit history

The project exposes its queue in order, including completed tasks whose work
is not yet on main, with each task's state, integration status, and
overlapping tasks.

## UX expectations

- Human-only actions (approve, accept, waive review, return, move in queue,
  merge into main, push main, and break claim) are never offered in an agent
  context. They are visibly
  attributed to the selected user.
- The decision queue shows at least:
  - `proposed` tasks awaiting approval
  - `in_review` top-level tasks awaiting acceptance or return
  - subtasks whose review recorded findings (for information: a human may add
    a new subtask or block the parent; subtasks cannot be reopened)
  - blocked tasks, including split parents with the integration blocker
  - split parents that fell back (T14)
  - rejected authority-violation attempts
  - **"Accepted, not merged"** (Board, 2026-09-25, Q24): completed top-level
    tasks whose work is not on main, as their own group, with tasks whose
    latest merge was refused listed first. They are also shown in the project
    queue, the task detail, and the integration panel (CONTRACT-003 RS-15).
- Accepting states that it does not merge. Merging and pushing are separate
  actions on the completed task (CONTRACT-003 RS-15). A refused merge says
  exactly what to fix and that nothing changed.
- Approving a task that declares no paths states that it is approved as a task
  that changes no files (Board A1).
- A split parent in review shows every subtask's handoff, review verdict,
  findings, and same-model flag in one place. The return action lets the human
  add new subtasks. It offers no subtask reopening. Returning without new
  subtasks states that the next claimant may only add subtasks (Board A5).
- **Same-model reviews (A11)** carry a visible indicator wherever the review
  appears: the task view, the decision queue, and the parent's review summary.
  The indicator shows that the reviewer used the same model as the
  implementing run. It does not prevent acceptance.
- The claimant is visible wherever a task in `in_progress` is shown. For an
  agent-run claim, the lease deadline is visible too. Breaking a claim requires
  confirmation and a reason.
- A task with an unfinished path dependency shows which task it is waiting for
  and why (queue, inherited from the parent, or an earlier sibling). The task
  it waits for shows which tasks are waiting on it. Moving a task in the queue
  requires confirmation and shows which dependencies the move changes.
- `blocked` and `paused` are shown as badges on top of the state, never as a
  state.
- Rejections are shown with their category and reason. A `conflict` refreshes
  the task to its current state.
- Accepting a task that entered review by handoff without a recorded review
  requires an explicit waiver step with a reason (A5). Accepting with files
  outside the task's paths requires a written reason (Board C4).

## Validation requirements

Implementation is accepted against this contract when automated tests show the
following:

1. **Transition matrix:** For every state × action × actor kind (human, agent,
   system-only), the action either succeeds as specified or is rejected with the
   specified category, and rejections change nothing. T13 and any other
   reopen attempt are `invalid_transition`. Handing off a split parent that has
   a completed subtask is `invalid_transition`.
2. **Agent gate and check order:** Agent attempts to approve, accept, waive
   review, return, move a task in the queue, merge into main, or push main are
   rejected with
   `authority_violation` and recorded. This holds even when the request names a
   human user, and even when the task is in a state or does not exist.
   Unresolvable actors are rejected `unidentified` and not recorded.
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
   - A claimant run of the parent or of a non-done sibling can add subtasks with
     no human action. An ineligible run is rejected with `not_permitted`.
   - A reviewer run can add fix subtasks together with a review that has
     findings. The review, the additions, and the subtask's completion are
     atomic, and the parent never enters review in between. Without findings
     the addition is rejected with `validation`.
6. **Subtask flow:**
   - Subtasks are handed off, reviewed, and completed automatically, whatever
     the verdict.
   - Completion integrates the subtask into the parent's branch. A failed
     integration completes the subtask and adds the system integration blocker
     to the parent in the same action.
   - The parent enters `in_review` exactly once when the last subtask is done,
     including under concurrent completion and when that races an added
     subtask.
   - The parent falls back when all its subtasks are cancelled.
7. **Return:**
   - A returned leaf goes to `approved`, unclaimed, with return notes.
   - A parent returned with new subtasks goes to `in_progress`, and its
     completed subtasks stay `completed`.
   - A parent returned without new subtasks goes to `approved`. Its claimant
     can add subtasks and release, and cannot hand off.
8. **Cancel:**
   - Cancelling a parent cancels every non-done subtask and ends their claims
     atomically. Completed subtasks are unchanged.
   - An agent run can cancel a subtask it created while that subtask has never
     been claimed. It cannot cancel a subtask created by another run, or one
     that has been claimed.
   - An agent cancel can trigger T12 or T14.
9. **Conditions:**
   - `blocked` and `paused` never change the state, and they disallow exactly
     the listed actions.
   - Clearing a parent's last blocker unblocks its subtasks in the same action
     and releases deferred T8 completions. A subtask's own blockers stay open.
   - The system adds only the integration blocker, and only a human resolves
     it.
10. **Review independence:** A same-model review (same model identifier,
    including a different quantization) is accepted and flagged. A
    different-model review is not flagged. A review of human-claimed work is
    not flagged.
11. **Queue and path dependencies:**
    - Approval appends the task to the queue, and it depends on every
      unfinished, earlier-queued task with overlapping paths.
    - Glob, absolute, and escaping paths are rejected at approval. A task with
      no paths overlaps nothing.
    - A subtask cannot be claimed while its parent has an unfinished
      dependency, or while an earlier overlapping sibling is unfinished.
    - A claim is rejected with `blocked` while any dependency is unfinished.
      Cancellation of the earlier task allows it. For a queue or inherited
      dependency, acceptance of the earlier task alone does not; its merge
      (M1) or a detected hand merge (M2) does. For a sibling dependency, the
      sibling's completion does.
    - Moving a task in the queue, or a subtask among its siblings, changes
      dependencies accordingly, is human-only, never creates a cycle, and is
      rejected if a started task would gain an unfinished path dependency.
12. **Repository boundary:** T6 is rejected with `merge_conflict` when the
    branch does not merge cleanly into its target. T9 changes nothing in the
    repository. While the branch conflicts with main, T9 is rejected with
    `merge_conflict` and changes nothing, unless "accept anyway" is used; then
    it succeeds and its audit record carries the override. Acceptance with
    out-of-scope files and no reason is rejected. T10,
    T15, and T16 never merge (I18).
15. **Merge (M1, M2):** a merge is human-only and allowed only for a completed
    top-level task not on main; otherwise `invalid_transition`. A merge
    refused with `merge_conflict`, `working_folder_unsafe`, or
    `repository_unavailable` leaves the task `completed`, main unchanged, and
    shows Merge refused. A successful merge records `merged` and finishes
    dependents' path dependencies. A hand merge is detected as M2 with a system
    audit record carrying the override, and has the same effect on
    dependencies. A hand merge of an `in_review` task's review commit moves it
    to `completed` by M3 with the note "accepted by early merge; review
    skipped". The next successful M1 in the project writes the records of
    hand-merged tasks whose records were not yet written, each with its note.
13. **Audit:**
    - Every successful action produces the specified audit records with the
      correct actor kind, and human actors carry the identity mode `selected`.
    - Each task's state matches its latest state-changing record (I15).
    - Claim renewals and non-authority rejections produce no audit records
      (A12).
14. **Invariants I1–I22** are checked after each step of a randomized sequence
    of actions. A property-style test is recommended but not required.

Board review of this contract was the validation for TASK-002. Board review of
the 2026-09-24 revision diffs is the validation for TASK-004, TASK-012, and
TASK-013, and of the 2026-09-25 revision diff for TASK-014.

## Open questions

This was uncovered by the TASK-014 revision and is **not decided**.

- **Q26 — A hand merge before acceptance, outside `in_review`.** The board said
  a hand merge before acceptance makes the task accepted ("accepted by early
  merge; review skipped"). M3 applies this to a top-level task in `in_review`,
  where the merged commit is the one under review. Not decided:
  - (a) A task branch that reaches main by hand while the task is `approved`
    (for example after a return), `in_progress` (possibly with an active run
    holding the claim), or has non-done subtasks. Which commit counts as
    accepted, and what happens to an active claim or run and to unfinished
    subtasks?
  - (b) A subtask branch merged into main by hand. Subtasks never merge into
    main through Moonbeam.
  - (c) A task that is blocked or paused when M3 fires. M3 as written does not
    wait for either; what happens to its open blockers or pause on
    `completed`?

  Interim reading: M3 fires only for top-level `in_review` tasks, whether or
  not they are blocked or paused, and open blockers stay recorded as they were.
  In every other case Moonbeam shows the warning "reached main by hand before
  acceptance" on the task (CONTRACT-004 B14), records the override, and
  changes no state. **Proposed default:** (a) treat the task as accepted by
  early merge at the branch head contained in main, ending any claim as for a
  cancelled run, and cancelling unfinished subtasks; (b) warning only; (c)
  resolve blockers and pause by the system, noting the early merge.
  **Board, 2026-09-25: interim reading adopted as the decision** (warning plus a
  recorded override, no state change; ADR-007).

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
  *Applied:* T10. Remaining ambiguity was raised as Q16 (resolved by Board A5).
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
  *Applied:* T9, UX. TASK-012 keyed the requirement to how the task entered
  review, which is equivalent for every leaf.
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
  authorship reading was raised as Q18 (resolved by Board A6).
- **Q8 — Scope envelope after approval.** Proposed: fixed; changing scope means
  cancelling and re-proposing. Alternative: a human may edit it, which then
  requires re-checking existing subtasks against the edited envelope.
  a8 - yes cancel and repropose.
  *Applied:* Scope envelope, Project queue and path dependencies.
- **Q9 — Blocked vs. claims.** Proposed: blocking suspends claim expiry; agents
  cannot claim a blocked task but humans can; a blocked parent effectively
  blocks its subtasks. Confirm each point.
  a9 - yes agents cannot claim a blocked task and blocking the parent effectively blocks all subtasks. but also unblocking the parent unblocks all subtasks
  *Applied:* C1. The scope of unblocking was raised as Q20 (resolved by Board
  A7).
- **Q10 — Adding subtasks after a split.** Proposed: humans may add subtasks to
  an unclaimed split parent in `in_progress`; agents may not (they propose a new
  task or raise a blocker). Confirm.
  a10 - I don't think the person should have to be involved in raising/blocking subtasks.
  *Applied:* T11, global precondition 3. Run eligibility was raised as Q19
  (resolved by Board A6).
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
  *Applied:* Scope (Excluded). CONTRACT-002 is that contract.
- **Q14 — Path dependencies within a split.** Do subtasks inherit their parent's
  dependencies? Do sibling subtasks with overlapping paths depend on each other,
  and what finishes that dependency?
  Board A2, 2026-09-24: follow the recommendation. Yes, subtasks inherit: if the
  parent is waiting on an earlier task, its subtasks wait too. Yes, overlapping
  siblings run in creation order; the dependency is satisfied when the earlier
  sibling is completed, because its work is then merged into the parent's
  branch (CONTRACT-004).
  *Applied:* Definitions (path dependency kinds, creation order), T3, T11,
  "Project queue and path dependencies", I17, UX, validation item 11. A
  cancelled earlier sibling also finishes the dependency, as a cancelled task
  does for top-level tasks.
- **Q15 — Reordering constraints.** May a reorder make an in-progress task wait?
  How are cycles among three or more tasks prevented?
  Board A3, 2026-09-24: follow the recommendation. Overlap order is a
  per-project queue position. Reordering moves a task's position, which cannot
  create cycles. A task already `in_progress` or later cannot be moved behind an
  unfinished task.
  *Applied:* Definitions (project queue), T2, D1 (now "move task in project
  queue"), "Project queue and path dependencies", audit action
  `queue_reordered`, I2, I19, failure categories, Interfaces, validation item 11.
  Applied reading: "behind an unfinished task" is checked against tasks whose
  paths overlap, since only those create a dependency; it covers moving another
  task ahead of a started one; and it is judged by whether the move gives a
  started task a dependency it did not already have. Sibling order is raised as
  Q22.
- **Q16 — Returned split parent without new subtasks.** May it be worked
  directly, and does its own handoff then need an agent review?
  Board A5, 2026-09-24: follow the recommendation. Subtasks only. A returned
  split parent goes to `approved`. Whoever claims it may only add subtasks,
  following the return notes, and may not change files directly. No separate
  parent-level review is needed, because each fix subtask gets its own review.
  *Applied:* T3, T6, T9 (review requirement keyed to how the task entered
  review), T10, T14 note, I4, I20, UX, validation items 1 and 7.
- **Q17 — Merge failure at acceptance.**
  Board A4, 2026-09-24: follow the recommendation. At handoff, a handoff is
  refused unless the branch merges cleanly into its target (main, or the parent
  branch for a subtask). At acceptance, if the merge still fails (for example
  because main moved), the accept is rejected; the task stays `in_review` with
  the conflict shown, and the human returns it. The merge and the permanent
  record succeed or fail together. If a subtask will not integrate into the
  parent branch, Moonbeam raises a system blocker on the parent, which allows
  "system" as an actor that can raise blockers; a fix subtask then resolves it.
  *Applied:* Actors, Definitions (system blocker), T6, T8, T9, T12 note, C1,
  I18, failure categories (repository categories), validation items 6, 9, 12.
  Applied reading: the system blocker is resolved by a human, typically after
  adding the fix subtask; the system never resolves blockers.
  *Partly superseded 2026-09-24 (ADR-005 amendment, TASK-013):* acceptance no
  longer merges, so "at acceptance, if the merge still fails, the accept is
  rejected; the task stays `in_review` and the human returns it" no longer
  applies to T9. It is re-expressed at merge time: a merge requested with M1
  that cannot be made is refused, main is unchanged, and the task stays
  `completed` with integration status Merge refused. What follows a conflict
  was open (CONTRACT-004 Q19) until the board answered it on 2026-09-25: a
  hand merge is accepted as fact (M2, M3). The rest of this answer stands: handoffs must be
  mergeable, the merge and the permanent record succeed or fail together (now
  in M1), and the system integration blocker is unchanged.
- **Q18 — Which agent "created" a subtask.**
  Board A6, 2026-09-24: follow the recommendation. Cancel: only the run that
  created the subtask, and only while no one has claimed it.
  *Applied:* T15, global precondition 3, failure categories (`not_permitted`),
  validation item 8. "While no one has claimed it" is applied as "has never been
  claimed".
- **Q19 — Which agent runs may add subtasks.**
  Board A6, 2026-09-24: follow the recommendation. Add: the run that has claimed
  the parent or a sibling subtask, and also a reviewer run. A review that has
  findings and adds a fix subtask is recorded in the same step, so the parent
  cannot slip into review in between.
  *Applied:* global precondition 3, T7, T11, T12 race, C1, I13, Interfaces,
  validation item 5.
- **Q20 — Scope of unblocking.**
  Board A7, 2026-09-24: follow the recommendation. Unblocking the parent clears
  the "blocked because the parent is blocked" state on its subtasks. Blockers
  recorded on a subtask itself stay open until someone resolves them.
  *Applied:* C1 (interim wording removed), validation item 9.
- **Q21 — Paths at approval and overlap.**
  Board A1, 2026-09-24: follow the recommendation. Every task that changes files
  must declare paths to be approved. A task with no paths, such as a pure
  planning or review task, never overlaps. Overlap means the same file, or one
  path containing the other. V1 allows plain file and directory paths only, with
  no globs.
  *Applied:* Definitions (paths, overlapping paths), T2, Scope envelope, T9
  (out-of-scope files of a pathless task), UX, validation item 11. How a
  pathless approval is confirmed is raised as Q23.
- **Q22 — Reordering sibling subtasks.** Board A2 orders overlapping siblings by
  creation order, and Board A3 introduced moving tasks in the project queue.
  Subtasks have no queue position. Interim reading: sibling order is fixed at
  creation and D1 does not change it. Should a human be able to change the order
  of overlapping siblings, under the same "no started task behind an unfinished
  one" rule?
  Board, 2026-09-24 (TASK-013 approval): follow the recommendation. Humans may
  reorder sibling subtasks with the queue move.
  *Applied:* Definitions (sibling order, sibling dependency), T11, "Project
  queue and path dependencies" (D1), transition table (D1), audit
  `queue_reordered`, I17, I19, Interfaces, validation item 11; CONTRACT-004 B2,
  B3; `TEMPLATE/docs/workflow/splits.md` and `lifecycle.md`.
- **Q23 — Confirming that a pathless task changes no files.** Board A1 says a
  task that changes files must declare paths, and a task with no paths never
  overlaps. The server cannot tell whether a task will change files. Interim
  reading: approving a task with no paths approves it as changing no files. The
  approval UI says so, and at review every file it changes is outside its paths
  and needs a written reason at acceptance (T9). Is that enough, or should the
  task carry an explicit "changes no files" declaration that approval requires?
  Board, 2026-09-24 (TASK-013 approval): the interim reading is confirmed. A
  task with no paths changes no files, and any file it does change needs a
  reason at acceptance. No separate declaration.
  *Applied:* T2 (interim wording made final); `TEMPLATE/docs/templates/task.md`.
- **Q24 — Accepted but unmerged tasks in the decision queue (ADR-005
  amendment, open point 3).** Asked whether the decision queue shows completed
  top-level tasks that are not merged, including those whose latest merge was
  refused. Interim reading was no; proposed default was a separate "Accepted,
  not merged" group with refused merges first.
  Board, 2026-09-25: accepted but unmerged tasks appear in the decision queue
  as their own group ("Accepted, not merged"), with refused merges first.
  *Applied (TASK-014):* UX expectations (decision queue); CONTRACT-003.
- **Q25 — A merge conflict known at acceptance.** Interim reading was that a
  conflict with current main is a warning and accepting is allowed; the
  alternative was to reject the accept with `merge_conflict`.
  Board, 2026-09-25: a conflict already known at acceptance refuses the accept
  by default. A human may use an "accept anyway" override, which is recorded
  (ADR-007).
  *Applied (TASK-014):* transition table (T9), T9, Audit record (Overrides),
  Failure behavior, Interfaces, validation item 12; CONTRACT-003,
  CONTRACT-004 UX expectations.
