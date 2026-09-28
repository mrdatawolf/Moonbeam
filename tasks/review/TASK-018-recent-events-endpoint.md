# TASK-018: A read-only "recent events" endpoint for the dashboard

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-002 (read rules, agent e-mail rule), CONTRACT-005 (audit records)
Related ADRs: ADR-002
Dependencies: TASK-008 (completed; this replaces its per-task audit reads)

## Desired outcome

The dashboard gets its recent events from one bounded request, not by reading
the full detail of every task every 10 seconds. Its request load no longer
grows with the number of tasks ever created.

## Context

TASK-008 had to reuse existing endpoints, because a new route would have needed
a response schema in `packages/shared/`, which was outside its paths. The only
way to read audit history was the task-detail read. The dispatcher measured one
detail read per task on every 10-second refresh, including completed and
cancelled tasks, and each read also loads every user and run (TASK-006 note N3).
See "Dispatcher validation and testing" in `tasks/completed/TASK-008-dashboard.md`.

The board decided on 2026-09-28 to add the shared type and endpoint now, and
to leave cosmetic work until the product is working end to end.

## Scope

### Included

- **Shared type:** a response schema in `packages/shared/` for a list of
  recent audit records across projects. Reuse the existing
  `auditRecordViewSchema`. Each record carries what the dashboard shows: the
  task number and title, and the project, so no extra read is needed.
- **Endpoint:** a read-only route, for example `GET /api/audit/recent?limit=N`,
  newest first.
  - It has a default limit and a maximum, for example 10 and 50. A limit
    outside that range is a `validation` refusal.
  - The database query is bounded by the limit, ordered by time with an index
    if one is needed. It must not load every task's history.
  - Read rules match the existing reads: humans and viewers see all projects,
    and an agent credential sees only its own project (CONTRACT-002).
  - An agent never receives a user's e-mail address (TASK-017 N1).
- **Dashboard:** "Recent audit events" uses the new endpoint and stops reading
  task detail per task. The widget's behavior is otherwise unchanged: 10
  events, newest first, 10-second refresh, errors labeled.
- Tests: a shared schema test, server route tests (limit bounds, ordering,
  agent project scope, no e-mail addresses for agents), and an updated
  dashboard UI test showing no per-task detail reads.
- `docs/DEVELOPMENT.md`: document the endpoint and remove the scaling note.

### Excluded

- All cosmetic work: dashboard count spacing on wide screens, and readable
  scope values in edit history. The board deferred these until the product
  works end to end.
- Other dashboard widgets, registry-only (user and project) audit events, and
  any write routes.
- TASK-006 note N3 (view load cost) beyond what this endpoint needs.

### Paths

- `packages/shared/`
- `server/`
- `ui/`
- `docs/DEVELOPMENT.md`
- `packages/db/`: only the audit-table index on event time and its generated
  migration (board, 2026-09-28; see "Blocker")

## Plan

## Acceptance criteria

- [ ] One dashboard refresh makes a fixed number of requests: one per project
      for task lists, plus the queue, the projects list and the recent-events
      endpoint. It makes no task-detail reads.
- [ ] The endpoint returns at most `limit` records, newest first, with the
      task and project fields the dashboard shows.
- [ ] An agent credential gets only its own project's records, with no user
      e-mail addresses.
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass, with the database
      suite actually run.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. The dispatcher runs the
database suite and repeats the TASK-008 live check with sample data. That
includes counting the requests in one refresh cycle and confirming the dashboard
still updates without a reload.

## Risks and assumptions

- Assumes audit records already store the project for task events. If not,
  resolving it through the task must stay a bounded join, not a per-record read.
- No contract names this endpoint. It follows the existing read rules. If the
  implementer finds a contract rule that conflicts with it, stop and ask.

## Blocker

**Resolved 2026-09-28 by Patrick (board):** `packages/db/` is added to this
task's paths, for the audit-table index on event time and its generated
migration only. No other database changes. The original blocker is kept below
for the record.


