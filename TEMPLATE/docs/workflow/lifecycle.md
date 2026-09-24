# Task Lifecycle

Moonbeam holds every task's lifecycle state. The state recorded in Moonbeam is
authoritative; nothing in this repository is.

```text
proposed --board approval--> approved --claim--> in_progress
in_progress --implementation handoff--> in_review
in_review --board acceptance--> completed
in_review --board returns it--> in_progress
(any state before completed) --cancellation--> cancelled
```

Moonbeam enforces these transitions and records who performed each one and when.
The exact preconditions, postconditions, and allowed actors for each transition
are specified in Moonbeam's task lifecycle contract. This document summarizes
what agents need to know to work correctly.

## States

- `proposed`: A plan exists, but work is not authorized.
- `approved`: A board member approved the task. It is ready to be claimed.
- `in_progress`: One claimant (a person or an agent run) is working on it.
- `in_review`: Implementation and its handoff are ready for independent review
  and human acceptance.
- `completed`: A board member accepted the work.
- `cancelled`: The task will not be completed.

## Conditions

Conditions describe a task's circumstances without changing its state.

- `blocked`: The task cannot proceed until something outside it is resolved,
  such as an unfinished dependency or an external decision. Raise the blocker in
  Moonbeam with what is needed, who can resolve it, and its effect. Do not
  continue beyond the approved scope to get around a blocker.
- `paused`: A run on the task has stopped to ask a human a question and is
  waiting for the answer. See `pauses.md`.

## Authority

- Agents never approve tasks and never accept work. Moonbeam rejects approval
  and acceptance actions from agents.
- Agents and board members may propose tasks. Only a board member moves a task
  from `proposed` to `approved`.
- An approved task is claimed by one claimant at a time. Claiming starts work.
- The implementer submits its handoff to Moonbeam, which moves the task to
  `in_review`. A task that has been split enters `in_review` when all its
  subtasks are done (see `splits.md`).
- The reviewer records findings but does not implement fixes or accept the task.
  Review findings always go to a human.
- Only a board member accepts work (`completed`) or returns it to
  `in_progress`.
- Subtasks created by a split are approved automatically, within the parent's
  scope envelope. See `splits.md`.

## Task files in a checkout

There are no lifecycle directories in this repository. A task's location in the
file tree says nothing about its state.

- When a run starts, Moonbeam writes the task file into the working checkout so
  the agent can read its assignment. That file is a **read-only snapshot**.
  Editing, moving, or deleting it does not change the task's state, and the
  next snapshot may overwrite it.
- Report progress, blockers, pauses, splits, and handoffs to Moonbeam, not by
  editing the snapshot.
- When a board member accepts a task, Moonbeam writes the task file, with its
  handoff, review, and acceptance, into the repository as the permanent record.

## File conventions

Tasks are identified as `TASK-NNN` and task files are named
`TASK-NNN-short-description.md`. Link contracts as `CONTRACT-NNN` and decisions
as `ADR-NNN`.

## Open questions

These are not yet decided by the Moonbeam board. Until they are, do not assume
an answer; pause and ask if one matters to your work.

- Who may cancel a task, and from which states. Until decided, agents do not
  cancel tasks; they may recommend cancellation to the board.
- The exact mechanism an agent uses to submit a handoff, raise a blocker, or
  record a split in Moonbeam.
- Where in the repository Moonbeam writes accepted task records, and its commit
  policy (branch, author, message) for write-back.
- Claim timeouts, and how a claim is released.
- How a project is worked by hand when Moonbeam is unavailable, and how that
  work is reconciled with Moonbeam afterwards.
