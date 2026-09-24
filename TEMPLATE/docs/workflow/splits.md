# Splitting Tasks

A split divides a task into subtasks within its scope envelope. The parent task
remains the unit of human approval and acceptance. Subtasks are the means of
getting it done.

## Scope envelope

A task's scope envelope is its:

- inclusions (what the task is authorized to change or deliver)
- exclusions (what it must not change or deliver)
- linked contracts
- constraints (technical, operational, or process limits stated in the task,
  its contracts, or its ADRs)

The envelope is recorded in the task's "Scope envelope" section (see
`docs/templates/task.md`).

## Rules

1. **Subtasks inherit the parent's scope envelope and may only narrow it.** A
   subtask may include less, exclude more, and add constraints. It may not
   include anything the parent excludes or does not include, drop a linked
   contract, or relax a constraint.
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
5. **Subtasks are not accepted individually.** No board member accepts a
   subtask on its own.
6. **The parent enters review when all its subtasks are done.** The parent's
   review and handoff cover the combined result.
7. **A board member accepts the parent or returns it.** When returning it, the
   board member may reopen specific subtasks.

## Writing a good split

- Make each subtask independently reviewable, with its own desired outcome and
  acceptance criteria.
- State the subtask's envelope explicitly, even when it is identical to the
  parent's. Name what it narrows.
- Record dependencies between subtasks.
- Make sure the subtasks together cover the parent's acceptance criteria, or
  state which parent criteria are satisfied at the parent level.

## Open questions

These are not yet decided by the Moonbeam board. Until they are, do not assume
an answer; pause and ask if one matters to your work.

- Who may split a task: only its current claimant, or any agent or board
  member.
- Whether a subtask may itself be split, and to what depth.
- Exactly when a subtask counts as done (for example, whether its agent review
  must pass, and what happens when that review requires changes).
- Whether dispatching helper agents inside a single run must be recorded as a
  split.