2026-09-28 — Index migration requires an out-of-scope path. The audit table in
`packages/db/src/schema/index.ts` has indexes on `(task_id, id)`,
`(project_id, id)` and `(rejected, id)`, plus its ID primary key. No existing
migration indexes `occurred_at`. The dashboard orders by effective time
(`occurred_at DESC, id DESC`); effective time can differ from insertion order
(for example, a late-recorded claim expiry). Using the ID index instead would
change widget behavior. `ORDER BY occurred_at DESC, id DESC LIMIT N` bounds
returned rows but, without a matching index, still scans/sorts growing history.

Board question: authorize `packages/db/src/schema/index.ts` and generated
migration/metadata files under `packages/db/migrations/` for time-order indexes
supporting both all-project and agent-project task-event reads? Suggested keys
are `(occurred_at, id)` and `(project_id, occurred_at, id)`, restricted to task
events where appropriate. Final index definitions should accompany the query.

Stopped before implementation per the dispatch instruction requiring a stop
when an index migration needs paths outside the allowed scope. No database
files were changed.

## Implementation handoff

Task: TASK-018
Implementer: Codex, Implementer
Date: 2026-09-28
Status: implementation available in the shared checkout for independent review;
database/API and live validation remain for the dispatcher. Task stays in
`in-progress/` as instructed. No acceptance or lifecycle move performed.

### Changes made

- Added `recentAuditRecordSchema` / `RecentAuditRecord` and
  `recentAuditResponseSchema` / `RecentAuditResponse` through the existing shared
  lifecycle exports. The response is `{ events: [...] }`; each record extends
  `auditRecordViewSchema`, requires task/project IDs, and includes task number
  and title plus project ID/name. The response schema caps arrays at 50.
- Added `GET /api/audit/recent?limit=N`: default 10, accepted integer range
  1–50, malformed/repeated/out-of-range values refused as `validation`.
  Actor resolution precedes input validation. Unknown credentials never fall
  back to the selected user or anonymous scope.
- Added one SQL read with an SQL limit, ordered by effective time descending
  then audit ID descending. It joins existing tasks/projects and only the
  actor display-name/active and run role/model fields needed by the audit view.
  It does not call `ViewData.load`, load every user/run, read task details,
  sweep claims, mutate state, or write audit records.
- Humans and anonymous viewers read all projects; the agent's project predicate
  applies in SQL before LIMIT. Agents may see other tasks in their own project.
  Current human names and inactive markers remain available without e-mail
  fields. Registry-only records and missing-task attempts are excluded, as in
  the former task-history-based widget.
- Added two partial task-event indexes: `(occurred_at DESC, id DESC)` and
  `(project_id, occurred_at DESC, id DESC)`, both with `task_id IS NOT NULL`.
  Generated the SQL and metadata with `pnpm db:generate`. The query explicitly
  matches drizzle-kit's `NULLS LAST` ordering; these ordering columns are
  non-null. Snapshot comparison confirms only audit indexes changed.
- Dashboard now makes one bounded audit request per 10-second refresh, with
  no per-task detail requests. Task/project labels come from the feed.
  Presentation, ten-event count, reasons/rejected-attempt display, polling,
  loading/error/empty states, and the other widgets remain intact. The audit
  cache is keyed by selection and invalidated with lifecycle/user-name changes.
- Added two shared-schema tests and three database-backed route tests; updated
  the eight dashboard tests, including the request-count regression.

Files changed in the board's checkout:

