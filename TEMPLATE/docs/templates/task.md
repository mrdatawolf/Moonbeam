<!--
Task state lives in Moonbeam, not in this file. A copy of this file in a working
checkout is a read-only snapshot written by Moonbeam; editing it changes
nothing. The approval, handoff, review, and acceptance fields are filled from
Moonbeam's records when Moonbeam writes the permanent task record.
-->

# TASK-NNN: Title

Owner role:
Assigned agent:
Parent task:
Proposed by:
Proposed date:
Approved by:
Approved date:
Related contracts:
Related ADRs:
Dependencies:

## Desired outcome

## Context

## Scope envelope

Subtasks inherit this envelope and may only narrow it. See
`docs/workflow/splits.md`. For a subtask, state what it narrows relative to the
parent.

### Included

### Excluded

### Contracts

### Paths

Files and directories this task may create or change, one per line, relative
to the repository root. Use plain file or directory paths only: no globs, no
absolute paths, and nothing outside the repository. A directory covers
everything inside it.

A task with no paths changes no files. It is approved as a task that changes no
files, and any file it does change is flagged at review and needs a written
reason from the board member who accepts it.

Moonbeam uses these paths to check a run's changes against its scope and to
make tasks with overlapping paths run one at a time. The reviewer verifies
them.

### Constraints

## Plan

## Acceptance criteria

- [ ]

## Validation requirements

## Risks and assumptions

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
