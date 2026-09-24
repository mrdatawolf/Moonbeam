# CONTRACT-004: Run branches, checkouts, and merge on acceptance

Status: Proposed
Approved by:
Approved date:
Related tasks: TASK-010
Related ADRs: ADR-005, ADR-001, ADR-003 (context: ADR-004)
Related contracts: CONTRACT-001 (lifecycle; boundary at T3, T6, T8, T9, T10,
T11, T15/T16), CONTRACT-002 (identity; supplies the acceptor's name and
address), CONTRACT-003 (review surface; displays what this contract produces)

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

ADR-005 fixes the direction: each run's work is on a Moonbeam-named branch,
the main branch holds only accepted work, and accepting a task merges it. This
contract states the observable behavior that follows from that direction. It
does not design the runner process.

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
- Local LAN repositories as the default; external remotes as optional mirrors.

### Excluded

- The runner process design (how runs are launched, supervised, and stopped).
- The review surface's presentation (CONTRACT-003). This contract only defines
  the facts it displays: branch, commits, changed files, mergeability.
- Lifecycle transitions themselves (CONTRACT-001). This contract adds
  repository behavior at named transitions and proposes the boundary changes
  listed under "Open questions".
- Identity and the user registry (CONTRACT-002), beyond needing a name and an
  e-mail address per board member for commit authorship.
- CI, pull requests on external git servers, and branch protection on external
  servers.
- Moonbeam's own repository, which uses the interim shared-checkout rule in the
  root `AGENTS.md` (ADR-005).

## Actors

| Actor | Role in this contract |
|---|---|
| **Board member** (human) | Accepts, returns, or cancels tasks (CONTRACT-001). May claim a task and work its branch by hand. Named as the author of the acceptance merge. |
| **Agent run** | Works in a run checkout and commits to the task branch there. Never writes the canonical repository directly and never writes main. |
| **Reviewer run** | Reads a task branch at a fixed commit. Never changes any branch. |
| **Moonbeam** (system) | The only actor that creates, updates, merges, and deletes branches in the canonical repository, and the only actor that changes main. |

Identity follows ADR-003: the acceptor named on a merge is the user selected in
the UI. That proves only that someone selected that user.

## Definitions

- **Canonical repository** — the project repository registered in Moonbeam,
  reachable on the LAN. It is the repository whose main branch Moonbeam
  governs and in which task branches live. An external git server is not
  required.
- **Main branch** — the canonical repository's integration branch configured
  for the project (default `main`).
- **Task branch** — the branch holding one task's work. One per task, for the
  task's whole life (see Q1 on ADR-005's "branch per run" wording).
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
  run (reviewer, summaries, pause triage, handoff drafting).
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
- **Moonbeam namespace** — branch names beginning `moonbeam/`, reserved for
  Moonbeam.

## Inputs and outputs

Inputs are lifecycle events from CONTRACT-001 (claim, split, run start, run
end, handoff, subtask completion, accept, return, cancel) and commits made in
run checkouts or by a human claimant.

Outputs, visible to board members and to CONTRACT-003's views:

- per task: task branch name, base commit, current head, handoff commit per
  handoff, commits since the previous handoff, changed-file set, mergeability,
  and staleness (how many target commits the branch lacks)
- per run: its checkout location (writing runs), the commit range it published
  (first and last), and any uncommitted files discarded at run end
- per acceptance: the merge commit on main, the permanent record's path, and
  the cleanup outcome
- repository failures as defined under "Failure behavior"

## Preconditions

1. The project is registered with a canonical repository that Moonbeam can
   read and write, and a configured main branch.
2. Moonbeam can update the canonical repository's main branch without altering
   anyone's working files. A repository whose main branch is checked out in a
   person's working tree does not satisfy this (see Q15).
3. Every board member has a name and e-mail address usable as a git author
   (CONTRACT-002 user registry; see Q7).
4. Each runner that starts writing runs has a configured workspace location on
   its machine for run checkouts.

## Required behavior

### B1 Task branch naming

