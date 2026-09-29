# TASK-026: Remove the shelved lifecycle code and drop its tables

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-002 (kept parts), CONTRACT-003, CONTRACT-004, CONTRACT-005 (shelved)
Related ADRs: ADR-008, ADR-003, ADR-002
Dependencies: None

## Desired outcome

Moonbeam is the kept shell ADR-008 describes:
- users and the user select
- first-run setup
- the audit trail
- the dashboard and layout shell

The lifecycle service, claims, leases, splits, agent run credentials,
development routes, projects root, local registration, discovery, the task
board, the decision queue, and task actions are gone. A migration drops their
tables. Audit records are kept.

## Context

This is TASK-023 decision 3: remove first and drop the tables. The shelved code
occupies the files the rework must change. Removing it first gives later tasks a
small, clean base.

## Scope

### Included

- **Server:**
  - delete `server/src/lifecycle/`, `server/src/repository.ts`, `server/src/views.ts`, `server/src/discovery.ts` and `discovery.test.ts`, `server/src/identity/credentials.ts`, `server/src/identity/permission.ts` and its test
  - trim `server/src/registry.ts` to users and first-run setup, with no projects root, projects, discovery, or permission guard
  - trim `server/src/identity/actor.ts` to human resolution from `X-Moonbeam-User`. `Authorization` is ignored. `resolveActor` remains the only way to get an actor (the CONTRACT-002 replacement seam).
  - `server/src/routes.ts`: keep `/whoami`, `/setup`, and `/users*`. `Services` becomes `{ db, clock, registry }`.
  - `server/src/index.ts`: remove the lease sweep, the lifecycle, and `MOONBEAM_DEV_ROUTES`
  - `server/src/errors.ts`: remove `AuthorityViolation`
- **Server tests:**
  - delete the concurrency, conditions, invariants, queue, review-fixes, splits, task016, transitions, projects, and recent-audit suites
  - trim `identity.test.ts` to CONTRACT-002's kept parts
  - simplify `harness.ts`: no FakeRepository, lifecycle, or projects dirs
  - update `vitest.unit.config.ts`
- **Shared:**
  - delete `lifecycle.ts`, `projects.ts`, `edit-task.test.ts`, `lifecycle.test.ts`, `recent-audit.test.ts`
  - from `identity.ts`, remove the agent, run, and dev schemas, `AUTHORIZATION_HEADER`, and `projectsRoot` in setup
  - keep only the human form of the actor schema
  - reduce `errors.ts` to `unidentified`, `not_found`, `invalid_transition`, `conflict`, `validation`
- **Database:**
  - remove every table and enum except `users`, `audit_records`, and `actor_kind`
  - generate migration `0003` that drops them
  - `audit_records`, its rows, and its append-only trigger stay
- **UI:**
  - delete the DecisionQueue, Project, ProposeTask, and Task pages and `task016.test.tsx`
  - delete the TaskActions, MoveControl, TaskCard, EditProposedTask, and StatusBadge components
  - delete `lib/status.ts` and its test, `lib/actionPresentation.ts`, `lib/paths.ts`
  - replace Dashboard and Projects with neutral placeholders ("Projects are registered from GitHub; this view is being rebuilt")
  - remove the projects root from the Setup page
  - trim `queries.ts`, `format.ts`, and test fixtures
  - Layout nav: Dashboard, Projects, Users
  - `NotFound`, `Dialog`, `common`, `currentUser`, `selection`, `client`, and `connection` stay
- **`docs/DEVELOPMENT.md`:**
  - remove the lifecycle API, TASK-016 readings, dev routes, projects root, discovery, and the task board UI
  - update the layout, configuration table, identity notes, and endpoint table to what remains

### Excluded

- Any new feature, table, or endpoint.
- Changing dependencies: `package.json` dependency lists and `pnpm-lock.yaml` stay unchanged.
- `tools/model-eval/`, `ui/screenshots/`, and every document except `docs/DEVELOPMENT.md`.

### Paths

- `server/src/`
- `server/vitest.unit.config.ts`
- `packages/shared/src/`
- `packages/db/src/schema/index.ts`
- `packages/db/migrations/`
- `ui/src/`
- `docs/DEVELOPMENT.md`

## Plan

1. UI first: remove the pages, components, and lib files that import lifecycle
   schemas. Add the placeholders.
2. Server: remove the modules and routes, trim the registry and actor, and
   rewrite the harness and remaining tests.
3. Shared: remove the schemas nothing imports any more.
4. Database: edit the schema and run `pnpm db:generate`. Check that the generated
   SQL only drops tables, indexes, and enums, and touches neither `users` nor
   `audit_records`.
5. Update `docs/DEVELOPMENT.md`, then run the full validation.

## Acceptance criteria

- [ ] `grep -rniE "lifecycle|claim|lease|subtask|split|credential|decision.?queue|projects.?root|discover|dev/runs|pause|handoff" server/src packages ui/src` finds nothing, except in audit history text or comments that explain the removal.
- [ ] The API serves exactly:
  - `GET /api/health`
  - `GET /api/whoami`
  - `GET` and `POST /api/setup`
  - `GET` and `POST /api/users`
  - `PATCH /api/users/:id`
  - `POST /api/users/:id/deactivate`
  - `POST /api/users/:id/reactivate`

  Every other `/api` path returns 404.
