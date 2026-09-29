# TASK-038: UI for the per-project view, task detail, documents, and flags

Owner role: Implementer
Assigned agent: openai-coder (Codex); interface-designer if the board prefers
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008, ADR-009, ADR-002
Dependencies: TASK-036, TASK-037

## Desired outcome

Anyone can open a project and see what CONTRACT-006 D1 to D10 lists:
- task detail and history
- rendered documents
- flags with their evidence

Board members can dismiss and reopen flags with notes, and any viewer can
refresh. Markdown is rendered safely.

## Context

This task uses the TASK-034 to TASK-036 endpoints. It adds a Markdown renderer
that doesn't render raw HTML. `react-markdown` with `remark-gfm` is proposed; it
is a new dependency within ADR-002's stack.

## Scope

### Included

- `/projects/:id` with sections D1 to D7.
- `/projects/:id/tasks/:taskId` (D8).
- `/projects/:id/documents` and document pages (D9, R4).
- **Components:**
  - `Markdown`: no raw HTML; links opened safely; `javascript:` URLs removed
  - `SourceStatus`
  - `FlagList` and `FlagDetail`, with the evidence inline (UX3), GitHub links for commits and files, and dismiss or reopen dialogs with a required note
  - a refresh button (S5)
- Routes in `App.tsx`, queries, fixtures, tests.
- `docs/DEVELOPMENT.md`: the UI section.

### Excluded

- The cross-project dashboard (TASK-039).
- Cosmetic polish.

### Paths

- `ui/src/pages/Project.tsx`
- `ui/src/pages/ProjectTask.tsx`
- `ui/src/pages/ProjectDocuments.tsx`
- `ui/src/pages/project.test.tsx`
- `ui/src/components/Markdown.tsx`
- `ui/src/components/SourceStatus.tsx`
- `ui/src/components/FlagList.tsx`
- `ui/src/api/queries.ts`
- `ui/src/App.tsx`
- `ui/src/test/fixtures.tsx`
- `ui/package.json`
- `pnpm-lock.yaml`
- `docs/DEVELOPMENT.md`

## Plan

1. Queries and fixtures from the TASK-036 schemas.
2. The project page sections, then task detail, then documents.
3. The flag list, detail, and dismissal.
4. The Markdown component with its safety tests.
5. Documentation.

## Acceptance criteria

- [ ] D1 to D9 are shown with every field listed in CONTRACT-006. D4 links to the full completed list.
- [ ] D10 and UX6: no control implies a change to the repository or GitHub. GitHub links open GitHub. Dismissal is presented as a note in Moonbeam.
- [ ] UX1 and N6: every project page shows the head commit and the last poll time, and says plainly when the data isn't current.
- [ ] UX2: source status and flags are visibly separate.
- [ ] UX3: each flag shows its evidence without leaving Moonbeam, and links to its commits and files on GitHub.
- [ ] UX4: the wording is observational.
- [ ] UX5: pre-v1 files are labeled wherever their fields are shown.
- [ ] FG4:
  - dismiss and reopen require a selected user and a non-empty note
  - the flag's notes history is shown
  - dismissed, resolved, and withdrawn flags are reachable (D7)
- [ ] S5: any viewer can refresh, and the result updates the page.
- [ ] R4 and V7: a Markdown fixture containing `<script>`, `onerror` attributes, an `<iframe>`, and a `javascript:` link renders without executing or embedding any of them. A test asserts that no script element or handler attribute is in the DOM.
- [ ] I7 and I8: unmatched authors are marked "not a board member".
- [ ] The UI tests pass, including axe checks.

## Validation requirements

- `pnpm --filter @moonbeam/ui test` during work.
- `pnpm typecheck`, `pnpm test`, `pnpm build` at handoff.
- A manual check with `pnpm dev` against a registered test repository, recorded in the handoff. Stop the dev server afterwards.

## Risks and assumptions

- New UI dependencies: `react-markdown` and `remark-gfm`. If the board prefers
  otherwise, use `marked` with `DOMPurify`.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
