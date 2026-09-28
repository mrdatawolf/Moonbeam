# Architecture

This document has two parts:

- **"As built"** describes the code as it is today, and marks which parts
  ADR-008 keeps, re-points, or shelves.
- **"Direction (not yet built)"** describes the target from ADR-008 and
  CONTRACT-006. None of it exists in code yet.

Proposed changes belong in tasks and contracts until they are accepted.
Commands, configuration, and the repository layout are in
`docs/DEVELOPMENT.md`.

Last updated: 2026-09-28 (TASK-022, after ADR-008, ADR-009, and CONTRACT-006
were approved). The code has not changed since TASK-019.

## As built

The code was built for the earlier direction (ADR-001, ADR-005, ADR-006), in
which Moonbeam's database held task state and Moonbeam would run agents.
ADR-008 replaced that direction. The code below still works as described, but
the parts marked **shelved** no longer serve any planned work. Removing them
needs its own task (ADR-008, "What happens to the current code").

Status markers used below:

- **Kept:** stays in the ADR-008 direction.
- **Re-pointed:** stays, but must change to serve the ADR-008 direction.
- **Shelved:** no longer governed by an active contract, to be removed later.

### System boundaries

```text
 Board members' browsers (LAN)
            │  HTTP, one origin (/api proxied by Vite in development)
            ▼
 ┌──────────────────────────── Moonbeam host ────────────────────────────────┐
 │  ui/  React SPA ──► server/  Express API (/api/*) ──► PostgreSQL           │
 │                          │                           (embedded in dev,     │
 │                          │                            DATABASE_URL shared) │
 │                          ▼                                                 │
 │               projects root (read-only: discovery and registration)        │
 │               MOONBEAM_HOME (~/.moonbeam): database data                   │
 └────────────────────────────────────────────────────────────────────────────┘
```

- **Task state in the database (ADR-001, superseded).** The code treats the
  database as the authority for task state, claims, splits, runs, pauses,
  reviews, approvals, and acceptance. Under ADR-008 this is shelved: DbC files
  in each project are authoritative, and Moonbeam keeps no task state.
- **Projects under a projects root (ADR-006, superseded).** The code registers
  existing git repositories under a projects root chosen at first-run setup.
  Under ADR-008 this is re-pointed to GitHub repositories.
- **Trust boundary: the LAN (ADR-003, kept).** There is no authentication in
  V1. A human picks who they are from a user select. Moonbeam must not be
  exposed beyond the LAN.

### Components

#### `packages/shared` (`@moonbeam/shared`)

Zod schemas and TypeScript types for every request and response, shared by the
server and the UI: identity, lifecycle, projects, errors, health, and recent
audit records. **Kept** as the pattern. The lifecycle schemas are **shelved**
with the lifecycle service.

#### `packages/db` (`@moonbeam/db`)

Drizzle schema, migrations, the database client, and the embedded Postgres
starter. Main tables:

| Area | Tables | ADR-008 |
| --- | --- | --- |
| Identity (CONTRACT-002) | `users` | Kept |
| Identity (CONTRACT-002) | `run_credentials` | Shelved |
| Configuration | `settings` (projects root), `projects` | Re-pointed |
| Lifecycle (CONTRACT-005) | `tasks` (state, scope envelope, queue position, parent), `claims` (with leases), `handoffs`, `reviews`, `blockers` | Shelved |
| Runs and pauses | `agent_runs` (role, model, status), `pauses` | Shelved |
| Audit | `audit_records` (every action: actor, kind, before and after) | Kept |

`agent_runs` and `pauses` exist in the schema and are used by the lifecycle
(claims, leases, credentials, and the "open pause" condition). Nothing launches
real runs, and under ADR-008 nothing will.

#### `server/` (`@moonbeam/server`)

Express 5 API under `/api`:

- **Identity (`src/identity/`, CONTRACT-002).** `resolveActor` is the only way
  the server learns who is acting, and it is the seam a future login will
  replace. A request with a user header is a human. A request with an
  `Authorization` bearer credential is an agent run, bound to one task,
  project, role, and model. Credentials are stored only as hashes. The
  permission check refuses approval, acceptance, and every other human-only
  action to agents.
  - **Kept:** the user header, `resolveActor` as the seam, and users.
  - **Shelved:** agent run credentials and the human-only action checks.
    Agents do not use Moonbeam under ADR-008.
