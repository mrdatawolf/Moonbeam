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
  src/schema/         Drizzle table definitions (users and audit records)
  migrations/         generated SQL migrations and drizzle-kit metadata
  drizzle.config.ts   drizzle-kit configuration
server/               @moonbeam/server: Express API (`/api/*`)
  src/identity/       selected-human actor resolution (CONTRACT-002)
  src/test/           database-backed API tests and their harness
ui/                   @moonbeam/ui: Vite + React single-page app
docs/, tasks/         development-system documentation and task board
```

Workspace packages export their TypeScript sources under a custom `source`
export condition. Development tools (tsx, Vite, Vitest, `tsc --noEmit`) use that
condition, so no package needs building before `pnpm dev` or `pnpm test`.
Production builds resolve the default condition, which points at each package's
compiled `dist/`.

## Setup and commands

Prerequisites: git 2.31 or later (for environment-scoped authentication), Node.js 24 and pnpm 11 (`corepack enable` picks up the pinned
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
| `MOONBEAM_GITHUB_TOKENS_FILE` | `$MOONBEAM_HOME/github-tokens.json` | Override the host-side GitHub token file. |
| `MOONBEAM_EMBEDDED_PG_PORT` | `54330` | Port for embedded Postgres (loopback only). |
| `MOONBEAM_SERVER_HOST` | `127.0.0.1` | Express bind address. |
| `MOONBEAM_SERVER_PORT` | `3100` | Express port; also the UI dev proxy target. |
| `MOONBEAM_UI_PORT` | `5180` | Vite dev server port (fails rather than picking another port). |

### GitHub source configuration

Create `$MOONBEAM_HOME/github-tokens.json` (default `~/.moonbeam/github-tokens.json`)
on the server host, or set `MOONBEAM_GITHUB_TOKENS_FILE` to another file:

```json
{
  "tokens": {
    "your-github-owner": "your-read-only-token"
  }
}
```

Grant repository **contents: read** and **metadata: read**, and nothing else.
Restrict the file to its owner (`chmod 600`). Group/other readability produces a
warning naming only the file path. Labels match case-insensitively and
conventionally name the GitHub owner; registrations will default to that label.
Duplicate labels differing only by case make the configuration unreadable.
The loader checks modification time on every lookup/list request and picks up
edits or replacement without restarting. Missing files or labels mean "token not
configured" with no flag; invalid or unreadable files mean "token configuration
unreadable". Token-list consumers receive labels and `••••` plus the last four
characters only. Raw lookup results are private to server authentication.

Bare mirrors are rebuildable caches at
`$MOONBEAM_HOME/mirrors/<project-id>.git`. They fetch only the tracked branch into
`refs/moonbeam/tracked`, without tags. `refs/moonbeam/last-processed` pins the last
processed head so old objects survive a history rewrite. The source layer never
pushes or edits a remote. Authentication uses process-scoped git configuration,
never the URL, command arguments, or mirror config. Classic-token write scopes
(`repo`, `public_repo`, `write:*`) are reported when GitHub supplies them;
fine-grained tokens generally have no scope header and return `null`.

The primitives in `server/src/github/` are not yet connected to registration or
polling. `TokenFile.labels()` returns masked entries; `lookup(label)` privately
returns a token, or `missing`/`unreadable`. `RestGitHubApi` implements `GitHubApi`
with injectable fetch/base URL/timeout. Use `getRepository(owner, repo, token,
etag?)` for registration and `getRepositoryById(id, registeredFullName, token,
etag?)` for subsequent identity resolution. A mismatched numeric ID is refused
as `not_found`; a changed canonical name sets `redirected`. Branch, commit, and
login requests take the resolved owner/name. API results use `kind`, successful
facts are in `data`, and rate limits carry an ISO `resetAt` (or `null` if absent).

`Mirror(directory, { git?, remoteUrl? })` provides `ensure`, `fetch(url, branch,
token)`, `readChain`, `readFile`, `isAncestor`, and `pin`. Build fetch URLs with
`mirror.remoteUrl(owner, repo)` (GitHub HTTPS by default, injectable `file://`
fixture URLs in tests). The caller serializes operations per mirror. Files are
raw buffers, limited to 1 MiB; chains include complete first-parent change sets.
Mirror read errors throw generic errors rather than returning partial history;
fetch distinguishes `branch_missing` from `unreachable`, with detailed source
status classification supplied by REST. Polling, status persistence, and flags
belong to the orchestration layer.

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

## Testing

Vitest runs per package (`pnpm test`). Unit tests sit beside the code. The
server's API tests use an isolated embedded Postgres in a temporary directory
on a free loopback port; they ignore `DATABASE_URL` and never use the developer's
normal database. Each test gets a database cloned from the migrated template,
a real Express app on an ephemeral port, and a controllable clock.

- `pnpm --filter @moonbeam/server exec vitest run` runs the database/API suite.
- `pnpm --filter @moonbeam/server exec vitest run src/test/identity.test.ts`
  checks setup, user changes, request identity, and audit attribution.
- `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts`
  selects socket-free identity and GitHub source unit tests. GitHub tests use
  fake HTTP and temporary bare repositories over `file://`, never real GitHub or
  the operator's token file. `src/test/git-fixture.ts` builds deterministic root,
  merge, squash, fast-forward, and rewritten histories with isolated git config.
