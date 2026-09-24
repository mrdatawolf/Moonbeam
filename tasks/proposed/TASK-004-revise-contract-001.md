# TASK-004: Revise CONTRACT-001 with board answers and ADR-005

Owner role: Contract designer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by:
Approved date:
Related contracts: CONTRACT-001
Related ADRs: ADR-001, ADR-003, ADR-005
Dependencies: None

## Desired outcome

CONTRACT-001's body matches the board's answers to Q1–Q13 (recorded in its
"Open questions" section) and ADR-005. Nothing in it contradicts them, and it
has a revision note.

## Context

The board approved CONTRACT-001 and answered its open questions. Several
answers change transitions. ADR-005 was approved after the contract was
written.

## Scope

### Included

- A1: human claims never expire. The agent-run lease is unchanged.
- A2 and A3: a subtask is done once its agent review is recorded. Subtasks are
  never reopened. Remove T13. A returned split parent gets new subtasks instead
  of reopened ones (update T10).
- A4 and A5: a returned leaf goes to `approved`, unclaimed, with return notes. A
  top-level leaf needs an agent review before acceptance, and a human may waive
  it with a reason.
- A7: agents may cancel subtasks they created.
- A9: unblocking a parent unblocks its subtasks.
- A10: agents may add subtasks to a split parent within its scope envelope,
  without human involvement.
- A11: a reviewer using a different model from the implementing run is
  recommended, not required. When the model is the same, it is flagged in the
  audit record and in the UX expectations.
- A12: confirm the defaults (no renewal audit, no audit of non-authority
  rejections).
- ADR-005:
  - Accept (T9) includes merging the run branch. The merge itself belongs to
    CONTRACT-004 and is referenced only as a boundary.
  - Claim (T3) requires that no earlier-approved task with overlapping paths is
    unfinished.
  - The scope envelope includes paths.
- Remove "optionally reopening specific subtasks" wording from
  `docs/PROJECT.md` and the TEMPLATE workflow docs, replacing it with the
  new-subtask rule.
- Move the answered open questions into a "Resolved questions" section. Keep
  status Approved, and add a revision note listing the changed transitions.

### Excluded

- New behavior beyond the answers and ADR-005.

### Paths

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/PROJECT.md`
- `TEMPLATE/docs/workflow/`

## Plan

## Acceptance criteria

- [ ] Every answer A1–A13 and every ADR-005 point is reflected in the relevant
      transitions and invariants.
- [ ] No text in the paths above still describes reopening subtasks.
- [ ] Any new question the revision uncovers is flagged, not decided.

## Validation requirements

The board reviews the diff of the contract.

## Risks and assumptions

Invariant numbering may shift. Keep transition IDs stable where possible.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
