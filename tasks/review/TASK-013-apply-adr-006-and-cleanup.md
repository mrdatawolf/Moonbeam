# TASK-013: Apply ADR-006, record Q18/Q22/Q23, and clean up follow-ups

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001, CONTRACT-003, CONTRACT-004
Related ADRs: ADR-001, ADR-005 (incl. 2026-09-24 amendment), ADR-006
Dependencies: ADR-006 approved

## Desired outcome

The contracts, the project docs, and TEMPLATE agree with ADR-006. Board answers
Q18, Q22, and Q23 are recorded. TASK-012's leftover follow-ups are closed.

## Context

The board decided on 2026-09-24 that:

- Projects live in a user-defined projects root outside Moonbeam, and Moonbeam
  never holds repositories.
- Moonbeam never pushes without a human's explicit request.
- V1 runs on a single host.

The board also accepted the recommendations for:

- CONTRACT-001 Q22: humans may reorder sibling subtasks with the queue move.
- CONTRACT-001 Q23: a task with no paths changes no files, and any file it does
  change needs a reason at acceptance (the interim reading is confirmed).
- CONTRACT-004 Q18: never force-push. A rejected push is reported on the
  project. Under ADR-006, a push happens only on explicit request.

CONTRACT-004 Q17 is resolved by ADR-006.

## Scope expansion (board-directed, 2026-09-24)

When the board approved this task, it also amended ADR-005: acceptance no
longer merges. The merge into main is a separate human step after acceptance
(Moonbeam merges on request, or a human merges by hand), and pushing is a
further step. This task also applies that amendment:

- CONTRACT-001:
  - T9 accept no longer merges.
  - Add a human-only merge action for completed tasks, and integration status.
  - Path dependencies are satisfied when the earlier work is on main.
  - Revise the Board A4 "merge fails at acceptance" behavior into merge-time
    behavior.
  - I18 still holds.
- CONTRACT-002: the merge and push actions are human-only.
- CONTRACT-003:
  - The accept dialog no longer merges.
  - Add an integration panel on completed tasks (Merge, Push, status, refusal
    messages).
  - The decision queue's treatment of accepted but unmerged tasks is an open
    question.
- CONTRACT-004:
  - Merging happens on request, not at accept.
  - The record is written as part of the merge.
  - Detect hand merges.
  - Merge-time conflicts.
- `TEMPLATE/AGENTS.md` and `TEMPLATE/docs/workflow/`: remove "Merging is
  acceptance" wording.
- Flag, don't decide, the three open points listed in the ADR-005 amendment.

## Scope

### Included

- CONTRACT-004:
  - Replace the Moonbeam-held canonical repository and the automatic mirror
    push with ADR-006's model: projects root, registration, worktrees in
    Moonbeam's data directory, the working-folder safety check at accept, and
    the explicit push action.
  - Resolve Q17 and Q18.
- CONTRACT-001:
  - Resolve Q22 and Q23.
  - Add the working-folder check to T9's preconditions and failure categories
    if needed.
- CONTRACT-003:
  - Add the push action, the accept-refused message for an unsafe working
    folder, and a "main is ahead of origin" indicator.
  - Update any wording about the Moonbeam-held repository.
- CONTRACT-002: only if the push action needs to be on the human-only list.
  Proposed: yes.
- `docs/PROJECT.md`: add single-host V1 and the projects root to the
  constraints.
- `TEMPLATE/AGENTS.md`: change "Each run works on its own branch" to per-task
  branches (ADR-005 amendment), and reflect ADR-006.
- `TEMPLATE/docs/templates/task.md`: state that paths are plain file or
  directory paths with no globs, and that a task with no paths changes no
  files.
- ADR-001: add a dated amendment note saying that write-back failure handling
  is settled by CONTRACT-004 (the record is part of the acceptance merge).

### Excluded

- New behavior beyond ADR-006 and the answers above.

