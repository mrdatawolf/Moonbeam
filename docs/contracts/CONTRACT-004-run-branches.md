# CONTRACT-004: Task branches, checkouts, and merge on acceptance

Status: Accepted
Approved by: Patrick
Approved date: 2026-09-24
Revised: 2026-09-24 (TASK-012), see "Revision history"
Related tasks: TASK-010, TASK-012
Related ADRs: ADR-005 (as amended 2026-09-24), ADR-001, ADR-003 (context:
ADR-004)
Related contracts: CONTRACT-001 (lifecycle; boundary at T3, T6, T8, T9, T10,
T11, T15/T16, and the integration blocker in C1), CONTRACT-002 (identity;
supplies the acceptor's name and e-mail address), CONTRACT-003 (review surface;
displays what this contract produces)

## Revision history

### 2026-09-24 — TASK-012: board answers, round 1 sheet

The board answered `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`, following
every recommendation. This revision applies the answers that concern this
contract and aligns it with CONTRACT-001 and CONTRACT-002 as revised the same
day. The contract stays Proposed until the board approves it. The file name is
unchanged; the title now says "task branches".

- **Branches (Board C1):** one branch per task, named `moonbeam/TASK-NNN`;
  merge commits, not squash; cancelled branches kept for 30 days. ADR-005 is
  amended ("per task", not "per run").
- **Subtasks (Board A2, A4):** overlapping siblings run in creation order. A
  subtask that will not integrate into the parent's branch makes Moonbeam raise
  a system blocker on the parent (CONTRACT-001 C1).
- **Returned split parents (Board A5):** never worked directly; their branch
  changes only through subtask integration, updates, and acceptance.
- **Merging (Board A4):** a handoff is refused unless the branch merges cleanly
  into its target. A failed merge at acceptance rejects the accept. The merge
  and the permanent record succeed or fail together.
- **Authorship and records (Board C3):** each user has an e-mail address; the
  acceptor is the merge author. Moonbeam's git identity is configured once for
  all projects. Records go to `tasks/TASK-NNN-slug.md`. Hand commits on main
  are allowed and shown as a warning.
- **Evidence (Board C4):** accepting when main has moved since review is
  allowed, with a warning.
- **Runs (Board C5):** uncommitted work is not published when a run ends.
  Detecting rewritten history is enough for V1. No special rules for local
  models until they take writing roles.
- **Repository location (Board C2):** Moonbeam hosts a bare canonical repository
  per project on its own machine. GitHub, where the team's repositories live
  today, is a mirror that Moonbeam pushes main to after each acceptance.
- Q1–Q16 moved to "Resolved questions". New open questions Q17 (importing
  existing GitHub repositories and reconciling work pushed directly to GitHub)
  and Q18 (a mirror whose main has diverged).

## Purpose

Define how work reaches, and does not reach, a managed project's main branch
when that work is done through Moonbeam:

- the branch a task's work lives on, how it is named and when it is created
- where run checkouts live on runner machines, and which runs need one
- how subtask branches relate to their parent's branch
- how a branch that has fallen behind main is updated, and by whom
- how merge conflicts are handled when a branch is updated, at handoff, and at
  acceptance
- the merge on acceptance, its style, and its commit and author policy
- the permanent task record written back to the repository (ADR-001) and how
  it combines with the merge
- returned, cancelled, and rejected tasks, and cleanup of branches and
  checkouts
- where the canonical repository lives, and mirroring to an external server

ADR-005 (as amended on 2026-09-24) fixes the direction: each task's work is on
one Moonbeam-named branch, used by the task's runs in turn; the main branch
holds only accepted work; and accepting a task merges it. This contract states
the observable behavior that follows from that direction. It does not design
the runner process.

## Scope

### Included

- Task branches: naming, creation, base, lifetime, and ownership.
- Subtask branches and the parent's integration branch.
- Run checkouts: which runs get one, where they live, and what they contain at
  run start and after run end.
- Publishing run commits to the task branch.
- Updating a task branch from main (or a subtask branch from its parent
  branch).
- Conflict handling at update, handoff, subtask integration, and acceptance.
- The acceptance merge: style, message, authorship, atomicity, concurrency.
- Permanent task record write-back and its combination with the merge.
- Returned, cancelled, and rejected tasks.
- Branch and checkout cleanup.
- The canonical repository on the Moonbeam host; external servers as mirrors.
- Showing commits on main that did not come from an acceptance.

### Excluded

- The runner process design (how runs are launched, supervised, and stopped).
- The review surface's presentation (CONTRACT-003). This contract only defines
  the facts it displays: branch, commits, changed files, mergeability.
