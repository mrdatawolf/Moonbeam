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

TASK-038 implemented in the shared `main` checkout; ready for dispatcher review and manual checking. The task remains in `in-progress/`, uncommitted and not accepted.

### Files changed and interactions

- `ui/src/pages/Project.tsx`: project overview, task summaries, twelve-week activity, and full completed list.
- `ui/src/pages/ProjectTask.tsx`: parsed fields, problems, historical records, complete events, flags, and rendered task files.
- `ui/src/pages/ProjectDocuments.tsx`: goals, contract/ADR lists and metadata, document pages, and snapshot-head checks for rendered files.
- `ui/src/components/Markdown.tsx`: read-only GFM rendering, safe external links, HTML exclusion, and omitted image embeds.
- `ui/src/components/SourceStatus.tsx`: source status, head/poll metadata, viewer refresh, project navigation, and GitHub file links.
- `ui/src/components/FlagList.tsx`: all flag statuses, inline evidence, commit/file links, attribution, audit history, and required-note dismiss/reopen dialogs.
- `ui/src/api/queries.ts`: schema-validated project/file/flag queries, refresh and note mutations, and cache invalidation.
- `ui/src/App.tsx`: overview, completed-list, task, document-list, and document-detail routes.
- `ui/src/test/fixtures.tsx` and `ui/src/pages/project.test.tsx`: mocked API fixtures and 15 new interaction, security, and accessibility tests.
- `docs/DEVELOPMENT.md`: current UI routes, rendering safeguards, refresh behavior, and testing conventions.
- `tasks/in-progress/TASK-038-ui-project-view.md`: this Implementation handoff only.

### Outside-path changes

- `ui/src/pages/Projects.tsx`: added the router Link import and linked each existing project heading to its new overview. This minimal integration follows directly from TASK-038 and uses the standing board allowance. No registration behavior changed.

### Validation

Commands used the instructed Node/pnpm PATH and `pnpm_config_verify_deps_before_run=false` to prevent automatic installation.

- `pnpm --filter @moonbeam/ui test`: passed, 55 tests across 6 files, including axe checks. The initial run had two test assertion errors, corrected before the passing runs.
- `pnpm typecheck`: passed across all five packages.
- `pnpm -r --reporter=append-only run test`: passed, 410 tests across 34 files: db 6, shared 4, dbc 182, server 163, UI 55. Per-package results inspected; no failures.
- `pnpm build`: passed across all five packages. Vite warned that the minified JavaScript chunk is 609.45 kB, above its 500 kB warning threshold.
- `git diff --check`: passed.

UI tests mocked every API request and never contacted a real server or GitHub. All launched validation processes finished. No dev server, dependency installation, pnpm-store change, or git write command was run.

### Acceptance criteria evidence

- D1–D9: overview shows registration/source/lead/count fields, proposal and approval records and elapsed times, FL-5 applicability, dependencies and states, acceptance/acceptor/duration, other states, weekly activity, and flags. The completed section links to the full completed list. Task detail includes parsed and unknown fields, Paths, problems, historical approval/acceptance records, full event facts, and rendered files. Documents expose goals and contract/ADR metadata, statuses, unreadable states, and rendered pages. Missing related IDs remain unlinked and marked “not found on main.”
- D10/UX6: controls describe Moonbeam reads and notes. GitHub links open GitHub; no repository lifecycle controls are offered.
- UX1/N6/S7: every project screen displays head and last successful poll time, explains unpushed-work visibility, and labels non-current data while retaining the last known snapshot.
- UX2: source status and flags have separate labeled sections.
- UX3: evidence is visible inline as escaped structured text, with attribution and links to primary/nested commits and files on GitHub.
- UX4: wording describes observed states, recorded facts, and Moonbeam notes.
- UX5: current and historical task fields carry their API format labels; FL-7 not-v1 evidence is explicitly labeled.
- FG4: dismiss/reopen requires an active selected user and trimmed nonempty note. Refusals retain text; clearing selection disables submission. History shows actors, times, transitions, and notes. Dismissed, resolved, and withdrawn flags remain visible.
- S5: any viewer can refresh; successful polling invalidates project reads and file text. Tests cover overview/document updates, source failures, refresh refusal, and mismatched file heads.
- R4/V7: react-markdown and remark-gfm skip raw HTML, restrict links to HTTP(S)/mailto, and omit image embeds. Malicious-content tests assert no script, iframe, image, handler attribute, unsafe link, or execution marker; GFM tables still render.
- I7/I8: unmatched recorded names and authors are labeled “not a board member”; commit identity and committer facts remain visible.
- UI validation: all 55 tests pass, including axe checks on overview, task, document, and note-dialog views.

### Assumptions, deviations, and remaining checks

Used the already-installed Markdown dependencies; package manifests and lockfile were unchanged. Evidence uses readable escaped JSON to preserve every supplied field. Relative Markdown links resolve against the GitHub file URL; images display alt text. A file response from a different head is withheld with refresh guidance. Existing API read projections determine task grouping and durations.

The manual `pnpm dev` check was not run, as explicitly instructed; the dispatcher must perform it. Browser visual review and color-contrast checks remain outstanding. Bundle splitting is deferred; the build warning is recorded above. No implementation blocker remains. Lifecycle moves, commits, independent review, and acceptance remain with the dispatcher/board.

**Dispatcher check:**

- The outside-path change to `ui/src/pages/Projects.tsx` is a `Link` import
  and a link around each project heading.
- Re-ran `pnpm typecheck` (passes) and `pnpm -r run test`: 410 passed (db
  6, shared 4, dbc 182, server 163, ui 55).
- **No `pnpm dev` smoke check this time.** Without a configured GitHub token
  no project can be registered, so every new screen would show only its empty
  state. The first real end-to-end check needs a token file and a registered
  repository. TASK-040 (the V9 walk-through against this repository) is the
  natural place for it.
- **Open for the board:**
  - a browser visual review and color-contrast check
  - Vite warns that the main JS chunk is 609 kB; code splitting is deferred,
    and cosmetic work waits until Moonbeam works end to end

## Review

Not reviewed.

## Board notes

**Dispatcher, 2026-09-29.** The first Codex run declared `react-markdown`
`^10.1.0` and `remark-gfm` `^4.0.1` in `ui/package.json` and stopped, as
instructed. The dispatcher ran `pnpm install` against the default store: 97
packages added, `pnpm-lock.yaml` updated. The task runs again.

