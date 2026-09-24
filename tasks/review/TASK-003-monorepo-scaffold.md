# TASK-003: Scaffold the Moonbeam monorepo

Owner role: Implementer
Assigned agent: implementer (Claude)
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

Task: TASK-003
Implementer: implementer (Claude)
Date: 2026-09-24

### Changes made

- Root: `package.json` (`packageManager: pnpm@11.24.0`, `engines.node >=24`,
  scripts `dev`, `dev:server`, `dev:ui`, `build`, `typecheck`, `test`,
  `db:generate`, `db:migrate`), `pnpm-workspace.yaml` (packages plus
  `allowBuilds` for `esbuild` and the `@embedded-postgres/*` platform
  packages), `tsconfig.base.json`, `.nvmrc` (24), `pnpm-lock.yaml`, and
  `.gitignore` entries for `node_modules/`, `dist/`, `*.tsbuildinfo`,
  `coverage/`, logs and `.vite/`.
- `packages/shared` (`@moonbeam/shared`): zod `healthResponseSchema`
  (`status: ok|degraded`, `database: {ok, error?}`, `checkedAt`), used by both
  server and UI, with 4 Vitest tests.
- `packages/db` (`@moonbeam/db`): Drizzle ORM over the `postgres` driver.
  `startDatabase()` uses `DATABASE_URL` if set; otherwise it starts
  `embedded-postgres` (a real Postgres 18 process) with data in
  `$MOONBEAM_HOME/db` (default `~/.moonbeam/db`) on loopback port 54330. It
  initialises the cluster on first run, creates the `moonbeam` database,
  clears a stale `postmaster.pid`, and refuses to start if a live process owns
  the data directory. Also: `createDatabaseClient`, `pingDatabase`
  (`select 1`), `runMigrations`, a `migrate.ts` CLI, `drizzle.config.ts`, an
  empty `src/schema/index.ts` and an empty migration journal. No tables.
  Includes 6 Vitest tests for configuration resolution.
- `server` (`@moonbeam/server`): Express 5. `createApp()` serves
  `GET /api/health` (200 `ok` / 503 `degraded`, body validated with the shared
  schema before sending) and JSON 404s for other `/api` paths. `index.ts`
  starts the database, applies migrations, listens on `127.0.0.1:3100`, and on
  SIGINT/SIGTERM closes the pool and stops embedded Postgres. Includes 3 Vitest
  tests (ok, degraded, 404) against the real app on an ephemeral port.
- `ui` (`@moonbeam/ui`): Vite 8, React 19, Tailwind CSS v4 through
  `@tailwindcss/vite` with tokens only in `ui/src/index.css` (light plus a
  `prefers-color-scheme: dark` override), TanStack Query, and React Router.
  One placeholder "Dashboard" route polls `/api/health` through the Vite proxy
  (port 5180, `strictPort`), validates it with the shared schema, and shows
  server and database status.
- `docs/DEVELOPMENT.md`: stack, repository layout, commands, configuration
  variables, embedded Postgres behaviour, conventions, testing and security
  notes.

### Validation performed

All runs used Node v24.16.0 and pnpm 11.24.0.

- `pnpm install`: succeeded. The postinstalls for `@embedded-postgres/linux-x64`
  and `esbuild` ran.
- `pnpm typecheck`: passed in all 4 packages.
- `pnpm test`: passed. db has 6 tests, shared 4 and server 3, for 13 in total.
- `pnpm build`: passed. shared, db and server compiled to `dist/`, and the UI
  bundle built (index.js 370.78 kB, 114.49 kB gzipped; CSS 7.50 kB).