- Lifecycle transitions themselves (CONTRACT-001). This contract adds
  repository behavior at named transitions. CONTRACT-001 states the matching
  preconditions (T6 mergeability, T9 merge and record) and the system blocker.
- Identity and the user registry (CONTRACT-002), beyond needing a name and an
  e-mail address per board member for commit authorship.
- CI, pull requests on external git servers, and branch protection on external
  servers.
- Moonbeam's own repository, which uses the interim shared-checkout rule in the
  root `AGENTS.md` (ADR-005).

## Actors

| Actor | Role in this contract |
|---|---|
| **Board member** (human) | Accepts, returns, or cancels tasks (CONTRACT-001). May claim a leaf task and work its branch by hand. Named as the author of the acceptance merge. |
| **Agent run** | Works in a run checkout and commits to the task branch there. Never writes the canonical repository directly and never writes main. |
| **Reviewer run** | Reads a task branch at a fixed commit. Never changes any branch. |
| **Moonbeam** (system) | The only actor that creates, updates, merges, and deletes branches in the canonical repository, the only actor that changes main through Moonbeam, and the actor that raises the integration blocker (CONTRACT-001 C1). |

Identity follows ADR-003: the acceptor named on a merge is the user selected in
the UI. That proves only that someone selected that user.

## Definitions

- **Canonical repository** — the bare git repository that Moonbeam hosts for
  each registered project on its own machine (Board C2). It is the repository
  whose main branch Moonbeam governs and in which task branches live. It has no
  working files, so no one's checkout is affected when Moonbeam updates main.
- **Mirror** — an external repository (for this team, GitHub) to which Moonbeam
  publishes main after each acceptance. It is never authoritative for review or
  merge.
- **Main branch** — the canonical repository's integration branch configured
  for the project (default `main`).
- **Task branch** — the branch holding one task's work. One per task, for the
  task's whole life, used by each of its runs in turn (Board C1).
- **Integration target** — where a task branch is eventually merged: main for
  a top-level task; the parent's task branch for a subtask.
- **Base** — the commit of the integration target the task branch was created
  from.
- **Stale** — the integration target has commits not contained in the task
  branch.
- **Run checkout** — a working copy of the canonical repository dedicated to
  one run, on the machine where that run's runner executes.
- **Writing run** — a run whose role may change repository files (for example
  implementer, contract designer, UX specialist). **Read-only run** — any other
  run (reviewer, summaries, pause triage, handoff drafting). A run bound to a
  split parent that has a completed subtask is read-only toward that parent's
  branch (Board A5).
- **Handoff commit** — the task branch head recorded with a handoff (T6).
- **Changed-file set** — the files that differ between the task branch head and
  its merge base with the integration target. Commits brought in by updates
  from the target do not contribute to it.
- **Mergeability** — whether the task branch, at its current head, merges into
  the current head of its integration target without conflict: `clean`,
  `conflicts` (with the conflicting files), or `unknown` (not yet computed or
  repository unavailable).
- **Rejected task** — a task that leaves review by return or by cancellation
  rather than by acceptance. There is no separate "reject" transition.
- **Hand commit** — a commit on main that did not come from an acceptance merge
  made by Moonbeam (Board C3).
- **Moonbeam namespace** — branch names beginning `moonbeam/`, reserved for
  Moonbeam.

## Inputs and outputs

Inputs are lifecycle events from CONTRACT-001 (claim, split, run start, run
end, handoff, subtask completion, accept, return, cancel) and commits made in
run checkouts or by a human claimant.

Outputs, visible to board members and to CONTRACT-003's views:

- per task: task branch name, base commit, current head, handoff commit per
  handoff, commits since the previous handoff, changed-file set, mergeability,
  staleness (how many target commits the branch lacks), and whether any of
  those target commits are hand commits
- per run: its checkout location (writing runs), the commit range it published
  (first and last), and any uncommitted files discarded at run end
- per acceptance: the merge commit on main, the permanent record's path, the
  cleanup outcome, and the mirror publish outcome
- per project: hand commits on main, cleanup and mirror failures
- repository failures as defined under "Failure behavior"

## Preconditions

1. The project is registered with a canonical repository on the Moonbeam host
   that Moonbeam can read and write, and a configured main branch (Board C2).
2. The canonical repository is bare, so Moonbeam can update its main branch
   without altering anyone's working files.
3. Every board member has a name and e-mail address usable as a git author
   (CONTRACT-002 user registry, Board C3).
4. Moonbeam's own git identity (name and address) is configured once for all
   projects (Board C3).
5. Each runner that starts writing runs has a configured workspace location on
   its machine for run checkouts.

## Required behavior

### B1 Task branch naming