### Paths

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md`
- `docs/decisions/ADR-001-database-owns-lifecycle-repos-own-knowledge.md`
- `docs/PROJECT.md`
- `TEMPLATE/AGENTS.md`
- `TEMPLATE/docs/templates/task.md`
- `TEMPLATE/docs/workflow/`

## Plan

## Acceptance criteria

- [ ] No contract still describes a Moonbeam-held repository or automatic
      pushes.
- [ ] The accept preconditions and the refusal behavior for an unsafe working
      folder are consistent across CONTRACT-001, 003, and 004.
- [ ] Any new question is flagged, not decided.

## Validation requirements

Board review of the diffs.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Contract designer (contract-architect), 2026-09-24. Documentation only. No git
commands were run. Contract statuses were not changed: 001 stays Approved, and
002, 003, and 004 stay Accepted. Each contract has a dated TASK-013 revision
note.

### Files changed

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md` (rewritten throughout; retitled
  "Task branches, worktrees, and integration into main"; file name unchanged)
- `docs/decisions/ADR-001-database-owns-lifecycle-repos-own-knowledge.md`
  (dated amendment only)
- `docs/PROJECT.md`
- `TEMPLATE/AGENTS.md`
- `TEMPLATE/docs/templates/task.md`
- `TEMPLATE/docs/workflow/lifecycle.md`, `approval-gates.md`,
  `definition-of-done.md`, `splits.md`

### Decision → sections changed

| Decision | Sections changed |
|---|---|
| ADR-006 (1): projects root at setup, outside the install and data directories | 004 Definitions, Preconditions 1, B13, R15, validation 16; PROJECT Constraints, Domain language |
| ADR-006 (2): Moonbeam holds no repositories; registration under the root, nested layouts allowed, paths outside rejected | 004 Definitions (project repository, project folder), B13, R15, Failure (`validation`), validation 16–17; the Board C2 bare repository and mirror are removed (Q15 marked superseded); 001 `repository_unavailable` wording; PROJECT |
| ADR-006 (3): task branches worked in worktrees in the data directory | 004 B4 (rewritten), B5, B12, R14, validation 3; TEMPLATE/AGENTS.md |
| ADR-006 (4): merge requires a safe main checkout, otherwise refused with a message | 004 B15 (new), B7, category `working_folder_unsafe`, validation 8; 001 M1, repository categories; 003 RS-15, A-8 messages, Failure, state coverage; TEMPLATE lifecycle.md, approval-gates.md |
| ADR-006 (5) and Board Q18: push only on explicit request, never force, rejected push reported | 004 B16 (new), R10, R13, `push_rejected` / `remote_unavailable`, validation 14, Q18 resolved; 002 human-only list; 003 A-9, SV-3 Push family, RS-15; 001 Actors, I2, `authority_violation`; TEMPLATE AGENTS.md, lifecycle.md, approval-gates.md; PROJECT |
| ADR-006 (6): V1 single host | 004 Preconditions 5, B4, Scope (Excluded); PROJECT Included, Excluded, Constraints, Runner |
| CONTRACT-004 Q17 resolved by ADR-006 | 004 B13, B14, Resolved questions; TEMPLATE lifecycle.md Open questions |
| ADR-005 amendment 1: acceptance is a decision, not a merge | 001 T9 (rewritten), states table, transition table, I21, validation 12; 003 A-1, RS-4, RS-12, RS-14, SV-3 "Accepting"; 004 B7 intro, R1, R6 (d) removed, validation 6; 002 accept row; TEMPLATE lifecycle.md, approval-gates.md, definition-of-done.md, AGENTS.md; PROJECT |
| ADR-005 amendment 2: merge is a separate human action (or a hand merge, detected) | 001 new M1 and M2, Interfaces, Audit, I18, I22, validation 15; 004 B7, B14, R2, R8; 002 human-only list, system actor; 003 RS-15, A-8 |
| ADR-005 amendment 3: main holds only accepted work | 001 M1 preconditions, I18, I22; 004 B7 eligibility, R1 |
| ADR-005 amendment 4: integration status | 004 B17 (new); 001 Definitions, task view; 003 SV-3 Integration and Push families, SV-4, RS-15, Interfaces |
| ADR-005 amendment 5: dependencies satisfied when the work is on main | 001 Definitions (project queue, path dependency finished), T2, T9 postconditions, queue section, I17, validation 11; 004 B2, B12; 003 RS-4 "Waiting on this task"; TEMPLATE lifecycle.md |
| Board A4 "merge fails at acceptance → accept rejected" re-expressed at merge time | 001 revision note, T9 note, M1 "Refusal", Q17 supersession note, concurrency; 004 revision note, B7 "All or nothing", Failure; 003 A-1 step 6, A-8, Failure table |
| The record is written as part of the merge (ADR-001 follow-up) | 004 B9, R8, Q8 note; ADR-001 amendment; TEMPLATE AGENTS.md, lifecycle.md, definition-of-done.md |
| Board Q22: humans may reorder sibling subtasks with the queue move | 001 Definitions (sibling order), T11, D1, I19, validation 11, Q22 resolved; 004 B2, B3; TEMPLATE splits.md (item 7, and the open question removed), lifecycle.md |
| Board Q23: interim reading confirmed | 001 T2, Q23 resolved; TEMPLATE task.md Paths |
| Human-only list includes merge and push | 002 human-only table, revision note; 001 Actors, I2, `authority_violation`, UX; 003 UI-I2 |