- [ ] CONTRACT-002's kept behavior is still tested:
  - first-run setup only while there are no users
  - add, edit, deactivate, and reactivate
  - unique active names
  - the last active user can't be deactivated
  - `X-Moonbeam-User` resolution, with `unidentified` for unknown or inactive users
  - an audit record for each registry change
- [ ] A request with an `Authorization` header and no user header resolves to no actor (a viewer). Reads succeed and actions are `unidentified`.
- [ ] After all migrations, the database has tables `users` and `audit_records` (plus the Drizzle bookkeeping) and still has the `audit_records` trigger. Migration 0003 applied to a database created at `main` before this task keeps every `audit_records` and `users` row. Checked by hand and recorded in the handoff.
- [ ] The UI boots to the Dashboard placeholder. The Users, Setup (without a projects root), Projects placeholder, and NotFound pages work. The remaining UI tests, including axe checks, pass.
- [ ] `docs/DEVELOPMENT.md` describes only the remaining code.
- [ ] No `package.json` dependency list or `pnpm-lock.yaml` changes.

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite: `pnpm --filter @moonbeam/server exec vitest run`. Record the test counts.
- `pnpm db:generate` after the change produces no new migration.
- A manual upgrade check: `pnpm db:migrate` against a copy of a pre-task database. Record it in the handoff.

## Risks and assumptions

- Assumes TASK-023 decision 3 as recommended. Any lifecycle data in existing
  databases is lost when they migrate. Take a `pg_dump` first if it is wanted.
- The TASK-027 lane (`packages/dbc/`) may run at the same time. Report any
  interference found in full-repo commands. Don't fix it.

## Blocker

None.

## Implementation handoff

Implemented by Codex, in two runs. The first stopped to ask a scope question,
and the dispatcher delivered the board's answer after the other Codex job was
cancelled. Validation was completed by the dispatcher, because Codex's sandbox
blocks loopback sockets.

**Changed:** 2 files added, 33 modified, 45 deleted.

- **Added:** `packages/db/migrations/0003_grey_ultron.sql` and
  `packages/db/migrations/meta/0003_snapshot.json`.
- **Modified:**
  - `docs/DEVELOPMENT.md`
  - `packages/db/migrations/meta/_journal.json` and
    `packages/db/src/schema/index.ts`
  - `packages/shared/src/{errors,identity,index}.ts`
  - `server/src/{app,audit,errors,index,registry,routes}.ts`,
    `server/src/identity/actor.ts`, and
    `server/src/test/{harness,identity.test}.ts`
  - `server/vitest.unit.config.ts`
  - `ui/src/`: App, the api client and queries, Layout, common, format,
    Dashboard, NotFound, Projects and its test, Setup, Users, and the
    dashboard, pages, and fixtures tests
- **Deleted:**
  - the lifecycle service and all of `server/src/lifecycle/`
  - discovery, repository, views, run credentials, and permission
  - 10 database-backed lifecycle test files
  - `packages/shared/src/` lifecycle, projects, and edit-task and
    recent-audit tests
  - UI pages: DecisionQueue, Project, ProposeTask, Task, and task016 test
  - UI components: EditProposedTask, MoveControl, StatusBadge, TaskActions,
    and TaskCard
  - UI lib: actionPresentation, paths, and status with its test

**Scope exception:** the board approved (2026-09-29) removing one line in
`packages/db/src/index.ts`. The line re-exported four types of the deleted
tables. Nothing else in that file changed.

**Migration 0003:**

- drops agent_runs, blockers, claims, handoffs, pauses, projects, reviews,
  run_credentials, settings, and tasks (with CASCADE)
- drops their eight enum types
- keeps users, audit_records, the actor_kind enum, and the append-only
  trigger

`settings` held only the projects root.

**Validated by the dispatcher (outside the sandbox), with TASK-027 also in the
tree:**

- `pnpm typecheck` passes in all 5 packages. `pnpm build` passes (exit 0),
  after clearing stale `dist/` output.
- `pnpm test`:
  - shared: 4 passed
  - db: passed
  - dbc: 78 passed
  - server: 2 files, 12 passed, with the embedded-Postgres database suite
    running
  - ui: 5 files, 21 passed, including axe
- Codex's second `pnpm db:generate` produced no new migration.
- **Upgrade check,** run by hand with
  `scratchpad/upgrade-check.mts`:
  - A scratch embedded Postgres got migrations 0000–0002 and was seeded with
    2 users, 3 audit records, a project, and settings. Then the real
    migrations folder was applied.
  - Afterwards the users and audit rows survive (2 and 3), the only tables
    are `users` and `audit_records`, and the only enum is `actor_kind`.
  - UPDATE, DELETE, and TRUNCATE on audit_records are refused by the trigger,
    and INSERT still works.
  - No Postgres process is left running.
- **Acceptance grep,** over source with `node_modules`, `dist`, and
  `migrations` excluded: the only hits are `.split(` string calls, which are
  false positives. Historical migrations 0000–0002 still contain the old
  names, as they must.

**Not checked:** a manual browser boot of the UI. The UI tests cover the
remaining pages.

## Review

Not reviewed.