- A task's branch is named `moonbeam/TASK-NNN`, where `TASK-NNN` is the task's
  identifier within the project (Board C1). Subtasks use their own identifier
  in the same form. The name does not encode the parent; the relationship is
  recorded in Moonbeam and shown with the branch.
- The name is fixed for the task's life and is never reused for another task,
  including after the branch is deleted.
- Moonbeam creates, moves, and deletes branches only within the Moonbeam
  namespace, plus the single merge into main at acceptance. It never creates,
  moves, or deletes any other branch.
- If a branch with the intended name already exists and Moonbeam has no record
  of creating it for this task, Moonbeam does not adopt or overwrite it. The
  triggering action is rejected with `branch_name_taken` (see "Failure
  behavior").

### B2 Task branch creation and base

- **Top-level task:** the task branch is created from the current head of main
  as part of the task's first successful claim (T3), by a human or an agent. The
  base commit is recorded. If the branch cannot be created, the claim is
  rejected and nothing changes.
- **Split parent:** if the parent has no task branch when it is split (T11), one
  is created from the current head of main as part of the split. If it already
  has one (it was worked before the split), that branch is kept with its work.
- **Subtask:** the subtask branch is created from the current head of the
  parent's task branch as part of the subtask's first successful claim.
- Later claims of the same task (after a release, expiry, or return) reuse the
  existing branch. No task ever gets a second branch.
- Because ADR-005 makes overlapping tasks sequential (CONTRACT-001 project
  queue), a top-level branch created at claim time starts from a main that
  already contains every overlapping task ahead of it in the queue. Likewise a
  subtask branch starts from a parent branch that already contains every
  earlier overlapping sibling (Board A2).

### B3 Subtask branches and the parent's integration branch

- A split parent's task branch is the **integration branch** for its subtasks.
  Subtasks never merge into main.
- When a subtask completes (T8), Moonbeam merges the subtask branch into the
  parent's task branch, as part of that completion. The completion happens
  whatever the review verdict (CONTRACT-001, A2): a subtask's work is
  integrated once it is done, and problems are fixed by new subtasks, which
  branch from the parent branch and so start from the integrated work.
- A cancelled subtask's branch is never merged into the parent's branch.
- Sibling subtasks whose paths overlap are worked in creation order
  (CONTRACT-001 sibling dependencies, Board A2). An earlier sibling's
  dependency is finished when it is completed, which means integrated, or
  cancelled. With non-overlapping paths, integrating one subtask cannot
  textually conflict with another.
- **Integration failure (Board A4).** If integration of a completed subtask
  into the parent branch conflicts (for example because a subtask changed files
  outside its paths), the subtask's work is **not** integrated and the parent
  branch is unchanged. In the same step, Moonbeam raises the system
  **integration blocker** on the parent (CONTRACT-001 C1), naming the subtask
  and the conflicting files. The subtask stays `completed`. A board member
  resolves the blocker, typically after adding a fix subtask that redoes or
  ports the work; that subtask branches from the parent branch and integrates
  normally.
- **Returned split parents are not worked directly (Board A5).** A split parent
  that has a completed subtask never receives commits from a claimant. Its
  branch changes only by subtask integration, by Moonbeam's update from main,
  and at acceptance. Its claimant may only add subtasks (CONTRACT-001 T10). A
  split parent that fell back with no completed subtask (CONTRACT-001 T14) may
  be worked like a leaf.
- **Combined result (Board C6).** What a split parent will merge is its task
  branch compared with main. CONTRACT-003 shows exactly that.

### B4 Run checkouts

- **Writing runs** work in a run checkout on the runner's machine: for frontier
  agents, the dev box; for a local-model writing run, the machine running the
  caller (runner), never the llama.cpp host. A model endpoint never needs
  repository access. No further rule applies to local models until they take
  writing roles (Board C5).
- **Read-only runs** do not need a writable checkout. They are given the task
  branch's content at a fixed commit (for reviewers, the handoff commit under
  review). Anything they change is discarded and never reaches any branch.
- Run checkouts live under the runner's configured workspace location, one per
  active writing run. They are never a board member's working copy and never
  the canonical repository itself.
- At the start of a writing run, the run checkout:
  - is on the task branch, at its head after the update in B5
  - has no uncommitted changes except the task snapshot
  - contains the task snapshot (ADR-001) at a location that is excluded from
    commits, so the snapshot never becomes part of the branch. The snapshot
    includes return notes when the task was returned.
- The agent commits in its checkout. Moonbeam publishes the run's commits to
  the canonical task branch no later than at handoff and at run end, and may do
  so earlier so the run view can show progress. Agents do not write the
  canonical repository directly.
- **Uncommitted work is not published (Board C5).** Uncommitted changes at run
  end are not part of the task's work. The run record lists the files that
  were uncommitted.

