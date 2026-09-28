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
Status: blocked on index migration scope; implementation not started.

### Changes made

Recorded the index evidence and board question above. No endpoint, shared
schema, dashboard, tests or development documentation changed.

Files changed:

- `tasks/in-progress/TASK-018-recent-events-endpoint.md`

### Validation performed

- `git status --short`: exit 0, clean checkout before this task-file edit.
- `sed -n '314,355p' packages/db/src/schema/index.ts`: exit 0; inspected audit
  columns and all declared audit indexes.
- `rg -n 'occurred_at|CREATE INDEX.*audit|occurredAt' packages/db/migrations server/src/audit.ts`:
  exit 0; confirmed migrations contain no effective-time index and audit writes
  accept an effective time distinct from recording time.
- `git diff --check -- tasks/in-progress/TASK-018-recent-events-endpoint.md`:
  exit 0; no whitespace errors.

Automated test commands run: none; 0 tests executed. Typecheck, shared/UI tests,
server unit tests and build were not run because the explicit scope blocker
stopped implementation before code changes. Database/API suites and the live
check remain for the dispatcher with loopback permitted; this sandbox cannot
open loopback sockets. Root `pnpm test` was not used as evidence.

### Acceptance criteria evidence

No implementation acceptance criteria are claimed met. Existing dashboard
per-task reads and the development guide's scaling note remain in place.

### Assumptions and deviations

Preserve the existing effective-time ordering with descending audit ID as the
tie-breaker. A SQL limit alone limits response rows but does not avoid scanning
history for this ordering without a supporting index. The stop follows the
explicit dispatch constraint; no scope expansion, git write, lifecycle move,
branch or worktree was performed.

### Unresolved risks / questions for the board

Authorize the database schema/migration paths described in Blocker before
implementation resumes. Database suite and live request-count/polling validation
will still require the dispatcher. No acceptance or independent review claimed.

### Documentation updated

Only this task file; `docs/DEVELOPMENT.md` remains accurate for the unchanged
implementation.

## Review

Not reviewed.

## Human acceptance

Pending.
