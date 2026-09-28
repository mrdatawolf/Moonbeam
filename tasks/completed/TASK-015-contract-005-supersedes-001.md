# TASK-015: CONTRACT-005, the task lifecycle, superseding CONTRACT-001

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick (instructed in planning session)
Approved date: 2026-09-25
Related contracts: CONTRACT-001 (to be superseded), CONTRACT-005 (new)
Related ADRs: ADR-001, ADR-003, ADR-005, ADR-006, ADR-007
Dependencies: None

## Desired outcome

CONTRACT-005 fully replaces CONTRACT-001. It keeps every working part and
includes the fixes the board decided on 2026-09-25. CONTRACT-001 is marked
superseded. The contract READMEs state the board's rule: an approved contract
is never changed; it is superseded by a new contract.

## Context

- **Board rule (2026-09-25):** contracts can't change. A change is a new
  contract that replaces the old one and contains the working parts plus the
  fixes.
- **Fixes to include, from the TASK-006 implementation questions (board
  2026-09-25):**
  1. **I9 contradicts T14.** A parent whose subtasks were all cancelled falls
     back to being worked directly (T14). It may then enter review with no
     completed subtask. I9 must exclude that case. TASK-006 already implements
     this reading.
  2. **Add an "edit a proposed task" action.** While a task is `proposed`, a
     human, or the agent run that authored it, may edit its title,
     description, scope envelope (including paths, with the same validation
     as at create), and acceptance criteria. Each edit is audited. Nothing is
     editable after approval (scope changes still mean cancel and re-propose,
     Board A8).
  3. **Record the other TASK-006 readings the board accepted as contract
     text.**
     - Agent cancel and break-claim failures:
       - Outside the run's binding: `not_permitted`.
       - A fixed human-only action: an audited `authority_violation`.
     - A human recording a review (T7) gets `not_permitted`.
     - A return that adds subtasks writes one `returned` record on the
       parent.
     - Returning a leaf with new subtasks is rejected (it can be split after
       the return).
     - Minor ones:
       - Deactivating an inactive user, or reactivating an active one, is
         `invalid_transition`.
       - An out-of-range queue position is `validation`.
       - Renewing a suspended lease resets it to the full term.
     - Paths are validated at create and split, as well as at approval.
- **Fold into the body:** the 001 Q26 decision (a hand merge before
  acceptance outside `in_review` gives a warning plus a recorded override, with
  no state change).

## Scope

### Included

- `docs/contracts/CONTRACT-005-task-lifecycle.md` has been pre-created by the
  dispatcher as an exact copy of CONTRACT-001. Turn it into CONTRACT-005:
  - A new header:
    - Status: Proposed
    - Supersedes: CONTRACT-001
  - Apply the fixes above.
  - Replace the scattered revision notes with one short "Lineage" section. It
    says CONTRACT-005 supersedes CONTRACT-001, which was revised by TASK-004,
    012, 013, and 014, and lists what changed in CONTRACT-005.
  - Keep the resolved-questions history, trimmed if needed.
  - Keep IDs stable. New items get new IDs.
  - State that references to CONTRACT-001 in CONTRACT-002, 003, and 004 now
    resolve to CONTRACT-005.
- In `docs/contracts/CONTRACT-001-task-lifecycle.md`, change **only** the
  status lines: `Status: Superseded by CONTRACT-005`, plus the date. Change no
  other text.
- `docs/contracts/README.md` and `TEMPLATE/docs/contracts/README.md`: state the
  immutability rule and how supersession works.

### Excluded

- Any edit to the bodies of CONTRACT-001, 002, 003, or 004.
- Implementation (TASK-016).

### Paths

- `docs/contracts/CONTRACT-005-task-lifecycle.md`
- `docs/contracts/CONTRACT-001-task-lifecycle.md` (status lines only)
- `docs/contracts/README.md`
- `TEMPLATE/docs/contracts/README.md`

## Plan

## Acceptance criteria

- [ ] CONTRACT-005 is complete on its own. A reader never needs CONTRACT-001.
- [ ] Both fixes and the recorded readings are in the body, with IDs.
- [ ] CONTRACT-001's body is byte-identical apart from its status lines.

## Validation requirements

Board review. Diff CONTRACT-005 against CONTRACT-001.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

contract-architect, 2026-09-25. CONTRACT-005 is `Proposed` and not approved.

Changed:

- `docs/contracts/CONTRACT-005-task-lifecycle.md`: new header (Proposed,
  Supersedes CONTRACT-001). The four revision-history sections are replaced by
  one "Lineage" section, which also covers the citation convention and says
  CONTRACT-002/003/004 references now resolve here. Inline notes about earlier
  revisions are removed from T9, M1, I18, the `merge_conflict` row, and
  Concurrency. All IDs are kept.
  - Fix 1: I9 is corrected. A parent that entered review by handoff after T14
    has every subtask `cancelled`.
  - Fix 2: new **T17 Edit proposed task** (human, or the authoring run; audit
    `edited`) and new **I23** (approved content is fixed). Also updated: global
    precondition 3, Author definition, Scope envelope, table, Interfaces, UX,
    Failure behavior, and validation item 16.
  - Readings: **R1** agent cancel/break-claim categories; **R2** human T7
    `not_permitted`; **R3** one `returned` record; **R4** leaf return with
    subtasks `invalid_transition`; **R5** user no-op `invalid_transition`;
    **R6** out-of-range position `validation`; **R7** suspended-lease renewal
    resets to full term; **R8** paths validated at T1, T11, T17, and T2.
    Validation item 17 covers them.
  - Q26: folded in as new system action **M4** (warning plus override, no
    state change). M3 notes that blockers and pauses stay recorded. Q26 moved
    to Resolved. Validation item 18.
  - The audit intro "exactly one record per affected task" now lists the
    exceptions T11 already required.
  - New open question **Q27**: approving a task that was edited after the
    approver viewed it.
- `docs/contracts/CONTRACT-001-task-lifecycle.md`: only the status line
  changed.
- `docs/contracts/README.md`, `TEMPLATE/docs/contracts/README.md`: the
  immutability and supersession rule.

Flags for the board: see the final report (Q27; R5 belongs with CONTRACT-002;
authorship is now per-run for T15 withdrawal; T17's audit keeps previous
values; CONTRACT-001 is marked superseded before CONTRACT-005 is approved;
I22 does not cover M4 followed by M3).

## Review

Not reviewed.
