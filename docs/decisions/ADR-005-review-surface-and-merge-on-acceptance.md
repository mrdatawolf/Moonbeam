# ADR-005: Branch per run, review in Moonbeam, merge on acceptance

Status: Approved
Date: 2026-09-24
Decision owners: Board (direction chosen by Patrick, 2026-09-24)
Related tasks and contracts: CONTRACT-001, ADR-001

## Context

DbC's ideal for the board is: plan up front, let the work happen out of sight,
review the result at the end. The first parallel run in this repository broke
the last step. Three tasks reached review, but their work existed only on hidden
worktree branches, so the board could not see what it was asked to approve.

Moonbeam must guarantee that the board sees the actual result at review, however
many runs happen in parallel across however many projects.

## Decision

1. **Every run works on its own branch** in the project repository, which
   Moonbeam names and creates. Agents never merge into, rebase onto, or push to
   the project's main branch.
2. **Moonbeam's review surface is the pull request.** For a task in review it
   shows:
   - rendered documents in full (contracts, ADRs, docs)
   - the code diff
   - validation results (tests, typecheck, build)
   - previews or screenshots where relevant
   - the handoff, the agent review, the pause history, and the task's paths
     compared with the files actually changed
3. **Merging is acceptance.** The main branch holds only accepted work. When a
   board member accepts, Moonbeam merges the branch. A returned task continues
   on its branch. A rejected task is never merged, so nothing needs reverting.
4. **The scope envelope includes paths**: the files and directories a task may
   change. Moonbeam flags changes outside them, and they tell Moonbeam which
   runs can proceed side by side.
5. **Overlapping paths make tasks sequential.** When two tasks' paths overlap,
   the later one depends on the earlier one: it cannot be claimed until the
   earlier task is completed, which means merged. Its run branch therefore
   always starts from a main branch that already contains the earlier work.
   "Earlier" means approved earlier. Moonbeam records this dependency
   automatically and shows it on both tasks. A board member may reorder it.
6. **An external git server is optional.** Moonbeam works against local
   repositories on the LAN. Publishing to GitHub or Gitea can be added later but
   is not required for review.

This repository (Moonbeam's own development, which does not yet run under
Moonbeam) uses a different interim rule: shared-checkout work with the
dispatcher committing, as recorded in the root `AGENTS.md`.

## Alternatives considered

- **Merge into main when a task reaches review.** Simple, but the main branch
  would hold unaccepted work, and rejections would need reverts.
- **Visible review folders per task.** Keeps main clean, but reviewing means
  navigating to separate folders, and it doesn't scale across projects.
- **External pull requests only (GitHub or Gitea).** Industry standard, but it
  requires a server, and diffs are poor for reading whole documents.

## Consequences

### Benefits

- The board always reviews the real result in one place.
- The main branch stays clean. Rejection costs nothing.
- Path checks turn part of the "stays within scope" judgment into an automatic
  check.

### Costs and risks

- Moonbeam must build a good diff and document viewer. This becomes part of the
  run view and review work in delivery phase 3.
- A branch that has fallen behind the main branch needs updating before it can
  merge. Who does that (the agent in a follow-up run, or Moonbeam
  automatically) and how conflicts are handled needs a contract.
- Repository write-back (ADR-001) and merge on acceptance must agree on commit
  and author policy.

## Follow-up work

- Resolve CONTRACT-001's boundary with runs: the merge becomes part of the
  accept transition (T9).
- Add the overlap dependency to CONTRACT-001 as a precondition of claiming
  (T3).
- A contract for run branches: naming, how a branch is updated from main,
  conflicts, and cleanup.
- Add the review surface requirements to the run view design.

## Amendment — 2026-09-24: one branch per task (Board C1)

Recorded by TASK-012. The decision text above is left as approved; this
amendment corrects how it is read.

The board decided (answer sheet `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`,
item C1, "follow the recommendation") that **a branch belongs to a task, not to
a run**:

- Where this ADR says "branch per run" (title), "every run works on its own
  branch" (decision 1), and "its run branch" (decision 5), read **task
  branch**: one branch per task, named `moonbeam/TASK-NNN`, used by each of the
  task's runs in turn. Claims guarantee one writer at a time, and each run's
  commits are identified by the commit range it published.
- This matches decision 3, "a returned task continues on its branch".
- Everything else in decision 1 is unchanged: Moonbeam names and creates the
  branch, and agents never merge into, rebase onto, or push to main.
- Accepted work is merged with a merge commit, not squashed, and a cancelled
  task's branch is kept for 30 days (also Board C1).

The mechanics are specified in CONTRACT-004 ("Task branches, checkouts, and
merge on acceptance"). Separately, Board C2 places each project's canonical
repository as a bare repository on the Moonbeam host, with GitHub as a mirror;
that is consistent with decision 6 and needs no amendment here.

## Amendment — 2026-09-24: acceptance and merge are separate human steps (Board)

Decision 3 ("Merging is acceptance") is superseded as follows. Decisions 1, 2,
4, and 6 stand. Decision 5 is adjusted as described below.

1. **Acceptance is a decision, not a merge.** A board member accepts the task,
   and it becomes `completed`. Accepting does not change the project
   repository.
2. **Integration is a separate, explicit human step after acceptance.** For a
   completed task, a human either:
   - asks Moonbeam to **merge** the task branch into main (a human-only action
     in the UI), or
   - merges it by hand. Moonbeam then detects that the branch has reached main.

   Pushing to a remote is a further, separate step (ADR-006).
3. **The main branch still holds only accepted work.** Nothing merges before
   acceptance, and Moonbeam refuses to merge a branch whose task is not
   `completed`. Returned, cancelled, or rejected work never reaches main.
4. **A completed task shows its integration status**: not merged, merged by
   Moonbeam, merged by hand, or merge refused. Pushed or not pushed is shown
   too.
5. **Decision 5 changes**: a later task with overlapping paths waits until the
   earlier task's work is **on main**, not only until it is completed. This
   preserves "the later task's branch starts from main with the earlier work".

Open points for the contracts (TASK-013):

- What happens when a merge requested after acceptance conflicts. The task is
  already `completed` and cannot be returned.
- How the permanent task record reaches the repository when the merge is done
  by hand.
- Whether completed tasks that stay unmerged should surface in the decision
  queue.
