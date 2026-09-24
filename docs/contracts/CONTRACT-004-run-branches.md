# CONTRACT-004: Task branches, worktrees, and integration into main

Status: Accepted
Approved by: Patrick
Approved date: 2026-09-24
Revised: 2026-09-24 (TASK-012; TASK-013), see "Revision history"
Related tasks: TASK-010, TASK-012, TASK-013
Related ADRs: ADR-005 (as amended 2026-09-24, both amendments), ADR-006,
ADR-001, ADR-003 (context: ADR-004)
Related contracts: CONTRACT-001 (lifecycle; boundary at T3, T6, T8, T9, T10,
T11, T15/T16, M1, M2, and the integration blocker in C1), CONTRACT-002
(identity; supplies the requesting board member's name and e-mail address, and
lists merge and push as human-only), CONTRACT-003 (review surface and
integration panel; displays what this contract produces)

## Revision history

### 2026-09-24 — TASK-013: ADR-006 and the ADR-005 amendment

The board approved ADR-006 and amended ADR-005 ("acceptance and merge are
separate human steps") on 2026-09-24. This revision applies both. It does not
change the approval (Status stays Accepted); board review of the diff is its
validation. The file name is unchanged; the title now says "worktrees, and
integration into main".

- **Repository model (ADR-006, replaces Board C2):** Moonbeam no longer hosts a
  bare canonical repository, and there is no mirror and no automatic push. Each
  project is an existing git repository under a projects root chosen at
  first-run setup, and that repository is canonical. Task branches are worked
  in git worktrees in Moonbeam's data directory. V1 runs on a single host.
  *Changed:* Purpose, Scope, Actors, Definitions, Preconditions, B4, B12, B13
  (rewritten), Failure behavior, Interfaces, validation items 3, 13, 16, 17.
- **Acceptance no longer merges (ADR-005 amendment):** accepting (CONTRACT-001
  T9) records the accepted commit and changes nothing in the repository. B7 is
  now the merge that a board member requests for a completed task
  (CONTRACT-001 M1).
- **Board A4 re-expressed at merge time:** the rule "a failed merge at
  acceptance rejects the accept; the task stays `in_review`" no longer applies,
  because acceptance does not merge. It now reads: a merge that cannot be made
  is refused, main and the project folder are unchanged, and the task stays
  `completed` with integration status "Merge refused" (B7, B17). The rest of
  Board A4 stands: handoffs must be mergeable (B6), and the merge and the
  permanent record succeed or fail together (B7, B9), now at merge time.
- **Project folder safety (ADR-006 decision 4):** new B15 and new failure
  category `working_folder_unsafe`.
- **Push on request (ADR-006 decision 5):** new B16. Moonbeam never pushes on
  its own and never force-pushes; a rejected push is reported and nothing
  changes (resolves Q18). New categories `push_rejected` and
  `remote_unavailable`.
- **Hand merges (ADR-005 amendment):** B14 now detects a completed task whose
  work reached main by hand (CONTRACT-001 M2). New B17 defines integration
  status.
- **Merge author:** the board member who requests the merge, not necessarily
  the acceptor (B8). Interim reading, raised as Q22.
- **Path dependencies wait for main (ADR-005 amendment):** B2 wording. Sibling
  order can now be changed by a board member (CONTRACT-001 Q22): B2, B3
  wording.
- **Invariants:** IDs kept. R1, R2, R3, R6, R8, R10, and R11 reworded; new R13
  (no push without a request, never force), R14 (folders untouched), and R15
  (repositories under the root, none held by Moonbeam).
- Q17 and Q18 moved to "Resolved questions"; Q15 marked superseded. New open
  questions Q19–Q24. Q19 and Q20 are two of the three open points listed in the
  ADR-005 amendment; the third is CONTRACT-001 Q24.

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
  *(Superseded by ADR-006 in the TASK-013 revision.)*
- Q1–Q16 moved to "Resolved questions". New open questions Q17 (importing
  existing GitHub repositories and reconciling work pushed directly to GitHub)
  and Q18 (a mirror whose main has diverged).

## Purpose

Define how work reaches, and does not reach, a managed project's main branch
when that work is done through Moonbeam:

- the branch a task's work lives on, how it is named and when it is created
- where run checkouts (git worktrees) live, and which runs need one
- how subtask branches relate to their parent's branch
- how a branch that has fallen behind main is updated, and by whom
- how merge conflicts are handled when a branch is updated, at handoff, and
  when a merge into main is requested
- the merge into main that a board member requests after acceptance: the safety
  check on the project folder, the merge style, and the commit and author
  policy
- the permanent task record written back to the repository (ADR-001) as part
  of that merge
- detecting work that a person merged into main by hand
- pushing main to a remote, only when a board member asks
- returned, cancelled, and rejected tasks, and cleanup of branches and
  worktrees
- the projects root and project registration

ADR-005 (as amended on 2026-09-24) and ADR-006 fix the direction:

- Each task's work is on one Moonbeam-named branch, used by the task's runs in
  turn.
- Accepting a task is a decision and does not change the repository. Merging an
  accepted task into main, and pushing main, are separate human steps.
- The main branch holds only accepted work.
- Projects live in the team's own projects root. Moonbeam never holds project
  repositories. V1 runs on a single host.

This contract states the observable behavior that follows from that direction.
It does not design the runner process.

## Scope

### Included

- The projects root, project registration, and relinking a moved project.
- Task branches: naming, creation, base, lifetime, and ownership.
- Subtask branches and the parent's integration branch.
- Run checkouts as git worktrees in Moonbeam's data directory: which runs get
  one, and what they contain at run start and after run end.
- Recording run commits on the task branch.
- Updating a task branch from main (or a subtask branch from its parent
  branch).
- Conflict handling at update, handoff, subtask integration, and merge.
- The accepted commit recorded at acceptance.
- The merge into main on request: the project folder safety check, style,
  message, authorship, atomicity, concurrency.
- Permanent task record write-back as part of that merge.
- Detecting hand commits and hand merges on main.
- Pushing main to its remote on request.
- Integration status of completed tasks.
- Returned, cancelled, and rejected tasks.
- Branch and worktree cleanup.

### Excluded

- The runner process design (how runs are launched, supervised, and stopped).
- The presentation of review and integration (CONTRACT-003). This contract only
  defines the facts shown: branch, commits, changed files, mergeability,
  integration status, and push outcomes.
- Lifecycle transitions themselves (CONTRACT-001). This contract adds
  repository behavior at named actions. CONTRACT-001 states the matching
  preconditions (T6 mergeability, M1 merge) and the system blocker.
- Identity and the user registry (CONTRACT-002), beyond needing a name and an
  e-mail address per board member for commit authorship.
- CI, pull requests on external git servers, and branch protection on external
  servers.
- Runners and repositories on machines other than the Moonbeam host (deferred
  to V2, ADR-006).
- Moonbeam's own repository, which uses the interim shared-checkout rule in the
  root `AGENTS.md` (ADR-005).

## Actors

| Actor | Role in this contract |
|---|---|
| **Board member** (human) | Accepts, returns, or cancels tasks (CONTRACT-001). Requests the merge of a completed task into main, and pushes of main. Registers and relinks projects. May claim a leaf task and work its branch by hand. May commit to, merge into, or pull into main by hand in the project folder. Named as the author of merges they request. |
| **Agent run** | Works in a task worktree and commits to the task branch there. Never changes main, any other branch, or the project folder, and never pushes. |
| **Reviewer run** | Reads a task branch at a fixed commit. Never changes any branch. |
| **Moonbeam** (system) | The only actor that creates, updates, and deletes branches in the Moonbeam namespace. The only actor that changes main through Moonbeam, and only when a board member requests a merge. Pushes only when a board member requests it. Raises the integration blocker (CONTRACT-001 C1) and detects hand merges (CONTRACT-001 M2). |

Identity follows ADR-003: the requester named on a merge or push is the user
selected in the UI. That proves only that someone selected that user.

## Definitions

- **Projects root** — the directory, chosen at first-run setup, where the
  team's project repositories live (ADR-006 decision 1). It is never inside
  Moonbeam's install directory or data directory. Moonbeam itself may live
  inside it.
- **Moonbeam data directory** — `MOONBEAM_HOME` (default `~/.moonbeam`).
- **Project repository** — the existing git repository under the projects root
  that is registered as the project (ADR-006 decision 2). It is canonical: its
  main branch is the one Moonbeam governs, and task branches live in it.
  Moonbeam never holds a clone, bare copy, or mirror of it.
- **Project folder** — the project repository's main working tree: the folder
  under the projects root where the team keeps the project.
- **Main branch** — the project repository's integration branch configured for
  the project (default `main`).
- **Main checkout** — the working tree of the project repository in which the
  main branch is currently checked out, if any. Normally this is the project
  folder. Git allows at most one.
- **Remote** — the remote that the main branch tracks (its upstream, commonly
  `origin`), if one is configured. It is never authoritative for review or
  merge.
- **Task branch** — the branch holding one task's work. One per task, for the
  task's whole life, used by each of its runs in turn (Board C1).
- **Integration target** — where a task branch is eventually merged: main for
  a top-level task; the parent's task branch for a subtask.
- **Base** — the commit of the integration target the task branch was created
  from.
- **Stale** — the integration target has commits not contained in the task
  branch.
- **Task worktree** (run checkout) — a git worktree of the project repository,
  in Moonbeam's data directory, dedicated to one writing run.
- **Writing run** — a run whose role may change repository files (for example
  implementer, contract designer, UX specialist). **Read-only run** — any other
  run (reviewer, summaries, pause triage, handoff drafting). A run bound to a
  split parent that has a completed subtask is read-only toward that parent's
  branch (Board A5).
- **Handoff commit** — the task branch head recorded with a handoff (T6).
- **Accepted commit** — the commit a board member accepted (CONTRACT-001 T9):
  the latest handoff commit, or for a split parent that entered review by
  subtasks, its task branch head at acceptance.
- **Changed-file set** — the files that differ between the task branch head and
  its merge base with the integration target. Commits brought in by updates
  from the target do not contribute to it.
- **Mergeability** — whether the task branch, at its current head (after
  acceptance, at its accepted commit), merges into the current head of its
  integration target without conflict: `clean`, `conflicts` (with the
  conflicting files), or `unknown` (not yet computed, or repository
  unavailable).
- **On main** — the accepted commit is contained in the main branch.
- **Moonbeam merge** — the merge commit Moonbeam makes on main when a board
  member requests the merge of a completed task (CONTRACT-001 M1).
- **Hand merge** — a completed task's accepted commit reached main through
  commits made outside Moonbeam (CONTRACT-001 M2).
- **Hand commit** — a commit on main that did not come from a Moonbeam merge
  (Board C3), including commits pulled into main from a remote. Shown as "main
  changed outside Moonbeam" (ADR-006).
- **Integration status** — how far a completed task's work has travelled toward
  main and the remote (B17).
- **Rejected task** — a task that leaves review by return or by cancellation
  rather than by acceptance. There is no separate "reject" transition.
- **Moonbeam namespace** — branch names beginning `moonbeam/`, reserved for
  Moonbeam.

## Inputs and outputs

Inputs are lifecycle events from CONTRACT-001 (claim, split, run start, run
end, handoff, subtask completion, accept, return, cancel), merge requests (M1),
push requests, registration requests, commits made in task worktrees or by a
human claimant, and changes to main made by hand.

Outputs, visible to board members and to CONTRACT-003's views:

- per task: task branch name, base commit, current head, handoff commit per
  handoff, commits since the previous handoff, changed-file set, mergeability,
  staleness (how many target commits the branch lacks), whether any of those
  target commits are hand commits, and once accepted, the accepted commit and
  the integration status (B17)
- per run: its worktree location (writing runs), the commit range it produced
  (first and last), and any uncommitted files discarded at run end
- per merge: the merge commit on main, the permanent record's path, whether
  the main checkout's files were updated, and the cleanup outcome; or, if
  refused, the category and details
- per push: the requester, the commit range pushed, and the outcome with the
  remote's reason
- per project: the project folder path and registration status, hand commits
  on main, how many commits main is ahead of its remote (and as of when), the
  latest push outcome, and cleanup failures
- repository failures as defined under "Failure behavior"

## Preconditions

1. Moonbeam has a projects root, set at first-run setup (B13).
2. The project is registered: its project repository is a git repository under
   the projects root, on the Moonbeam host, that Moonbeam can read and write,
   with a configured main branch (B13).
3. Every board member has a name and e-mail address usable as a git author
   (CONTRACT-002 user registry, Board C3).
4. Moonbeam's own git identity (name and address) is configured once for all
   projects (Board C3).
5. **Single host (ADR-006 decision 6):** Moonbeam, its runners, and every
   project repository are on the same machine. That host does all file and git
   work. Model endpoints on other LAN machines are called over HTTP and never
   need repository access.

## Required behavior

### B1 Task branch naming

- A task's branch is named `moonbeam/TASK-NNN`, where `TASK-NNN` is the task's
  identifier within the project (Board C1). Subtasks use their own identifier
  in the same form. The name does not encode the parent; the relationship is
  recorded in Moonbeam and shown with the branch.
- The name is fixed for the task's life and is never reused for another task,
  including after the branch is deleted.
- Moonbeam creates, moves, and deletes branches only within the Moonbeam
  namespace, plus the merges into main that board members request (B7). It
  never creates, moves, or deletes any other branch, and never changes which
  branch a project folder has checked out.
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
- A later task with overlapping paths can be claimed only once the earlier
  task's work is on main (ADR-005 as amended; CONTRACT-001 project queue).
  So a top-level branch created at claim time starts from a main that already
  contains every overlapping task ahead of it in the queue. Likewise a subtask
  branch starts from a parent branch that already contains every overlapping
  sibling ahead of it in sibling order (Board A2; CONTRACT-001 Q22).
- Creating a branch adds a ref to the project repository. It does not change
  the project folder's files, index, or checked-out branch (R14).

### B3 Subtask branches and the parent's integration branch

- A split parent's task branch is the **integration branch** for its subtasks.
  Subtasks never merge into main.
- When a subtask completes (T8), Moonbeam merges the subtask branch into the
  parent's task branch, as part of that completion. The completion happens
  whatever the review verdict (CONTRACT-001, A2): a subtask's work is
  integrated once it is done, and problems are fixed by new subtasks, which
  branch from the parent branch and so start from the integrated work.
- A cancelled subtask's branch is never merged into the parent's branch.
- Sibling subtasks whose paths overlap are worked in sibling order: creation
  order, unless a board member moved a subtask among its siblings
  (CONTRACT-001 D1, Q22; Board A2). An earlier sibling's dependency is finished
  when it is completed, which means integrated, or cancelled. With
  non-overlapping paths, integrating one subtask cannot textually conflict with
  another.
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
  branch changes only by subtask integration and by Moonbeam's update from
  main. Its claimant may only add subtasks (CONTRACT-001 T10). A split parent
  that fell back with no completed subtask (CONTRACT-001 T14) may be worked
  like a leaf.
- **Combined result (Board C6).** What a split parent will merge into main is
  its task branch compared with main. CONTRACT-003 shows exactly that.

### B4 Run checkouts (task worktrees)

- **Writing runs** work in a task worktree: a git worktree of the project
  repository, created by Moonbeam in its data directory on the Moonbeam host
  (ADR-006 decisions 3 and 6). This holds for frontier agents and for
  local-model writing runs alike; a model endpoint is called over HTTP and
  never needs repository access. No further rule applies to local models until
  they take writing roles (Board C5).
- **Read-only runs** do not need a writable checkout. They are given the task
  branch's content at a fixed commit (for reviewers, the handoff commit under
  review). Anything they change is discarded and never reaches any branch.
