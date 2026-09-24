# ADR-002: Technology stack follows Paperclip

Status: Approved
Date: 2026-09-24
Decision owners: Board
Related tasks and contracts: none yet

## Context

Moonbeam's top layer (dashboard, run view, decision queue) is modeled on
Paperclip (`paperclipai/paperclip`, MIT license). Matching its stack lets us
borrow UI patterns and components with minimal translation. PGlite, used in
other internal projects, has had problems and is no longer a desired option.

## Decision

Build Moonbeam as a fresh codebase, not a fork, on Paperclip's stack:

- **Runtime and workspace:** Node.js 24, pnpm workspaces, TypeScript throughout.
- **Server:** Express, with shared zod validators between the server and the UI.
- **Database:** PostgreSQL through Drizzle ORM and its migrations. Development
  may use the `embedded-postgres` package, which runs a real Postgres process.
  Shared deployments set `DATABASE_URL`.
- **UI:** React with Vite, Tailwind CSS v4 (tokens in a single CSS source),
  shadcn/Radix primitives, TanStack Query, and React Router.
- **Tests:** Vitest.

Code copied or adapted from Paperclip keeps its MIT attribution in a
`THIRD_PARTY_NOTICES` file.

## Alternatives considered

- **Fork Paperclip.** Its autonomy model (heartbeats, CEO delegation, agent
  hiring, open agent-edited skills) runs through the data model and services.
  Removing it and keeping up with a fast-moving upstream would cost more than
  building fresh.
- **Node with PGlite (as in project-brain).** Rejected because of PGlite's
  known issues.

## Consequences

### Benefits

- Direct reuse of proven UI patterns and components.
- One language across the server, UI, and shared validation.

### Costs and risks

- Paperclip's components assume its data model and will need adapting, not
  just copying.
- Node 24 is required on the host and dev boxes.

## Follow-up work

- Scaffold the monorepo: `server/`, `ui/`, `packages/db`, `packages/shared`.
- Record commands and conventions in `docs/DEVELOPMENT.md`.
