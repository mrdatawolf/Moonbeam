# Splitting Tasks

A split divides a task into subtasks within its scope envelope. The parent task
remains the unit of human approval and acceptance. Subtasks are the means of
getting it done.

## Scope envelope

A task's scope envelope is its:

- inclusions (what the task is authorized to change or deliver)
- exclusions (what it must not change or deliver)
- paths (the files and directories it may create or change: plain paths
  relative to the repository root, no globs)
- linked contracts
- constraints (technical, operational, or process limits stated in the task,
  its contracts, or its ADRs)

The envelope is recorded in the task's "Scope envelope" section (see
`docs/templates/task.md`). It is fixed when the task is approved. To change it,
the board cancels the task and approves a new one.

## Who may split

- Only top-level tasks are split. A subtask is never split further.
- A board member may split an approved task, and may add subtasks to a split
  parent at any time before it is accepted, including when returning it.
- The claimant of a task, person or agent run, may split it.
- An agent run that has claimed one of the parent's subtasks may add sibling
  subtasks.
- A reviewer run whose review of a subtask has findings may add fix subtasks to
  the parent, as part of recording that review.
- An agent run may cancel a subtask that its own run created, only while no one
  has claimed it.

## Rules

1. **Subtasks inherit the parent's scope envelope and may only narrow it.** A
   subtask may include less, exclude more, and add constraints. It may not
   include anything the parent excludes or does not include, add paths outside
   the parent's paths, drop a linked contract, or relax a constraint.
2. **Subtasks of an approved task are approved automatically.** Because a
   subtask cannot exceed an envelope the board already approved, no further
   board approval is needed. This is the only way a task becomes approved
   without a board member's approval.
3. **Work outside the envelope is not a subtask.** If you find work that the
   parent's envelope does not cover, propose it as a new task for board
   approval, or pause with a scope question. Do not create a subtask for it.
4. **Each subtask gets its own independent agent review.** The reviewer checks
   the subtask against its acceptance criteria and against the envelope it
   inherited.
5. **A subtask is done when its agent review is recorded**, whatever the
   verdict. Its work is then merged into the parent's branch. Findings are
   carried to the parent's review. If Moonbeam cannot merge a finished
   subtask's work into the parent's branch, it blocks the parent until a board
   member resolves it, usually with a fix subtask.
6. **Subtasks are not accepted individually.** No board member accepts a
   subtask on its own.
7. **Subtasks wait like tasks.** A subtask waits for whatever its parent waits
   for, and for any earlier sibling whose paths overlap its own. Overlapping
   siblings run in the order they were created, unless a board member changes
   that order.
8. **The parent enters review when all its subtasks are done.** The parent's
   review covers the combined result: the parent's branch compared with main.
9. **A board member accepts the parent or returns it.** Completed subtasks are
   never reopened. If a problem is found, the fix is done in a new subtask. A
   returned parent is never worked directly; whoever claims it may only add
   subtasks.

## Writing a good split

- Make each subtask independently reviewable, with its own desired outcome and
  acceptance criteria.
- State the subtask's envelope explicitly, even when it is identical to the
  parent's. Name what it narrows.
- Give subtasks non-overlapping paths where you can, so they can run side by
  side. List overlapping subtasks in the order they should run.
- Make sure the subtasks together cover the parent's acceptance criteria, or
  state which parent criteria are satisfied at the parent level.

## Open questions

These are not yet decided by the Moonbeam board. Until they are, do not assume
an answer; pause and ask if one matters to your work.

- Whether dispatching helper agents inside a single run must be recorded as a
  split.