- **Lifecycle (`src/lifecycle/`, CONTRACT-005). Shelved.** A single service
  applies transitions (propose, edit, approve, claim, release, renew, handoff,
  review, accept, return, split, cancel, blockers, move). It also works out:
  - the conditions and allowed actions for each actor
  - scope envelopes, which subtasks may only narrow
  - path overlap and the per-project queue that turns overlap into
    dependencies (ADR-005 decision 5)
  - claim leases, expired by a 15-second sweep and on read

  Every action writes an audit record in the same transaction.
- **Registry (`src/registry.ts`, `src/discovery.ts`). Re-pointed.** First-run
  setup, the user list, the projects root, project registration, and read-only
  discovery of unregistered repositories under the root. The user list is
  kept. Registration is to be re-pointed at GitHub repositories.
- **Views (`src/views.ts`).** Read models for the task detail, project queue,
  decision queue, dashboard, and recent events. The task detail, project
  queue, and decision queue are **shelved**. The dashboard is **kept** as a
  shell, and its content will change with the new data.
- **Repository port (`src/repository.ts`). Shelved.** The boundary to git
  written for CONTRACT-004 (now shelved): whether a branch will merge, which
  files it changed, and subtask integration. It is a stub that always reports
  "mergeable, no changed files, integrated".
- **Development routes (`/api/dev/*`, `MOONBEAM_DEV_ROUTES=1`). Shelved.**
  Create fake runs with credentials, end runs, and open and close pauses. They
  stood in for a runner. They are never enabled in a shared deployment.
- **Audit (`src/audit.ts`). Kept.** Every action is recorded with its actor.

#### `ui/` (`@moonbeam/ui`)

React 19 SPA (Vite, Tailwind v4, TanStack Query, React Router). Its pages:

| Page | ADR-008 |
| --- | --- |
| first-run setup | Re-pointed (it asks for the projects root) |
| the dashboard and the layout shell | Kept |
| the decision queue | Shelved |
| projects: discovery and registration | Re-pointed |
| a project's task board | Shelved |
| proposing a task | Shelved |
| task detail with its actions | Shelved |
| users | Kept |

Every screen reads through the API. Live views poll on an interval, and there
is no push channel. The current user comes from the user select and is sent on
every request.

#### `tools/model-eval`

A standalone harness that scores local models (llama.cpp's OpenAI-compatible
API) on role-shaped fixtures: summarize, categorize, scope, and handoff. It is
not wired into the server. **Kept for now** (ADR-008).

#### `TEMPLATE/` (retired)

Moonbeam's own variant of DbC (ADR-004) was retired by ADR-008 decision 8
(alternative A) and removed by TASK-022. The DbC changes Moonbeam needs go to
the upstream Project Template DbC instead.

### Key flows (built)

1. **Setup (re-pointed).** The first run creates the first user and records
   the projects root. The root is refused if it is inside the install or data
   directory.
2. **Register a project (re-pointed).** A board member picks repositories
   found under the root, or enters a path. The server checks each is a git
   repository under the root, judged by its real location, then records it and
   audits it.
3. **Task lifecycle (shelved).** `proposed → approved → in_progress →
   in_review → completed` (or `cancelled`), as CONTRACT-005 specifies. A claim
   gives one human, or one agent run with a lease, the right to work the task.
   Overlapping paths queue tasks behind each other. A split creates subtasks
   that are approved automatically. Acceptance happens once, on the parent.
4. **Decisions (shelved).** The decision queue and the dashboard show
   everything waiting on a human in Moonbeam's lifecycle.

## Direction (not yet built)

This section describes the target set by ADR-008, ADR-009, and CONTRACT-006.
None of it is implemented. The rework is being planned in TASK-023. Where a
technical choice is left open below, it is open on purpose.

### Shape

