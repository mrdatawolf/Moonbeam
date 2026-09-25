# TASK-007: Board UI: user select, projects, task board, decision queue

Owner role: UX specialist
Assigned agent: interface-designer (original build); rework 2026-09-25: openai-coder (Codex), continuing partial work by interface-designer
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001 (being superseded by CONTRACT-005), CONTRACT-002, CONTRACT-003 (status vocabulary, decision-queue groups, reusable parts)
Related ADRs: ADR-002, ADR-003
Dependencies: TASK-006 (overlapping paths: `packages/shared`)

## Desired outcome

A board member picks who they are, sees projects and their tasks by state,
performs the human transitions (approve, accept, return, cancel, claim,
release), and sees a decision queue of everything that needs a human.

## Context

Phase 2 board surface. Follow Paperclip's layered disclosure and systematic
status vocabulary. Paperclip's code may be adapted under its MIT license with
attribution.

## Scope boundaries at dispatch (dispatcher clarification, 2026-09-25)

These clarifications describe what this task means against the current
contracts and the API built in TASK-006. They do not widen it.

- **Build against the TASK-006 API.** See `docs/DEVELOPMENT.md` for the
  endpoints and the error mapping.
- **Editing a proposed task is out of scope.** CONTRACT-005 adds it, and
  TASK-016 builds it.
- **Follow CONTRACT-003 where it covers board screens:**
  - the status vocabulary (SV): tone, label, and glyph
  - the decision-queue groups that exist in phase 2: proposed tasks awaiting
    approval, tasks in review, blocked tasks, agent authority violations, and
    accepted but not merged
  - the reusable status badge
  - the accessibility and responsive rules
- **Out of scope:** runs, pauses, review content (phase 3), and the merge and
  push actions.
- **First-run setup and project registration screens are in scope,** using the
  TASK-006 endpoints.

## Scope

### Included

- A user picker persisted per browser.
- A project list and project creation or registration.
- A task list and board by state, with task detail.
- Proposing tasks from the UI.
- Transition actions.
- The decision queue.

### Excluded

- The dashboard (TASK-008). Run and review views (phase 3).

### Paths

- `ui/`
- `packages/shared/`

## Plan

## Acceptance criteria

- [ ] Every human transition is available only when the API allows it.
- [ ] The decision queue lists proposed tasks awaiting approval, tasks in
      review, and blocked tasks.

## Validation requirements

Manual walkthrough of a task from proposed to completed. UI build passes.

## Risks and assumptions

If shadcn/Radix is introduced, record it in `docs/DEVELOPMENT.md`.

## Blocker

None.

## Implementation handoff

Task: TASK-007
Implementer: interface-designer (Claude)
Date: 2026-09-25

### Changes made

All changes are under `ui/` and `docs/DEVELOPMENT.md`. There are no changes to
`server/` or `packages/shared/`, and no `THIRD_PARTY_NOTICES` file: Paperclip
was followed for patterns only (tone tokens, glyph-per-status, layered
disclosure), and no code was copied.

- **App shell and identity:** `ui/src/main.tsx`, `ui/src/App.tsx`, `ui/src/components/Layout.tsx`,
  `ui/src/lib/selection.ts`, `ui/src/lib/currentUser.tsx`.
  - The header has navigation and an "Acting as" user select. The selection is saved per browser in
    localStorage and followed across tabs.
  - Anyone can view with no user selected ("Nobody (view only)").
  - If the saved selection is no longer an active user, the header says so and asks the person to choose
    again. It never switches user silently.
  - An `unidentified` refusal clears the selection.
  - A "Connection lost. Retrying." banner appears when the server can't be reached, and actions are
    disabled with that reason.
- **API layer:** `ui/src/api/client.ts`, `ui/src/api/queries.ts`, `ui/src/api/connection.ts`.
  - Requests send `X-Moonbeam-User`, and responses are validated with the shared zod schemas.
  - Refusals become `ApiRequestError` with the server's failure category and details.
  - After an action, the returned task goes into the cache and the lists refresh. A `conflict` refreshes
    the view.
