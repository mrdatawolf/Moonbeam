# Task Lifecycle

Moonbeam holds every task's lifecycle state. The state recorded in Moonbeam is
authoritative; nothing in this repository is.

```text
proposed --board approval--> approved --claim--> in_progress
in_progress --implementation handoff--> in_review
in_review --board acceptance--> completed
in_review --board returns it--> approved
                                (a split parent given new subtasks goes to in_progress)
(any state before completed) --cancellation--> cancelled
```

Accepting does not merge. After acceptance, a board member merges the task's
branch into the main branch, either by asking Moonbeam or by hand. The task
stays `completed`; Moonbeam shows whether its work is merged and pushed.
Pushing the main branch to a remote is a further step that only a board member
takes.

Moonbeam enforces these transitions and records who performed each one and when.
The exact preconditions, postconditions, and allowed actors for each transition
are specified in Moonbeam's task lifecycle contract. This document summarizes
what agents need to know to work correctly.

## States

- `proposed`: A plan exists, but work is not authorized.
- `approved`: A board member approved the task. It is ready to be claimed once
  no task it waits for is unfinished (see "Paths and waiting").
- `in_progress`: One claimant (a person or an agent run) is working on it.
- `in_review`: Implementation and its handoff are ready for independent review
  and human acceptance.
- `completed`: A board member accepted the work. Its merge into the main
  branch is a separate step (see above).
- `cancelled`: The task will not be completed.

## Conditions

Conditions describe a task's circumstances without changing its state.

- `blocked`: The task cannot proceed until something outside it is resolved,
  such as an external decision. Raise the blocker in Moonbeam with what is
  needed, who can resolve it, and its effect. Do not continue beyond the
  approved scope to get around a blocker. Moonbeam itself raises a blocker on a
  split parent when a finished subtask's work cannot be merged into the
  parent's branch; a board member resolves it.
- `paused`: A run on the task has stopped to ask a human a question and is
  waiting for the answer. See `pauses.md`.

## Paths and waiting

- A task that changes files declares its **paths**: plain file and directory
  paths, relative to the repository root. Globs are not allowed. A task with no
  paths is approved as a task that changes no files.
- Two tasks overlap when a path of one is the same as, or contains, a path of
  the other. Overlapping tasks run one at a time, in the order of the
  project's queue (normally approval order; a board member may move a task in
  the queue). A task cannot be claimed until every overlapping task ahead of it
  is cancelled, or is accepted with its work on the main branch. Acceptance
  alone is not enough: the work must have been merged.
- A subtask waits for whatever its parent waits for, and for any earlier
  sibling subtask whose paths overlap its own (normally creation order; a
  board member may change the order of siblings).
- Moonbeam compares the files you change with your task's paths. Changes
  outside them are flagged at review, and the board must give a reason to
  accept them.

## Authority

- Agents never approve tasks and never accept work. Moonbeam rejects approval
  and acceptance actions from agents.
- Agents and board members may propose tasks. Only a board member moves a task
  from `proposed` to `approved`.
- An approved task is claimed by one claimant at a time. Claiming starts work.
  An agent run's claim expires if the run stops showing activity for 30
  minutes, and ends when the run ends without a handoff. A person's claim never
  expires. A claimant may release its claim; a board member may break anyone's
  claim.
- The implementer submits its handoff to Moonbeam, which moves the task to
  `in_review`. Moonbeam refuses the handoff unless the task's branch merges
  cleanly into its target (the main branch, or the parent's branch for a
  subtask). A task that has been split enters `in_review` when all its subtasks
  are done (see `splits.md`).
- The reviewer records findings but does not implement fixes or accept the task.
  Review findings always go to a human. A reviewer whose review of a subtask has
  findings may add fix subtasks in the same step (see `splits.md`).
- Only a board member accepts work (`completed`) or returns it. Accepting does
  not change the repository. Only a board member merges a completed task into
  the main branch or pushes the main branch to a remote; Moonbeam never does
  either on its own and never force-pushes. If Moonbeam cannot merge safely (a
  conflict, or uncommitted changes in the folder where the main branch is
  checked out), it refuses, changes nothing, and says what to fix. A returned
  task goes back to `approved`, with
  return notes, for the next claimant. A returned split parent that is given
  new subtasks goes to `in_progress`; one returned without new subtasks goes to
  `approved`, and whoever claims it may only add subtasks. Completed subtasks
  are never reopened.
- Board members may cancel any unfinished task. An agent may cancel only a
  `proposed` task it proposed, or a subtask its own run created that no one has
  claimed yet. Otherwise, recommend cancellation to the board.
- Subtasks created by a split are approved automatically, within the parent's
  scope envelope. See `splits.md`.

## Task files in a checkout

There are no lifecycle directories in this repository. A task's location in the
file tree says nothing about its state.

- When a run starts, Moonbeam writes the task file into the working checkout so
  the agent can read its assignment. That file is a **read-only snapshot**,
  excluded from commits. Editing, moving, or deleting it does not change the
  task's state, and the next snapshot may overwrite it.
- Report progress, blockers, pauses, splits, and handoffs to Moonbeam, not by
  editing the snapshot.
- Commit your work on the task's branch. Work you leave uncommitted when your
  run ends is not published.
- When a board member has Moonbeam merge an accepted task into the main branch,
  Moonbeam writes the task file, with its handoff, review, and acceptance, to
  `tasks/TASK-NNN-short-description.md` as the permanent record. The record is
  part of the same merge commit as the accepted work.

## File conventions

Tasks are identified as `TASK-NNN` and task files are named
`TASK-NNN-short-description.md`. Link contracts as `CONTRACT-NNN` and decisions
as `ADR-NNN`.

## Open questions

These are not yet decided by the Moonbeam board. Until they are, do not assume
an answer; pause and ask if one matters to your work.

- The exact mechanism an agent uses to submit a handoff, raise a blocker, or
  record a split in Moonbeam.
- How a project is worked by hand when Moonbeam is unavailable, and how that
  work is reconciled with Moonbeam afterwards. Commits made on the main branch
  by hand, including commits pulled in from a remote, are allowed and shown as
  a warning.
- How the task record reaches the repository when a board member merges a task
  by hand, and what happens when a merge requested after acceptance conflicts.
