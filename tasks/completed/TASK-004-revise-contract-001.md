# TASK-004: Revise CONTRACT-001 with board answers and ADR-005

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
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

Task: TASK-004
Implementer: contract-architect
Date: 2026-09-24

### Changes made

- `docs/contracts/CONTRACT-001-task-lifecycle.md`:
  - The status stays `Approved`. Added a `Revised:` header line, `TASK-004` in
    Related tasks, and `ADR-005` in Related ADRs.
  - Added a "Revision history" section (2026-09-24) that lists every changed
    transition and the other changes.
  - Revised the body to match A1–A13 and ADR-005 (mapping below).
  - T13 is marked as removed. Its ID is retired, and no other IDs were
    renumbered.
  - Added action D1 (reorder path dependency), a "Path dependencies" section,
    and invariants I17 and I18. I1–I16 keep their numbers.
  - The answered Q1–Q13 moved to "Resolved questions". The board's answers are
    kept as written, including the corrected A4 and the clarified A5. Each one
    has an *Applied:* line naming the sections it changed.
  - New open questions Q14–Q21 are in "Open questions".
- `docs/PROJECT.md`: in the "Subtask acceptance" resolved question, replaced
  "optionally reopening specific subtasks" with the new-subtask rule.
- `TEMPLATE/docs/workflow/splits.md`: rule 7 now says subtasks are never
  reopened and fixes are done in new subtasks.
- `TEMPLATE/docs/workflow/lifecycle.md`: the return arrow in the diagram and
  the Authority bullet now say a return goes to `approved`, or to
  `in_progress` for a split parent given new subtasks. Before, both said
  "returns it to `in_progress`". The bullet also says subtasks are never
  reopened. See Deviations.

### Mapping of answers to changed sections

| Source | Sections changed |
|---|---|
| A1 human claims never expire; agent lease unchanged | T3 (only agent claims get a deadline), T5 (expiry trigger is agent-only; human claims end only by T4/T6/T10/T11/T15), Claim expiry, C1, C2, Interfaces (renew claim), UX, validation item 4 |
| A2 subtask done at review; never reopened | States (terminal note), T8, T13 removed, I2, I12 (no exception), I13, Failure (`invalid_transition` for reopen), Interfaces, UX, validation items 1, 6, and 7 |
| A3 returned parent gets new subtasks | T10 (split-parent branches), Interfaces (return with new subtasks), UX (return offers new subtasks, not reopening) |
| A4 returned leaf → `approved`, unclaimed, with notes | T10 (leaf), validation item 7 |
| A5 top-level leaf needs agent review; human may waive with reason | T9 (the "proposed" marker is gone), UX |
| A6 top-level splits only (confirmed) | Definitions, T11 |
| A7 agents may cancel subtasks they created | Transition table T15, T15, T12 trigger, global precondition 3, failure categories, validation item 8 |
| A8 envelope fixed; cancel and re-propose (confirmed) | Scope envelope (now includes paths), Path dependencies (never recomputed) |
| A9 unblocking parent unblocks subtasks | C1 (effective blocking ends in the same action; deferred T8/T12 fire), validation item 9 |
| A10 agents add subtasks without humans | T11 actors and preconditions, transition table, global precondition 3, validation item 5 |
| A11 different model recommended, not required; same-model flagged | Actors (implementing run), T6 (records model), T7, T12, Audit record, Interfaces (task view), UX, validation item 10 |
| A12 no renewal audit; no audit of non-authority rejections | Claim expiry, Audit record, Failure behavior, Interfaces, validation item 13 |
| A13 identity dependency agreed | Scope (Excluded) |
| ADR-005 accept includes merge (CONTRACT-004 boundary) | Scope (Excluded: run branches/merge/write-back → CONTRACT-004), T9, T10 (return merges nothing), T15, I18, validation item 12 |
| ADR-005 claim requires no unfinished earlier-approved overlapping task | T2 (records dependencies), T3, Path dependencies, D1, I2, I17, Failure (`blocked` covers dependencies), concurrency, Interfaces, UX, validation items 2 and 11 |
| ADR-005 scope envelope includes paths | Definitions, Scope envelope (path narrowing, server-checked), I11, out-of-path changes flagged on the review surface only |