- A task's branch is named `moonbeam/TASK-NNN`, where `TASK-NNN` is the task's
  identifier within the project (proposed; see Q2). Subtasks use their own
  identifier in the same form. The name does not encode the parent; the
  relationship is recorded in Moonbeam and shown with the branch.
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
- Because ADR-005 makes overlapping tasks sequential, a top-level branch created
  at claim time starts from a main that already contains every
  earlier-approved overlapping task.

### B3 Subtask branches and the parent's integration branch

- A split parent's task branch is the **integration branch** for its subtasks.
  Subtasks never merge into main.
- When a subtask completes (T8), Moonbeam merges the subtask branch into the
  parent's task branch, as part of that completion. The completion happens
  whatever the review verdict (CONTRACT-001 as revised by A2): a subtask's work
  is integrated once it is done, and problems are fixed by new subtasks, which
  branch from the parent branch and so start from the integrated work.
- A cancelled subtask's branch is never merged into the parent's branch.
- Sibling subtasks whose paths overlap are worked in sequence, as ADR-005
  requires for tasks (proposed; see Q3). With non-overlapping paths, integrating
  one subtask cannot textually conflict with another.
- If integration of a completed subtask into the parent branch does conflict
  (for example because a subtask changed files outside its paths), the
  subtask's work is **not** integrated, the parent branch is unchanged, and the
  conflict is shown on the parent in the decision queue. How the parent is held
  until a human deals with it is an open boundary with CONTRACT-001 (Q4).
- A human who claims the split parent directly (post-return integration work,
  if CONTRACT-001 retains it) works on the parent's task branch.

### B4 Run checkouts

- **Writing runs** work in a run checkout on the runner's machine: for frontier
  agents, the dev box; for a local-model writing run, the machine running the
  caller (runner), never the llama.cpp host. A model endpoint never needs
  repository access.
- **Read-only runs** do not need a writable checkout. They are given the task
  branch's content at a fixed commit (for reviewers, the handoff commit under
  review). Anything they change is discarded and never reaches any branch.
- Run checkouts live under the runner's configured workspace location, one per
  active writing run. They are never a board member's working copy and never
  the canonical repository's own files.
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
- Uncommitted changes at run end are not part of the task's work. The run
  record lists the files that were uncommitted (proposed; see Q11).

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
  handoff reports it.
- Moonbeam does not update a branch while a writing run on it is active, while
  its task is `in_review`, or while its task is terminal.
- Update merges made by Moonbeam are authored by the Moonbeam system identity
  and marked as updates (see B8).

### B6 Handoff and mergeability

- Every handoff (T6) records its handoff commit: the task branch head at that
  moment, after the run's commits are published.
- Proposed (Q5): a handoff is accepted only if the handoff commit merges
  cleanly into the current head of its integration target. Otherwise the
  handoff is rejected with `merge_conflict`, naming the conflicting files, and
  the claimant resolves it as in B5 and hands off again. This guarantees that
  what reaches review could be merged at the moment it was handed off.
- While a task is `in_review`, its task branch does not move. What is reviewed
  and what is accepted is exactly the handoff commit.
- Mergeability against the current target is recomputed whenever the target
  moves, and shown with the task. If main has moved since the latest handoff or
  review, that is shown as well (see Q10).

### B7 The merge on acceptance

Accept (T9) includes the merge. Merging is acceptance (ADR-005).

- **What is merged:** the latest handoff commit of the accepted task, plus the
  permanent record (B9). Nothing else.
- **Style (proposed; see Q6):** a merge commit on main, never a fast-forward,
  squash, or rebase. The merge commit's first parent is the previous head of
  main. Every commit of the task's branch (including integrated subtask work)
  becomes reachable from main through it, and the merge commit alone
  identifies the acceptance.
- **All or nothing:** acceptance succeeds only if the merge succeeds. If the
  merge cannot be made without conflict, or the canonical repository cannot be
  written, the accept action is rejected, the task stays `in_review`, and main
  is unchanged.
