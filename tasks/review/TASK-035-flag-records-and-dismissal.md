# TASK-035: Flag records, dismissal, and reopening

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-009, ADR-007, ADR-008
Dependencies: TASK-034

## Desired outcome

Flags raised by the engine become durable records with the FG lifecycle. Board
members can dismiss and reopen them with notes. Flags are re-evaluated when
identities or registration settings change. Nothing ever blocks.

## Context

This task implements the TASK-034 `FlagSink`. FG7 and ADR-009 say flag records,
dismissals, and notes live only in Moonbeam's audit trail.

## Scope

### Included

- **`server/src/flags/sink.ts`:** reconciliation, inside the poll transaction.
  - **Condition flags and FL-8:**
    - held with no open row: insert an open row, unless a dismissed row exists for the subject
    - FL-5 dismissed: re-raise a new open row once the dismissal is older than one threshold period (from the dismissal time)
    - open or dismissed rows no longer held: mark resolved (FG3; FL-8 through I6)
  - **Event flags:**
    - insert open rows for new subjects; otherwise refresh the evidence of open rows
    - rows whose `commit_sha` is no longer on the chain become withdrawn (FG5) and are listed in the FL-10 evidence
  - **FL-10:** inserted as an open event flag.
  - Each raise, resolve, and withdraw writes an audit record (system actor `poller`, with `flag_id`).
- **`server/src/flags/service.ts`:** dismiss and reopen (FG4) with a required non-empty note.
  - Requires a selected user.
  - Writes an audit record with `flag_id`, the note, and the status before and after.
  - Reopen sets the status back to open, provided no other open row exists for the same subject.
- **`server/src/flags/reevaluate.ts`:** after identity changes (all projects) and registration changes to the baseline, exempt paths, or threshold (that project), recompute flags from the stored snapshot, without GitHub, and reconcile.
- **Hooks** in the projects and identities services.
- **Routes:**
  - `GET /api/projects/:id/flags?status=`
  - `GET /api/flags/:id` (with its notes history from the audit trail)
  - `POST /api/flags/:id/dismiss`
  - `POST /api/flags/:id/reopen`
- `packages/shared/src/flags.ts`.
- Tests.
- `docs/DEVELOPMENT.md`.

### Excluded

- Views and the UI (TASK-036, TASK-038).
- Writing anything to a repository (FG7).

### Paths

- `server/src/flags/`
- `server/src/projects/`
- `server/src/identities/`
- `server/src/index.ts`
- `server/src/routes.ts`
- `server/src/test/harness.ts`
- `server/src/test/flags.test.ts`
- `packages/shared/src/flags.ts`
- `packages/shared/src/index.ts`
- `docs/DEVELOPMENT.md`

## Plan

1. The sink with its reconciliation rules, tested against fixture repositories through the poller.
2. The dismiss and reopen service and routes.
3. The re-evaluation hooks.
4. Documentation.

## Acceptance criteria

- [ ] FG1: each record carries its rule, subject, project, first raised time, evidence, and status (open, dismissed, resolved, or withdrawn).
- [ ] FG2:
  - repeated polls, a rebuild from a deleted snapshot and mirror, and a server restart never create a second open flag for a rule and subject
  - dismissals and notes survive all of them
  - two concurrent reconciliations do not duplicate a row
- [ ] FG3: condition flags resolve when their condition clears. Event flags stay open until dismissed, except for FL-8 and FG5.
- [ ] FG4:
  - dismissing and reopening need a selected user and a non-empty note
  - who, when, and the note are recorded
  - both are reachable from `GET /api/flags/:id`
- [ ] FG5: after a rewrite, event flags on dropped commits become withdrawn and are listed in the FL-10 evidence. Their dismissal records are kept.
- [ ] FG6 and N5: no code path reads flags to allow or refuse anything.
- [ ] FG7: flags, dismissals, and notes are stored only in Moonbeam, and each change has an audit record carrying `flag_id`.
- [ ] FL-5: a dismissed stale approval is re-raised as a new flag after one further threshold period if the task is still only in `approved/`.
- [ ] I6 and V6: adding the e-mail that an FL-8 lacked resolves that FL-8 without a GitHub call.
- [ ] V8: dismiss, reopen, persistence across a restart, the FL-5 re-raise, and withdrawal after a rewrite are all tested.

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`). Record the counts.

## Risks and assumptions

- The following are assumptions (TASK-023 questions 5, 6, 7, 9):
  - the FL-5 re-raise counts from the dismissal time
  - a withdrawn flag whose commit returns becomes a new flag
  - a dismissed condition flag whose condition clears becomes resolved
  - raising, resolving, and withdrawing flags writes audit records

## Blocker

None.

## Implementation handoff

Implemented TASK-035 in the shared main checkout. Ready for independent review; task remains in-progress for the dispatcher and is not marked accepted.

Files changed:

- `server/src/flags/sink.ts`
- `server/src/flags/service.ts`
- `server/src/flags/reevaluate.ts`
- `server/src/projects/service.ts`
- `server/src/identities/service.ts`
- `server/src/index.ts`
- `server/src/routes.ts`
- `server/src/test/harness.ts`
- `server/src/test/flags.test.ts`
- `packages/shared/src/flags.ts`
- `packages/shared/src/index.ts`
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-035-flag-records-and-dismissal.md` (Implementation handoff only).