- Task worktrees live only under Moonbeam's data directory, one per active
  writing run. A task worktree is never the project folder, and Moonbeam never
  creates a worktree anywhere else.
- At the start of a writing run, the task worktree:
  - is on the task branch, at its head after the update in B5
  - has no uncommitted changes except the task snapshot
  - contains the task snapshot (ADR-001) at a location that is excluded from
    commits, so the snapshot never becomes part of the branch. The snapshot
    includes return notes when the task was returned.
- The agent commits in its worktree. Because a worktree shares the project
  repository, those commits are on the task branch. Moonbeam records the run's
  commit range (first and last commit) no later than at handoff and at run
  end, and may record progress earlier so the run view can show it. Agents
  never change any other branch.
- **Uncommitted work is not published (Board C5).** Uncommitted changes at run
  end are not part of the task's work. The run record lists the files that
  were uncommitted.
- **Human claimants** work the task branch in a checkout of the project
  repository on the host. How they obtain one is not specified here. Their work
  counts once it is committed on the task branch.

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
- Update merges are made outside the project folder and never change it.
  They are authored by the Moonbeam system identity and marked as updates (see
  B8).

### B6 Handoff and mergeability

- Every handoff (T6) records its handoff commit: the task branch head at that
  moment, after the run's commits are recorded.