- **Conflict at acceptance:** the rejection is `merge_conflict` and names the
  conflicting files. Moonbeam does not resolve it. The board member's path is to
  return the task (T10) with notes; the next writing run starts with the
  conflict stated (B5). For a split parent, the return adds a new subtask to
  resolve it (A2/A3); that subtask merges main into its branch, and its
  integration brings the resolution into the parent branch.
- **Concurrency:** acceptances into the same main branch are applied one at a
  time. If an earlier acceptance moves main so that a later one now conflicts,
  the later one is rejected with `merge_conflict`. An acceptance whose merge
  has landed on main takes precedence over any concurrent return or cancel of
  the same task; those receive `conflict` (CONTRACT-001 concurrency rules).
- **Recovery:** if Moonbeam is interrupted after the merge lands on main but
  before the acceptance is recorded, Moonbeam completes the recording from the
  merge commit's identifying data when it recovers. It never reverts main to
  undo a landed acceptance.
- A board member may accept while main has advanced since the review, as long
  as the merge is clean (proposed; see Q10).

### B8 Commit and author policy

| Commit | Author | Committer | Message |
|---|---|---|---|
| Acceptance merge on main | The accepting board member (registry name and e-mail) | Moonbeam system identity | `Accept TASK-NNN: <title>` with trailers below |
| Permanent record (B9) | Moonbeam system identity | Moonbeam system identity | `Record TASK-NNN acceptance` with trailers |
| Update from target (B5) | Moonbeam system identity | Moonbeam system identity | `Update moonbeam/TASK-NNN from <target>` |
| Subtask integration (B3) | Moonbeam system identity | Moonbeam system identity | `Integrate TASK-MMM into TASK-NNN` |
| Agent work in a run | The run's agent identity: role and model, for example `implementer (claude-…) via Moonbeam` | Same | Agent's own message |
| Human claimant work | The board member | The board member | Their own message |

- Moonbeam-made commits carry trailers identifying the task (`Moonbeam-Task:`),
  and where applicable the acceptance, acceptor, and acceptance time
  (`Moonbeam-Accepted-By:`, `Moonbeam-Accepted-At:`) or run
  (`Moonbeam-Run:`). The exact trailer names are illustrative; the requirement
  is that the task, acceptor, and time can be read from main's history alone,
  without Moonbeam.
- The Moonbeam system identity is a fixed, configured name and address that
  never belongs to a board member or agent.
- Acceptor attribution is honor-system (ADR-003). V1 does not sign commits.
- Every commit made during a run is attributed to that run in Moonbeam (by the
  published commit range) even if its git author metadata is wrong.

### B9 Permanent task record write-back

- At acceptance, the permanent record (the task, its handoffs, reviews, any
  review waiver, and the acceptance) is added to the repository as part of the
  same acceptance merge (proposed; see Q8). There is no state of main that has
  the task's work without its record, or its record without its work.
- Location (proposed; see Q9): `tasks/TASK-NNN-short-description.md`, a flat
  directory of accepted records with no lifecycle subdirectories.
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
- Handoff commits of earlier review rounds remain recorded, so the board can
  see the commits and changes made since the previous handoff.

### B11 Cancellation

- Cancelling a task (T15, T16) never merges anything and never changes main or
  the parent's task branch.
- If a writing run is active, Moonbeam requests it to stop (CONTRACT-001).
  Commits published before cancellation stay on the task branch.
- A cancelled subtask's branch is not integrated into the parent. Cancelling a
  split parent leaves all its branches unmerged.
- The task branch is retained after cancellation for the retention period
  (proposed: 30 days; see Q12), then deleted. A board member can see and fetch
  it until then.

### B12 Cleanup

- **After acceptance:** the accepted task's branch, and the branches of its
  subtasks, are deleted from the canonical repository. Their commits remain
  reachable from main through the acceptance merge.
- **After cancellation:** as B11.
- **Run checkouts:** removed after a run ends and its commits are published.
  If the run ended abnormally (failed or stopped) with uncommitted changes, the
  checkout is kept until the task's next writing run starts or the task becomes
  terminal, so a human can inspect it (proposed; see Q11).