### Interim readings the board should confirm

These are applied in the text and repeated as open questions below.

- A merge conflict at acceptance is a warning, not a refusal (CONTRACT-001
  Q25).
- The merge author is the person who requests the merge, not the acceptor
  (CONTRACT-004 Q22).
- The folder safety check (CONTRACT-004 Q21).
- Moonbeam does not fetch (CONTRACT-004 Q23).

### New questions for the board (flagged, not decided)

ADR-005 amendment open points:

1. **CONTRACT-004 Q19, a merge that conflicts after acceptance.** Proposed
   default: a board member merges by hand in the project folder, and Moonbeam
   detects it. D1 can already release waiting tasks. An optional "won't merge"
   status plus a follow-up task is offered as an alternative.
2. **CONTRACT-004 Q20, the record after a hand merge.** Proposed default: a
   human-only "Write task record" action that commits the record to main under
   the same safety check. Until decided, the text shows "Record not written".
   This question also covers hand squash or rebase merges, which are not
   detected, and a branch that reaches main before acceptance.
3. **CONTRACT-001 Q24, accepted but unmerged tasks in the decision queue.**
   Proposed default: yes, as an "Accepted, not merged" group, with refused
   merges first. Until decided, they are not shown there.

Other new questions:

4. **CONTRACT-001 Q25, a known conflict at acceptance.** Should it warn (the
   interim reading and the proposed default) or refuse?
5. **CONTRACT-004 Q21, what counts as a safe folder.** The interim reading
   (checks only whichever worktree has main checked out; untracked files count
   only where the merge would write) is the proposed default.
6. **CONTRACT-004 Q22, the merge author.** Requester (the interim reading and
   the proposed default) or acceptor (the literal Board C3)?
7. **CONTRACT-004 Q23, fetching.** Proposed default: a human-only "Check
   remote" fetch, with no periodic fetch.
8. **CONTRACT-004 Q24, registration details.** Covers relink criteria,
   changing the root after setup, and whether setting the root, registering,
   and relinking are human-only (also CONTRACT-002 Q9; proposed yes).

### Stale text outside this task's Paths (not edited)

- `ADR-005` first amendment, last paragraph: still says Board C2 "places each
  project's canonical repository as a bare repository", which ADR-006 has
  superseded.
- `TEMPLATE/docs/AI_DEVELOPMENT_SYSTEM.md`, "Task records": says the record is
  written "when a board member accepts a task". It should say "when the
  accepted task is merged".
- `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`, C2: historical, left as is.

### Validation

Board review of the diffs, as the task requires. Grep sweeps of the four
contracts, PROJECT.md, and TEMPLATE for "canonical repository", "mirror",
"Accept and merge", "merging is acceptance", "merge on acceptance", and
"creation order" found only history (revision notes and superseded or resolved
questions). A separate check confirmed that merge and push are on
CONTRACT-002's human-only list.

## Review

Not reviewed.

## Human acceptance

Pending.
