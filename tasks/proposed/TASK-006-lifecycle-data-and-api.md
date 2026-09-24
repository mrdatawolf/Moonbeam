# TASK-006: Lifecycle data model and API

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by:
Approved date:
Related contracts: CONTRACT-001, CONTRACT-002
Related ADRs: ADR-001, ADR-002, ADR-003, ADR-005
Dependencies: TASK-004, TASK-005

## Desired outcome

Projects, users, tasks, subtasks, claims, conditions, and the audit trail exist
in Postgres. The server exposes an API that enforces every CONTRACT-001
transition and the CONTRACT-002 actor rules.

## Context

Phase 2 foundation. The UI tasks build on this API.

## Scope

### Included

- Drizzle schema and migrations.
- Shared zod schemas for API inputs and outputs.
- Express routes for each transition.
- Atomic transitions and concurrent-claim handling as specified.
- A test for every transition, invariant, and failure category.

### Excluded

- Runs, runners, and pauses.
- Repository write-back and branch merging (stubbed at the T9 boundary).
- UI.

### Paths

- `packages/db/`
- `packages/shared/`
- `server/`
- `docs/DEVELOPMENT.md`

## Plan

## Acceptance criteria

- [ ] Each CONTRACT-001 transition has passing tests for allowed actors and for
      rejected actors.
- [ ] Agent actors cannot approve, accept, or return, and the attempt is
      audited.
- [ ] Concurrent claim tests show exactly one winner.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build` pass. Exercise the API manually
against the embedded database.

## Risks and assumptions

This is the largest task so far. It may split into subtasks within these paths.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