- Cleanup never affects lifecycle state. A cleanup failure is recorded, shown
  on the project, and retried. It never undoes an acceptance or cancellation.
- Moonbeam lists branches in its namespace that belong to no non-terminal task
  and are past retention, so orphans are visible.

### B13 Local LAN repositories and external remotes

- All behavior in this contract works with a canonical repository on the LAN
  and no external git server (ADR-005).
- An external remote (GitHub, Gitea) may be configured per project as a
  **mirror**. If configured, Moonbeam publishes main to it after each
  acceptance, and may publish task branches. The canonical repository remains
  authoritative for review and merge.
- A mirror publish failure never blocks, delays, or reverts an acceptance. It is
  recorded, shown on the project, and retried.
- Whether a team may instead make an external server the canonical repository
  is open (Q15).

## Postconditions and invariants

- **R1 — Only acceptance changes main (through Moonbeam).** Moonbeam changes the
  main branch only by an acceptance merge (B7) for a task that is `completed` by
  that same acceptance. A task that is returned, cancelled, or otherwise not
  accepted never changes main, and neither does any subtask on its own.
- **R2 — Accepted is merged.** Every top-level task Moonbeam records as
  `completed` has exactly one acceptance merge on main, and every acceptance
  merge on main corresponds to exactly one `completed` task.
- **R3 — Reviewed is merged.** The work merged at acceptance is exactly the
  latest handoff commit, plus the permanent record.
- **R4 — One branch per task.** A task has at most one task branch, its name
  never changes, and no name is reused.
- **R5 — Forward-only branches.** While a task is non-terminal, its task branch
  only moves forward: every new head contains the previous head. No actor
  rewrites a published task branch.
- **R6 — Quiet branches.** A task branch changes only (a) by publishing the
  commits of the run or human holding the claim, (b) by Moonbeam's update at
  run start, (c) for a parent, by subtask integration, or (d) at acceptance.
  It never changes while the task is `in_review`, and read-only runs never
  change any branch.
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

R1 and R2 are scoped to Moonbeam's actions. Commits a person makes to main by
hand, outside Moonbeam, are not prevented by this contract (see Q14).

## Failure behavior

All failures below leave lifecycle state, main, and task branches unchanged
unless stated. They extend CONTRACT-001's failure categories at the boundary.

| Category | When | Effect |
|---|---|---|
| `merge_conflict` | Accept, or (if Q5 is approved) handoff, when the branch does not merge cleanly into its current target. | Action rejected; conflicting files named. |
| `repository_unavailable` | The canonical repository cannot be read or written when a claim needs to create a branch, a handoff needs to record its commit, or an accept needs to merge. | Action rejected. Mergeability shows `unknown`. |
| `branch_name_taken` | The task's branch name exists without a Moonbeam record for this task. | Claim or split rejected. A human must rename or remove that branch. |
| `history_rewritten` | The commits to be published do not contain the current task branch head (the claimant rewrote published history). | Publishing refused; the handoff is rejected until the claimant's branch builds on the published head. |
| Update conflict | B5's automatic update conflicts. | Not a rejection: the run starts with the conflict stated. |
| Subtask integration conflict | B3. | Subtask work not integrated; conflict shown on the parent; see Q4. |
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
| record handoff commit | handoff (T6) | Moonbeam |
| integrate subtask | subtask completion (T8) | Moonbeam |
| compute mergeability | target or branch moves; on demand from the review surface | Moonbeam |
| accept and merge | accept (T9) | Board member requests; Moonbeam performs |
| delete branch / checkout | acceptance, retention expiry, run end | Moonbeam |
| publish to mirror | after acceptance | Moonbeam |

No client, human or agent, can request a merge into main other than through
accept, or request a branch update, integration, or deletion directly.

