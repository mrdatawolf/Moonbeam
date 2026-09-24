# Definition of Done

A task is ready for review (`in_review`) when:

- Its approved scope and acceptance criteria are implemented, within its scope
  envelope.
- Required automated and manual validation has been performed.
- Relevant documentation is current.
- Material assumptions, deviations, pause resolutions, and unresolved risks are
  recorded.
- The work is committed on the task's branch, and the branch merges cleanly
  into its target (the main branch, or the parent's branch for a subtask).
  Moonbeam refuses a handoff otherwise.
- An implementation handoff has been submitted to Moonbeam.
- If the task was split, all its subtasks are done.

A subtask is done when its handoff has been submitted and its independent agent
review is recorded, whatever the verdict. Its work is then merged into the
parent's branch. It is never accepted on its own and never reopened.

A task is complete (`completed`) only when:

- Independent review findings have been resolved or explicitly accepted by the
  board.
- A board member accepts the result in Moonbeam.

Accepting does not merge. The accepted work reaches the main branch when a
board member has Moonbeam merge it, or merges it by hand. A Moonbeam merge
includes the task record, written to `tasks/TASK-NNN-short-description.md`.
Editing a task file never completes a task.
