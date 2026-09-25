# TASK-014: Apply board answers round 2 (merge and override edge cases), fix stale text

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick (instructed in planning session)
Approved date: 2026-09-25
Related contracts: CONTRACT-001, CONTRACT-002, CONTRACT-003, CONTRACT-004
Related ADRs: ADR-005, ADR-007 (Proposed)
Dependencies: TASK-013 (in review)

## Desired outcome

The board's 2026-09-25 answers to the questions TASK-013 raised are applied.
Stale text is fixed, and all contracts use the status word "Approved".

## Context

Board answers, 2026-09-25. The principle behind them is written up as ADR-007:
gates bind agents, humans may override, and every override is recorded.

- **004 Q19 (a merge requested after acceptance conflicts):**
  - A hand merge is always accepted as fact.
  - If a hand merge happens before acceptance, the task is treated as
    accepted, with the note "accepted by early merge; review skipped".
- **004 Q20 (the record after a hand merge):** the hand merge stands. The task
  record is written or updated, with a note, in the next merge Moonbeam
  performs.
- **001 Q24:** accepted but unmerged tasks appear in the decision queue as
  their own group ("Accepted, not merged"), with refused merges first.
- **001 Q25:** a conflict already known at acceptance refuses the accept by
  default. A human may use an "accept anyway" override, which is recorded.
- **004 Q21:** the interim reading is confirmed. The safe-folder check applies
  only to the working tree that has main checked out.
- **004 Q22:** whoever performs the merge is its author. If that person is not
  the acceptor, this is noted.
- **004 Q23:** Moonbeam never fetches from remotes. Humans do.
- **004 Q24:** registering and relinking projects, and changing the projects
  root, are human-only actions. This also resolves 002 Q9. Relink verifies
  that the new path is the same repository before updating it.

## Scope

### Included

- Apply the answers above to the named contracts, and move each question to
  "Resolved questions".
- Add a dated revision note to each contract changed.
- Record overrides (who, when, what was bypassed, reason) as audit and task
  record notes, as ADR-007 point 4 describes.
- Set `Status: Approved` in CONTRACT-002, 003, and 004. They currently say
  "Accepted".
- ADR-005:
  - Add a short dated amendment saying that its first amendment's reference to
    a Moonbeam-held repository is superseded by ADR-006.
  - Reference ADR-007 for hand merges.
- `TEMPLATE/docs/AI_DEVELOPMENT_SYSTEM.md`: fix the "Task records" wording. The
  record is written with the merge, not at acceptance.

### Excluded

- New behavior beyond these answers.
- The override review screen (phase 4).

### Paths

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md`
- `docs/decisions/ADR-005-review-surface-and-merge-on-acceptance.md`
- `TEMPLATE/docs/AI_DEVELOPMENT_SYSTEM.md`
- `TEMPLATE/docs/workflow/`

## Plan

## Acceptance criteria

- [ ] Every answer above is traceable to the contract text it changed.
- [ ] Every contract says `Status: Approved`.
- [ ] No contract contradicts another on hand merges, overrides, or the
      decision queue.
- [ ] Any new question is flagged, not decided.

## Validation requirements

Board review of the diffs.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
