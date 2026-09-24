# Approval Gates

Moonbeam enforces the gates and records the actor and time of every approval,
return, and acceptance. Agents never pass an approval or acceptance gate: Moonbeam
rejects those actions from agents.

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
Review informs the board's decision; it is not acceptance. Review findings
always go to a human.

## Acceptance

Implementation completion is not acceptance, and neither is a passing review.
Only a board member accepts work. Acceptance happens once, on the parent task;
subtasks are not accepted individually.

When a board member accepts a task, Moonbeam writes the task record, with its
handoff, review, and acceptance, into the repository.
