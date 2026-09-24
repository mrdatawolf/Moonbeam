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