### B5 Updating a stale branch

- Moonbeam checks staleness whenever the integration target moves and before
  every writing run starts.
- **Automatic update at run start.** Before a writing run's agent begins,
  Moonbeam brings the branch up to date:
  - for a subtask: the parent branch is first updated from main, then the
    subtask branch from the parent branch
  - for a top-level task: the task branch is updated from main
- Updates are merges of the target into the task branch. They never rebase,
  squash, or otherwise rewrite the task branch's existing commits.
- Moonbeam performs an update only when it merges without conflict. It never
  resolves conflicts itself and never chooses one side of a conflict.
- **If an update conflicts,** Moonbeam leaves the branch unchanged and the run
  starts anyway with the conflict stated in its assignment: which target
  commits are missing and which files conflict. Resolving it is the claimant's
  work: the agent (or human claimant) merges the target into the task branch in
  its checkout and resolves the conflict within the task's scope, and the
  handoff reports it. The handoff is refused until the result merges cleanly
  (B6).
- Moonbeam does not update a branch while a writing run on it is active, while
  its task is `in_review`, or while its task is terminal.
- Update merges made by Moonbeam are authored by the Moonbeam system identity
  and marked as updates (see B8).

### B6 Handoff and mergeability

- Every handoff (T6) records its handoff commit: the task branch head at that
  moment, after the run's commits are published.