Public API and endpoints:

- `flagSink.apply(tx, input)` implements the existing poller sink. Startup and the harness inject it; no poller, GitHub, DbC, or schema files changed.
- `FlagsService.list/get/dismiss/reopen`; `reevaluateFlags(tx, now, projectId?)` and `reevaluateAll(db, now)`.
- `GET /api/projects/:id/flags?status=` returns `{ flags }`, all statuses with open first when omitted, or the requested status.
- `GET /api/flags/:id` returns the flag plus chronological audit `history`, including actors, times, notes, and before/after values.
- `POST /api/flags/:id/dismiss` and `/reopen` accept `{ note }` and return the updated flag. Both require a selected user and nonempty trimmed note.
- Shared exports: flag status, record, note-input, audit, detail, and list schemas; `FlagView`, `FlagDetail`, and `FlagStatus`.
- Harness `restartServer()` recreates HTTP, application services, and scheduler against the retained database and temporary home.

Validation (Node/pnpm path prepended as instructed):

- `pnpm typecheck`: passed across all five packages.
- `pnpm -r --reporter=append-only run test`: 359 passed across 32 files; db 6, dbc 182, shared 4, server 146, UI 21. Per-package results inspected; no failures.
- `pnpm --filter @moonbeam/server exec vitest run`: separately passed, 146 tests across 12 files, including the database/API suite and 14 new flag tests.
- `pnpm build`: passed across all five packages.
- `git diff --check`: passed.
- Tests used TASK-034 local git/HTTP fixtures, temporary homes, and isolated Postgres. No real GitHub or real `~/.moonbeam` access. All task-started servers, schedulers, database processes, and subprocesses stopped.

Acceptance evidence:

1. FG1: persisted records and validated responses carry rule, subject, project, first-raised time, evidence, and all four statuses.
2. FG2: project-scoped transaction locks serialize reconciliation and human changes; the existing unique index remains a second safeguard. Tests cover concurrent reconciliation, repeated polls, deleted snapshot/mirror rebuilds, and HTTP/service/scheduler restart with unchanged IDs and dismissal notes.
3. FG3: absent conditions resolve, including dismissed rows; recurrence raises a new record. FL-8 resolves on full re-evaluation, while conditions-only polls preserve events. Other events remain open/dismissed when registration excludes their original evidence.
4. FG4: missing users and empty notes are rejected; dismiss/reopen record selected user, time, note, and before/after status. Detail history exposes both. Concurrent action and conflicting-reopen tests pass.
5. FG5: rewrite reconciliation withdraws events on dropped commits, preserves their audit history, and includes their records in FL-10 evidence under `withdrawnFlags`. Returning withdrawn subjects receive new records.
6. FG6/N5: flags never gate project, identity, repository, or polling actions. Only flag lifecycle operations check flag status, as required for dismissal/reopening.
7. FG7: all flag changes, including evidence refreshes, append audit records with `flag_id` in the same transaction. Automatic changes use system actor `poller`. Rollback and unchanged remote-ref tests pass.
8. FL-5: a new occurrence is raised strictly after the current threshold elapses from the latest dismissal for that subject; boundary and repeated-dismissal tests pass.
9. I6/V6: adding the missing email resolves FL-8 immediately without a source call. Identity removal, automatic registry email edits, all-project re-evaluation, and concurrent polling are tested.
10. V8: dismissal, reopening, restart persistence, FL-5 re-raising, and rewrite withdrawal are covered by database-backed tests.

Assumptions, deviations, and remaining limits:

- No scope/dependency deviations, installation, pnpm-store changes, or repository git write commands. Unrelated task moves from review to completed appeared during execution and were left untouched.
- Explicit identity edits and relevant registration edits reconcile within their transactions. Registry API additions/name/email edits trigger re-evaluation after the existing registry transaction commits because the registry implementation is outside this task's paths. Direct RegistryService callers do not invoke that route hook; hook failure cannot undo a committed registry edit.
- Missing/incompatible snapshots wait for the next poll. A simultaneous tracked-branch change defers re-evaluation until polling replaces the old branch snapshot. Baseline validation retains the existing source calls; re-evaluation itself makes none.
- Dismissal applies to open rows; reopening applies to dismissed rows. Resolved and withdrawn records retain their history. Archived project flags remain readable.
- Restart validation recreates the HTTP server, services, and scheduler in-process against the same database; it does not restart the Node executable or Postgres.
- No unresolved implementation blocker. Independent review and board acceptance remain outstanding.

**Dispatcher check:**

- Changes are within the task's paths. The default pnpm store is intact.
- Re-ran `pnpm typecheck` (passes) and `pnpm -r run test`: 359 passed (db
  6, shared 4, dbc 182, ui 21, server 146).
- **Note for review:** changes to the user registry (add a user, rename,
  e-mail edit) trigger flag re-evaluation from the route, after the registry
  transaction commits, because `registry.ts` is outside this task's paths.
  A failure in that hook can't undo the registry edit. The next poll
  re-evaluates anyway.

## Review

Not reviewed.
