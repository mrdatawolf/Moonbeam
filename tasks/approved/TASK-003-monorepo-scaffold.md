# TASK-003: Scaffold the Moonbeam monorepo

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts:
Related ADRs: ADR-002
Dependencies: ADR-002 accepted

## Desired outcome

An empty but running pnpm workspace:

- `server/`: Express with a health endpoint
- `ui/`: Vite and React rendering a placeholder dashboard
- `packages/db/`: Drizzle wired to Postgres, with embedded Postgres for
  development
- `packages/shared/`: zod

## Scope

### Included

- Node 24, pnpm workspace, TypeScript configs, and Vitest.
- Root `dev`, `build`, `typecheck`, and `test` scripts.
- `docs/DEVELOPMENT.md` updated with commands and layout.

### Excluded

- Domain tables and features.

## Plan

## Acceptance criteria

- [ ] A fresh clone runs `pnpm install && pnpm dev`, and the UI loads and
      reaches the server health endpoint.
- [ ] `pnpm typecheck` and `pnpm test` pass.

## Validation requirements

Run from a clean clone on a dev box.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
