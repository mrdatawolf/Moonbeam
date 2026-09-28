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
  src/schema/         Drizzle table definitions (lifecycle, identity, audit)
  migrations/         generated SQL migrations and drizzle-kit metadata
  drizzle.config.ts   drizzle-kit configuration
server/               @moonbeam/server: Express API (`/api/*`)
  src/identity/       actor resolution, permission check, run credentials (CONTRACT-002)
  src/lifecycle/      transitions, paths, envelopes, dependencies (CONTRACT-005)
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
| `MOONBEAM_DEV_ROUTES` | unset | `1` enables the development and test endpoints under `/api/dev` (runs, credentials, pauses). Never set it in a shared deployment. |

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

Vitest runs per package (`pnpm test`). Unit tests sit next to the code as
`*.test.ts`. The server's API tests live in `server/src/test/` and run against a
real database:

- `server/src/test/global-setup.ts` starts **one isolated embedded Postgres per
  test run**, in a temporary `MOONBEAM_HOME` on a free loopback port, applies
  the migrations to a template database, and removes everything afterwards.
  `DATABASE_URL` is ignored, and the developer's `~/.moonbeam/db` is never
  touched.
- `server/src/test/harness.ts` gives each test a fresh database cloned from the
  template, the real Express app on an ephemeral port, a controllable clock
  (for lease expiry), a fake repository port (to exercise `merge_conflict`,
  out-of-scope files, integration failures and `repository_unavailable`), and
  helpers for users, projects, tasks and runs.
- The suites cover every transition with allowed and rejected actors
  (`transitions`, `splits`, `queue`, `conditions`), CONTRACT-002 (`identity`),
  project registration (`projects`), concurrent claims and races
  (`concurrency`), and a seeded random walk that checks the CONTRACT-005
  invariants after every step (`invariants`). TASK-017 regressions (`review-fixes`) cover deferred review
  completion, run-end and project-root races, lease resumption, repeated actions,
  agent e-mail redaction, and a leaf matrix of six states × eight actions ×
  three actors (human claimant, independent bound agent, anonymous viewer).

Run one file with `pnpm --filter @moonbeam/server exec vitest run src/test/queue.test.ts`.
The first run of a session takes a few seconds longer while Postgres initialises.

Socket-free server unit tests can be run with
`pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts`.
This deliberately excludes database/API tests and `app.test.ts` (which also
opens a loopback socket). In a sandbox without loopback, neither a root test
runner's exit 0 nor package "Done" output proves those suites ran. Use direct
package commands and record test counts and setup errors. TASK-016's API suite
is `src/test/task016.test.ts`; UI regressions are `src/pages/task016.test.tsx`.

### CONTRACT-005 readings checked in TASK-016

The existing service already implements I9 and R1–R8; no lifecycle behavior
change was needed for these readings. The invariant test now explicitly checks
both I9 branches and fixed content after approval (I23), including randomized edits.

| Reading | Implementation / regression coverage |
| --- | --- |
| I9 | `reevaluateParent` falls back when every subtask is cancelled; handoff permits that parent. `splits.test.ts` T14 and `invariants.test.ts` cover it. |
| R1 | `run` checks binding before target-dependent cancel/break authority; `cancel` and `release` enforce the relationship. Transition, split and review-fix suites cover refusals/audit. |
| R2 | `recordReview` rejects humans as `not_permitted`; transition tests cover it. |
| R3 | `addSubtasksTo` omits the parent's `split` audit when called by return, which writes `returned`; split tests cover returns with additions. |
| R4 | `returnTask` rejects additions on a leaf; no behavior change. |
| R5 | Registry `setActive` rejects repeated activation/deactivation with `invalid_transition`. |
| R6 | `moveInputSchema` checks positive integers; `move` checks the upper bound as `validation`. |
| R7 | `renew` resets a suspended lease's remaining time to the full term and records no renewal audit. |
| R8 | Top-level/subtask envelope builders validate paths at create/split; T17 reuses the top-level builder for edits; approval rechecks paths. |

M4 remains in the documented phase-3 repository boundary, outside TASK-016.

## Lifecycle API

The server implements CONTRACT-005 (task lifecycle) and CONTRACT-002 (identity)
for phase 2. Request and response shapes are the zod schemas in
`packages/shared/src/` (`identity.ts`, `lifecycle.ts`, `projects.ts`,
`errors.ts`); the server validates every response before sending it.

### Identity