- **Status vocabulary (CONTRACT-003 SV, phase-2 subset):** `ui/src/lib/status.ts` and
  `ui/src/components/StatusBadge.tsx`.
  - Covers task states, conditions (Blocked, Blocked by parent, Paused), review verdicts, the review
    sub-status, the same-model warning, and Not merged.
  - Every status has a label, a tone, and a glyph whose shape differs within its family. Screen readers
    hear "family: label".
  - Tone tokens (fg, bg, border in light and dark) and shared utilities (`btn-*`, `field-input`, `card`)
    are in `ui/src/index.css`. `--color-muted-foreground` and `--color-primary` were darkened for contrast.
- **Screens:**
  - `pages/Setup.tsx`: first-run setup with users, e-mail addresses, and an optional projects root.
  - `pages/Projects.tsx`: the project list, register a project, and set or change the projects root.
  - `pages/Project.tsx`: tasks by state (board) and the queue in order, showing overlaps and move controls.
  - `pages/ProposeTask.tsx`: the T1 form. It warns up front when the task couldn't be approved yet, because
    proposed tasks can't be edited.
  - `pages/Task.tsx`: task detail with states and conditions, claimant and lease, blockers (with resolve),
    return notes, outcome and criteria, scope envelope, subtasks (read-only, with sibling move), handoffs,
    agent reviews (with the same-model flag), dependencies both ways, the decision record, and the audit
    history.
  - `pages/DecisionQueue.tsx`: the five phase-2 groups.
  - `pages/NotFound.tsx`: a not-found page.
  - `pages/Dashboard.tsx`: only its import path changed, and `<main>` became `<div>` to fit the shell.
- **Actions:** `ui/src/lib/actions.ts`, `ui/src/components/TaskActions.tsx`, `ui/src/components/MoveControl.tsx`.
  - Approve (with the no-paths notice), claim, release, break claim (reason required), and hand off
    (claimant; four-field record).
  - Accept, including accept without review with a required waiver reason, and warnings with "I've
    reviewed these".
  - If the server reports files outside the declared paths, the dialog asks for a reason. If it reports
    `merge_conflict`, the dialog switches to Return or Accept anyway, with an optional reason and no plain
    Accept.
  - Return (notes required), cancel (reason required; "Cancel task" or "Keep task"), add and resolve
    blockers, and queue or sibling move (D1) with confirmation. After a move, the dependency changes it
    caused are listed from the returned audit records.
  - Every action stays visible. Disabled actions give their reason through `aria-describedby`. Dialogs
    name the acting user.
  - Refusals appear next to the action with the plain category name and its code, and entered text is kept.
  - On success, focus moves to an in-place result message.
