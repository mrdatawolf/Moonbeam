# TASK-039: Cross-project dashboard

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: TASK-036, TASK-038

## Desired outcome

The dashboard at `/` gives the top-down view across projects that ADR-008 asks
for. It summarizes only data that CONTRACT-006 defines.

## Context

CONTRACT-006 excludes the dashboard but allows it to summarize the contract's
data under its own task. The content below is a proposal for the board to
adjust.

## Scope

### Included

- `GET /api/dashboard`, one row per project:
  - name, lead developer
  - source status, head, and last poll
  - proposed and approved counts
  - the count of stale approvals (open FL-5)
  - the open flag count
  - completions in the last 30 days
- The 10 most recent acceptances and the 10 most recently raised flags, across projects.
- The dashboard page, which replaces the TASK-026 placeholder and links into the project views.
- Tests.
- `docs/DEVELOPMENT.md`.

### Excluded

- New data or rules.
- Cosmetic polish.

### Paths

- `server/src/views/dashboard.ts`
- `server/src/routes.ts`
- `server/src/test/dashboard.test.ts`
- `packages/shared/src/dashboard.ts`
- `packages/shared/src/index.ts`
- `ui/src/pages/Dashboard.tsx`
- `ui/src/pages/dashboard.test.tsx`
- `ui/src/api/queries.ts`
- `docs/DEVELOPMENT.md`

## Plan

1. Server aggregation from snapshots, sources, and flags.
2. Shared schema.
3. The UI page and its tests.

## Acceptance criteria

- [ ] Every value comes from a snapshot, source status, flag record, or registration. No task state is kept beyond these (N2).
- [ ] Each project row shows its head and poll time, and says when the data isn't current (UX1, N6). Source status and flags are distinct (UX2).
- [ ] A project that has never been polled, or that is failing, appears with its status and doesn't hide other projects (N4).
- [ ] There are no controls that imply repository actions (D10, UX6).
- [ ] The UI tests pass, including axe checks. The server tests pass.

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`).

## Risks and assumptions

- The dashboard content is a proposal. The board may reshape it before approval.

## Blocker

None.

## Implementation handoff

TASK-039 implemented in the shared `main` checkout. Ready for dispatcher review; uncommitted and not accepted.

### Changes made

- `server/src/views/dashboard.ts`: read-only aggregation through existing project projections in one repeatable-read transaction.
- `server/src/routes.ts`: viewer-accessible `GET /api/dashboard`.
- `packages/shared/src/dashboard.ts` and `packages/shared/src/index.ts`: validated dashboard schema and exports.
- `ui/src/pages/Dashboard.tsx`: project summaries, ten recent acceptances, and ten recently raised flags; project/task links, source status, viewer refresh, inline evidence, and Moonbeam flag notes reuse existing components.
- `ui/src/api/queries.ts`: dashboard query, periodic refresh, and invalidation after relevant mutations.
- `server/src/test/dashboard.test.ts` and `ui/src/pages/dashboard.test.tsx`: aggregation, boundary, concurrency, failure, interaction, and accessibility coverage.
- `docs/DEVELOPMENT.md`: endpoint, aggregation semantics, UI interactions, and test conventions.
- `tasks/in-progress/TASK-039-cross-project-dashboard.md`: Implementation handoff only.

### Validation performed

Commands used the instructed Node/pnpm PATH and `pnpm_config_verify_deps_before_run=false` to prevent automatic installation.

- `pnpm typecheck`: passed across all five packages.
- `pnpm -r --reporter=append-only run test`: passed, 422 tests across 35 files: db 6, shared 4, dbc 182, server 169, UI 61. Per-package results checked; no failures.
- `pnpm --filter @moonbeam/server exec vitest run`: separately passed, 169 tests across 14 files.
- `pnpm build`: passed across all five packages. Vite retains the bundle-size warning: minified JavaScript is 613.26 kB, above 500 kB.
- `git diff --check`: passed.

Initial checks found an unsupported EmptyState prop and an incorrect loading-state test selector; both were corrected before the passing full validation. UI tests mock all API responses. Server tests use isolated Postgres and local source fixtures; no real GitHub calls. No dependency installation, pnpm-store change, dev server, or repository git write command was run. All launched validation processes finished.

### Acceptance criteria evidence

1. N2: every summary derives from existing registration/member, snapshot, source, and flag records. No new persisted state or source calls. Tests verify unchanged audit/source records and a consistent snapshot during concurrent updates.
2. UX1/N6/UX2: each project displays its head and last successful poll, explicitly marks non-current data, and separates source status from flag counts/evidence.
3. N4: never-polled, failing, and incompatible-cache projects remain visible alongside healthy projects. Last-known data survives failures; unread task counts display “Not yet available.”
4. D10/UX6: links navigate to project/task views or GitHub. Controls only refresh observations or record flag notes in Moonbeam; none imply repository actions.
5. All UI and server tests pass, including axe checks. New coverage verifies dismissal-aware FL-5 counts, inclusive 30-day boundaries, global ten-item limits, archived-project exclusion, refresh invalidation, and loading/error/empty states.

### Assumptions and deviations

No outside-path changes or new dependencies. Acceptance summaries follow the existing D4 projection: tasks currently completed, ranked by first acceptance time, without a 30-day cutoff for the ten-item list. Completion counts use the inclusive server-clock interval [now minus 30 days, now]. Recently raised flags include all statuses, ordered by first-raised time; stable IDs break ties. These semantics are documented in DEVELOPMENT.md.

### Unresolved risks

No implementation blocker remains. The dispatcher must perform the manual app/browser check; jsdom axe checks exclude color contrast. The existing bundle-size warning remains. Lifecycle moves, commits, independent review, and acceptance remain with the dispatcher/board.

**Dispatcher check:**

- Changes are within the task's paths.
- The route diff adds only `GET /api/dashboard`.
- Re-ran `pnpm typecheck` (passes) and `pnpm -r run test`: 422 passed (db
  6, shared 4, dbc 182, server 169, ui 61).
- No `pnpm dev` smoke check, for the same reason as TASK-038: there is no
  token or registered project yet, so the page would show only its empty
  state. The end-to-end check is TASK-040.

## Review

Not reviewed.