- `pnpm dev` (background, real `~/.moonbeam/db`): the UI started on 5180 and
  the server on 3100, reporting `database: embedded`.
  - `curl http://127.0.0.1:5180/` returned HTTP 200.
  - `curl http://127.0.0.1:5180/api/health` through the Vite proxy returned
    `{"status":"ok","database":{"ok":true},"checkedAt":"..."}` with HTTP 200.
  - A headless Chromium render of the Dashboard showed "Server healthy /
    Database Connected".
  - SIGINT to the process group stopped the server, UI and Postgres. No
    `postmaster.pid` remained and ports 3100, 5180 and 54330 were free.
- `pnpm db:migrate`: printed "Migrating database (embedded)" and "Migrations
  complete".
- `pnpm --filter @moonbeam/server start` (compiled `dist/`, default export
  condition): `/api/health` returned HTTP 200 `ok`, and the server stopped
  cleanly.
- Clean clone: I cloned the committed branch into a scratch directory and ran
  `pnpm install --frozen-lockfile`, typecheck, test and build (all passed).
  With a fresh `MOONBEAM_HOME`, `pnpm dev` initialised a new cluster, the UI
  returned HTTP 200 and the proxied health check returned HTTP 200 `ok`.
- Degraded path: I stopped embedded Postgres underneath a running server. The
  proxied health check then returned HTTP 503
  `{"status":"degraded","database":{"ok":false,"error":"connect ECONNREFUSED 127.0.0.1:54330"},...}`.
- Afterwards, no Moonbeam processes were left running.

### Acceptance criteria evidence

- Fresh clone `pnpm install && pnpm dev`: the UI loads and reaches the health
  endpoint through the proxy (see the clean-clone run above).
- `pnpm typecheck` and `pnpm test` pass, in both the worktree and the clean
  clone.

### Assumptions and deviations

- **Ports:** 5173 is already in use on this box (`[::1]:5173`), and 5432 is
  the system Postgres. The UI therefore uses 5180, the server 3100 and
  embedded Postgres 54330, not Paperclip's 54329. All three can be overridden
  with `MOONBEAM_UI_PORT`, `MOONBEAM_SERVER_PORT` and
  `MOONBEAM_EMBEDDED_PG_PORT`.
- **Source export condition:** workspace packages export TypeScript sources
  under a custom `source` condition, used by tsx, Vite, Vitest and `tsc`. The
  default condition points at `dist/`, so the compiled server runs with plain
  `node`. The server's build tsconfig clears the condition so it type-checks
  against the built packages.
- **Migrations at startup:** the server applies pending migrations at startup,
  so `pnpm dev` works without a separate step. There are no migrations yet.
- **Version choices:** Vite is `^8.3.0`, which resolved to 8.3.0. 8.3.1 was
  published today and pnpm's `minimumReleaseAge` policy rejects it. I did not
  keep the policy exclusion that pnpm auto-added. embedded-postgres is pinned
  to `18.4.0-beta.17`, its only published line, which is also a beta for
  Paperclip. TypeScript is 7.0.2 (the native port, as in Paperclip).
- **Omitted for now:** shadcn/Radix primitives (not needed yet), and a `test`
  script in `ui` (no UI tests yet; `pnpm -r test` skips it).
- **No Paperclip code copied:** I only read Paperclip for configuration
  patterns (compiler options, drizzle config shape, `initdbFlags`). No
  `THIRD_PARTY_NOTICES` file was needed.

### Unresolved risks

- embedded-postgres is a beta release, and its native binaries depend on pnpm
  `allowBuilds`. New platforms must be listed in `pnpm-workspace.yaml`. Only
  linux-x64 was exercised.
- Only one process can own a data directory. A second concurrent server (for
  example from another worktree) fails with a clear error unless it sets
  `MOONBEAM_HOME` or `DATABASE_URL`.
- The unauthenticated health endpoint returns the raw database error message.
  That is fine on loopback in development, but it should be revisited before
  any shared deployment.
- On shutdown the pool close can take up to its 5 s timeout if Postgres has
  already died.

### Documentation updated

- `docs/DEVELOPMENT.md`

## Review

Not reviewed.

## Human acceptance

Pending.