- **Clean mergeability is a handoff precondition (Board A4).** A handoff is
  accepted only if the handoff commit merges cleanly into the current head of
  its integration target (main, or the parent's branch for a subtask).
  Otherwise the handoff is rejected with `merge_conflict`, naming the
  conflicting files, and the claimant resolves it as in B5 and hands off again.
  The board never receives work that could not merge at the moment it was
  handed off. CONTRACT-001 T6 states the same precondition.
- While a task is `in_review`, its task branch does not move. What is reviewed
  and what is accepted is exactly the handoff commit.
- Mergeability against the current target is recomputed whenever the target
  moves, and shown with the task. If main has moved since the latest handoff or
  review, that is shown as well, with the number of new main commits and
  whether any are hand commits.

### B7 The merge on acceptance

Accept (T9) includes the merge. Merging is acceptance (ADR-005).

- **What is merged:** the latest handoff commit of the accepted task (for a
  split parent, its task branch head, which holds the integrated subtask work),
  plus the permanent record (B9). Nothing else.
- **Style (Board C1):** a merge commit on main, never a fast-forward, squash, or
  rebase. The merge commit's first parent is the previous head of main. Every
  commit of the task's branch (including integrated subtask work) becomes
  reachable from main through it, and the merge commit alone identifies the
  acceptance.
- **All or nothing (Board A4):** acceptance, the merge, and the permanent record
  succeed or fail together. If the merge cannot be made without conflict, or
  the canonical repository cannot be written, the accept action is rejected,
  the task stays `in_review`, and main is unchanged.
- **Conflict at acceptance:** because handoffs are mergeable (B6), a conflict at
  acceptance means main moved after the handoff. The rejection is
  `merge_conflict` and names the conflicting files, which are shown on the task.
  Moonbeam does not resolve it. The board member's path is to return the task
  (T10) with notes; the next writing run starts with the conflict stated (B5).
  For a split parent, the return adds a new subtask to resolve it (A2/A3); that
  subtask merges main into its branch, and its integration brings the
  resolution into the parent branch.
- **Main moved since review (Board C4):** a board member may accept while main
  has advanced since the handoff or review, as long as the merge is clean. It is
  shown as a warning. Validation results shown were produced on the branch, not
  on the merged result.
- **Concurrency:** acceptances into the same main branch are applied one at a
  time. If an earlier acceptance moves main so that a later one now conflicts,
  the later one is rejected with `merge_conflict`. An acceptance whose merge
  has landed on main takes precedence over any concurrent return or cancel of
  the same task; those receive `conflict` (CONTRACT-001 concurrency rules).
- **Recovery:** if Moonbeam is interrupted after the merge lands on main but
  before the acceptance is recorded, Moonbeam completes the recording from the
  merge commit's identifying data when it recovers. It never reverts main to
  undo a landed acceptance.

### B8 Commit and author policy

| Commit | Author | Committer | Message |
|---|---|---|---|
| Acceptance merge on main | The accepting board member (registry name and e-mail, Board C3) | Moonbeam system identity | `Accept TASK-NNN: <title>` with trailers below |
| Update from target (B5) | Moonbeam system identity | Moonbeam system identity | `Update moonbeam/TASK-NNN from <target>` |
| Subtask integration (B3) | Moonbeam system identity | Moonbeam system identity | `Integrate TASK-MMM into TASK-NNN` |
| Agent work in a run | The run's agent identity: role and model, for example `implementer (claude-…) via Moonbeam` | Same | Agent's own message |
| Human claimant work | The board member | The board member | Their own message |

- The permanent record is part of the acceptance merge commit (B9), so it has
  no commit of its own.
- Moonbeam-made commits carry trailers identifying the task (`Moonbeam-Task:`),
  and where applicable the acceptance, acceptor, and acceptance time
  (`Moonbeam-Accepted-By:`, `Moonbeam-Accepted-At:`) or run
  (`Moonbeam-Run:`). The exact trailer names are illustrative; the requirement
  is that the task, acceptor, and time can be read from main's history alone,
  without Moonbeam.
- The Moonbeam system identity is a single name and address, configured once
  for all projects (Board C3), that never belongs to a board member or agent.
- Acceptor attribution is honor-system (ADR-003). V1 does not sign commits.
- Every commit made during a run is attributed to that run in Moonbeam (by the
  published commit range) even if its git author metadata is wrong.
- A change to a user's name or e-mail address in the registry does not rewrite
  existing commits (R10).

### B9 Permanent task record write-back

- At acceptance, the permanent record (the task, its handoffs, reviews, any
  review waiver, the out-of-scope reason, and the acceptance) is added to the
  repository as part of the same acceptance merge commit (Board A4). There is
  no state of main that has the task's work without its record, or its record
  without its work.
- Location (Board C3): `tasks/TASK-NNN-short-description.md`, a flat directory
  of accepted records with no lifecycle subdirectories. The short description
  is derived from the task's title.
- For a split parent, the records of its completed subtasks are written in the
  same commit, each citing the parent's acceptance. Cancelled subtasks appear
  only in the parent's record.
- Moonbeam's record content is authoritative for its path. If the task branch
  changed that path, Moonbeam's record replaces it and the path is shown as
  outside scope.
- Cancelled and rejected tasks get no record in the repository. Their history
  stays in Moonbeam.
- The task snapshot written into a run checkout at run start (ADR-001) is never
  committed and never reaches main (B4).

### B10 Returned tasks

- A returned task keeps its task branch, unchanged by the return. Main is
  unchanged.
- The next writing run starts on the branch head (after B5's update), with the
  return notes in its snapshot.
- A returned split parent receives no direct work (B3, Board A5); its rework
  arrives through new subtasks.
- Handoff commits of earlier review rounds remain recorded, so the board can
  see the commits and changes made since the previous handoff.

### B11 Cancellation

- Cancelling a task (T15, T16) never merges anything and never changes main or
  the parent's task branch.
- If a writing run is active, Moonbeam requests it to stop (CONTRACT-001).
  Commits published before cancellation stay on the task branch.
- A cancelled subtask's branch is not integrated into the parent. Cancelling a
  split parent leaves all its branches unmerged.
- The task branch is retained for **30 days** after cancellation (Board C1),
  then deleted. A board member can see and fetch it until then.

### B12 Cleanup

- **After acceptance:** the accepted task's branch, and the branches of its
  subtasks, are deleted from the canonical repository. Their commits remain
  reachable from main through the acceptance merge.
- **After cancellation:** as B11.
- **Run checkouts:** removed after a run ends and its commits are published.
  If the run ended abnormally (failed or stopped) with uncommitted changes, the
  checkout is kept until the task's next writing run starts or the task becomes
  terminal, so a human can inspect it (Board C5).
- Cleanup never affects lifecycle state. A cleanup failure is recorded, shown
  on the project, and retried. It never undoes an acceptance or cancellation.
- Moonbeam lists branches in its namespace that belong to no non-terminal task
  and are past retention, so orphans are visible.

### B13 Canonical repository and mirrors

- **Canonical repository (Board C2):** Moonbeam hosts one bare canonical
  repository per project on its own machine. All behavior in this contract
  works against it, with no external git server (ADR-005). An external server
  is never registered as canonical.
- **Mirror:** an external remote may be configured per project as a mirror. For
  this team it is GitHub, where the repositories live today. If configured,
  Moonbeam pushes main to it after each acceptance, and may publish task
  branches. The canonical repository remains authoritative for review and
  merge.
- A mirror publish failure never blocks, delays, or reverts an acceptance. It is
  recorded, shown on the project, and retried.
- How an existing GitHub repository becomes a project's canonical repository,
  and how commits pushed directly to GitHub reach the canonical repository, are
  open (Q17, Q18).

### B14 Hand commits on main

- People may commit to main outside Moonbeam, because projects must stay
  workable by hand (PROJECT.md). Moonbeam does not block this (Board C3).
- Moonbeam shows every hand commit on main as a warning: on the project, and on
  the review surface of any task whose branch is behind main by a hand commit
  (CONTRACT-003).
- A hand commit is not an acceptance. R1 and R2 cover only Moonbeam's actions.

## Postconditions and invariants

- **R1 — Only acceptance changes main (through Moonbeam).** Moonbeam changes the
  main branch only by an acceptance merge (B7) for a task that is `completed` by
  that same acceptance. A task that is returned, cancelled, or otherwise not
  accepted never changes main, and neither does any subtask on its own.
- **R2 — Accepted is merged.** Every top-level task Moonbeam records as
  `completed` has exactly one acceptance merge on main, and every acceptance
  merge on main corresponds to exactly one `completed` task.
- **R3 — Reviewed is merged.** The work merged at acceptance is exactly the
  latest handoff commit (for a split parent, its branch head), plus the
  permanent record.
- **R4 — One branch per task.** A task has at most one task branch, its name
  never changes, and no name is reused.
- **R5 — Forward-only branches.** While a task is non-terminal, its task branch
  only moves forward: every new head contains the previous head. No actor
  rewrites a published task branch. In V1 this is enforced by detection and
  refusal (`history_rewritten`), not prevention (Board C5).
- **R6 — Quiet branches.** A task branch changes only (a) by publishing the
  commits of the run or human holding the claim on a task that may be worked
  directly (a leaf, or a split parent with no completed subtask), (b) by
  Moonbeam's update at run start, (c) for a parent, by subtask integration, or
  (d) at acceptance. It never changes while the task is `in_review`, and
  read-only runs never change any branch.
- **R7 — No automatic conflict resolution.** Moonbeam never resolves a merge
  conflict or picks a side. Conflicts are resolved only by a claimant in a
  checkout.
- **R8 — Record with work.** A task's permanent record is on main if and only
  if its acceptance merge is on main.
- **R9 — Snapshots stay out.** A task snapshot is never committed to any branch.
- **R10 — Main is never rewritten.** Moonbeam never force-updates, rewinds, or
  rewrites main, including during recovery.
- **R11 — Moonbeam's namespace only.** Moonbeam creates, moves, and deletes only
  branches in its namespace, apart from the acceptance merge into main.
- **R12 — Handed off is mergeable.** Every recorded handoff commit merged
  cleanly into its integration target at the moment of handoff.

R1 and R2 are scoped to Moonbeam's actions. Commits a person makes to main by
hand are allowed and shown as a warning (B14).

## Failure behavior

All failures below leave lifecycle state, main, and task branches unchanged
unless stated. CONTRACT-001's "Failure behavior" lists the categories that
reject lifecycle actions, with the same names.

| Category | When | Effect |
|---|---|---|
| `merge_conflict` | Handoff (T6) or accept (T9), when the branch does not merge cleanly into its current target. | Action rejected; conflicting files named. For accept, the task stays `in_review` with the conflict shown. |
| `repository_unavailable` | The canonical repository cannot be read or written when a claim or split needs to create a branch, a handoff needs to record its commit, or an accept needs to merge. | Action rejected. Mergeability shows `unknown`. |
| `branch_name_taken` | The task's branch name exists without a Moonbeam record for this task. | Claim or split rejected. A human must rename or remove that branch. |
| `history_rewritten` | The commits to be published do not contain the current task branch head (the claimant rewrote published history). | Publishing refused; the handoff is rejected until the claimant's branch builds on the published head. |
| Update conflict | B5's automatic update conflicts. | Not a rejection: the run starts with the conflict stated. |
| Subtask integration conflict | B3. | Not a rejection: the subtask completes, its work is not integrated, and the system integration blocker is raised on the parent (CONTRACT-001 C1). |
| Cleanup or mirror failure | B12, B13. | Recorded, shown, retried. Never affects lifecycle or main. |
| Interrupted acceptance | Merge landed, recording did not. | Rolled forward on recovery (B7); main never reverted. |

## Interfaces

Illustrative names. Required behavior is the semantics above.

| Operation | Trigger | Actor |
|---|---|---|
| create task branch | first claim (T3); split of an unbranched parent (T11) | Moonbeam |
| prepare run checkout | writing run start | Moonbeam (runner) |
| update from target | writing run start | Moonbeam |
| publish run commits | during run, at handoff, at run end | Moonbeam (runner) |
| check mergeability and record handoff commit | handoff (T6) | Moonbeam |
| integrate subtask (raising the integration blocker on failure) | subtask completion (T8) | Moonbeam |
| compute mergeability | target or branch moves; on demand from the review surface | Moonbeam |
| accept and merge, with record | accept (T9) | Board member requests; Moonbeam performs |
| delete branch / checkout | acceptance, retention expiry, run end | Moonbeam |
| publish to mirror | after acceptance | Moonbeam |
| detect hand commits | main moves | Moonbeam |

No client, human or agent, can request a merge into main other than through
accept, or request a branch update, integration, or deletion directly.

For each task, Moonbeam exposes: branch name, parent branch (subtasks), base
commit, head, handoff commits, changed-file set, mergeability with conflicting
files, staleness with hand-commit indication, integration status (subtasks),
and cleanup status. For each run: checkout location (writing runs), published
commit range, and discarded uncommitted files. For each project: hand commits,
cleanup failures, and mirror status.

## UX expectations

For CONTRACT-003 to present; listed here because they follow from this
contract's outputs.

- The task and review views show the branch name (copyable, so a board member
  can fetch it locally), its base, and for a subtask its parent branch.
- The review surface shows mergeability before the board member presses
  Accept. When it is `conflicts`, Accept explains that it will fail and offers
  Return.
- When main has moved since the latest handoff or review, the review surface
  says so, with the number of new main commits, and flags hand commits among
  them.
- A returned task's review shows the changes since the previous handoff as well
  as the whole change.
- A rejected accept shows `merge_conflict` with the files, and states that main
  was not changed.
- A rejected handoff shows `merge_conflict` with the files to the claimant.
- Cleanup and mirror failures, and hand commits, appear on the project, not as
  task state.

## Validation requirements

Implementation is accepted against this contract when automated tests against
real git repositories on local disk (no external server) show:

1. **Naming and creation:** first claim creates `moonbeam/TASK-NNN` from main's
   head; later claims reuse it; an existing foreign branch of that name rejects
   the claim with `branch_name_taken` and changes nothing.
2. **Subtasks:** subtask branches start from the parent branch; completion
   integrates into the parent branch; cancelled subtasks are not integrated;
   a new subtask after integration starts from the integrated work; a
   conflicting integration leaves the parent branch unchanged, completes the
   subtask, and raises the integration blocker on the parent.
3. **Checkouts:** a writing run starts on the branch head with a clean tree and
   an uncommitted-and-excluded snapshot; read-only runs cannot change any
   branch; uncommitted files at run end are listed and not published; a
   returned split parent's branch receives no claimant commits.
4. **Update:** a clean update is a merge of the target with the Moonbeam
   identity; a conflicting update leaves the branch unchanged and states the
   conflict to the run; no update happens while a run is active, in review, or
   terminal.
5. **Handoff:** a handoff whose commit does not merge cleanly into its target is
   rejected with `merge_conflict` and changes nothing.
6. **Acceptance merge:** a clean accept produces one merge commit on main with
   the specified parents, author, committer, trailers, and record at
   `tasks/TASK-NNN-short-description.md`; the merged tree equals the handoff
   commit plus the record.
7. **Acceptance conflict:** a conflicting accept is rejected with
   `merge_conflict`, the task stays `in_review`, and main is byte-for-byte
   unchanged. An accept with main moved but mergeable succeeds.
8. **Concurrency:** concurrent accepts on one repository are serialized; a
   newly conflicting later accept is rejected; accept racing cancel or return
   produces exactly one outcome.
9. **Recovery:** an acceptance interrupted after the merge is completed on
   recovery without changing main.
10. **Main protection (R1):** over randomized sequences of claim, run, handoff,
    return, cancel, and accept, main's head changes only on successful accepts,
    and never for returned, cancelled, or subtask-only events.
11. **Forward-only (R5):** a rewritten history is refused with
    `history_rewritten`.
12. **Cleanup:** accepted branches are deleted and their commits remain
    reachable from main; cancelled branches survive for 30 days and are then
    deleted; cleanup failure does not change lifecycle state.
13. **Mirror:** with a mirror configured and unreachable, acceptance succeeds,
    and the failure is recorded and retried.
14. **Hand commits:** a commit pushed to main outside Moonbeam is detected and
    reported as a hand commit, and does not count as an acceptance.

Board review of this contract is the validation for TASK-010 itself.

## Open questions

These were uncovered by the TASK-012 revision and are **not decided**.

- **Q17 — Bringing existing GitHub repositories under Moonbeam, and work pushed
  directly to GitHub.** Board C2 makes a bare repository on the Moonbeam host
  canonical and GitHub a mirror that receives main after each acceptance. The
  team's repositories live on GitHub today. Not decided:
  - (a) How an existing GitHub repository is imported to become a project's
    canonical repository (for example a one-time clone at registration), and
    what happens to its existing branches.
  - (b) How commits developers push directly to GitHub, including hand commits
    to main (Board C3, former Q14), get back into the canonical repository.
    Options include: Moonbeam fetches GitHub's main and merges it into
    canonical main when that is clean; developers push hand commits to the
    canonical repository instead of GitHub; or GitHub becomes read-only for
    humans once a project is under Moonbeam, and all hand work goes to the
    canonical repository.
- **Q18 — A mirror whose main has diverged.** If someone pushes to GitHub's main
  directly, Moonbeam's next push of main is no longer a fast-forward. This
  contract only says mirror failures are recorded, shown, and retried, which
  would retry forever. Should Moonbeam overwrite the mirror (force-push), stop
  and ask a board member, or depend on the answer to Q17(b)? Until decided,
  Moonbeam never force-pushes the mirror; it records the failure and shows it
  on the project.

## Resolved questions

Every item below was answered "follow the recommendation" on the round 1
answer sheet (`docs/contracts/BOARD-QUESTIONS-2026-09-24.md`).

- **Q1 — Branch per task, not per run.**
  Board C1, 2026-09-24: one branch per task. ADR-005's "per run" wording gets
  corrected.
  *Applied:* Purpose, Definitions, B2, R4. ADR-005 has a dated amendment.
- **Q2 — Branch name.**
  Board C1, 2026-09-24: `moonbeam/TASK-NNN`.
  *Applied:* B1.
- **Q3 — Sibling subtasks with overlapping paths.**
  Board A2, 2026-09-24: overlapping siblings run in creation order; the
  dependency is satisfied when the earlier sibling is completed, because its
  work is then merged into the parent's branch.
  *Applied:* B2, B3; CONTRACT-001 sibling dependencies.
- **Q4 — Subtask integration conflict.**
  Board A4, 2026-09-24: Moonbeam raises a system blocker on the parent, which
  allows "system" as an actor that can raise blockers. A fix subtask then
  resolves it.
  *Applied:* Actors, B3, Failure behavior, Interfaces, validation item 2;
  CONTRACT-001 C1 and T8. A human resolves the blocker.
- **Q5 — Clean mergeability as a handoff precondition.**
  Board A4, 2026-09-24: a handoff is refused unless the branch merges cleanly
  into its target.
  *Applied:* B5, B6, R12, Failure behavior, validation item 5; CONTRACT-001 T6.
- **Q6 — Merge style.**
  Board C1, 2026-09-24: merge commits, not squash.
  *Applied:* B7.
- **Q7 — Authorship.**
  Board C3, 2026-09-24: add an e-mail address to each user; the person who
  accepts is the merge author. Moonbeam's git identity is configured once for
  all projects.
  *Applied:* Preconditions 3 and 4, B8; CONTRACT-002 user registry.
- **Q8 — Record inside the merge.**
  Board A4, 2026-09-24: the merge and the permanent task record succeed or fail
  together.
  *Applied:* B7, B8, B9, R8; CONTRACT-001 T9. This supersedes CONTRACT-001's
  earlier "write-back failure does not roll back acceptance" and settles
  ADR-001's open write-failure handling for the record.
- **Q9 — Record location.**
  Board C3, 2026-09-24: `tasks/TASK-NNN-slug.md`.
  *Applied:* B9; `TEMPLATE/docs/workflow/lifecycle.md`.
- **Q10 — Main moved since review.**
  Board C4, 2026-09-24: the board member can still accept, with a warning.
  *Applied:* B6, B7; CONTRACT-003.
- **Q11 — Uncommitted work at run end.**
  Board C5, 2026-09-24: uncommitted work is not published when a run ends.
  *Applied:* B4, B12.
- **Q12 — Retention of cancelled branches.**
  Board C1, 2026-09-24: kept for 30 days.
  *Applied:* B11, validation item 12.
- **Q13 — Human claimants and forward-only enforcement.**
  Board C5, 2026-09-24: detecting rewritten branch history is enough for V1.
  *Applied:* R5.
- **Q14 — Hand commits to main.**
  Board C3, 2026-09-24: commits made on main by hand are allowed and shown as a
  warning.
  *Applied:* Definitions, B6, B14, R1/R2 note, Interfaces, validation item 14;
  CONTRACT-003. How hand commits pushed to GitHub reach the canonical
  repository is Q17.
- **Q15 — Canonical repository form and location.**
  Board C2, 2026-09-24: "follow the recommendation (GitHub)". Moonbeam hosts a
  bare canonical repository per project on its own machine; the team's
  repositories are on GitHub, which becomes a mirror that Moonbeam pushes main
  to after each acceptance.
  *Applied:* Definitions, Preconditions 1 and 2, B13. Import and reconciliation
  are raised as Q17 and Q18.
- **Q16 — Local-model writing runs.**
  Board C5, 2026-09-24: no special rules for local models until they get
  writing roles.
  *Applied:* B4.
