# TASK-002: Contract for the task lifecycle, claims, and splits

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001 (`docs/contracts/CONTRACT-001-task-lifecycle.md`, Proposed)
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

- [x] Every transition names its preconditions, postconditions, and allowed
      actors. (CONTRACT-001 transition table and T1–T16, C1–C2.)
- [x] The subtask rule above is specified as transitions and invariants.
      (T8, T10–T14, T16; invariants I3, I6–I11.)
- [x] Any remaining open questions are flagged for the board. (CONTRACT-001
      "Open questions" Q1–Q13, summarized below.)

## Validation requirements

Board review.

## Risks and assumptions

- CONTRACT-001 depends on an identity and permission interface (ADR-003
  follow-up) that reliably tells agent credentials apart from UI user
  selection. That contract does not exist yet.
- It also depends on future runs, pauses, and write-back contracts, and
  references them only as boundaries.

## Blocker

None.

## Implementation handoff

Contract designer: contract-architect
Date: 2026-09-24

### Summary

Produced `docs/contracts/CONTRACT-001-task-lifecycle.md` (Status: Proposed).
It defines:

- Six states, with `completed` and `cancelled` terminal. The only exit from a
  terminal state is a human reopening a completed subtask while its parent is
  still non-terminal.
- Three actor kinds: human (board member), agent (always inside a run started by
  a human), and system (only named automatic transitions). The server decides
  actor kind from how the request is authenticated, never from what the caller
  declares.
- Transitions T1–T16 with preconditions, postconditions, allowed actors, and
  audit records: create, approve, claim, release/break, automatic claim end,
  hand off, record review, subtask completion on review, accept, return, split,
  parent enters review, reopen subtask, parent falls back, cancel, and cascade
  cancel.
- Conditions: blocked (C1) and paused (C2), which never change state and block
  a listed set of forward actions.
- Claim exclusivity and expiry: agent-run lease, human inactivity expiry, and
  the claim ending when its run ends without a handoff.
- Scope-envelope narrowing rules, split between what the server checks
  structurally and what review checks semantically.
- Audit record contents, 16 invariants, failure categories, concurrency rules,
  and validation requirements.

### Assumptions made (each is a proposed default, flagged in the contract)

- A handoff ends the claim, so in-review tasks have no claimant.
- A returned leaf task goes back to `approved` (unclaimed), not to
  `in_progress`.
- A subtask completes automatically once an agent review is recorded, whatever
  the verdict. Findings carry forward to the parent's review. Humans can reopen
  a subtask at any time before the parent is accepted.
- Splits are one level deep in V1.
- If every subtask is cancelled, the parent falls back to `approved`.
- Cancelling a parent cascades to all subtasks that are not yet done. Completed
  subtasks stay as history.
- Agents may only cancel (withdraw) proposals they authored.
- The scope envelope is fixed once the task is approved.

### Open questions for the board

1. **Claim expiry values:** agent-run lease 30 minutes, human claim 7 days
   of inactivity. Alternatively, human claims could never expire.
2. **Subtask review with findings:** complete it automatically and carry the
   findings to the parent (proposed), or hold it for a human decision?
3. **Parent returned without reopening:** make the parent directly claimable
   (proposed), or require at least one reopened or new subtask?
4. **Returned leaf task:** send it to `approved`, unclaimed (proposed), or to
   `in_progress` with the prior claimant?
5. **Review before acceptance:** require a review of the latest handoff, with a
   human waiver allowed (proposed)? Or never require one, or never allow a
   waiver?
6. **Nested splits:** disallow in V1 (proposed)?
7. **Agent cancellation:** should agents only withdraw their own proposals
   (proposed)?
8. **Scope envelope after approval:** keep it fixed (proposed), or let humans
   edit it?
9. **Blocked and claims:** should blocking suspend claim expiry, stop agents
   (but not humans) from claiming, and block the parent's subtasks as well?
10. **Adding subtasks after a split:** humans only (proposed)?
11. **Reviewer independence:** must the reviewer use a different model from the
    implementing run?
12. **Audit granularity:** should claim renewals and non-authority rejections be
    recorded (proposed: no)?
13. **Identity dependency:** the identity and permission contract (ADR-003
    follow-up) should be produced before or alongside implementation.

### Validation performed

Checked the contract against TASK-002's acceptance criteria and against
ADR-001, ADR-003, ADR-004, and the domain language and resolved questions in
`docs/PROJECT.md`. No code or tests are in scope.

## Review

Not reviewed.

## Human acceptance

Pending.