- **Clean mergeability is a handoff precondition (Board A4).** A handoff is
  accepted only if the handoff commit merges cleanly into the current head of
  its integration target (main, or the parent's branch for a subtask).
  Otherwise the handoff is rejected with `merge_conflict`, naming the
  conflicting files, and the claimant resolves it as in B5 and hands off again.
  The board never receives work that could not merge at the moment it was
  handed off. CONTRACT-001 T6 states the same precondition.
- While a task is `in_review`, its task branch does not move. What is reviewed
  and what is accepted is exactly the handoff commit (for a split parent that
  entered review by subtasks, its branch head).
- Mergeability against the current target is recomputed whenever the target
  moves, and shown with the task, including after acceptance until the work is
  on main. If main has moved since the latest handoff, review, or acceptance,
  that is shown as well, with the number of new main commits and whether any
  are hand commits.

### B7 The merge into main, on request

Accepting a task (CONTRACT-001 T9) does not merge it and does not change the
project repository (ADR-005 amendment). Acceptance records the accepted
commit. The merge into main is a separate action, requested by a board member
for a completed top-level task (CONTRACT-001 M1) and performed by Moonbeam.
Until the TASK-013 revision, this section made the merge part of acceptance.

- **Who and when:** only on a board member's explicit request (CONTRACT-002
  human-only). Moonbeam never merges into main on its own, as part of any
  other action, or on retry.
- **Eligible tasks:** a top-level task that is `completed` and whose work is
  not on main (no Moonbeam merge recorded, no hand merge detected). Moonbeam
  refuses to merge any other task, with `invalid_transition` (CONTRACT-001
  M1). Subtasks never merge into main.
- **What is merged:** the accepted commit, plus the permanent record (B9).
  Nothing else.
- **Order of checks:** the project folder safety check (B15), then the merge
  itself.
- **Style (Board C1):** a merge commit on main, never a fast-forward, squash, or
  rebase. The merge commit's first parent is the previous head of main. Every
  commit of the task's branch (including integrated subtask work) becomes
  reachable from main through it, and the merge commit alone identifies the
  Moonbeam merge.
- **The project folder:** when main is checked out and the safety check passes,
  the merge updates the files in the main checkout to the merged result, as a
  pull would, and leaves it on main with no uncommitted changes (ADR-006
  decision 4). When main is not checked out anywhere, only the main branch
  changes, and no folder's files change.
