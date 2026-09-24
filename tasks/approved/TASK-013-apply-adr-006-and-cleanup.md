# TASK-013: Apply ADR-006, record Q18/Q22/Q23, and clean up follow-ups

Owner role: Contract designer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001, CONTRACT-003, CONTRACT-004
Related ADRs: ADR-001, ADR-005, ADR-006
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

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