- **Shared pieces:** `ui/src/components/Dialog.tsx` (native `<dialog>`: focus trap, Escape, focus
  returns to the trigger), `ui/src/components/common.tsx` (time, task reference, empty, skeleton,
  load error, refusal, field), `ui/src/components/TaskCard.tsx`, `ui/src/lib/format.ts`, `ui/src/lib/paths.ts`
  (mirror of the server's path rule).
- **Tests and tooling:**
  - Added `ui/vite.config.ts` test config and a `test` script in `ui/package.json`.
  - Added dependencies: `zod`, plus dev dependencies `vitest`, `@testing-library/react`, `user-event`,
    `jest-dom`, `jsdom`, and `axe-core`. `pnpm-lock.yaml` is updated.
  - Test files: `ui/src/test/setup.ts`, `ui/src/test/fixtures.tsx`, `ui/src/lib/actions.test.ts`,
    `ui/src/lib/status.test.ts`, `ui/src/pages/pages.test.tsx`.
- **Docs:** a "Board UI (TASK-007)" section in `docs/DEVELOPMENT.md`.
- **Screenshots:** `ui/screenshots/TASK-007/01-first-run-setup.png` to `15-task-390-dark.png`.

### Validation performed

- `pnpm typecheck`: passed (all packages).
- `pnpm test`: passed. UI 20/20, server 131/131, shared 8/8, db 6/6.
- `pnpm build`: passed (UI bundle 475 kB, 140 kB gzip).
- Manual walkthrough in headless Chromium (Playwright) against `pnpm dev` with a scratch `MOONBEAM_HOME`
  and `MOONBEAM_DEV_ROUTES=1`:
  - UI steps: first-run setup (2 users and a projects root), view Projects with no user selected, choose
    Patrick, register a scratch git repository, propose a task, approve it, claim it, release it.
  - Development routes: an implementer run claims the task; its approve attempt is refused with
    `authority_violation` and shows in the queue; it hands off; a reviewer run on the same model records
    "Changes required".
  - Back in the UI: the task shows In review and Awaiting decision. The accept dialog lists the verdict,
    same-model, and handoff-risk warnings. Accepted after confirming them. The decision queue shows
    proposed, blocked, authority violations, and accepted-not-merged. The board and queue views were also
    checked.
  - The walkthrough ran in two parts: a selector bug in the script stopped the first part after step 07,
    and the second part carried on against the same server and data.
- axe-core in the real browser, with colour contrast included, found no serious or critical violations on
  task in review, decision queue, board, and the 390 px dark-mode decision queue and task pages.
  - Setup, projects, propose, and task in progress were scanned in the first part, but those results were
    not printed before the script stopped.
  - In jsdom, axe (without colour contrast) passes on the task page and the decision queue.
- At 390 px there is no page-level horizontal scroll on the decision queue or the task page.
- The servers were stopped with SIGINT to the process group. Ports 5180, 3100, and 54330 are free, no
  process from the scratch home remains, and no `postmaster.pid` is left.

### Acceptance criteria evidence

- **Every human transition is available only when the API allows it.**
  - `lib/actions.ts` mirrors the CONTRACT-001 preconditions: state, top-level vs subtask, claimant, open
    subtasks, unfinished path dependencies, blockers, pause, review waiver, inclusions, criteria, and paths.
  - The rules are unit-tested in `actions.test.ts`. `pages.test.tsx` checks that enabled and disabled
    buttons, and their reasons, match the task state.
  - Subtasks never get Accept or Return (CONTRACT-003 UI-I2), even though the server accepts a leaf
    subtask return.
  - Refusals still show their category (tested for `conflict` and `merge_conflict`).
- **The decision queue lists proposed tasks awaiting approval, tasks in review, and blocked tasks.**
  - Shown in `11-decision-queue.png` (the in-review task is in `08`, taken before it was accepted) and in
    the `decision queue` test.
  - The queue also shows agent authority violations and accepted, not merged, per the dispatch
    clarification.
- **Validation requirement (walkthrough from proposed to completed; build passes):** screenshots 01 to 11;
  `pnpm build` passed.

### Assumptions and deviations

- **Action availability is mirrored in the client.** The API does not report which actions are allowed
  (CONTRACT-003 lists this under the data each view needs), so the rules are duplicated in
  `ui/src/lib/actions.ts`. There is a risk they drift from the server. See the questions below.
- **Out-of-scope files and known conflicts are discovered at accept time.** The task detail doesn't include
  the changed-file set or branch mergeability. The accept dialog learns about them from the server's first
  refusal (`validation` with `outOfScopeFiles`, or `merge_conflict`) and then asks for the reason or offers
  Accept anyway. CONTRACT-003 A-1 allows this for conflicts. In phase 2 the default repository port never
  reports either.
- **Hand off is included for a human claimant (T6).** It wasn't in the dispatch list, but without it a
  human-claimed task could only be released.
- **Not built:** adding subtasks (T11), and adding subtasks as part of a return. Subtasks are read-only apart
  from sibling moves. The return dialog explains what happens when a split parent is returned without new
  subtasks.
- **Queue move confirmation doesn't preview dependency changes.** The UI doesn't compute path overlaps
  itself. The changes are listed after the move from the returned audit records, and the server refuses
  moves that would make a started task wait.
- **Handoff deviations and risks count as accept warnings** unless they read "None", "N/A", or "-".
- **The decision queue shows only the five dispatch groups.** The API also returns `subtaskFindings` and
  `fellBack`, which CONTRACT-001 UX lists. They are not shown. See the questions below.
- **No review sub-status on in-review rows.** Task summaries carry no review data, so the queue and board
  rows show only state and conditions. The sub-status is on the task detail.
- **No user management screen** (add, edit, deactivate) beyond first-run setup. It wasn't in the dispatch
  scope.
- **Tab title pause count (SV-6):** not done; pauses arrive in phase 4.

### Unresolved risks

- The mirrored availability rules can drift from `server/src/lifecycle/service.ts`, for example when
  TASK-016 implements the CONTRACT-005 delta.
- Contrast was checked by axe on rendered pages in light theme and in dark theme at 390 px. The glyph and
  border 3:1 ratios (SV-2) were not measured separately. There was no manual screen-reader or full
  keyboard-only pass, so accessibility is not claimed beyond the automated checks.
- The 200% zoom and 1024 px widths were not captured.
- Polling is every 10 s. There is no push channel yet.

### Documentation updated

- `docs/DEVELOPMENT.md`: new section "Board UI (TASK-007)". No shadcn or Radix primitives were introduced.

### Questions for the board

1. Should the API report the allowed actions per task and user, with reasons (CONTRACT-003 "Data each
   view needs")? That would remove the client-side mirror.
2. Should the decision queue also show the "Subtask findings" and "Fell back" groups that the API already
   returns (CONTRACT-001 UX)? The dispatch clarification listed only five groups.
3. Should adding subtasks (split, and new subtasks on return) get a board UI, and under which task?

### Rework handoff (2026-09-25)

Task: TASK-007

Implementer: openai-coder (Codex), completing prior partial work

Date: 2026-09-25

#### Changes made

Reviewed the existing UI diff, new user-management files, CONTRACT-002, and
screenshots 16–22. The prior partial implementation supplied `/users`, the header
"Add a user" link, add/edit/deactivate/reactivate dialogs, separate alphabetized
active/inactive lists with e-mail addresses, client validation, categorized
server refusals, explicit switch-after-add, registry hooks, and nine UI tests.
It also supplied the seven screenshots listed below, without a handoff.

This continuation closes identity and test gaps:

- Successful self-deactivation clears the selection immediately, without waiting
  for refetch. A stored selection missing from the active list is also cleared,
  so later reactivation cannot silently restore it. The picker asks for a new
  selection; no other user is automatically selected.
- A delayed `unidentified` response for an old selection does not clear a newer
  explicit choice. Refused reads retry as a viewer; mutations never retry.
- An explicit selection from another tab clears the invalid-selection notice.
- Tests now cover successful reactivation and picker refresh, all registry
  controls without a selection, active-user editing, server last-active-user
  refusal, stale selection, cross-tab selection, and request races. Test cleanup
  resets the selection notice as well as storage.
- Removed the partial work's unused export of `ActionButton`; TaskActions has
  no remaining diff. Updated only the Board UI section of DEVELOPMENT.md.

Exact files with retained rework changes (relative to the shared checkout):

- Prior partial work retained unchanged by this continuation:
  `ui/src/App.tsx`, `ui/src/components/Layout.tsx`,
  `ui/src/components/common.tsx`, `ui/src/pages/Users.tsx`.
- Prior partial work extended by this continuation:
  `ui/src/api/client.ts`, `ui/src/api/queries.ts`,
  `ui/src/lib/currentUser.tsx`, `ui/src/lib/selection.ts`,
  `ui/src/pages/users.test.tsx`.
- Added/updated in this continuation:
  `ui/src/api/client.test.ts`, `ui/src/test/setup.ts`,
  `docs/DEVELOPMENT.md` (Board UI section only),
  `tasks/in-progress/TASK-007-board-ui.md` (this handoff; existing assignment
  attribution preserved).
- Prior screenshots retained unchanged:
  `ui/screenshots/TASK-007/16-users-newcomer-no-user-selected.png`,
  `ui/screenshots/TASK-007/17-users-add-validation.png`,
  `ui/screenshots/TASK-007/18-users-added-switch-offered.png`,
  `ui/screenshots/TASK-007/19-deactivate-dialog.png`,
  `ui/screenshots/TASK-007/20-inactive-listed-reactivate-name-taken.png`,
  `ui/screenshots/TASK-007/21-edit-inactive-user.png`,
  `ui/screenshots/TASK-007/22-deactivate-yourself-dialog.png`.

The original handoff above remains historical; its statement that user
management was not built is superseded by this rework. No allowed-actions API,
extra decision-queue groups, or subtask UI was implemented. No server/shared
source or TASK-017 file was edited. Concurrent DEVELOPMENT.md changes outside
its UI section were preserved. No git writes, branch/worktree creation, or
lifecycle moves were performed; the task remains in-progress as instructed.

#### Validation performed

Every validation command run in this continuation is recorded below. The first
attempts could not find pnpm; subsequent commands used Node 24 by prepending
`/home/patrick/.nvm/versions/node/v24.16.0/bin` to PATH.

| Command | Result |
| --- | --- |
| `pnpm --filter @moonbeam/ui typecheck` (initial PATH) | Not run: `pnpm: command not found`. |
| `pnpm --filter @moonbeam/ui test` (initial PATH) | Not run: `pnpm: command not found`. |
| `pnpm --filter @moonbeam/ui typecheck` (Node 24; twice) | Passed both times, no diagnostics. |
| `pnpm --filter @moonbeam/ui test` (baseline) | `Test Files  4 passed (4)`; `Tests  29 passed (29)`. |
| `pnpm --filter @moonbeam/ui test` (expanded) | `Test Files  5 passed (5)`; `Tests  35 passed (35)`. |
| `pnpm typecheck` (root, final code) | Exit 0; shared, db, server, UI reported Done. |
| `pnpm test` (root, final code) | Exit 0; all packages reported Done, but nested output omitted counts/errors. **Not evidence of a passing server suite**; see direct result below. |
| `pnpm build` (root, final code) | Exit 0; all packages reported Done; UI transformed 263 modules. |
| `pnpm -r --stream run test` | Exit 0, still only package Done summaries; direct package commands below were needed for counts. |
| `pnpm --filter @moonbeam/ui test` (final) | `Test Files  5 passed (5)`; `Tests  36 passed (36)`. |
| `pnpm --filter @moonbeam/shared test` | `Test Files  2 passed (2)`; `Tests  8 passed (8)`. |
| `pnpm --filter @moonbeam/db test` | `Test Files  1 passed (1)`; `Tests  6 passed (6)`. |
| `pnpm --filter @moonbeam/server test` | **Blocked by sandbox**: `No test files found, exiting with code 1`, followed by `Error: listen EPERM: operation not permitted 127.0.0.1`. No pass/fail test counts were produced. The command wrapper reported exit 0 despite that output. No server tests are claimed passing. |
| `git diff --check -- ui/ docs/DEVELOPMENT.md tasks/in-progress/TASK-007-board-ui.md` | Initial code checks passed. The first handoff check found two trailing-space lines; corrected them and the final check passed. |
| `ss -ltn` | Could not inspect sockets: `Cannot open netlink socket: Operation not permitted`. |
| Read `/proc/net/tcp` and `/proc/net/tcp6`; Python check for LISTEN entries on 3100/5180/54330 | `Listening task ports: []`; `Ports 3100/5180/54330 free: True`. |

No dev servers were started in this continuation. Existing screenshots were
opened and visually reviewed; no new capture was needed. There are no task
servers to stop. The observed namespace has no listeners on 3100, 5180, or
54330. No development MOONBEAM_HOME was used.

#### Acceptance criteria evidence

- Add/edit/deactivate/reactivate use the existing registry API and selected-user
  header. The 13 user-management UI tests exercise the management operations,
  invalid inputs/refusals, sorting/e-mail display, selection requirements,
  last-active-user protection, and explicit switching.
- Screenshot 16 shows newcomer instructions and disabled actions with no
  selection; 17 shows duplicate-name and invalid-email errors; 18 shows the
  optional switch after add; 19 shows deactivation confirmation; 20 shows the
  separate inactive list, e-mail, and a blocked duplicate-name reactivation;
  21 shows editing the inactive user; 22 shows reactivation success behind the
  self-deactivation warning dialog.
- Three request-client tests cover viewer retry, no mutation retry, and a delayed
  refusal not replacing a new selection. The management tests cover clearing
  the deactivated selection and asking again.
- The user-list test runs axe in jsdom with color contrast disabled and asserts
  no serious/critical violations. No new real-browser accessibility, mobile,
  zoom, or keyboard-only pass is claimed.

#### Assumptions and deviations

- Registry changes continue to require a selected human. Newcomers choose an
  existing user before adding themselves; this is not unauthenticated
  self-registration. The server remains authoritative for races and refusals.
- Human/viewer user responses retain e-mail addresses. The concurrent TASK-017
  shared change adds a separate agent response shape; the browser still uses
  the full human user schema and sends no agent credential.
- Existing screenshot evidence is reused; successful final self-deactivation
  and last-active-user refusal are covered by tests rather than new captures.

#### Unresolved risks, gaps, and questions

- Server integration tests must be rerun where loopback listeners are permitted.
  The root runner's exit 0/Done summary masked this setup error. This is an
  environment validation gap, not a server/shared change request.
- External deactivation is discovered on user-list refresh (60-second interval)
  or an `unidentified` response. Self-deactivation is handled immediately.
- Existing screenshots precede the identity-race fixes, which do not change
  the photographed layouts. This continuation did not repeat a live API
  walkthrough or independently verify the prior capture process's cleanup.
- No product or contract questions remain. Independent review and human
  acceptance remain outstanding; this implementation does not mark itself
  accepted.

#### Documentation updated

- `docs/DEVELOPMENT.md`: Board UI user-management route, validation, selection,
  and test behavior.
- This dated rework handoff, preserving the original implementation handoff.

### Dispatcher validation (2026-09-25)

Run by the dispatcher (Claude) in the shared checkout, after TASK-017 was
committed:

- `pnpm typecheck`: all four packages pass.
- `pnpm test`: db 6, shared 8, ui 36, server 163 — **213 passed**, 0 failed.
- `pnpm build`: all four packages pass.
- Screenshots 16–22 were taken by the interface-designer agent before Codex
  changed deactivation to clear the selection immediately. They may not show
  that final behavior. No new live walkthrough was done.

## Review

Not reviewed.

## Human acceptance

Changes requested by Patrick, 2026-09-25. Returned to `in-progress/`.

**Build user management after first-run setup.** Today only the users entered
at setup can ever exist. Anyone must be able to add themselves as a user
later.

- Build the full user management that CONTRACT-002 describes: add, edit,
  deactivate, and reactivate users. Inactive users are listed separately, and
  e-mail addresses are shown there (CONTRACT-002 UX expectations).
- Keep CONTRACT-002's rule that adding a user needs a selected user, because
  every registry change records who made it. A newcomer chooses any existing
  user, then adds themselves. The board chose not to change the contract for
  self-registration from the picker.
- Make the way to add a user easy to find from the header user select, for
  example an "Add a user" link next to it.
- Follow CONTRACT-002 validation: unique display names among active users, a
  valid e-mail address, and the last active user can't be deactivated.
- Add UI tests and screenshots for the new screens.

**Board answers to the handoff questions:**

1. Allowed actions from the API: yes. Added to TASK-016. Don't change it here.
2. "Subtask findings" and "Fell back" groups: yes. Added to TASK-016. Don't
   change it here.
3. A board UI for adding subtasks: later, as its own task.

Paths are unchanged (`ui/`, `packages/shared/`). The user-management API
already exists from TASK-006, so no `server/` changes are expected. If one is
needed, stop and ask, because TASK-017 owns `server/`.
