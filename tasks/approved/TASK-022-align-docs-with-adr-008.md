# TASK-022: Align the documentation and status lines with ADR-008

Owner role: Librarian
Assigned agent: librarian
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-002, CONTRACT-003, CONTRACT-004, CONTRACT-005,
CONTRACT-006
Related ADRs: ADR-001, ADR-003, ADR-004, ADR-005, ADR-006, ADR-008, ADR-009
Dependencies: TASK-021 (CONTRACT-006 approved)

## Desired outcome

Every document in this repository describes Moonbeam as ADR-008 defines it: a
read-only, top-down observer of DbC projects on GitHub. No document still
presents the old direction as current, and every superseded or shelved
decision says so at its top.

## Context

ADR-008, ADR-009, and CONTRACT-006 are approved. `README.md`,
`docs/PROJECT.md`, and `docs/ARCHITECTURE.md` were rewritten earlier on
2026-09-28 for the old direction, which had enforced gates, Moonbeam-held task
state, runs, and a review surface. ADR-008's follow-up work lists the status
changes. ADR-008 decision 8 (alternative A) retires Moonbeam's `TEMPLATE/`.

## Scope

### Included

- **`README.md`.** Rewrite the goals for ADR-008. Goals only, no progress. The
  goals:
  - DbC stays authoritative in each project
  - a lead developer per project
  - GitHub as the shared reference
  - a read-only Moonbeam
  - detection, not enforcement
  - a top-down view per project and across projects

  Keep the "Origin of Design by Contract" section.
- **`docs/PROJECT.md`.** Rewrite purpose, users, desired outcomes, scope,
  constraints, domain language, and delivery phases for ADR-008.
  - Remove pauses, runs, costs, and track records from V1 scope. List them as
    deferred.
  - Keep the resolved questions that still hold. Mark the ones that no longer
    apply as superseded by ADR-008.
- **`docs/ARCHITECTURE.md`.** Describe the code as it is today, marking the
  parts ADR-008 shelves. Add the target architecture from ADR-008 and
  CONTRACT-006 as a clearly labeled "Direction (not yet built)" section.
- **Status lines and amendment notes.** Leave the decision text of each ADR
  unchanged. Add a dated amendment at the end of each that points to ADR-008,
  as earlier amendments did:
  - ADR-001, ADR-005, and ADR-006: superseded by ADR-008
  - ADR-003 and ADR-004: superseded in part
- **Contracts.** Change only the status line of each:
  - CONTRACT-002: "Approved; superseded in part by ADR-008 (user registry and
    user select kept)"
  - CONTRACT-003, 004, and 005: "Shelved by ADR-008 (2026-09-28)"
- **Retire `TEMPLATE/`** (ADR-008 decision 8, alternative A):
  - delete the folder
  - update the root `CLAUDE.md` section "This repository versus `TEMPLATE/`"
    and the `README.md` reference, so neither mentions it as a deliverable
  - `docs/contracts/README.md` and `docs/decisions/README.md` only if they
    refer to it

### Excluded

- Any code change, including `docs/DEVELOPMENT.md` (it describes the code,
  which has not changed yet).
- The decision text of any ADR or the body of any contract.
- The upstream Project Template DbC (synced later, by the board's choice).
- This repository's own task template and workflow. It stays classic DbC until
  the board decides to adopt DbC task v1 here.

### Paths

- `README.md`
- `CLAUDE.md`
- `docs/PROJECT.md`
- `docs/ARCHITECTURE.md`
- `docs/decisions/ADR-001-database-owns-lifecycle-repos-own-knowledge.md`
- `docs/decisions/ADR-003-honor-system-identity-v1.md`
- `docs/decisions/ADR-004-moonbeam-dbc-variant-and-template.md`
- `docs/decisions/ADR-005-review-surface-and-merge-on-acceptance.md`
- `docs/decisions/ADR-006-projects-root-and-single-host-v1.md`
- `docs/decisions/README.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md`
- `docs/contracts/CONTRACT-005-task-lifecycle.md`
- `docs/contracts/README.md`
- `TEMPLATE/`

## Acceptance criteria

- [ ] No document presents enforced gates, Moonbeam-held task state, runs,
      pauses, or a review surface as current or planned V1 behavior.
- [ ] README goals match ADR-008 and contain no progress information.
- [ ] Every superseded or shelved ADR and contract says so at its top, with the
      date and a pointer to ADR-008. Decision text and contract bodies are
      unchanged.
- [ ] `TEMPLATE/` is gone, and nothing still refers to it as a deliverable.
- [ ] ARCHITECTURE separates what is built from the ADR-008 direction.

## Validation requirements

The dispatcher reads the changes against ADR-008, ADR-009, and CONTRACT-006.
`grep` for "TEMPLATE/", "enforce", "review surface", "pause", and "run view"
across `README.md`, `CLAUDE.md`, and `docs/`. Each remaining hit must be
historical or say it is superseded.

## Risks and assumptions

- Assumes deleting `TEMPLATE/` is what "retire" means. Git history keeps it.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