For each task, Moonbeam exposes: branch name, parent branch (subtasks), base
commit, head, handoff commits, changed-file set, mergeability with conflicting
files, staleness, and cleanup status. For each run: checkout location (writing
runs), published commit range, and discarded uncommitted files.

## UX expectations

For CONTRACT-003 to present; listed here because they follow from this
contract's outputs.

- The task and review views show the branch name (copyable, so a board member
  can fetch it locally), its base, and for a subtask its parent branch.
- The review surface shows mergeability before the board member presses
  Accept. When it is `conflicts`, Accept explains that it will fail and offers
  Return.
- When main has moved since the latest handoff or review, the review surface
  says so, with the number of new main commits.
- A returned task's review shows the changes since the previous handoff as well
  as the whole change.
- A rejected accept shows `merge_conflict` with the files, and states that main
  was not changed.
- Cleanup and mirror failures appear on the project, not as task state.

## Validation requirements

Implementation is accepted against this contract when automated tests against
real git repositories on local disk (no external server) show:

1. **Naming and creation:** first claim creates `moonbeam/TASK-NNN` from main's
   head; later claims reuse it; an existing foreign branch of that name rejects
   the claim with `branch_name_taken` and changes nothing.
2. **Subtasks:** subtask branches start from the parent branch; completion
   integrates into the parent branch; cancelled subtasks are not integrated;
   a new subtask after integration starts from the integrated work.
3. **Checkouts:** a writing run starts on the branch head with a clean tree and
   an uncommitted-and-excluded snapshot; read-only runs cannot change any
   branch; uncommitted files at run end are listed and not published.
4. **Update:** a clean update is a merge of the target with the Moonbeam
   identity; a conflicting update leaves the branch unchanged and states the
   conflict to the run; no update happens while a run is active, in review, or
   terminal.
5. **Acceptance merge:** a clean accept produces one merge commit on main with
   the specified parents, author, committer, trailers, and record; the merged
   tree equals the handoff commit plus the record.
6. **Acceptance conflict:** a conflicting accept is rejected with
   `merge_conflict`, the task stays `in_review`, and main is byte-for-byte
   unchanged.
7. **Concurrency:** concurrent accepts on one repository are serialized; a
   newly conflicting later accept is rejected; accept racing cancel or return
   produces exactly one outcome.
8. **Recovery:** an acceptance interrupted after the merge is completed on
   recovery without changing main.
9. **Main protection (R1):** over randomized sequences of claim, run, handoff,
   return, cancel, and accept, main's head changes only on successful accepts,
   and never for returned, cancelled, or subtask-only events.
10. **Forward-only (R5):** a rewritten history is refused with
    `history_rewritten`.
11. **Cleanup:** accepted branches are deleted and their commits remain
    reachable from main; cancelled branches survive until retention expires;
    cleanup failure does not change lifecycle state.
12. **Mirror:** with a mirror configured and unreachable, acceptance succeeds,
    and the failure is recorded and retried.

Board review of this contract is the validation for TASK-010 itself.

## Open questions

Each states the proposed default used above. The board may accept or change it.

- **Q1 — Branch per task, not per run.** ADR-005 says "every run works on its
  own branch" and also "a returned task continues on its branch". Proposed: one
  branch per task, used by each of its runs in turn (claims guarantee one
  writer at a time); each run's commits are identified by its published
  commit range. Alternative: a new branch per run, each starting from the
  previous run's head. That multiplies branches without adding isolation.
- **Q2 — Branch name.** Proposed `moonbeam/TASK-NNN`. Alternative
  `moonbeam/TASK-NNN-short-description`, which is easier to read in git tools
  but changes meaning if a title is edited before approval.
- **Q3 — Sibling subtasks with overlapping paths.** Proposed: sequenced like
  tasks (ADR-005 point 5), earlier-created first. This needs the CONTRACT-001
  revision (TASK-004) to apply the overlap precondition of T3 to sibling
  subtasks as well as top-level tasks.
