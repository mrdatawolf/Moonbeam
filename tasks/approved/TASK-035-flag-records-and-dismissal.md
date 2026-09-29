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

Not started.

## Review

Not reviewed.