```text
 Lead developer's clone ──push──► GitHub repository (main)
   (DbC, own AI tools)                    ▲
                                          │ read-only polling, read-only token
                                          │
 Board members' browsers ──► Moonbeam (ui/, server/, PostgreSQL)
```

- **DbC is authoritative for each project** (ADR-008 decision 2). A task's
  state is the `tasks/` directory holding it. Moonbeam derives everything it
  knows about a project's work from the DbC files and git history on the
  tracked branch, `main` by default.
- **GitHub is the shared reference** (ADR-008 decision 5). Moonbeam polls each
  project's GitHub repository with a read-only token, every 5 minutes by
  default, with a manual refresh (CONTRACT-006 S5). Unpushed work is
  invisible.
- **Moonbeam is read-only** (ADR-008 decision 6, CONTRACT-006 S3, N1). It never
  commits, pushes, approves, accepts, or merges, and never writes to GitHub.
- **Moonbeam detects and does not enforce** (ADR-008 decision 7, ADR-007).
  Flags are records for review. They never block anything (CONTRACT-006 FG6).

### Parts

Each part is defined by CONTRACT-006. Names here are descriptive, not module
names.

- **Registration** (S1): the GitHub owner and repository, its numeric ID, the
  tracked branch, which configured token to use, the lead developer, the
  baseline commit, exempt paths, and the staleness threshold. Replaces the
  projects root registration.
- **Poller** (S, F): reads the tracked branch's first-parent chain, trees,
  change sets, and file contents from GitHub. It handles rate limits, token
  and repository failures, renames, and rewritten history, and keeps the last
  known state visible. Tokens are configured on the server per GitHub owner
  (Q11) and never reach the browser. How GitHub is read (REST, GraphQL, or
  git fetch into a local mirror) is an implementation choice that CONTRACT-006
  leaves open. TASK-023 is planning it.
- **Parser** (P): reads task files in the "DbC task v1" format from the
  upstream Project Template DbC, tolerating older and malformed files.
- **History** (H): derives each task's events and dates from main's chain,
  deterministically, so it can always be rebuilt from GitHub.
- **Flags** (FL, FG): FL-1 to FL-11, such as approval skipped, incomplete
  record, unaccounted change, out of scope, and stale approval. A board member
  may dismiss or reopen a flag with a note.
- **Per-project view** (D, R): proposed, approved, and recently completed
  tasks, activity over time, flags with evidence, and read-only rendered
  contracts, ADRs, and `docs/PROJECT.md`. It offers no action on the
  repository.
- **Identities** (I, L): git e-mails, GitHub logins, and name aliases per board
  member, used to attribute commits and recorded names. One lead developer per
  project.
- **Cross-project dashboard:** a summary across projects. It is outside
  CONTRACT-006 and needs its own task.

### What Moonbeam stores

Moonbeam keeps no task state (CONTRACT-006 N2). Its own data is limited to:

- registrations and lead developers
- users and their identities (CONTRACT-002 kept parts, CONTRACT-006 I1)
- flag records, dismissals, and notes, in the audit trail (ADR-009,
  CONTRACT-006 FG7)
- poll status and caches that can be rebuilt

Flags and dismissals are never written to a project repository, and Moonbeam
does not read dismissals from one (ADR-009).

### Deferred

Not part of the direction for now (ADR-008 decision 9): agent runs in
Moonbeam, pauses and pause review, costs and model track records, and
sub-projects or several lead developers on one project.

## Related decisions

- Current direction: ADR-008 (Moonbeam observes DbC through GitHub), ADR-009
  (detection records live in Moonbeam), ADR-007 (record and review, never
  block; decision 4 superseded in part by ADR-009), ADR-002 (stack), ADR-003
  (identity; amended by ADR-008).
- Behavior: CONTRACT-006 (what Moonbeam reads), CONTRACT-002 (identity; kept
  parts).
- Historical, describing the as-built code: ADR-001, ADR-005, and ADR-006
  (superseded by ADR-008), ADR-004 (superseded in part), and CONTRACT-003,
  CONTRACT-004, and CONTRACT-005 (shelved).