- **All or nothing (Board A4, now at merge time):** the merge and the permanent
  record succeed or fail together. If the project folder is not safe to update
  (`working_folder_unsafe`), the merge cannot be made without conflict
  (`merge_conflict`), or the project repository cannot be written
  (`repository_unavailable`), the merge is refused. Main, the project folder,
  and the task branch are unchanged. The task stays `completed`, and its
  integration status shows "Merge refused" with the category and details
  (B17).
- **Conflict at merge time:** handoffs are mergeable (B6) and a task branch
  does not move after handoff, so a conflict at merge time means main moved
  after the handoff (through earlier merges or hand commits). Moonbeam does
  not resolve it. The task is `completed` and cannot be returned (CONTRACT-001
  I12). What the board does next is **open (Q19)**. Until decided, the refusal
  names the conflicting files, a board member may request the merge again
  later, and a board member may merge the branch by hand in the project
  folder, resolving the conflict there; Moonbeam then detects the hand merge
  (B14).
- **Main moved since review or acceptance (Board C4):** a board member may
  request the merge while main has advanced since the handoff, review, or
  acceptance, as long as the merge is clean. It is shown as a warning.
  Validation results shown were produced on the branch, not on the merged
  result.
- **Concurrency:** merges into the same main branch are applied one at a time.
  If an earlier merge moves main so that a later one now conflicts, the later
  one is refused with `merge_conflict`. Of two requests to merge the same task,
  exactly one can succeed; the other receives `conflict` or
  `invalid_transition`.
- **Recovery:** if Moonbeam is interrupted after the merge lands on main but
  before the merge is recorded, Moonbeam completes the recording from the merge
  commit's identifying data when it recovers. It never reverts main to undo a
  landed merge.
- **No push:** a merge never pushes. Pushing is B16.

### B8 Commit and author policy

| Commit | Author | Committer | Message |
|---|---|---|---|
| Moonbeam merge on main (B7) | The board member who requested the merge (registry name and e-mail, Board C3; interim reading, Q22) | Moonbeam system identity | `Merge TASK-NNN: <title>` with trailers below |
| Update from target (B5) | Moonbeam system identity | Moonbeam system identity | `Update moonbeam/TASK-NNN from <target>` |
| Subtask integration (B3) | Moonbeam system identity | Moonbeam system identity | `Integrate TASK-MMM into TASK-NNN` |
| Agent work in a run | The run's agent identity: role and model, for example `implementer (claude-…) via Moonbeam` | Same | Agent's own message |
| Human claimant work | The board member | The board member | Their own message |

- The permanent record is part of the Moonbeam merge commit (B9), so it has no
  commit of its own.
- Moonbeam-made commits carry trailers identifying the task (`Moonbeam-Task:`),
  and where applicable the acceptance, acceptor, and acceptance time
  (`Moonbeam-Accepted-By:`, `Moonbeam-Accepted-At:`), the merge requester
  (`Moonbeam-Merged-By:`), or the run (`Moonbeam-Run:`). The exact trailer
  names are illustrative; the requirement is that the task, acceptor,
  acceptance time, and merge requester can be read from main's history alone,
  without Moonbeam.
- The Moonbeam system identity is a single name and address, configured once
  for all projects (Board C3), that never belongs to a board member or agent.
- Acceptor and requester attribution is honor-system (ADR-003). V1 does not
  sign commits.
- Every commit made during a run is attributed to that run in Moonbeam (by the
  recorded commit range) even if its git author metadata is wrong.
- A change to a user's name or e-mail address in the registry does not rewrite
  existing commits (R10).

### B9 Permanent task record write-back

- When Moonbeam merges a task (B7), the permanent record (the task, its
  handoffs, reviews, any review waiver, the out-of-scope reason, and the
  acceptance) is added to the repository as part of that same merge commit
  (Board A4). There is no state of main that has a Moonbeam-merged task's work
  without its record, or its record without its work. This settles ADR-001's
  write-failure handling for the record (see ADR-001's amendment).
- Location (Board C3): `tasks/TASK-NNN-short-description.md`, a flat directory
  of accepted records with no lifecycle subdirectories. The short description
  is derived from the task's title.
- For a split parent, the records of its completed subtasks are written in the
  same commit, each citing the parent's acceptance. Cancelled subtasks appear
  only in the parent's record.
- Moonbeam's record content is authoritative for its path. If the task branch
  changed that path, Moonbeam's record replaces it and the path is shown as
  outside scope.
- **Hand merges:** a hand merge does not write the record. How the record
  reaches the repository then is **open (Q20)**. Until decided, Moonbeam does
  not write to main on its own, the record stays in Moonbeam, and the task's
  integration status shows "Record not written" (B17).
- Cancelled and rejected tasks get no record in the repository. Their history
  stays in Moonbeam.
- The task snapshot written into a task worktree at run start (ADR-001) is
  never committed and never reaches main (B4).

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
  Commits made before cancellation stay on the task branch.
- A cancelled subtask's branch is not integrated into the parent. Cancelling a
  split parent leaves all its branches unmerged.
- The task branch is retained for **30 days** after cancellation (Board C1),
  then deleted. A board member can see and check it out until then.

### B12 Cleanup

- **After the work is on main** (a Moonbeam merge, or a detected hand merge):
  the task's branch, and the branches of its subtasks, are deleted from the
  project repository. Their commits remain reachable from main. A completed
  task whose work is not on main keeps its branch and its subtasks' branches,
  because the merge still needs them.
- **After cancellation:** as B11.
- **Task worktrees:** removed after a run ends and its commits are recorded.
  If the run ended abnormally (failed or stopped) with uncommitted changes, the
  worktree is kept until the task's next writing run starts or the task becomes
  terminal, so a human can inspect it (Board C5).
- Cleanup never affects lifecycle state and never touches the project folder.
  A cleanup failure is recorded, shown on the project, and retried. It never
  undoes an acceptance, merge, or cancellation.
- Moonbeam lists branches in its namespace that belong to no task still
  needing them (a non-terminal task, or a completed task not on main) and are
  past retention, so orphans are visible.

### B13 Projects root, registration, and the project repository

- **Setup (ADR-006 decision 1):** at first run, Moonbeam asks for the projects
  root. A projects root that is, or is inside, Moonbeam's install directory or
  its data directory is refused with `validation`, judged by the real location
  after resolving symbolic links. Moonbeam itself may live inside the projects
  root. Changing the projects root after setup is open (Q24).
- **Moonbeam never holds project repositories (ADR-006 decision 2).** It never
  clones, copies, or mirrors a project repository into its data directory or
  anywhere else. Its data directory holds only task worktrees and Moonbeam's
  own data.
- **Registration:** a board member registers a project by choosing an existing
  git repository under the projects root. Moonbeam offers the repositories it
  finds under the root, including nested layouts (repositories at any depth,
  in whatever folder structure the team uses). A path outside the root (by real
  location) is rejected with `validation`, as is a folder that is not a git
  repository or a repository already registered. The registered repository is
  the project's canonical repository; its main branch is configured at
  registration (default `main`).
- Registration changes nothing in the project folder.
- **Moved or renamed folders (ADR-006):** when the registered folder is missing,
  or is no longer the registered repository, Moonbeam marks the project
  unavailable, shows it on the project, and rejects actions that need the
  repository with `repository_unavailable`. It offers a board member to relink
  the project to a repository under the projects root. What makes a relink
  target acceptable is open (Q24).
- **External servers:** none is required (ADR-005 decision 6). A remote is used
  only when a board member asks Moonbeam to push (B16). No remote is ever
  registered as a project or treated as authoritative.
- **Existing repositories and remote work (resolves Q17):** an existing
  repository is registered where it already is; nothing is imported. Commits
  that reach main by hand, including commits pulled in from a remote, are hand
  commits (B14).

### B14 Hand commits and hand merges on main

- People may commit, merge, and pull into main outside Moonbeam, because
  projects must stay workable by hand (PROJECT.md). Moonbeam does not block
  this (Board C3).
- **Hand commits.** Moonbeam shows every hand commit on main as a warning, "main
  changed outside Moonbeam": on the project, on the review surface of any task
  whose branch is behind main by a hand commit, and in the merge confirmation
  (CONTRACT-003).
- **Hand merges (CONTRACT-001 M2).** Whenever Moonbeam observes main, if the
  accepted commit of a completed top-level task is contained in main and no
  Moonbeam merge of it is recorded, Moonbeam records that the task was merged
  by hand, with the main commit at which it was detected. Only containment
  counts. A squash, rebase, or cherry-pick done by hand is not detected (Q20).
- A hand commit or hand merge is not a Moonbeam merge. R1 and R2 cover only
  Moonbeam's actions. A hand merge does not write the permanent record (B9,
  Q20).
