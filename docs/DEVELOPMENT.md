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
| `MOONBEAM_POLL_INTERVAL_SECONDS` | `300` | Positive polling interval in seconds. Every active project is also polled on startup. |
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

The primitives in `server/src/github/` support registration and polling. `TokenFile.labels()` returns masked entries; `lookup(label)` privately
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

The app starts at the cross-project Dashboard. Projects lists GitHub registrations
and links to each project overview. Navigation contains Dashboard, Projects,
and Users. Unknown routes show NotFound.

Project read screens (CONTRACT-006):

- `/projects/:id`: source status, proposed/approved/recently completed and other
  tasks, twelve weeks of activity, and all flag statuses with inline evidence.
- `/projects/:id/tasks`: the full completed list.
- `/projects/:id/tasks/:taskId`: parsed current and historical fields, parse
  problems, complete event history, flags, and rendered current files.
- `/projects/:id/documents`: goals and contract/ADR metadata.
- `/projects/:id/documents/file?path=...`: a rendered document at the snapshot head.

Every screen shows head and last successful poll time, labels stale data, and
provides viewer-accessible refresh. Snapshot queries refresh every minute;
manual refresh invalidates all project reads and file text. File responses from
a different head are withheld with refresh guidance, so a poll race cannot mix
new file text with old metadata. References resolve to UI routes; missing IDs
remain unlinked. GitHub links open a separate tab with `noopener noreferrer`.

Markdown uses `react-markdown` and `remark-gfm`, skips raw HTML, permits only
HTTP(S)/mailto links, and replaces images with their alt text instead of loading
remote embeds. Relative links resolve against the GitHub file URL. Repository
content is read-only. Flag evidence is escaped text, with commit/file links;
dismiss/reopen dialogs record required notes only in Moonbeam and require a
selected active user. Refusals retain entered notes. UI tests mock every API
request and include malicious Markdown fixtures and axe checks.

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


### Project polling and refresh

`POST /api/projects/:id/refresh` needs no selected user and returns a validated
`SourceView` (`packages/shared/src/source.ts`). Concurrent refreshes in this
server join the same poll. The view includes status and its since-time, last
attempt/success times, last processed head, rate-limit reset, redirected name,
write-scope warning, failure count, and baseline-reset notice. A missing or
removed project returns `not_found`. Registration names are never changed by
polling. The last successful snapshot, head, and time survive all source errors.

`Poller.poll(id, manual?)` orchestrates the source read. `PollScheduler` provides
`start()`, `pollAll()`, `refresh(id)`, and `stop()`. It polls every active project
at startup and every `MOONBEAM_POLL_INTERVAL_SECONDS` (default 300). Invalid or
non-positive intervals are rejected. `stop()` clears the interval and waits for
active reads before the database is closed. Source failures are isolated per
project. Unreachable retries wait 5, 10, 20, then 30 minutes; manual refresh can
retry immediately. All refreshes, including manual refreshes, respect a stored
rate-limit reset. If GitHub supplies no reset, the fallback wait is five minutes.
Other source failures retry at the normal interval, reloading the token file.

The source row is created lazily on first poll. Repository metadata is resolved
by numeric ID with its persisted ETag (ADR-010). A numeric-ID lookup returning
not-found triggers a name-only metadata check to distinguish a replaced
repository (`identity_changed`); no branch or content of that replacement is
read. A successful metadata response must match the registered ID. A 304 uses
the previously verified name. Branch heads are read on each poll. If REST and
git observe different heads, the poll fails as unreachable and retries, keeping
the previous snapshot instead of combining two versions.

An in-process promise map serializes each project's polls. PostgreSQL
`pg_try_advisory_lock` covers other server instances on a connection held by a
transaction; a matching transaction lock retains exclusion through commit.
A refresh on another instance waits for that transaction to finish and returns
its committed source status. A project row share lock keeps registration edits/removal from
racing a poll. Each new head derives the whole version-3 snapshot, using cached
REST author logins and decoded mirror files. Unknown login entries are filled
before derivation; null means GitHub reported no associated login.

Snapshot replacement, source success, login-cache updates, and
`FlagSink.apply(transaction, input)` commit together. A sink failure rolls back
all those writes before recording failure status. `FlagInput` supplies the
project ID, evaluation time, `full` or `conditions` mode, snapshot, evaluation,
and optional FL-10 rewrite evidence. Server startup and the test harness inject
`flagSink` from `server/src/flags/sink.ts`; the poller retains its injectable
`nullFlagSink` for callers that explicitly need no persistence.
An unchanged head evaluates conditions with event rules skipped. A snapshot
version change triggers full derivation without FL-10. A deliberately changed
tracked branch uses TASK-033's cleared cursor and likewise produces no FL-10.

