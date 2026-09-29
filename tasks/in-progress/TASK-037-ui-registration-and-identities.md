# TASK-037: UI for project registration, lead developer, and identities

Owner role: Implementer
Assigned agent: openai-coder (Codex); interface-designer if the board prefers
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-008, ADR-003
Dependencies: TASK-033

## Desired outcome

Board members can register GitHub projects, edit or remove registrations,
assign lead developers, and manage each member's e-mails, logins, and aliases in
the UI. Conflicts are shown as warnings.

## Context

This task uses the TASK-033 endpoints and replaces the TASK-026 Projects
placeholder. The per-project view comes in TASK-038. Cosmetic polish is deferred
(board, 2026-09-28).

## Scope

### Included

- **The Projects page:**
  - the list of registrations: name, owner and repository, branch, lead developer
  - the register form: owner and repository (pasting a GitHub URL is also accepted), optional name, branch, a token label chosen from the masked list, lead developer, and optional baseline, exempt paths, and threshold
  - edit and remove
  - lead developer assignment
  - the F4 guidance "update the registration" when the API reports a redirect, if that data is present
- **The Users page:** an identities section per member (the automatic CONTRACT-002 e-mail, added e-mails, logins, aliases), with add and remove, and a conflict warning banner (I4).
- The query hooks.
- Test fixtures.
- Tests, including axe.

### Excluded

- The per-project view and dashboard (TASK-038, TASK-039).
- Visual polish beyond the existing tokens.

### Paths

- `ui/src/pages/Projects.tsx`
- `ui/src/pages/Projects.test.tsx`
- `ui/src/pages/Users.tsx`
- `ui/src/pages/users.test.tsx`
- `ui/src/components/Identities.tsx`
- `ui/src/components/ProjectForm.tsx`
- `ui/src/api/queries.ts`
- `ui/src/test/fixtures.tsx`
- `ui/src/App.tsx`

## Plan

1. Queries and fixtures.
2. The project list, the form, and the edit, remove, and lead-developer controls.
3. The identities component on the Users page.
4. Tests.

## Acceptance criteria

- [ ] S1: every registration field can be entered, and the defaults are shown (branch `main`; baseline "head at registration").
- [ ] S4: tokens are chosen by label, and only masked values are shown. The UI never asks for a token value.
- [ ] L1: the lead developer can be assigned, changed, or cleared. "No lead developer" is shown when there is none.
- [ ] I1: members' identities can be added and removed. The CONTRACT-002 e-mail is shown as automatic.
- [ ] I4: each conflict is shown as a warning naming the members involved.
- [ ] Actions are disabled without a selected user, with the existing "Choose who you are" affordance. Refusals are shown with their category, and the entered values are kept.
- [ ] Removal asks for confirmation and says that Moonbeam's data is kept (assumption, TASK-023 question 4).
- [ ] UX6: no control suggests an action on the repository.
- [ ] The UI tests pass, including axe checks.

## Validation requirements

- `pnpm --filter @moonbeam/ui test` during work.
- `pnpm typecheck`, `pnpm test`, `pnpm build` at handoff.

## Risks and assumptions

- This may run in parallel with the server tasks TASK-034 to TASK-036. Its paths are UI-only.

## Blocker

None.

## Implementation handoff

Blocked before implementation; not ready for review.

Task: TASK-037. Implementer: Codex. Date: 2026-09-29.

### Changes made

Only `tasks/in-progress/TASK-037-ui-registration-and-identities.md`, this
Implementation handoff section, changed. No screens or interactions were
implemented.

### Unresolved blocker

`ui/src/api/client.ts` excludes `DELETE` from its `Method` type. Both required
removal endpoints use DELETE and return 204. Reusing the existing client's
selected-user header, categorized refusals, selection invalidation, and
connection handling requires adding `DELETE` to that type. Empty success
responses can already be parsed by passing `z.undefined()` from the query hook.

The client file is outside the assigned Paths. Following the direct instruction
to stop if an outside file must change, implementation stopped without editing
it. The dispatcher/board needs to authorize that additional path or supply the
client extension before implementation resumes. No dependency is needed.

### Validation performed

These are baseline results, not validation of a TASK-037 implementation. Commands
used `/home/patrick/.nvm/versions/node/v24.16.0/bin` prepended to PATH and
`pnpm_config_verify_deps_before_run=false` to prevent automatic installation.

- `pnpm --filter @moonbeam/ui test`: passed, 21 tests across 5 files, including
  the existing axe checks.
- `pnpm typecheck`: passed for all five workspace packages.
- `pnpm -r --reporter=append-only run test`: passed, 376 tests across 33 files:
  db 6, shared 4, dbc 182, UI 21, server 163. No reported failures.
- `pnpm build`: passed for all five workspace packages.
- No installation, pnpm store change, dev server, or git write command was run.
  All launched validation commands finished; no validation process was left
  running. UI tests used the existing mocked API setup.

### Acceptance criteria evidence

- S1 registration fields/defaults: not implemented.
- S4 masked token selection: not implemented.
- L1 lead assignment/change/clear: not implemented.
- I1 identity add/remove and automatic e-mail: not implemented.
- I4 conflict warnings naming members: not implemented.
- Selected-user action gate, categorized refusals, and retained input for the
  new actions: not implemented.
- Removal confirmation and retained-data explanation: not implemented.
- UX6: no new controls were introduced; the requested screens remain pending.
- Existing UI tests and axe checks pass; TASK-037 coverage remains pending.

### Assumptions and deviations

The existing API client should remain the common transport for these actions;
duplicating its behavior in queries or casting around its method type would
bypass that convention. The only deviation is stopping for the path blocker
before implementation. No unrelated tracked changes were present or modified.
Task lifecycle and acceptance remain with the dispatcher/board.

### Documentation updated

This handoff only. The task remains in `tasks/in-progress/`.

## Review

Not reviewed.

## Board notes

**Patrick, 2026-09-29.** The first Codex run stopped because
`ui/src/api/client.ts` has no `DELETE` in its `Method` type, and the two
remove endpoints need it. The board adopted a standing rule (AGENTS.md,
"Dispatching to Codex"). Codex may make the smallest outside-path change that
only follows from the task's own work, and lists it in the handoff under
"Outside-path changes". So this task may add `DELETE` to that type. The task
runs again.