- A task branch that reaches main by hand before its task is accepted is shown
  as a warning on that task. What happens at its later acceptance is part of
  Q20.

### B15 Project folder safety at merge (ADR-006 decision 4)

- Before merging (B7), Moonbeam checks the main checkout, if there is one.
  Interim reading, pending Q21: the merge may proceed when main is not checked
  out anywhere, or when the main checkout is on main and has no uncommitted
  changes, meaning:
  - no staged or unstaged changes to tracked files
  - no merge, rebase, cherry-pick, or revert in progress
  - no untracked file at a path the merge would write

  Ignored files, and untracked files the merge would not touch, do not count.
- Otherwise the merge is refused with `working_folder_unsafe`, and nothing
  changes. The refusal names the folder and exactly what to fix: the changed
  files by path, the operation in progress, or the untracked files in the way,
  each with the step to take (for example "commit or stash these changes in
  `<folder>`, then merge again").
- When main is not checked out (for example the project folder is on another
  branch), the merge changes only the main branch. The merged files appear
  when someone checks out main.
- Moonbeam never discards, overwrites, stashes, or commits a person's
  uncommitted changes, and never switches a folder's branch. If the main
  checkout changes during the merge so that updating it would overwrite
  changes, the merge is abandoned, main is left unchanged, and the merge is
  refused with `working_folder_unsafe`.

### B16 Pushing main, on request (ADR-006 decision 5)

- Moonbeam pushes only when a board member explicitly asks, in the UI
  (CONTRACT-002 human-only). It never pushes on its own, as part of a merge or
  any other action, on a schedule, or on retry.
- **What:** the project's main branch, to its remote, as a fast-forward.
  Moonbeam never pushes task branches or any other ref.
- **Never force (Board, Q18):** Moonbeam never force-pushes and never uses any
  option that overwrites the remote's history.
- **Remote and credentials:** the remote that main tracks, using the project
  repository's own git configuration on the host, as a person pushing by hand
  from the project folder would. If main has no remote, push is unavailable,
  with that reason.
- **Success:** the remote's main equals local main. The push is recorded with
  the requester, time, and the range pushed.
- **Rejected or failed:** if the remote refuses the push (for example because
  its main has diverged), the push fails with `push_rejected`. If the remote
  cannot be reached or authentication fails, it fails with
  `remote_unavailable`. Either way, Moonbeam reports it on the project with the
  remote's reason and what to do (for a divergence: bring the remote's commits
  into main by hand, for example by pulling in the project folder, then push
  again). Nothing changes locally or on the remote. There is no automatic
  retry. The report stays until a later push succeeds.
- Pushing does not depend on the project folder's state and never touches
  working files.
- **Remote state:** Moonbeam does not fetch on its own (interim reading, Q23).
  How far main is ahead of the remote, and whether a task is pushed, are
  computed from the project repository's remote-tracking branch as last
  updated by a push or by a person's fetch, and shown with that time.

### B17 Integration status

For each completed top-level task, Moonbeam exposes:

- **Merge status:**
  - Not merged
  - Merging (a merge is in progress)
  - Merged by Moonbeam, with the merge commit, requester, and time
  - Merged by hand, with the detection time and the main commit (B14)
  - Merge refused: the task is still not merged, and its latest refusal is
    shown (category, details, requester, time). The next merge request is
    evaluated afresh.
- **Record status:** written (path and commit), or not written (hand merge,
  Q20).
- **Push status:** Pushed, when the remote-tracking main contains the task's
  merge commit (or its accepted commit, for a hand merge); otherwise Not
  pushed.
- While not merged: mergeability against current main, and how far main has
  moved since acceptance, with hand commits flagged.

A merge refusal is informational. It is not a lifecycle state or condition,
and not an audit record (CONTRACT-001 A12). It is replaced by the next
attempt's outcome.

For each project, Moonbeam exposes: the project folder and its registration
status; the main checkout and whether it would pass B15 now; how many commits
main is ahead of its remote, as of when; the latest push outcome; hand commits;
and cleanup failures.

Subtasks have no merge status toward main. Their integration into the parent's
branch is shown as Integrated or Not integrated (B3).

## Postconditions and invariants

- **R1 — Only a requested merge changes main (through Moonbeam).** Moonbeam
  changes the main branch only by a Moonbeam merge (B7) of a `completed`
  top-level task, requested by a board member. Accepting, returning,
  cancelling, and subtask events never change main. (Before the TASK-013
  revision, R1 read "only acceptance changes main"; acceptance no longer
  merges.)
