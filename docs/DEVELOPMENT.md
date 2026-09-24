# Development Guide

## Technology stack

Selected in ADR-002 (modeled on Paperclip):

- **Runtime and workspace:** Node.js 24 (`.nvmrc`), pnpm 11 workspaces
  (`packageManager` in `package.json`), TypeScript throughout.
- **Server:** Express 5; request and response shapes validated with zod schemas
  shared with the UI.
- **Database:** PostgreSQL through Drizzle ORM and drizzle-kit migrations, using
  the `postgres` driver. Development runs a real Postgres process through the
  `embedded-postgres` package when `DATABASE_URL` is unset. PGlite is not used.
- **UI:** React 19 with Vite, Tailwind CSS v4 (design tokens in
  `ui/src/index.css`), TanStack Query and React Router. shadcn/Radix
  primitives are added when the first component needs them.
- **Tests:** Vitest.

## Repository layout

```text
package.json          root scripts; pnpm and Node versions
pnpm-workspace.yaml   workspace packages and allowed dependency build scripts
tsconfig.base.json    shared compiler options
packages/shared/      @moonbeam/shared: zod schemas and types used by server and UI
packages/db/          @moonbeam/db: Drizzle client, embedded Postgres, migrations
  src/schema/         Drizzle table definitions (none yet)
  migrations/         generated SQL migrations and drizzle-kit metadata
  drizzle.config.ts   drizzle-kit configuration
server/               @moonbeam/server: Express API (`/api/*`)
ui/                   @moonbeam/ui: Vite + React single-page app
docs/, tasks/         development-system documentation and task board
```

Workspace packages export their TypeScript sources under a custom `source`
export condition. Development tools (tsx, Vite, Vitest, `tsc --noEmit`) use that
condition, so no package needs building before `pnpm dev` or `pnpm test`.
Production builds resolve the default condition, which points at each package's
compiled `dist/`.

## Setup and commands

Prerequisites: Node.js 24 and pnpm 11 (`corepack enable` picks up the pinned
version). No separate Postgres install is needed for development.

```sh
pnpm install      # install all workspace dependencies
pnpm dev          # server (http://127.0.0.1:3100) and UI (http://127.0.0.1:5180) together
pnpm typecheck    # tsc --noEmit in every package
pnpm test         # Vitest in every package that has tests
pnpm build        # compile packages and server to dist/, build the UI bundle
pnpm db:migrate   # apply pending migrations (the server also does this at startup)
pnpm db:generate  # generate a migration from changes in packages/db/src/schema
```

`pnpm dev:server` and `pnpm dev:ui` run one side only. After `pnpm build`,
`pnpm --filter @moonbeam/server start` runs the compiled server.

Open the UI at http://127.0.0.1:5180. The Vite dev server proxies `/api` to the
Express server, so the browser only talks to one origin.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | unset | Postgres connection string. When unset, embedded Postgres is started. |
| `MOONBEAM_HOME` | `~/.moonbeam` | Local state directory; embedded Postgres data lives in `$MOONBEAM_HOME/db`. |
| `MOONBEAM_EMBEDDED_PG_PORT` | `54330` | Port for embedded Postgres (loopback only). |
| `MOONBEAM_SERVER_HOST` | `127.0.0.1` | Express bind address. |
| `MOONBEAM_SERVER_PORT` | `3100` | Express port; also the UI dev proxy target. |
| `MOONBEAM_UI_PORT` | `5180` | Vite dev server port (fails rather than picking another port). |

### Embedded Postgres

The server starts embedded Postgres itself and stops it on shutdown (Ctrl-C).
The first start initialises a cluster in `~/.moonbeam/db` and creates the
`moonbeam` database. Only one process can use a data directory at a time. If a
second server finds it in use, it exits with an error; set `MOONBEAM_HOME` or
`DATABASE_URL` to run another instance. A `postmaster.pid` left by a crashed
process is removed automatically.

pnpm 11 blocks dependency install scripts by default. `pnpm-workspace.yaml`
allows the ones needed here (`esbuild` and the `@embedded-postgres/*` platform
packages). Review any new entry pnpm asks for before allowing it.

## Coding conventions

- ES modules and strict TypeScript everywhere (`tsconfig.base.json`). Server-side
  packages use `NodeNext` resolution, so relative imports carry a `.js`
  extension; the UI uses bundler resolution.
- Data shapes that cross the server/UI boundary are defined once as zod schemas
  in `@moonbeam/shared`, validated on the server before sending and in the UI
  after receiving.
- UI colours, radii and fonts come from the tokens in `ui/src/index.css`; do not
  hard-code values in components.
- Database schema changes go through `packages/db/src/schema` and a generated
  migration committed with the change.

## Testing philosophy

Vitest runs per package (`pnpm test`). Tests sit next to the code as
`*.test.ts`. Unit-test pure logic and HTTP handlers (the server tests start the
Express app on an ephemeral port with a stubbed database check). Tests that need
a real database are not set up yet.

## Security and privacy

- Secrets go in environment variables or an untracked `.env`; never commit them.
- Embedded Postgres listens on loopback only with fixed development
  credentials, and is not for shared deployments. Shared deployments set
  `DATABASE_URL`.
- The server binds to `127.0.0.1` by default.
