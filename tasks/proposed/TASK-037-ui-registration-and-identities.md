# TASK-037: UI for project registration, lead developer, and identities

Owner role: Implementer
Assigned agent: openai-coder (Codex); interface-designer if the board prefers
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by:
Approved date:
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

Not started.

## Review

Not reviewed.
