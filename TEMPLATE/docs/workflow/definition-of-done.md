# Definition of Done

A task is ready for review (`in_review`) when:

- Its approved scope and acceptance criteria are implemented, within its scope
  envelope.
- Required automated and manual validation has been performed.
- Relevant documentation is current.
- Material assumptions, deviations, pause resolutions, and unresolved risks are
  recorded.
- An implementation handoff has been submitted to Moonbeam.
- If the task was split, all its subtasks are done.

A subtask is done when its handoff has been submitted and its independent agent
review is recorded. It is never accepted on its own. (The exact condition is
defined by Moonbeam's task lifecycle contract; see the open questions in
`splits.md`.)

A task is complete (`completed`) only when:

- Independent review findings have been resolved or explicitly accepted by the
  board.
- A board member accepts the result in Moonbeam.

Moonbeam then writes the task record into the repository. Editing a task file
never completes a task.