- **Q4 — Subtask integration conflict.** The subtask is completed (T8) but its
  work could not be integrated. Proposed: Moonbeam shows the conflict on the
  parent and the parent cannot enter review (T12) until a human adds a subtask
  to redo or port the work, or cancels. This needs either a system-raised
  blocker (CONTRACT-001 C1 allows only humans and agents to add blockers) or a
  new T12 precondition. Alternatively, the subtask could be held in `in_review`
  rather than completed. Board decision, then a CONTRACT-001 change.
- **Q5 — Clean mergeability as a handoff precondition.** Proposed: yes, so the
  board never receives work that could not merge at handoff time. This adds a
  precondition to CONTRACT-001 T6. Alternative: allow the handoff and only flag
  the conflict in review.
- **Q6 — Merge style.** Proposed: a merge commit (no fast-forward). It keeps
  the agents' commits and marks each acceptance with one commit, which can be
  reverted as a unit. Alternative: squash to one commit per task, which gives a
  cleaner main history but drops per-run commits from main once the branch is
  deleted. Rebase or fast-forward are not proposed, because they leave no
  single acceptance commit.
- **Q7 — Authorship.** Proposed: the acceptor is the merge author and Moonbeam
  is the committer; agent commits carry a role-and-model identity. This needs
  CONTRACT-002's user registry to hold an e-mail address per board member.
  Should the Moonbeam system identity's name and address be fixed across
  projects or configured per project?
- **Q8 — Record inside the merge.** Proposed: the permanent record is part of
  the acceptance merge, so acceptance, merge, and record are all or nothing.
  This replaces CONTRACT-001 T9's current wording ("acceptance is not rolled
  back if write-back fails") and ADR-001's separate write-back failure
  handling. Alternative: merge first, then a separate record commit on main,
  retried on failure. That allows a window in which main has the work without
  its record.
- **Q9 — Record location.** Proposed: `tasks/TASK-NNN-short-description.md`,
  flat, with subtask records alongside and cross-linked. This also closes the
  open question in `TEMPLATE/docs/workflow/lifecycle.md` (a TEMPLATE update
  would be a separate task). Alternative: `docs/tasks/`.
- **Q10 — Main moved since review.** Proposed: allow accept if the merge is
  clean, with a visible warning. Validation results shown were run on the
  branch, not on the merged result. Alternative: require re-validation on the
  merged result before accept. That needs a way to run validation without a
  writing run.
- **Q11 — Uncommitted work at run end.** Proposed: not published; the files are
  listed on the run; after an abnormal end the checkout is kept until the
  task's next writing run or a terminal state. Alternative: Moonbeam commits
  leftovers as a marked "run-end snapshot" commit. That preserves more work but
  can publish half-finished or unintended files to the branch the board
  reviews.
- **Q12 — Retention of cancelled branches.** Proposed: 30 days, then deleted.
  Alternatives: keep indefinitely, or delete immediately.
- **Q13 — Human claimants and forward-only enforcement.** Human claimants work
  the task branch in their own checkout and publish to the canonical task
  branch. On a plain LAN repository Moonbeam can detect, but not necessarily
  prevent, a rewritten or wrongly published branch, or a direct write to main
  from a run's machine. Proposed: detect and refuse at publish or handoff
  (`history_rewritten`), and treat prevention as hardening (delivery phase 6).
  Is detection enough for V1?
- **Q14 — Hand commits to main.** Projects must stay workable by hand
  (PROJECT.md), so people may commit to main outside Moonbeam. Proposed: allowed
  and not blocked; R1 and R2 cover only Moonbeam's actions. Should Moonbeam
  display commits on main that did not come from an acceptance?
- **Q15 — Canonical repository form and location.** Proposed: a repository on
  the LAN (typically on the Moonbeam host) whose main branch no one has checked
  out as working files, so Moonbeam can merge into it. Should a team be able
  to register an external server as canonical instead of as a mirror?
- **Q16 — Local-model writing runs.** Proposed: this contract allows them (the
  checkout is on the runner's machine). PROJECT.md phase 5 starts local models
  on read-only roles. Confirm that no special rule is needed until local models
  take writing roles.