After commit, the last-processed ref is pinned under the project advisory lock,
with a cursor recheck to prevent an older poll overwriting a newer pin. A failed
pin logs a generic message and is retried on the next poll; committed results
remain visible. A deleted mirror is recreated even when the head is unchanged.
If a rewrite also removed the old objects, the stored snapshot supplies FL-10
comparison evidence. No registrations, identities, or audit history are deleted.

Tests in `src/test/poller.test.ts`, `src/test/source-failures.test.ts`, and
`src/poller/scheduler.test.ts` use temporary homes, local git fixtures, stubbed
REST responses, real isolated Postgres, and controllable clocks. The harness
accepts `remoteUrl`, `mirror`, `flags`, and `intervalMs`, exposes `poller` and
`newScheduler()`, and stops every scheduler in `close()`. It never defaults to a
real GitHub remote. `fixtureGitHub()` exercises the actual REST decoder over a
controllable fake HTTP transport.


### Flag records and review

`flagSink.apply(tx, input)` reconciles flags in the poll transaction. Records
retain rule, canonical subject, project, first-raised time, evidence, and status.
A project-specific transaction advisory lock serializes reconciliation and
human flag actions; the database also enforces one open row per rule/subject.
Open evidence changes and every raise, resolution, withdrawal, dismissal, and
reopen append an audit record with `flag_id`, before/after values, and time.
Automatic changes use system actor `poller`; human changes record the selected
user and note. Flags are observations and are never consulted as action gates.

Conditions resolve when absent, including dismissed conditions. FL-8 resolves
on full re-evaluation when no longer raised. Other events remain open or
dismissed even if registration settings stop detecting them. Conditions-only
polls leave FL-8 and other event records untouched. A dismissed FL-5 produces a
new open row once more than the current threshold has elapsed since the latest
dismissal for that subject. Old rows and notes remain. A resolved condition
that recurs produces a new row. Rewrites withdraw event records whose commits
left the chain, including dismissed/resolved events, and add their records to
FL-10 evidence as `withdrawnFlags`. A returning withdrawn event gets a new row.

| Method and path | Behavior |
| --- | --- |
| `GET /api/projects/:id/flags?status=` | `{ flags }`; omit status for all, open first; filter by `open`, `dismissed`, `resolved`, or `withdrawn` |
| `GET /api/flags/:id` | flag fields plus chronological `history` from the audit trail, including actors, times, notes, and before/after evidence |
| `POST /api/flags/:id/dismiss` | `{ note: string }`; open to dismissed; returns the updated flag |
| `POST /api/flags/:id/reopen` | `{ note: string }`; dismissed to open; returns the updated flag |

Reads allow viewers and retain access to archived project flags. Mutations
require a selected active user and a trimmed, nonempty note. An invalid status
transition returns `invalid_transition`; reopening when another open occurrence
exists returns `conflict`. Invalid notes/filters return `validation`, and
unknown IDs return `not_found`. Shared schemas/types are in
`packages/shared/src/flags.ts`. `FlagsService` exposes `list`, `get`, `dismiss`,
and `reopen`.

`reevaluateFlags(tx, now, projectId?)` evaluates compatible stored snapshots
without source calls. Explicit identity additions/removals reevaluate all active
projects in the mutation transaction. Baseline, exempt-path, threshold, and
lead-developer edits reevaluate the affected project in their transaction. A
branch change waits for the next poll instead of evaluating the retained old
branch snapshot. Missing/incompatible snapshots wait for rebuilding by the
poller. Registration row locks serialize these reads against poll publication.
Registry API additions and name/email edits call `reevaluateAll(db, now)` after
the registry transaction commits; direct RegistryService callers do not trigger
this route hook. A failure in this hook does not undo the committed registry
edit. Inactive members still match, so activation changes need no flag refresh.

`src/test/flags.test.ts` uses TASK-034 git/HTTP fixtures, temporary homes and
isolated Postgres. It covers reconciliation races, rollback, notes, cache
rebuilds, HTTP server/service/scheduler recreation against the same database,
staleness boundaries, identity/registration re-evaluation, and rewrites.
The harness `restartServer()` stops schedulers and HTTP, then recreates the
application services using the retained test database and temporary home.

### Per-project read API

TASK-036 adds viewer-accessible GET endpoints. `ProjectViewsService` in
`server/src/views/project.ts` reads registration, source status, the version-3
snapshot, flags/notes, and current identities in one read-only repeatable-read
transaction. It never polls, changes stored data, or contacts GitHub. Shared
response schemas and types are in `packages/shared/src/project-view.ts`.

