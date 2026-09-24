# Approval Gates

Moonbeam enforces the gates and records the actor and time of every approval,
return, acceptance, and merge. Agents never pass an approval or acceptance gate,
and never merge into the main branch or push: Moonbeam rejects those actions
from agents.

## Design approval

Meaningful work requires board approval of its intended outcome, boundaries, and
architectural direction before an implementation task is approved.

## Contract approval

Large, risky, externally visible, or cross-cutting work requires an approved
behavioral contract. Small work may use acceptance criteria in the task.

## Implementation authorization

A board member approving a task in Moonbeam authorizes work within that task's
scope envelope. It does not authorize adjacent changes. Work runs only against a
task that Moonbeam shows as approved and claimed.

A task file in a checkout is not authorization. Its presence, contents, or
location do not approve anything.

## Split approval

Subtasks created by splitting an approved task are approved automatically,
because they may only narrow the parent's scope envelope. Anything outside the
envelope needs a new task approved by the board. See `splits.md`.

## Review

Every handoff, including each subtask's, receives an independent agent review.
A board member may accept a task without one only by waiving it with a
recorded reason. Review informs the board's decision; it is not acceptance.
Review findings always go to a human.

## Acceptance

Implementation completion is not acceptance, and neither is a passing review.
Only a board member accepts work. Acceptance happens once, on the parent task;
subtasks are not accepted individually. Accepting changes to files outside the
task's paths requires a written reason.

Accepting does not change the repository. Merging the accepted task's branch
into the main branch is a separate step that only a board member takes, by
asking Moonbeam or by hand. When Moonbeam merges, the task record, written to
`tasks/TASK-NNN-short-description.md`, is part of the same merge commit. If
Moonbeam cannot merge safely (a conflict, or uncommitted changes in the folder
where the main branch is checked out), it refuses, changes nothing, and says
what to fix.

Pushing the main branch to a remote is a further step that only a board member
takes. Moonbeam never pushes on its own and never force-pushes.