### Validation performed

- Searched all three paths for "reopen". Every remaining mention either states
  that reopening never happens or is part of the board's original questions and
  answers kept under "Resolved questions".
- Checked that T13's ID is retired rather than reused, that no other transition
  or invariant was renumbered, and that the transition table, interfaces,
  failure categories, invariants, UX, and validation lists agree with each
  other.
- The board's review of the contract diff is the validation this task requires.

### Acceptance criteria evidence

- Every answer and every ADR-005 point is reflected: see the mapping table
  above, and the *Applied:* line under each resolved question.
- No text in the three paths still describes reopening subtasks: confirmed by
  the search above.
- New questions are flagged, not decided: Q14–Q21 are in the contract's "Open
  questions", and every interim reading in the body is marked "interim".

### Assumptions and deviations

- **TEMPLATE lifecycle.md return target.** The Included scope names only the
  reopening wording. `TEMPLATE/docs/workflow/lifecycle.md` also said a return
  goes to `in_progress`, which contradicts A4. It is in this task's paths, so I
  corrected it. The board may revert that change if it wants it handled
  separately.
- **"Unfinished" means non-terminal.** A path dependency is finished when the
  earlier task is `completed` (merged) or `cancelled` (nothing will merge).
  ADR-005 names only completion. Treating cancellation the same way avoids
  blocking the later task forever.
- **A subtask never depends on its own parent.** Otherwise every subtask would
  wait on its unfinished parent. This is logically forced, and the contract
  states it.
- **Unfinished path dependency uses the `blocked` failure category.** No new
  category was added. The dependency is not the `blocked` condition, and it
  gates only T3.
- **Q3 default kept.** A parent returned without new subtasks goes to
  `approved` and may be claimed directly. A3 does not clearly remove this, so
  it is flagged as Q16 rather than changed.
- **Interim readings.** The overlap definition (Q21), A7 authorship meaning the
  same run (Q18), A10 run eligibility (Q19), and A9 ending only effective
  blocking (Q20) are interim readings for the board to confirm.
- **Out of scope, not changed:** the "Open questions" lists in
  `TEMPLATE/docs/workflow/splits.md` and `lifecycle.md` still list items the
  board has now answered (who may split, nesting, when a subtask is done,
  cancellation, claim timeouts). Removing them was not in the Included scope. I
  recommend a follow-up task to sync the TEMPLATE workflow docs with the
  revised CONTRACT-001.

### Unresolved risks and new questions for the board

These are in CONTRACT-001 under "Open questions". None of them is decided.

- **Q14:** How path dependencies apply within a split: whether subtasks inherit
  their parent's dependencies, and whether overlapping sibling subtasks depend
  on each other, given that subtasks complete without merging. Needs alignment
  with CONTRACT-004.
- **Q15:** Constraints on reordering a path dependency: reordering when a task
  is already claimed or further along, and cycles among three or more tasks.
- **Q16:** Whether a split parent returned without new subtasks may be worked
  directly, and if so, whether that parent-level handoff needs an agent review.
- **Q17:** The lifecycle outcome when the merge at acceptance fails: reject the
  accept, or complete with the merge pending. Must be answered together with
  CONTRACT-004.
- **Q18:** Whether "subtasks it created" (A7) covers only the creating run or
  any run of the same agent, and whether an agent may cancel a subtask another
  run has claimed.
- **Q19:** Which agent runs may add subtasks (A10), including whether a
  subtask's reviewer run may add a fix subtask.
- **Q20:** Whether unblocking a parent (A9) also resolves blockers recorded on
  its subtasks.
- **Q21:** Whether paths are required at approval, how a task with no declared
  paths is treated for overlap, the overlap definition, and path syntax.

TASK-006 (lifecycle data and API) depends on this contract. Q14, Q15, Q17, and
Q21 affect it directly.

### Documentation updated

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/PROJECT.md`
- `TEMPLATE/docs/workflow/splits.md`
- `TEMPLATE/docs/workflow/lifecycle.md`

## Review

Not reviewed.

## Human acceptance

Pending.