- **R2 — Merged was accepted.** Every Moonbeam merge on main corresponds to
  exactly one `completed` top-level task, and each such task has at most one
  Moonbeam merge. A completed task may also be not merged, or merged by hand
  (ADR-005 amendment). The former reading, "every completed task has exactly
  one acceptance merge", no longer holds.
- **R3 — Accepted is what merges.** The work merged by a Moonbeam merge is
  exactly the accepted commit, plus the permanent record.
- **R4 — One branch per task.** A task has at most one task branch, its name
  never changes, and no name is reused.
- **R5 — Forward-only branches.** While a task is non-terminal, its task branch
  only moves forward: every new head contains the previous head. No actor
  rewrites a recorded task branch. In V1 this is enforced by detection and
  refusal (`history_rewritten`), not prevention (Board C5).
- **R6 — Quiet branches.** A task branch changes only (a) by commits of the run
  or human holding the claim on a task that may be worked directly (a leaf, or
  a split parent with no completed subtask), (b) by Moonbeam's update at run
  start, or (c) for a parent, by subtask integration. It never changes while
  the task is `in_review` or after the task is terminal, and read-only runs
  never change any branch. (Item (d), "at acceptance", was removed in the
  TASK-013 revision: acceptance changes no branch.)
- **R7 — No automatic conflict resolution.** Moonbeam never resolves a merge
  conflict or picks a side. Conflicts are resolved only by a claimant in a
  checkout, or by a person merging by hand.
- **R8 — Record with the Moonbeam merge.** A task's permanent record is put on
  main by Moonbeam if and only if its Moonbeam merge is on main. For hand
  merges, see Q20.
- **R9 — Snapshots stay out.** A task snapshot is never committed to any branch.
- **R10 — History is never rewritten.** Moonbeam never force-updates, rewinds,
  or rewrites main, locally or on a remote, including during recovery.
- **R11 — Moonbeam's namespace only.** Moonbeam creates, moves, and deletes only
  branches in its namespace, apart from Moonbeam merges into main.
- **R12 — Handed off is mergeable.** Every recorded handoff commit merged
  cleanly into its integration target at the moment of handoff.
- **R13 — No push without a request; never force.** Moonbeam pushes only main,
  only when a board member explicitly asks, and only as a fast-forward.
- **R14 — Folders untouched.** Moonbeam never changes a project folder's working
  files, index, or checked-out branch, except that a Moonbeam merge updates the
  files of a main checkout that passed B15. It never discards uncommitted
  changes.
- **R15 — Repositories stay in the projects root.** Every registered project
  repository is under the projects root. The projects root is outside
  Moonbeam's install and data directories. Moonbeam holds no copy of any
  project repository.

R1 and R2 are scoped to Moonbeam's actions. Commits and merges a person makes
to main by hand are allowed and shown (B14).

## Failure behavior

All failures below leave lifecycle state, main, the project folder, and task
branches unchanged unless stated. CONTRACT-001's "Failure behavior" lists the
categories that reject lifecycle actions and merges, with the same names.

| Category | When | Effect |
|---|---|---|
| `merge_conflict` | Handoff (T6) or merge (M1), when the branch does not merge cleanly into its current target. | Handoff rejected, or merge refused; conflicting files named. For a merge, the task stays `completed` with integration status Merge refused. |
| `working_folder_unsafe` | Merge (M1), when the main checkout fails B15. | Merge refused, naming the folder and what to fix. Nothing changes. |
| `repository_unavailable` | The project repository cannot be read or written when a claim or split needs to create a branch, a handoff needs to record its commit, an accept needs the changed-file set, or a merge needs to write main. Also while the registered folder is missing (B13). | Action rejected or merge refused. Mergeability shows `unknown`. |
| `branch_name_taken` | The task's branch name exists without a Moonbeam record for this task. | Claim or split rejected. A human must rename or remove that branch. |
| `history_rewritten` | The task branch head no longer contains the head Moonbeam last recorded (the claimant rewrote history). | The handoff is rejected until the branch builds on the recorded head. |
| `push_rejected` | Push (B16): the remote refused it, for example because its main diverged. | Reported on the project with the remote's reason and what to do. Nothing changes. No retry, no force. |
| `remote_unavailable` | Push (B16): the remote cannot be reached, authentication fails, or main has no remote. | As `push_rejected`. |
| `validation` | Setup or registration: a projects root inside Moonbeam's install or data directory; a repository outside the root; not a git repository; already registered. | Rejected. |
| Update conflict | B5's automatic update conflicts. | Not a rejection: the run starts with the conflict stated. |
| Subtask integration conflict | B3. | Not a rejection: the subtask completes, its work is not integrated, and the system integration blocker is raised on the parent (CONTRACT-001 C1). |
| Cleanup failure | B12. | Recorded, shown, retried. Never affects lifecycle, main, or the project folder. |
| Interrupted merge | Merge landed, recording did not. | Rolled forward on recovery (B7); main never reverted. |

## Interfaces

Illustrative names. Required behavior is the semantics above.

| Operation | Trigger | Actor |
|---|---|---|
| set projects root | first-run setup | the person setting up |
| register project / relink project | on request | board member (see Q24) |
| create task branch | first claim (T3); split of an unbranched parent (T11) | Moonbeam |
| prepare task worktree | writing run start | Moonbeam (runner) |
| update from target | writing run start | Moonbeam |
| record run commits | during run, at handoff, at run end | Moonbeam (runner) |
| check mergeability and record handoff commit | handoff (T6) | Moonbeam |
| integrate subtask (raising the integration blocker on failure) | subtask completion (T8) | Moonbeam |
| compute mergeability | target or branch moves; on demand | Moonbeam |
| record accepted commit (no repository change) | accept (T9) | Moonbeam |
| check project folder safety | on demand; before every merge | Moonbeam |
| merge into main, with record | merge request (M1) | Board member requests; Moonbeam performs |
| push main | push request | Board member requests; Moonbeam performs |
| detect hand commits and hand merges (M2) | main observed to move | Moonbeam |
| delete branch / worktree | work on main, retention expiry, run end | Moonbeam |

No client, human or agent, can request a merge into main other than through M1,
a push other than through the push request, or a branch update, integration, or
deletion directly.

For each task, Moonbeam exposes: branch name, parent branch (subtasks), base
commit, head, handoff commits, accepted commit, changed-file set,
mergeability with conflicting files, staleness with hand-commit indication,
integration status (B17; for subtasks, integration into the parent), and
cleanup status. For each run: worktree location (writing runs), recorded
commit range, and discarded uncommitted files. For each project: the items
listed at the end of B17.

## UX expectations

For CONTRACT-003 to present; listed here because they follow from this
contract's outputs.

- The task and review views show the branch name (copyable, so a board member
  can check it out on the host), its base, and for a subtask its parent branch.