| Method and path | Response |
| --- | --- |
| `GET /api/projects/:id/view` | D1 header/notices, `proposed`, `approved`, `recentlyCompleted`, `other`, 12 `activity` buckets, and all `flags` with open first |
| `GET /api/projects/:id/tasks` | Every historical task ID in `tasks`, including the full completed list and removed/withdrawn tasks |
| `GET /api/projects/:id/tasks/:taskId` | `task`, full chronological `history`, historical approval/completion `entries`, and task flags (including file-keyed FL-7) |
| `GET /api/projects/:id/documents` | `goals`, `goalsMessage`, `contracts`, and `adrs`; document metadata and file references |
| `GET /api/projects/:id/file?path=` | Raw UTF-8 `text` in JSON, `file` reference, `status`, and optional failure `reason` |

Every successful response has `projectId`, `headSha`, `lastSuccessfulPollAt`,
`notCurrent`, `readState`, and `source`. Before a successful poll, `readState`
is `not yet read`; lists are empty. Missing/incompatible snapshot caches after
an earlier success report `not available until the next poll`. Source failures
retain the last successful head, time, and task facts. Unknown/removed projects,
unknown tasks, and files outside the snapshot allowlist return `not_found`.
Task/file not-found errors include the available read metadata in error details.

Task models retain all head files and states for duplicate IDs. Each file
includes its complete parsed header (including unknown fields), raw header
lines, Paths, parse problems, format label, recorded dates/names, assigned agent,
and related references. Pre-v1 parse problems are informational; reads raise no
flags. Related IDs resolve only against files present at head; missing or removed
targets say `not found on main`. Historical entry files have their historical
head and GitHub URL; their API `href` is null unless they refer to the current
snapshot head, because the file endpoint serves only that head.

Attribution is rebuilt from current users/identities on every read. Recorded
values stay intact; matches include member ID/display name and inactive status.
Unmatched and ambiguous identities say `not a board member`; matches do not
verify who acted. Committers are shown without mapping. Flag evidence remains
unchanged, with current `attributions` alongside it, source links, and all notes;
`href` opens the existing flag detail/history endpoint.

Task ages/waits are milliseconds as of the last successful poll. `staleApproval`
reports the FL-5 condition, independently of dismissal, using that poll time and
the current threshold. Acceptance is the first completed entry; its duration
uses the latest approval preceding that entry in chain order, or null if absent.
Recorded negative durations are preserved because commit times are not verified.
Recently completed contains current completed tasks from the last 30 days plus
at least the ten newest (or all if fewer exist), newest first. Activity counts
state-entry events, first-parent commits, and persisted flag occurrences in
12 rolling seven-day windows ending at the request clock, oldest bucket first.
Each window is `(start, end]`, so a boundary counts once and now is included.

Files are read by exact allowlisted path and immutable snapshot SHA through
`Mirror.readFile`; no mirror is created or fetched by a read. Only recognized
task files, recognized contracts/ADRs, and present `docs/PROJECT.md` qualify.
Missing mirrors return `status: "not available until the next poll"` with null
text while the other endpoints remain usable. Oversized/invalid UTF-8 files
return `could not be read`. Document metadata marks unreadable/unknown status;
missing goals say `No project definition found`. Markdown is raw JSON text;
safe rendering belongs to TASK-038.

`src/test/project-view.test.ts` uses TASK-034/035 local git and stubbed HTTP
fixtures through the poller, temporary homes, and isolated Postgres. It covers
selection and timing boundaries, merge/re-approval history, current identities,
notes, duplicate/unreadable files, source and mirror failures, allowlisting,
read-only behavior, and reads during atomic poll publication.


### Cross-project dashboard

`GET /api/dashboard` is a viewer read. It returns `projects`,
`recentAcceptances`, and `recentFlags`, validated by
`packages/shared/src/dashboard.ts`. Removed registrations are excluded.
Project rows contain name/lead, source/head/last successful poll metadata,
proposed and approved task counts, open FL-5 count, all open flags, and
completions whose acceptance time is in the inclusive interval [now minus
30 days, now]. Missing or incompatible snapshots retain source metadata;
the UI labels their task counts unavailable.

The endpoint reuses project read projections inside one read-only,
repeatable-read transaction. Nested project reads use savepoints in that
transaction. It performs no GitHub, mirror, poll, or database write operation.
Acceptances follow D4: tasks currently in completed, ordered by their first
acceptance commit time, newest first, capped at ten across projects (without
a 30-day cutoff). Flags include all statuses, ordered by first-raised time,
capped at ten. Stable IDs break timestamp ties. The response adds no stored state.

At `/`, project entries link to project overviews; acceptance entries also
link to task details. Existing SourceStatus and FlagList components provide
viewer refresh, inline evidence, and Moonbeam-only flag notes. Source status
and flag counts/evidence are separate. Dashboard queries refresh each minute
and invalidate after refresh, flag notes, registration, user, or identity
changes. UI tests mock API responses; server tests use isolated database and
local source fixtures. No real GitHub calls are used in these tests.
