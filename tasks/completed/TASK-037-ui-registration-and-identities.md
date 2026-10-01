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

TASK-037 implemented; ready for dispatcher review and manual checking.
Implementer: Codex. Date: 2026-09-29. Shared checkout, branch `main`.

### Changes made

- `ui/src/pages/Projects.tsx`: registration list, inline editor, lead assignment/change/clear, confirmed removal, and redirect guidance.
- `ui/src/components/ProjectForm.tsx`: registration fields, GitHub URL entry, masked token-label selector, defaults, validation, and retained input after refusals.
- `ui/src/components/Identities.tsx`: per-member automatic e-mail and stored identities, add/remove controls, confirmation, and conflict warnings naming all involved members.
- `ui/src/pages/Users.tsx`: identities section and corrected observational e-mail wording; existing registry actions remain available.
- `ui/src/api/queries.ts`: registration, token, source-metadata, and identity hooks; mutation invalidation also refreshes identities after registry changes.
- `ui/src/test/fixtures.tsx`: schema-valid project/identity fixtures and mocked reads.
- `ui/src/pages/Projects.test.tsx` and `ui/src/pages/users.test.tsx`: interaction, refusal, gating, refresh, and axe coverage. Existing setup and registry tests retained.
- `tasks/in-progress/TASK-037-ui-registration-and-identities.md`: replaced only this Implementation handoff section.

### Outside-path changes

- `ui/src/api/client.ts`: added `DELETE` to the Method union, as specifically authorized by the board. No other outside-path changes.

### Validation performed

Commands used `/home/patrick/.nvm/versions/node/v24.16.0/bin` prepended to PATH and `pnpm_config_verify_deps_before_run=false` to prevent automatic installation.

- `pnpm --filter @moonbeam/ui test`: passed, 40 tests across 5 files, including axe checks. An initial run exposed four URL-entry failures; these were fixed before the passing runs.
- `pnpm typecheck`: passed for all five workspace packages.
- `pnpm -r --reporter=append-only run test`: passed, 395 tests across 33 files: db 6, shared 4, dbc 182, UI 40, server 163. Per-package output checked; no failures.
- `pnpm build`: passed for all five workspace packages.
- `git diff --check`: passed.

UI tests use mocked API responses; no real server or GitHub calls were made by them. No dependency installation, pnpm store change, dev server, or git write command was run. All launched validation processes finished.

### Acceptance criteria evidence

- S1: owner/repository, optional name, branch, token label, lead, baseline, exempt paths, and threshold are editable. GitHub repository URLs fill owner/repository. Defaults show `main`, head at registration, no exempt paths, and 14 days.
- S4: configured labels show only their API-provided masked values. There is no token-value input; missing/unreadable configuration is explained.
- L1: registration supports an initial lead; each listed registration supports assigning, changing, or clearing its lead. Unassigned projects show “No lead developer.” Inactive existing leads are labeled; new assignments offer active users.
- I1: e-mails, logins, and aliases can be added and removed, including for inactive members. Registry e-mail is marked automatic and directs users to registry editing instead of offering removal.
- I4: every returned conflict names its identity and all involved members, with inactive markers, in a warning banner.
- Action gating/refusals: writes require a selected active user and connection, with the existing “Choose who you are” affordance. Categorized refusals preserve registration, lead, and identity input. Tests exercise viewer gates, connection loss, and stale selection.
- Removal: confirmations explain that Moonbeam's data is kept. Successful 204 responses refresh the lists; refusals keep confirmation visible.
- UX6: controls describe Moonbeam registrations and identities, with no repository action. F4 guidance displays “Now at owner/repository; update the registration” when source metadata supplies a redirect.
- UI tests: all 40 pass, including axe checks on registration/identity screens and removal dialogs.

### Assumptions and deviations

Lead edits use the separate lead-developer endpoint. Registration edits send only changed fields, preserving the API's new-head baseline behavior when changing branch without an explicit baseline change. The existing read-only project-view endpoint supplies only the source metadata needed for redirect guidance; no per-project screen was added. Token selection can retain the API's owner-label default. No new dependencies or architectural changes were needed.

### Unresolved risks and documentation

The dispatcher still needs to perform the requested manual browser check; axe checks do not replace visual review. No implementation blocker remains. This handoff is the only documentation change. The task remains in `tasks/in-progress/`; lifecycle moves, commits, review, and acceptance remain with the dispatcher/board.

**Dispatcher check:**

- The only outside-path change is the board-approved `DELETE` in
  `ui/src/api/client.ts`.
- Re-ran `pnpm typecheck` and `pnpm -r run test`.
- **Manual smoke check** (HTTP through the Vite proxy, no browser available).
  The app ran with `pnpm dev` against a scratch `MOONBEAM_HOME` and a
  Postgres port of 54331, not the board's `~/.moonbeam`.
  - First-run setup worked.
  - Adding an e-mail, a login, and an alias returned 201 each. The registry
    e-mail is listed as automatic.
  - A change without a selected user returned 401 `unidentified`.
  - Deleting an identity returned 204.
  - With no token file, the token list reported `missing`, and registration
    returned 422 "Token not configured".
  - `/`, `/projects`, and `/users` served 200.
  - The app was stopped afterwards, and the ports are closed.
- Not done: a visual review in a browser.

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