- The review surface shows mergeability before the board member presses
  Accept. A conflict is listed as a warning in the accept confirmation, which
  says that a merge requested after acceptance would be refused until it is
  resolved, and that Return resolves it on the branch (CONTRACT-001 Q25).
- When main has moved since the latest handoff or review, the review surface
  says so, with the number of new main commits, and flags hand commits among
  them.
- A returned task's review shows the changes since the previous handoff as well
  as the whole change.
- A completed task shows its integration status, with Merge and Push actions
  for board members. The merge confirmation says whether files in the project
  folder will change.
- A refused merge shows its category and exactly what to fix, and states that
  main was not changed and the project folder was not touched.
- A rejected handoff shows `merge_conflict` with the files to the claimant.
- A rejected or failed push shows the remote's reason and what to do, and
  states that nothing was changed.
- Cleanup failures, push outcomes, hand commits, "main ahead of its remote",
  and registration problems appear on the project, not as task state.

## Validation requirements

Implementation is accepted against this contract when automated tests against
real git repositories on local disk show the following. For push, a local
repository stands in for the remote; no external server is needed.

1. **Naming and creation:** first claim creates `moonbeam/TASK-NNN` from main's
   head; later claims reuse it; an existing foreign branch of that name rejects
   the claim with `branch_name_taken` and changes nothing.
2. **Subtasks:** subtask branches start from the parent branch; completion
   integrates into the parent branch; cancelled subtasks are not integrated;
   a new subtask after integration starts from the integrated work; a
   conflicting integration leaves the parent branch unchanged, completes the
   subtask, and raises the integration blocker on the parent.
3. **Worktrees:** a writing run starts in a worktree under the data directory,
   on the branch head, with a clean tree and an uncommitted-and-excluded
   snapshot; read-only runs cannot change any branch; uncommitted files at run
   end are listed and not published; a returned split parent's branch receives
   no claimant commits. Across run start, run end, update, and integration, the
   project folder's files, index, and checked-out branch are byte-for-byte
   unchanged.
4. **Update:** a clean update is a merge of the target with the Moonbeam
   identity; a conflicting update leaves the branch unchanged and states the
   conflict to the run; no update happens while a run is active, in review, or
   terminal.
5. **Handoff:** a handoff whose commit does not merge cleanly into its target is
   rejected with `merge_conflict` and changes nothing.
6. **Accept changes nothing in the repository:** after T9, every ref and the
   project folder are unchanged, and the accepted commit is recorded.
7. **Merge:** a merge requested for a completed task produces one merge commit
   on main with the specified parents, author, committer, trailers, and record
   at `tasks/TASK-NNN-short-description.md`; the merged tree equals the
   accepted commit merged with main, plus the record. With main checked out and
   clean, the folder's files equal the merged result and the folder stays
   clean and on main. With main not checked out, no folder's files change.
8. **Merge refusals:** a conflicting merge is refused with `merge_conflict`;
   an unsafe main checkout (a modified tracked file, a staged change, a rebase
   in progress, an untracked file where the merge would write) is refused with
   `working_folder_unsafe`, naming what to fix. In every refusal, main, the
   folder, and the person's uncommitted changes are byte-for-byte unchanged,
   and the task stays `completed` with Merge refused. Ignored files and
   untouched untracked files do not cause a refusal. A merge requested for a
   task that is not `completed`, is a subtask, or is already on main is refused
   with `invalid_transition`. A merge with main moved but mergeable succeeds.
9. **Concurrency:** concurrent merges into one main are serialized; a newly
   conflicting later merge is refused; two merge requests for the same task
   produce exactly one merge.
10. **Recovery:** a merge interrupted after landing on main is recorded on
    recovery without changing main.
11. **Main protection (R1):** over randomized sequences of claim, run, handoff,
    accept, return, cancel, and merge, main's head changes (through Moonbeam)
    only on successful merges, and never on accept, return, cancel, or
    subtask events.
12. **Forward-only (R5):** a rewritten history is refused with
    `history_rewritten`.
13. **Cleanup:** after a Moonbeam merge or a detected hand merge, the task's
    branches are deleted and their commits remain reachable from main; a
    completed task not on main keeps its branches; cancelled branches survive
    for 30 days and are then deleted; cleanup failure does not change
    lifecycle state or the project folder.
14. **Push:** no push happens except on request; a requested push sends only
    main, as a fast-forward; a diverged remote yields `push_rejected`, an
    unreachable one `remote_unavailable`, and in both cases nothing changes
    locally or on the remote and nothing is retried; no push is ever forced.
15. **Hand commits and hand merges:** a commit made on main by hand is reported
    as a hand commit; a hand merge that contains the accepted commit is
    detected as Merged by hand and finishes dependents' path dependencies; a
    squash merge by hand is not detected.
16. **Projects root and registration:** a projects root equal to or inside the
    install or data directory is refused, including through a symbolic link;
    nested repositories under the root are offered; a repository outside the
    root is refused, including through a symbolic link; a missing folder marks
    the project unavailable and actions that need it are rejected
    `repository_unavailable`.
17. **No held repositories (R15):** the data directory contains task worktrees
    and Moonbeam's own data, and no clone or copy of a project repository.

Board review of this contract is the validation for TASK-010 itself, and board
review of the revision diffs is the validation for TASK-012 and TASK-013.

## Open questions

These were uncovered by the TASK-013 revision and are **not decided**. Where
the contract needs an interim reading to stay coherent, it is marked in the
body and repeated here with a proposed default.

- **Q19 — A merge that conflicts after acceptance (ADR-005 amendment, open
  point 1).** The task is `completed` and cannot be returned, and its branch no
  longer moves (R6). Tasks with overlapping paths keep waiting until its work
  is on main (CONTRACT-001). Options:
  - (a) A board member merges by hand in the project folder, resolving the
    conflict; Moonbeam detects the hand merge (B14).
  - (b) A board member approves a new follow-up task that redoes or ports the
    work on current main; the original task is then marked as not to be merged
    (a new integration status) and stops holding dependents.
  - (c) Allow a special "resolution run" on the completed task's branch that
    merges main into it, followed by a new merge request.

  In every option, a board member can already release waiting tasks by moving
  the unmerged task behind them in the queue (CONTRACT-001 D1). **Proposed
  default:** (a) for V1, as the body states now. Add (b) if the board wants a
  way to abandon an accepted task's integration without merging it.