- `pnpm --filter @moonbeam/ui test` checks setup, routing, placeholders, user
  management, browser selection, request recovery, and accessibility with axe.
  jsdom cannot check colour contrast, so those checks require a browser.

Database/API tests require loopback sockets and permission to start embedded
Postgres. Record setup errors and actual test counts if the environment cannot
run them; the workspace runner's exit status alone is insufficient evidence.

## API

Shared request and response schemas live in `packages/shared/src/identity.ts`,
`errors.ts`, and `health.ts`.

### Identity and user registry

`resolveActor` is the only request-identity seam. `X-Moonbeam-User: <user id>`
selects an active human, with identity mode `selected`. Unknown, malformed,
or inactive user IDs are `unidentified`. `Authorization` is ignored, including
when a selected-user header is also present. Without a selected user, requests
are anonymous viewers: reads succeed and user mutations are `unidentified`.
Headers and body fields cannot request a system actor.

First-run setup is the exception to requiring a selection: while no users exist,
it creates the initial users and records the actor as `setup`. Once any users
exist, setup is refused. Any selected active user can add, edit, deactivate,
or reactivate users. Display names are unique among active users ignoring case;
the last active user cannot be deactivated. Users are never deleted.

Registry changes run under a transaction-scoped advisory lock and write one
audit record per changed user in the same transaction, with the actor, time,
and before/after values. The database contains only `users` and `audit_records`
(plus Drizzle bookkeeping). Historical audit fields and the `actor_kind` enum
are retained unchanged, and the append-only trigger rejects updates and deletes.

### Endpoints

| Method and path | Behavior |
| --- | --- |
| `GET /api/health` | database health; 200 or 503 |
| `GET /api/whoami` | resolved human actor, or `null` |
| `GET /api/setup` | whether first-run setup is needed |
| `POST /api/setup` | create initial users, only while the registry is empty |
| `GET /api/users[?includeInactive=true]` | users sorted by display name; active only by default |
| `POST /api/users` | add a user |
| `PATCH /api/users/:id` | edit name and/or e-mail |
| `POST /api/users/:id/deactivate` | deactivate a user |
| `POST /api/users/:id/reactivate` | reactivate a user |
| `GET /api/github/tokens` | configured token labels with masked tokens, and the file state (`ok`, `missing`, `unreadable`); never the tokens |
| `GET /api/projects` | registered projects (removed ones are hidden) |
| `GET /api/projects/:id` | one project; `not_found` once removed |
| `POST /api/projects` | register a GitHub repository (CONTRACT-006 S1); records its numeric ID, and defaults the baseline to the branch head, the token label to the owner, the branch to `main`, and the threshold to 14 days; 201 |
| `PATCH /api/projects/:id` | change name, owner or repo (must resolve to the recorded ID, F4), tracked branch, token label, baseline, exempt paths, or threshold |
| `DELETE /api/projects/:id` | remove a project (soft: its snapshot, flags, and audit are kept, and the repository can be registered again); 204 |
| `PUT /api/projects/:id/lead-developer` | set or clear the lead developer (`{ "userId": uuid \| null }`; active users only) |
| `GET /api/identities` | every member's e-mails, logins, and aliases, including the automatic registry e-mail, and identity conflicts (I4) |
| `POST /api/users/:id/identities` | add an e-mail, login, or alias (`{ "kind", "value" }`); 201 |
| `DELETE /api/identities/:id` | remove a stored identity; 204 |

Reads need no selected user. Every change needs a selected active user and
writes an audit record. Project IDs from GitHub are returned as decimal
strings. All other API paths return 404. There is no audit read endpoint at
present.

### Failures

Rejected actions change nothing and return
`{ "error": { "category", "message", "details"? } }`.

| Category | HTTP | Meaning |
| --- | --- | --- |
| `unidentified` | 401 | no selected user, or an unknown/inactive selection |
| `not_found` | 404 | the user does not exist |
| `invalid_transition` | 409 | setup already finished, or user already has the requested active status |
| `conflict` | 409 | conflicting change |
| `validation` | 422 | invalid input, duplicate active name, last-active-user restriction, duplicate active repository, unknown token label, or a repository, branch, or baseline GitHub can't find |
| `github_unavailable` | 503 | GitHub unreachable or rate-limited while registering or changing a project |

## UI shell

```text
ui/src/api/         client.ts, queries.ts, connection.ts
ui/src/lib/         currentUser.tsx, selection.ts, format.ts
ui/src/components/  Layout, Dialog, common
ui/src/pages/       Dashboard, Projects, Setup, Users, NotFound
```

The app starts at the Dashboard placeholder. Projects is also a placeholder:
"Projects are registered from GitHub; this view is being rebuilt". Navigation
contains Dashboard, Projects, and Users. Unknown routes show NotFound.

While setup is needed, the app shows only the initial-users form. The selected
user is stored in `localStorage` (`moonbeam.selectedUserId`) and sent with API
requests. Anyone may view without a selection. User changes require choosing
an active user. The header offers a user select and an "Add a user" link.

The Users page separates active and inactive users, shows e-mail addresses,
and supports adding, editing, deactivating, and reactivating. Forms preserve
entered values after a refusal. An `unidentified` read clears the stale
selection and retries as a viewer; writes never retry. A newer browser
selection is not cleared by an older request's response. The connection banner
shows failures and user actions are disabled while the connection is lost.
