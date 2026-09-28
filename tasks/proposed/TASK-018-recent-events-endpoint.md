# TASK-018: A read-only "recent events" endpoint for the dashboard

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by:
Approved date:
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

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