- **Q20 — The permanent record after a hand merge (ADR-005 amendment, open
  point 2).** A hand merge does not write the record. Options:
  - (a) Moonbeam offers a human-only "Write task record" action for a task
    merged by hand. It commits the record alone onto main, under the same
    folder safety check (B15), authored by the requester.
  - (b) At acceptance, Moonbeam commits the record onto the task branch, so any
    merge carries it. This conflicts with "accepting does not change the
    project repository" (ADR-005 amendment).
  - (c) The record stays in Moonbeam only for hand-merged tasks.

  Related, also undecided: whether a hand squash, rebase, or cherry-pick can be
  marked as merged by a board member (it is not detected, B14), and what
  happens when a task branch reached main by hand before acceptance (proposed:
  on acceptance it is detected as Merged by hand, with the warning kept on the
  task). **Proposed default:** (a). Until decided, the body uses (c) and shows
  "Record not written".
- **Q21 — What counts as a safe project folder.** ADR-006 says the merge is
  allowed, when main is checked out in the project folder, only if the folder
  is on main with no uncommitted changes. Interim reading (B15): the check
  applies to whichever working tree has main checked out; with main not checked
  out anywhere, the merge only moves the main branch; untracked files count
  only where the merge would write, and ignored files never count. The stricter
  alternative is to require the project folder to be on main for every merge,
  and to treat any untracked file as unsafe. **Proposed default:** the interim
  reading.
- **Q22 — Who is the author of the merge commit.** Board C3 made the acceptor
  the merge author when acceptance and merge were one step. Now a different
  board member may request the merge. Interim reading (B8): the requester is
  the author, and the acceptor is named in a trailer. Alternative: the acceptor
  stays the author and the requester is named in a trailer. **Proposed
  default:** the interim reading.
- **Q23 — May Moonbeam fetch from the remote?** "Main is N ahead of the
  remote" and "Pushed" are only as current as the repository's remote-tracking
  branch. Interim reading (B16): Moonbeam never fetches on its own, and shows
  when the remote state was last updated. Alternatives: a human-only "Check
  remote" action that fetches, or a periodic fetch. A fetch changes no branch
  and no files, only remote-tracking refs. **Proposed default:** add the
  human-only "Check remote" action; no periodic fetch.
- **Q24 — Registration details.** Not decided:
  - (a) What makes a relink target acceptable. Proposed: a repository under the
    root that contains the main commit Moonbeam last recorded and the project's
    task branches.
  - (b) Whether the projects root can be changed after setup, and what happens
    to projects that would fall outside it. Proposed: changeable by a board
    member only when every registered project stays under the new root.
  - (c) Whether setting the projects root, registering, and relinking a
    project are added to CONTRACT-002's human-only list. Proposed: yes. Agents
    are already confined to their run's project, but listing them makes a
    rejected attempt an audited `authority_violation`.

## Resolved questions

Q1–Q16 were answered "follow the recommendation" on the round 1 answer sheet
(`docs/contracts/BOARD-QUESTIONS-2026-09-24.md`). Q17 and Q18 were resolved by
ADR-006 and the board's answers when approving TASK-013.

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
  *Applied:* B2, B3; CONTRACT-001 sibling dependencies. Since TASK-013, a board
  member may change sibling order (CONTRACT-001 Q22).
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
  *Applied:* Preconditions 3 and 4, B8; CONTRACT-002 user registry. Since
  TASK-013 the merge is a separate step, and the requester is the author as an
  interim reading (Q22).
- **Q8 — Record inside the merge.**
  Board A4, 2026-09-24: the merge and the permanent task record succeed or fail
  together.
  *Applied:* B7, B8, B9, R8; CONTRACT-001 M1 (formerly T9). This supersedes
  CONTRACT-001's earlier "write-back failure does not roll back acceptance" and
  settles ADR-001's open write-failure handling for the record. Since TASK-013,
  "together" applies at merge time, not at acceptance; ADR-001 has a dated
  amendment.
- **Q9 — Record location.**
  Board C3, 2026-09-24: `tasks/TASK-NNN-slug.md`.
  *Applied:* B9; `TEMPLATE/docs/workflow/lifecycle.md`.
- **Q10 — Main moved since review.**
  Board C4, 2026-09-24: the board member can still accept, with a warning.
  *Applied:* B6, B7; CONTRACT-003. Since TASK-013 the same warning applies to
  the merge request.
- **Q11 — Uncommitted work at run end.**
  Board C5, 2026-09-24: uncommitted work is not published when a run ends.
  *Applied:* B4, B12.
- **Q12 — Retention of cancelled branches.**
  Board C1, 2026-09-24: kept for 30 days.
  *Applied:* B11, validation item 13.
- **Q13 — Human claimants and forward-only enforcement.**
  Board C5, 2026-09-24: detecting rewritten branch history is enough for V1.
  *Applied:* R5.
- **Q14 — Hand commits to main.**
  Board C3, 2026-09-24: commits made on main by hand are allowed and shown as a
  warning.
  *Applied:* Definitions, B6, B14, R1/R2 note, Interfaces, validation item 15;
  CONTRACT-003.
- **Q15 — Canonical repository form and location.**
  Board C2, 2026-09-24: "follow the recommendation (GitHub)". Moonbeam hosts a
  bare canonical repository per project on its own machine; the team's
  repositories are on GitHub, which becomes a mirror that Moonbeam pushes main
  to after each acceptance.
  *Superseded 2026-09-24 by ADR-006:* the registered repository under the
  projects root is canonical, Moonbeam holds no repository, and Moonbeam
  pushes only on request. *Applied (TASK-013):* Definitions, Preconditions,
  B13, B16, R13, R15.
- **Q16 — Local-model writing runs.**
  Board C5, 2026-09-24: no special rules for local models until they get
  writing roles.
  *Applied:* B4.
- **Q17 — Bringing existing GitHub repositories under Moonbeam, and work pushed
  directly to GitHub.** Asked how an existing GitHub repository is imported as
  the canonical repository, and how commits pushed directly to GitHub reach it.
  Resolved by ADR-006, 2026-09-24: nothing is imported. The team's existing
  repository under the projects root is registered where it is and is
  canonical. Commits from GitHub reach it when a person pulls them into main,
  and Moonbeam shows them as "main changed outside Moonbeam".
  *Applied:* B13, B14, Definitions (hand commit), validation item 15.
- **Q18 — A mirror whose main has diverged.** Asked whether Moonbeam should
  force-push a diverged mirror, stop and ask, or depend on Q17.
  Board, 2026-09-24 (TASK-013 approval): never force-push. A rejected push is
  reported on the project. Under ADR-006, a push happens only on explicit
  request.
  *Applied:* B16, R10, R13, Failure behavior (`push_rejected`,
  `remote_unavailable`), validation item 14.
