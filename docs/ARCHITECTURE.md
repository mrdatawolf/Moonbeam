# Architecture

This document describes the system as currently built and accepted. Proposed
changes belong in tasks and contracts until they are accepted. Commands,
configuration, and the repository layout are in `docs/DEVELOPMENT.md`.

Last updated: 2026-09-28 (after TASK-019).

## System boundaries

```text
 Board members' browsers (LAN)
            │  HTTP, one origin (/api proxied by Vite in development)
            ▼
 ┌──────────────── Moonbeam host (single host in V1, ADR-006) ───────────────┐
 │  ui/  React SPA ──► server/  Express API (/api/*) ──► PostgreSQL           │
 │                          │                           (embedded in dev,     │
 │                          │                            DATABASE_URL shared) │
 │                          ▼                                                 │
 │               projects root (read-only today: discovery and registration)  │
 │               MOONBEAM_HOME (~/.moonbeam): database data; later worktrees  │
 └────────────────────────────────────────────────────────────────────────────┘
            ┆ (planned, phase 3 onward)
            ▼
 Agent runs: Claude Code / Codex on this host; llama.cpp endpoints on the LAN
```

- **Moonbeam holds workflow state; repositories hold durable knowledge
  (ADR-001).** The database is the only authority for task state, claims,
  splits, runs, pauses, reviews, approvals, acceptance, and the audit trail.
  Contracts, ADRs, and accepted task records live in each project repository.
- **Moonbeam never holds project repositories (ADR-006).** It registers
  existing git repositories under a projects root chosen at first-run setup.
  The root must be outside Moonbeam's install and data directories.
- **Trust boundary: the LAN.** There is no authentication in V1 (ADR-003). A
  human picks who they are from a user select. Moonbeam must not be exposed
  beyond the LAN.

## Components

### `packages/shared` (`@moonbeam/shared`)

Zod schemas and TypeScript types for every request and response, shared by the
server and the UI: identity, lifecycle, projects, errors, health, and recent
audit records.

### `packages/db` (`@moonbeam/db`)

Drizzle schema, migrations, the database client, and the embedded Postgres
starter. Main tables:

| Area | Tables |
| --- | --- |
| Identity (CONTRACT-002) | `users`, `run_credentials` |
| Configuration | `settings` (projects root), `projects` |
| Lifecycle (CONTRACT-005) | `tasks` (state, scope envelope, queue position, parent), `claims` (with leases), `handoffs`, `reviews`, `blockers` |
| Runs and pauses | `agent_runs` (role, model, status), `pauses` |
| Audit | `audit_records` (every action: actor, kind, before and after) |

`agent_runs` and `pauses` exist in the schema and are used by the lifecycle
(claims, leases, credentials, and the "open pause" condition). Nothing launches
real runs yet (see "Not yet built").

### `server/` (`@moonbeam/server`)

Express 5 API under `/api`:

- **Identity (`src/identity/`, CONTRACT-002).** `resolveActor` is the only way
  the server learns who is acting, and it is the seam a future login will
  replace. A request with a user header is a human. A request with an
  `Authorization` bearer credential is an agent run, bound to one task,
  project, role, and model. Credentials are stored only as hashes. The
  permission check refuses approval, acceptance, and every other human-only
  action to agents, whatever else the request claims.
- **Lifecycle (`src/lifecycle/`, CONTRACT-005).** A single service applies
  transitions (propose, edit, approve, claim, release, renew, handoff, review,
  accept, return, split, cancel, blockers, move). It also works out:
  - the conditions and allowed actions for each actor
  - scope envelopes, which subtasks may only narrow
  - path overlap and the per-project queue that turns overlap into
    dependencies (ADR-005 decision 5)
  - claim leases, expired by a 15-second sweep and on read

  Every action writes an audit record in the same transaction.
- **Registry (`src/registry.ts`, `src/discovery.ts`).** First-run setup, the
  user list, the projects root, project registration, and read-only discovery
  of unregistered repositories under the root.
- **Views (`src/views.ts`).** Read models for the task detail, project queue,
  decision queue, dashboard, and recent events.
- **Repository port (`src/repository.ts`).** The boundary to git
  (CONTRACT-004): whether a branch will merge, which files it changed, and
  subtask integration. Today it is a stub that always reports "mergeable, no
  changed files, integrated". Phase 3 replaces it with a real implementation.
- **Development routes (`/api/dev/*`, `MOONBEAM_DEV_ROUTES=1`).** Create fake
  runs with credentials, end runs, and open and close pauses. They stand in for
  a runner until one exists. They are never enabled in a shared deployment.

### `ui/` (`@moonbeam/ui`)

React 19 SPA (Vite, Tailwind v4, TanStack Query, React Router). Its pages:

- first-run setup
- the dashboard
- the decision queue
- projects: discovery and registration
- a project's task board
- proposing a task
- task detail with its actions
- users

Every screen reads through the API. Live views poll on an interval, and there
is no push channel. The current user comes from the user select and is sent on
every request.

### `TEMPLATE/`

The Moonbeam variant of DbC (ADR-004) that gets copied into managed projects:
CLAUDE.md, AGENTS.md, workflow and role docs, and templates adjusted for
Moonbeam-held state. It is a deliverable, not instructions for this repository.

### `tools/model-eval`

A standalone harness that scores local models (llama.cpp's OpenAI-compatible
API) on role-shaped fixtures: summarize, categorize, scope, and handoff. It is
an early input to phase 5 track records and is not wired into the server.

## Key flows (built)

1. **Setup.** The first run creates the first user and records the projects
   root. The root is refused if it is inside the install or data directory.
2. **Register a project.** A board member picks repositories found under the
   root, or enters a path. The server checks each is a git repository under
   the root, judged by its real location, then records it and audits it.
3. **Task lifecycle.** `proposed → approved → in_progress → in_review →
   completed` (or `cancelled`), as CONTRACT-005 specifies. A claim gives one
   human, or one agent run with a lease, the right to work the task. Overlapping
   paths queue tasks behind each other. A split creates subtasks that are
   approved automatically. Acceptance happens once, on the parent.
4. **Decisions.** The decision queue and the dashboard show everything waiting
   on a human.

## Not yet built

- **Phase 3, runs.** CONTRACT-003 (run view and review surface) and
  CONTRACT-004 (task branches, worktrees, merges, and pushes) are approved but
  not implemented. Still missing:
  - a runner that launches Claude Code or Codex
  - worktrees in `MOONBEAM_HOME`
  - `moonbeam/TASK-NNN` branches
  - transcripts and costs
  - the review surface (rendered documents, diff, validation)
  - merge and push actions
  - writing the task record to the repository
- **Phase 4, pauses.** Pauses from real runs, the pause log, pause review, and
  override review. No contract yet.
- **Phase 5, local models.** llama.cpp runners and track records.
- **Phase 6, hardening.** Login, roles, and budgets.

## Related decisions

ADR-001 (state versus knowledge), ADR-002 (stack), ADR-003 (identity), ADR-004
(TEMPLATE), ADR-005 (branches and the review surface), ADR-006 (projects root,
single host), ADR-007 (gates bind agents; human overrides are recorded).
