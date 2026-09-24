# TASK-002: Contract for the task lifecycle, claims, and splits

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001 (to be produced)
Related ADRs: ADR-001, ADR-003
Dependencies: ADR-001 and ADR-003 accepted

## Desired outcome

An approved behavioral contract (CONTRACT-001) that defines:

- the task states and the transitions allowed between them
- who may perform each transition (human or agent)
- claim exclusivity and claim timeouts
- how splits work and the rules of the scope envelope
- blocked and paused conditions
- the audit record each transition produces

## Context

This is the core of Moonbeam. The data model, the API, and the decision queue
UI will all be built against this contract.

## Scope

### Included

- States: proposed, approved, in_progress, in_review, completed, cancelled.
- Conditions: blocked, paused.
- Invariants, including that an agent can never approve or accept.
- Subtask rule (decided 2026-09-24):
  - Subtasks of an approved task are approved automatically.
  - Each subtask gets an independent agent review but no individual human
    acceptance.
  - The parent enters review when all its subtasks are done.
  - A board member accepts the parent, or returns it and may reopen specific
    subtasks.

### Excluded

- Runs, pauses in detail, and repository write-back. These get their own
  contracts.

## Plan

## Acceptance criteria

- [ ] Every transition names its preconditions, postconditions, and allowed
      actors.
- [ ] The subtask rule above is specified as transitions and invariants.
- [ ] Any remaining open questions are flagged for the board.

## Validation requirements

Board review.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
