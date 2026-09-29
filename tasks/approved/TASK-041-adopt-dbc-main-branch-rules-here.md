# TASK-041: Adopt the DbC main-branch rules in this repository

Owner role: Documentation
Assigned agent: librarian
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: TASK-025, TASK-038, TASK-022

## Desired outcome

This repository follows the DbC task v1 main-branch rules (U5 to U8):
- proposals and approvals are committed on main and pushed
- work happens on a branch
- merging from `completed/` without fast-forwarding is acceptance

The dispatch rules keep parallel work in one visible checkout. Moonbeam can
observe the switch as its first project.

## Context

This is TASK-023 decision 4, option B, part 2. It is scheduled after the
per-project view (TASK-038) so the board can watch the effect. The model is a
batch branch: parallel tasks share one branch cut from main, in the shared
checkout, and the branch is merged with `--no-ff` only when every task on it is
in `completed/`.

## Scope

### Included

- **`docs/workflow/lifecycle.md`:**
  - U5: propose and approve on main and push; branch after approval; the moves to `in-progress/`, `review/`, and back happen only on the branch; move to `completed/` on the branch; merge with a merge commit or squash, never fast-forward; never merge a branch whose tasks are not all in `completed/`; every other change to main arrives through an accepted task's merge
  - U6: task IDs and withdrawn proposals
- **`docs/workflow/approval-gates.md`:** U7 (approval in the header fields, in the moving commit; acceptance is the merge commit; contract and ADR approvals are header-only commits).
- **`tasks/README.md`:** U8 (`in-progress/` and `review/` don't appear on main).
- **`AGENTS.md` "Dispatching subagents":**
  - the batch-branch model
  - how approvals reach main while a batch branch is checked out: between batches, or through a dedicated main worktree for lifecycle commits followed by merging main into the branch
  - the dispatcher commits and merges, and the board reviews on the batch branch in the shared checkout
  - push main after each proposal, approval, and merge

### Excluded

- `CLAUDE.md`. If the new rules would contradict it, stop and raise the conflict.
- Existing task files.
- The upstream template.

### Paths

- `docs/workflow/lifecycle.md`
- `docs/workflow/approval-gates.md`
- `tasks/README.md`
- `AGENTS.md`

## Plan

1. Draft the workflow changes from U5 to U8.
2. Rewrite the dispatch section for batch branches.
3. Check for consistency with `CLAUDE.md` and the review-visibility rule.

## Acceptance criteria

- [ ] U5 to U8 are stated for this repository, as listed under Included.
- [ ] AGENTS.md keeps the visibility guarantee (the board reviews in the shared checkout) and describes when parallel tasks may share a batch branch.
- [ ] After adoption, a normal batch produces on main only proposal commits, approval commits, and one non-fast-forward merge per batch. Checked against CONTRACT-006 FL-1, FL-3, FL-4, and FL-11, the batch raises no flags.
- [ ] No contradiction with `CLAUDE.md`. Any conflict found is raised to the board, not resolved.

## Validation requirements

A hand walk-through of one batch against FL-1, FL-3, FL-4, and FL-11, recorded
in the handoff. After the first real batch, the board can confirm it in
Moonbeam's view of this repository.

## Risks and assumptions

- Assumes decision 4, option B. With option A this runs first. With option C it is dropped.
- A returned task left on a batch branch blocks that batch's merge until it is
  completed, or moved back to `approved/` on the branch.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
