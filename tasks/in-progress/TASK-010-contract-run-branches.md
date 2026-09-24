# TASK-010: CONTRACT-004: run branches and merge on acceptance

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-004 (to be produced)
Related ADRs: ADR-001, ADR-005
Dependencies: None

## Desired outcome

An approved contract for:

- run branch naming and creation
- where checkouts live on runner machines
- updating a stale branch from main
- conflict handling
- the merge on acceptance, with its commit and author policy
- task-record write-back (ADR-001)
- branch cleanup

## Context

These are ADR-005's follow-ups. They are needed before phase 3 runs.

## Scope

### Included

- Behavior for local LAN repositories. External remotes are optional.

### Excluded

- The runner process design itself.

### Paths

- `docs/contracts/CONTRACT-004-run-branches.md`

## Plan

## Acceptance criteria

- [ ] A rejected or cancelled task never changes the main branch.
- [ ] A merge conflict at acceptance has defined behavior.

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