- **Human:** send `X-Moonbeam-User: <user id>` (the user chosen in the user
  select). Audit records carry identity mode `selected`.
- **Agent:** send `Authorization: Bearer <run credential>`. An agent credential
  always makes the request an agent request, even if it also names a user; a
  bad, expired or ended-run credential is `unidentified` and never falls back to
  the user header. Before applying an agent lifecycle action, the server checks
  the run and credential again after taking the project lock; an ended run or
  revoked/expired credential is `unidentified`. Human actions are unchanged.
- **System:** never from a request. No header or body field sets the actor kind.
- Reads need no identity (anyone on the LAN can view). Agents read only their
  own project. User lists omit e-mail addresses for requests with agent
  credentials, including when a user header is also present. They retain ids,
  display names, active/inactive status and timestamps. Human and anonymous
  viewer lists retain e-mail addresses; human who-am-I retains its e-mail
  address, while agent who-am-I contains only run identity fields.

Every action runs: resolve actor → permission check → lifecycle rules →
repository step, in that order. An agent attempt at a human-only action is
therefore `authority_violation` (and audited) whatever the task's state, even
for a task that does not exist and even with an invalid body.

### Endpoints

| Method and path | Action |
| --- | --- |
| `GET /api/whoami` | the resolved actor, or `null` |
| `GET /api/setup`, `POST /api/setup` | first-run status; first-run setup (users, optional projects root) |
| `GET /api/users[?includeInactive=true]`, `POST /api/users` | list, add |
| `PATCH /api/users/:id`, `POST /api/users/:id/deactivate`, `POST /api/users/:id/reactivate` | edit, deactivate, reactivate (no delete) |
| `GET/PUT /api/settings/projects-root` | read, set or change the projects root |
| `GET /api/projects`, `POST /api/projects` | list, register an existing git repository under the root |
| `GET /api/projects/:id` | project with its queue in order |
| `GET /api/projects/:id/tasks[?state=a,b]` | task summaries, optionally by state |
| `POST /api/projects/:id/tasks` | T1 create |
| `GET /api/audit/recent[?limit=N]` | recent task audit events; default 10, integer 1–50, newest effective time then audit ID first |
| `GET /api/tasks/:id` | task detail: conditions, claim and lease, parent, subtasks, envelope, dependencies both ways, handoffs, reviews, audit |
| `PATCH /api/tasks/:id` | T17 edit proposed task |
| `POST /api/tasks/:id/approve` | T2 |
| `POST /api/tasks/:id/claim` | T3 |
| `POST /api/tasks/:id/release` | T4 (a reason is required to break someone else's claim) |
| `POST /api/tasks/:id/renew` | renew an agent-run lease (not audited) |
| `POST /api/tasks/:id/handoff` | T6 |
| `POST /api/tasks/:id/reviews` | T7, optionally adding fix subtasks (→ T11, T8, T12) |
| `POST /api/tasks/:id/accept` | T9: review waiver, out-of-scope reason, warnings confirmation, accept anyway |
| `POST /api/tasks/:id/return` | T10, optionally with new subtasks for a split parent |
| `POST /api/tasks/:id/subtasks` | T11 split / add subtasks |
| `POST /api/tasks/:id/cancel` | T15 (→ T16, T12, T14) |
| `POST /api/tasks/:id/blockers`, `POST /api/tasks/:id/blockers/:blockerId/resolve` | C1 |
| `POST /api/tasks/:id/move` | D1: `{ "position": n }` in the project queue, or among siblings for a subtask |
| `GET /api/decision-queue[?projectId=]` | proposed, in review, subtask findings, blocked, fell back, authority violations, accepted not merged |

`PATCH /api/tasks/:id` accepts any subset of `title`, `desiredOutcome`,
`acceptanceCriteria` and `envelope`. Omitted fields are preserved. A supplied
`envelope` replaces the whole envelope using the creation shape (plain-text
inclusions, optional arrays defaulting to empty). Unknown fields are rejected,
including attempted author/state changes. Titles/outcomes must remain nonempty;
paths are normalized and validated as at creation. An empty or semantically
unchanged edit is `validation`. Any active human or the exact authoring agent
run can edit; another run is `not_permitted` without audit. Only proposed
top-level tasks are editable; later states are `invalid_transition`. Successful
edits write one `edited` record with `details.changes`, keyed by content field
(including `envelope.paths`, etc.), each holding `previous` and `new` values.
Edits use the project lock and locked credential revalidation. Approval applies
to the content present when it obtains that lock (CONTRACT-005 Q27 interim rule).

A successful action returns `{ task, audit }`: the task detail after the action
and the audit records the action produced. The system transitions (T5, T8,
T12, T14, T16) have no endpoints; they happen inside the actions that trigger
them, and lease expiry is also applied by a 15-second sweep and before task/queue
reads. The recent-audit endpoint only reads already-recorded events; it does not
trigger a sweep or write audit records.

Development and test only (`MOONBEAM_DEV_ROUTES=1`), until the runs contract
exists: `POST /api/dev/runs` starts a run bound to a task and returns its
credential once (human only, like starting a run); `POST /api/dev/runs/:id/end`
ends it (its credential stops working and T5 ends its claim; closing its pauses
resumes any other run’s lease they had suspended, once no suspension remains);
`POST /api/dev/runs/:id/pauses` and `POST /api/dev/pauses/:id/close` open and
answer a pause.

A deferred subtask completion belongs to the reviewed handoff. Returning the
subtask or recording a new handoff clears that deferred completion; a new review
is required before it completes. Moving a task to its current queue or sibling
position is `invalid_transition` and writes no audit record. Repeating an agent’s
withdrawal of its own never-approved proposal also returns `invalid_transition`
without an authority-violation record. Project registration rechecks the current
projects root under the same lock used for root changes.

### Failure categories and HTTP status

Rejections change nothing and return `{ "error": { "category", "message", "details"? } }`.

| Category | HTTP | Notes |
| --- | --- | --- |
| `unidentified` | 401 | no or inactive selected user; bad, expired or ended-run credential. Not audited. |
| `authority_violation` | 403 | agent attempted a human-only action. Always audited as a rejected attempt. |
| `not_permitted` | 403 | not the claimant, outside the run's binding, not the blocker's author, and similar. |
| `not_found` | 404 | task, project, user, run or blocker does not exist. |
| `invalid_transition` | 409 | action not defined for the task's state or kind. |
| `conflict` | 409 | another action got there first (for example concurrent claims); names the current claimant. |
| `blocked` | 409 | blocked, effectively blocked, paused, or (claims) unfinished path dependencies; lists them. |
| `merge_conflict` | 409 | T6 or T9 (unless "accept anyway"); names the conflicting files. |
| `working_folder_unsafe`, `branch_name_taken`, `history_rewritten` | 409 | CONTRACT-004; not raised until phase 3. |
| `validation` | 422 | missing or invalid input, including malformed JSON; lists each failing rule. |
| `repository_unavailable` | 503 | the repository could not be read (T9 changed-file set). |

Only `authority_violation` rejections are audited (CONTRACT-005 A12).

### Phase-3 boundary

Git is not integrated yet. Branch mergeability (T6, the known conflict at T9),
the changed-file set (T9) and subtask integration (T8) go through the
`RepositoryPort` in `server/src/repository.ts`; the default implementation
reports mergeable, no changed files and integrated. Nothing sets a task's work
"on main" yet, so tasks that depend on an accepted task keep waiting until a
human moves the queue (D1) or the earlier task is cancelled.

## Board UI (TASK-007)

The UI in `ui/src/` is the phase-2 board surface built on the lifecycle API.

```text
ui/src/api/        client.ts (fetch, identity header, ApiRequestError), queries.ts (TanStack Query hooks), connection.ts
ui/src/lib/        status.ts (CONTRACT-003 SV vocabulary), actionPresentation.ts (browser readiness and action labels), selection.ts, currentUser.tsx, format.ts, paths.ts
ui/src/components/ StatusBadge (the shared status badge), Dialog (native <dialog>), TaskActions, MoveControl, TaskCard, Layout, common
ui/src/pages/      Setup, Users, Projects, Project (board and queue), ProposeTask, Task (detail), DecisionQueue, Dashboard
```

- **Identity.** The selected user lives in `localStorage` (`moonbeam.selectedUserId`) and is sent as
  `X-Moonbeam-User` on every request. Anyone can view without a selection. Actions are disabled with
  "Choose who you are to take this action". If the server answers `unidentified`, the selection is cleared.
- **First-run setup.** While `GET /api/setup` reports `needsSetup`, the app shows only the setup screen.
- **User management.** `/users` adds, edits, deactivates, and reactivates users through the existing
  registry endpoints. The header's "Add a user" link focuses the add form. Every change requires a
  selected active user; newcomers choose an existing user, add themselves, then explicitly switch.
  Active and inactive lists are separate, alphabetized, and show e-mail addresses. Forms check active
  name uniqueness and valid e-mail; the last active user cannot be deactivated. Server refusals remain
  visible with their category and entered values. Deactivation clears the affected browser selection
  and asks the person to choose again. An `unidentified` read retries as a viewer; writes never retry.
  `pages/users.test.tsx` and `api/client.test.ts` cover these flows and selection races.
- **Action availability.** Every task summary and detail includes `allowedActions`, computed by
  `server/src/lifecycle/availability.ts` for the resolved actor (or anonymous viewer). Each entry
  is `{ enabled: true }` or `{ enabled: false, reason }`. Detail also includes `blockerActions`,
  keyed by blocker id. This covers edit, approve, claim, release, renew, handoff, recordReview,
  accept, return, addSubtasks, cancel, addBlocker, resolveBlocker and move. The browser consumes
  these decisions; it adds only selection/connection readiness, form validation and presentation.
  Task, project queue, task list and decision queue query caches are keyed by selected user so a
  user's permissions cannot carry over to another selection. Availability means an action can be
  started with valid input: required reasons, review waivers, warnings confirmation, specific move
  destinations and repository checks still apply when submitted, as do fresh identity/state checks.
  Reading availability performs no actions and writes no authority-violation audit records.
- **Proposal editing.** A proposed task offers an edit dialog for title, desired outcome,
  acceptance criteria and every envelope field. The same `desiredOutcome` prose field used at
  creation represents the description/outcome; there is no separate description column. History
  displays each edited field's previous and new value. Refusals retain the entered form and category.
- **Decision queue.** The UI renders all seven phase-2 API groups, including Subtask findings
  (verdict, findings, same-model flag and parent link) and Fell back (parents whose subtasks were
  all cancelled, ready for direct work or another split).
- **Dashboard (TASK-008).** Four sections at `/`: the seven decision-queue group
  counts linking to `/decisions`, all six task-state counts per project (including
  subtasks), active claims with claimant/lease and condition badges, and the ten
  most recent task audit events by effective time (audit ID breaks ties). Reads
  poll every 10 seconds while the page is visible, including the project list.
  It uses schema-validated project, task-list, decision-queue and recent-audit
  endpoints. Each refresh makes one task-list request per project plus one each
  for projects, decision queue and recent audit; there are no task-detail reads.
  `GET /api/audit/recent?limit=10` returns `{ events: [...] }`, extending each
  audit record with `task: { number, title }` and `project: { id, name }`.
  The limit defaults to 10; non-integers or values outside 1–50 are `validation`.
  The read-only query orders by `occurred_at DESC, id DESC`, limits in SQL,
  and joins only the needed task, project and actor context. Partial task-event
  indexes support global and per-project time ordering. Registry-only records
  and attempts against nonexistent tasks are excluded, matching task-history
  scope. Humans/viewers see all projects; valid agent credentials restrict the
  query to their own project before limiting. Actor references expose current
  display names and inactive status, never user e-mail addresses.
  The feed polls independently, retains cached events on error, and participates
  in lifecycle/user-name cache invalidation. Failed reads are labeled; available
  data stays visible with a stale-data warning, and failed reads never become
  misleading empty states.
  `pages/dashboard.test.tsx` covers fixtures, polling, partial failures and axe.
- **Tokens.** Status tones (`--color-tone-<tone>-fg|bg|border`) and control utilities (`btn-*`,
  `field-input`, `card`) are defined in `ui/src/index.css`. No shadcn or Radix primitives were added.
  Dialogs use the native `<dialog>` element.
- **Tests.** `pnpm --filter @moonbeam/ui test` runs Vitest in jsdom with Testing Library and axe-core
  (the colour-contrast rule needs a real browser and is checked there).

## Security and privacy

- Secrets go in environment variables or an untracked `.env`; never commit them.
- Embedded Postgres listens on loopback only with fixed development
  credentials, and is not for shared deployments. Shared deployments set
  `DATABASE_URL`.
- Agent run credentials are stored only as SHA-256 hashes and returned once,
  when the run is started. They never appear in views or audit records.
- Human identity is honor-system in V1 (ADR-003): anyone on the LAN can send any
  `X-Moonbeam-User` header.
- The server binds to `127.0.0.1` by default.
