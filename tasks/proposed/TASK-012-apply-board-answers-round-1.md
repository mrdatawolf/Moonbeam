# TASK-012: Apply board answers (round 1) across CONTRACT-001 to CONTRACT-004

Owner role: Contract designer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by:
Approved date:
Related contracts: CONTRACT-001, CONTRACT-002, CONTRACT-003, CONTRACT-004
Related ADRs: ADR-005
Dependencies: The board answers `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`

## Desired outcome

All four contracts reflect the board's answers and agree with one another.
Answered questions move to each contract's "Resolved questions". CONTRACT-002,
003, and 004 are ready for board approval.

## Context

Four contracts were written in parallel. Their open questions were merged into
one answer sheet. This task applies the answers back.

## Scope

### Included

- Apply every answer from the board-questions file to the contracts it names.
- Cross-contract consistency:
  - the human-only action list (002) matches the transitions (001)
  - the `unidentified` failure category
  - the merge failure behavior (001 T6/T9 with 004)
  - the run status names (003 with a future runs contract)
- Correct ADR-005's "every run works on its own branch" wording if C1 is
  answered "branch per task". Add an amendment note to the ADR rather than
  rewriting its history.
- Clear the answered items from the open-question lists in
  `TEMPLATE/docs/workflow/lifecycle.md` and `splits.md`.

### Excluded

- New behavior beyond the answers.

### Paths

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md`
- `docs/decisions/ADR-005-review-surface-and-merge-on-acceptance.md`
- `TEMPLATE/docs/workflow/`

## Plan

## Acceptance criteria

- [ ] Every answer is traceable to the contract text it changed (a mapping
      table in the handoff).
- [ ] No two contracts contradict each other on shared terms, actions, or
      failure categories.
- [ ] Any new question is flagged, not decided.

## Validation requirements

The board reviews the diffs.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