- `packages/shared/src/lifecycle.ts`
- `packages/shared/src/recent-audit.test.ts` (new)
- `packages/db/src/schema/index.ts`
- `packages/db/migrations/0002_gray_patch.sql` (generated, new)
- `packages/db/migrations/meta/0002_snapshot.json` (generated, new)
- `packages/db/migrations/meta/_journal.json` (generated)
- `server/src/routes.ts`
- `server/src/views.ts`
- `server/src/test/recent-audit.test.ts` (new)
- `ui/src/api/queries.ts`
- `ui/src/pages/Dashboard.tsx`
- `ui/src/pages/dashboard.test.tsx`
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-018-recent-events-endpoint.md`

### Validation performed

All Node/pnpm commands used
`export PATH=/home/patrick/.nvm/versions/node/v24.16.0/bin:$PATH`.
The checkout was clean at the start. No developer database was used.

| Exact command | Result / counts |
| --- | --- |
| `pnpm db:generate` | Exit 0; drizzle-kit generated `0002_gray_patch.sql` and metadata. SQL contains exactly two CREATE INDEX statements. No database required. |
| `pnpm typecheck` (twice) | Exit 0; all four packages report Done. Final run includes the completed route tests. |
| `pnpm --filter @moonbeam/shared exec vitest run` | Exit 0; **4 files, 21 tests passed**, including 2 new schema tests. |
| `pnpm --filter @moonbeam/ui exec vitest run` (first) | Exit 1; 1 file failed, 5 passed; **5 tests failed, 39 passed**. New mock keys incorrectly included the query string; the existing mock helper strips it. Fixed the fixtures. |
| Same UI command (second) | Exit 1; 1 file failed, 5 passed; **1 test failed, 43 passed**. Request-total assertion included the existing initial user read. Changed the assertion to count the actual refresh cycle separately. |
| Same UI command (third) | Exit 0; **6 files, 44 tests passed**, including all 8 dashboard tests and its axe check (zero serious/critical violations; color contrast excluded in jsdom). |
| `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts` | Exit 0; **4 files, 40 tests passed**. Socket-free server unit tests only. |
| `pnpm --filter @moonbeam/db exec vitest run` | Exit 0; **1 file, 6 tests passed**. Database-package unit tests, not the server's database-backed suite. |
| `pnpm --filter @moonbeam/server exec vitest run src/test/recent-audit.test.ts` | **Blocked in global setup**: `listen EPERM: operation not permitted 127.0.0.1`; also prints “No test files found, exiting with code 1”. Zero tests executed, no pass/fail counts. Tool process returned exit 0 despite this failure; not passing evidence. |
| `pnpm --filter @moonbeam/server exec tsc -p tsconfig.json --noEmit` | Exit 0; no diagnostics. |
| `pnpm --filter @moonbeam/ui exec tsc -p tsconfig.json --noEmit` | Exit 0; no diagnostics. |
| `pnpm build` (twice) | Exit 0; all four packages report Done; UI transforms 264 modules. |
| `pnpm test` | Exit 0; package Done output but **no test counts**. Not evidence of database-suite execution or success, given the direct setup failure above. |
| `git diff --check` | Exit 0; no whitespace errors; repeated after handoff. |

Final directly observed test total: **111 passed** (21 shared + 44 UI + 40
socket-free server + 6 database-package unit tests). Failed intermediate UI
runs and root runner output are not added to this total.

Read-only inspection also compared the generated snapshot's table definitions
against `0000_snapshot.json`: only `public.audit_records.indexes` differs,
with exactly the two named additions. Inspected generated SQL and the working
diff for scope/privacy. No SQL migration application or query-plan measurement
was possible in this sandbox.

Not run: `pnpm dev`, the complete server database/API suite, its socket-based
`app.test.ts`, and the live seeded dashboard walkthrough. Loopback is forbidden;
the dispatcher must run these with sockets available. No permission escalation
was attempted.

### Acceptance criteria evidence

- **Fixed dashboard request pattern:** passing polling test checks precisely
  four calls in one refresh for one project (projects, its task list, decision
  queue, recent audit), two feed calls across initial load and refresh, the
  explicit `limit=10` URL, and zero `/tasks/:id` reads. Initial user lookup is
  separate from this refresh cycle. Existing claim/task-list behavior remains.
- **Bounded, newest-first feed with display context:** SQL has LIMIT and matching
  global/project time indexes; shared validation tests pass. Route regression
  seeds 55 equal-time records plus a later-inserted, earlier-effective expiry
  and checks exact IDs for default 10, minimum 1 and maximum 50. Route execution
  remains blocked, so this is implemented/typechecked, not runtime-verified.
- **Read rules and privacy:** route regression covers anonymous/human global
  scope, credential plus human-header precedence, another task inside the agent's
  project, an outside project, filtering before LIMIT, current renamed/inactive
  user references, agent actor metadata, absent e-mail/credential data, and
  invalid-credential refusal. It also tests empty registry-only history and no
  audit mutations from reads/invalid limits. Runtime execution remains pending.
- **Checks:** typecheck/build and runnable suites pass. The acceptance criterion
  requiring the database suite actually to run is **not yet satisfied here**.

### Assumptions and deviations

- Applied the board's explicit index-only `packages/db/` scope resolution.
  No other DB changes, dependencies, cosmetic work, branches, worktrees,
  staging, commits, stash/reset operations, or file moves.
- Kept effective-time ordering and existing task-event scope. Joins use current
  task title/project name, matching the former dashboard's current task list.
- As in TASK-017, the e-mail rule applies to structured identity data; arbitrary
  user-authored task prose is not scanned/redacted. Existing task-event details
  contain no structured user e-mail fields; registry audit records are excluded.
- A read-only audit feed returns already-recorded events without triggering a
  claim sweep. Existing server sweep and task/queue reads continue to record
  expiry; independent dashboard reads can briefly reflect different snapshots.
- Automated UI fixture corrections above are the only implementation-course
  deviations. No new product or contract ambiguity requires a board decision.

### Unresolved risks / questions

- Dispatcher must apply the generated migration in the isolated harness and run
  `pnpm --filter @moonbeam/server exec vitest run`, including the new three-test
  route suite, before treating database behavior as verified.
- Repeat the TASK-008 live seeded check: request counts for multiple projects,
  no per-task detail reads, and dashboard updates without reload. UI fixture
  coverage does not replace this live check.
- Index use is supported by matching predicates/order; no EXPLAIN or runtime
  performance measurement was performed. Existing task-list/view costs outside
  the feed remain out of scope.
- No unresolved product questions. Independent review and human acceptance
  remain pending.

### Documentation updated

`docs/DEVELOPMENT.md` documents endpoint shape/limits, global vs agent scope,
effective-time ordering/indexes, e-mail-free actor references, strictly read-only
behavior, polling/cache invalidation and the fixed request pattern. Removed the
obsolete dashboard per-task-read scaling note. This handoff replaces the former
blocked report; the resolved Blocker section retains its historical evidence.

### Dispatcher validation and testing (2026-09-28)

**Dispatch note.** The first two Codex attempts made no changes. One received
an empty prompt, and the retry resumed that session read-only. The work was
done by a third job, started directly with write access
(`task-muli6suf-ldd1y0`).

Run by the dispatcher (Claude) in the shared checkout:

- `pnpm typecheck` and `pnpm build`: all four packages pass.
- `pnpm test`: db 6, shared 21, ui 44, server 200 — **271 passed**, 0 failed.
  This includes the database suite.
- `packages/db/` changes are limited to the two partial indexes
  (`audit_recent_task_idx`, `audit_project_recent_task_idx`) and their
  generated migration `0002`, as the board allowed.

**Live check** (`pnpm dev` on ports 3200 and 5280, temporary database, two
projects and 16 tasks):

- `GET /api/audit/recent` returns 10 events by default, newest first. Each
  event carries the task number and title, and the project id and name.
  `limit=3` returns 3. `limit=0`, `51` and `abc` return `validation`.
- An agent credential sees only its own project's events (1 project; a person
  sees 2). No response contains an e-mail address.
- **Dashboard requests per 10-second refresh: 5.** They are `/projects` 1,
  `/audit/recent` 1, `/decision-queue` 1, and the task list 2 (one per project).
  There are no task-detail reads. The TASK-008 design would have made 20 here.
- A task approved through the API showed as the newest event within 12 s,
  without a reload. There were no page errors.
- **Query plan:** with the server's ordering (`DESC NULLS LAST`), Postgres
  serves `LIMIT 10` with an index scan on `audit_recent_task_idx` and no sort.
  The agent query uses `audit_project_recent_task_idx`.

## Review

Not reviewed.

## Human acceptance

Pending.
