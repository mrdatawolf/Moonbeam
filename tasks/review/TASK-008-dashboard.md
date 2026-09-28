# TASK-008: Dashboard

Owner role: UX specialist
Assigned agent: openai-coder (Codex)
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001
Related ADRs: ADR-002
Dependencies: TASK-007 (overlapping paths: `ui/`)

## Desired outcome

A cross-project dashboard that answers: what is happening, what needs me, and
what changed recently. It shows task counts by state per project, the decision
queue summary, active claims, and recent audit events.

## Context

The board named the dashboard a top-priority screen, modeled on Paperclip's.

## Dispatch clarifications (dispatcher, 2026-09-28)

These describe the task against the current code. They do not widen it.

- CONTRACT-005 superseded CONTRACT-001. Use CONTRACT-005's state and
  decision-queue vocabulary, and CONTRACT-003's status vocabulary (SV) and
  status badge, as the board UI already does.
- Build on the accepted board UI (TASK-007, TASK-016). Reuse the existing
  decision-queue and task endpoints where they are enough.
- `packages/shared/` is not in this task's paths. If a new aggregate route
  needs a shared response schema, stop and ask; don't add one silently.
- The dashboard is for humans and viewers. Any new route must still give
  agents no user e-mail addresses (TASK-017 N1).
- Replace the placeholder `ui/src/pages/Dashboard.tsx`. Its "System health"
  card may stay.

## Scope

### Included

- A dashboard page.
- Any read-only aggregate API endpoints it needs.

### Excluded

Costs and run activity (added once runs exist).

### Paths

- `ui/`
- `server/` (read-only aggregate routes only)

## Plan

1. Reuse existing validated reads and shared task/status/time components.
2. Show decision counts, project state counts, claims and recent task history;
   poll all sources every 10 seconds with explicit partial-read errors.
3. Add fixture-based UI and polling tests, run UI tests/typecheck/build, and
   record browser/sandbox limits for dispatcher validation.

## Acceptance criteria

- [ ] The dashboard reflects state changes without a manual reload (polling or
      realtime).

## Validation requirements

Manual check against seeded data.

## Risks and assumptions

Keep the widget set small. Runs will add more later.

## Blocker

None.

## Implementation handoff

Task: TASK-008
Implementer: Codex (openai-coder), UX specialist
Date: 2026-09-28
Status: implementation ready for dispatcher review; live validation outstanding.
No lifecycle move or acceptance performed.

### Changes made

Replaced the placeholder with exactly four sections:

- Decision queue: all seven current groups with counts and a link to `/decisions`.
  Explains that a task may belong to multiple groups; no misleading summed total.
- Tasks by project: all six lifecycle states, including zero counts, using shared
  status badges. Counts include subtasks. Conditions are not counted as states.
- Active claims: existing TaskCard displays human/agent claimant, agent lease,
  state and conditions, with project context and task link. Split parents without
  claims do not appear. The API remains authoritative for claim expiry.
- Recent audit events: ten latest task events across every loaded project/task,
  deduplicated by audit ID, sorted by effective time descending then ID descending.
  Shows shared action/actor/time formatting, reasons and task links.

All sources poll every 10 seconds, including newly registered projects. Existing
query keys preserve per-user task caches and lifecycle invalidation. Existing
endpoints and shared response validators are reused; no server, shared schema,
identity, or lifecycle behavior changes. Failed reads retain available data with
explicit stale/incomplete warnings; loading and failure do not masquerade as
empty data. No costs or run activity widgets; removed the placeholder health card
as well to keep the widget set at four.

Semantic headings, regions, definition lists and ordered audit list; existing
status glyphs, light/dark tokens and focus styles. Narrow layouts use one column,
`min-w-0` and `overflow-wrap:anywhere` for long titles/project names/reasons. No
fixed-width table or horizontal scrolling container was introduced.

### Files changed

- `ui/src/pages/Dashboard.tsx`
- `ui/src/pages/dashboard.test.tsx` (new, eight fixture-based tests)
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-008-dashboard.md`

The UI build also regenerated ignored output under `ui/dist/`. No git operations,
branches, worktrees, file moves or dependency changes were performed.

### Validation performed

All Node/pnpm commands used:
`export PATH=/home/patrick/.nvm/versions/node/v24.16.0/bin:$PATH`.

| Exact command | Result / counts |
| --- | --- |
| `pnpm --filter @moonbeam/ui exec vitest run src/pages/dashboard.test.tsx` (first) | Exit 1: 5 passed, 1 failed. Polling test installed fake timers after real intervals existed. Fixed test setup to install fake timers before rendering. |
| Same command (second) | Exit 0: 1 file, 6 tests passed. |
| `pnpm --filter @moonbeam/ui test` (first) | Exit 0: 6 files, 42 tests passed. |
| `pnpm typecheck` (first) | Exit 0: all four workspace packages passed. |
| `pnpm --filter @moonbeam/ui build` | Exit 0: 264 modules transformed; production bundle built. |
| `pnpm --filter @moonbeam/ui exec vitest run src/pages/dashboard.test.tsx` (third, with additional claim/partial-failure coverage) | Exit 0: 1 file, 8 tests passed. |
| `pnpm --filter @moonbeam/ui test` (second) | Exit 0: 6 files, 44 tests passed. |
| `pnpm typecheck` (second) | Exit 0: all four workspace packages passed. |

Final test total: **44 UI tests passed**, including eight new dashboard tests.
Focused reruns are subsets, not additional tests. Dashboard axe check found zero
serious/critical violations; color contrast excluded because jsdom has no layout.

Exact browser capability probes (both exit 1, no browser checks executed):

```sh
node --input-type=module -e 'import { chromium } from "/tmp/task001-browser/node_modules/playwright/index.mjs"; const b = await chromium.launch({headless:true,args:["--no-sandbox"]}); console.log("Browser launched"); await b.close();'
node --input-type=module -e 'import { chromium } from "/tmp/task001-browser/node_modules/playwright/index.mjs"; const b = await chromium.launch({executablePath:"/usr/bin/chromium",headless:true,args:["--no-sandbox"]}); console.log("Browser launched"); await b.close();'
```

First probe: installed Playwright expected absent headless-shell revision 1223.
Second probe: system Chromium started but died with `setsockopt: Operation not
permitted (1)` / SIGTRAP. No dependency installation or sandbox escalation tried.

### Acceptance criteria evidence

- Polling test changes server fixtures from claimed/in-progress to unclaimed/
  in-review, changes queue membership and audit, advances 10 seconds, and asserts
  all widgets update without reload. It also checks repeated project-list reads.
- Fixtures verify two projects, six counts each, all seven queue groups and the
  decision link; empty data; rejected audit attempts and reasons; bounded, ordered,
  deduplicated history; partial errors; human and suspended agent claims with
  conditions; split parents excluded from active claims.
- Exactly four section headings, no costs/run-activity/placeholder text, verified
  in the dashboard test. State badge/time/claim presentation reuse current UI.
- Responsive source reviewed for 390 px: single column, shrinkable containers,
  wrapping long text. **Actual no-horizontal-scroll verification remains pending**
  because browser launch is blocked. No screenshot or live check is claimed.

### Suites and checks that could not be run

- Live seeded-data check and `pnpm dev`: not run; loopback sockets are prohibited.
- Server database/API suite and socket-based app tests: not run in this sandbox.
  No server route was added or changed, so no new server route test was needed.
  Dispatcher will run the existing database suite as requested.
- Real-browser 390/1024/1440 px, 200% zoom, light/dark visual and contrast checks,
  keyboard walkthrough and screen-reader checks: blocked at browser launch.
- Root `pnpm test` was deliberately not used as proof of database success.

### Assumptions and deviations

- Recent audit means task audit events in the existing task-detail API; the feed
  is explicitly labeled as such. User/project registry-only audit events are not
  exposed by these existing endpoints and are not represented as task events.
- Ten recent events keeps the widget small. Active claims and project counts are
  not truncated. All tasks, including subtasks, count toward project totals.
- Existing server views decide claim activity; no browser expiry/lifecycle rules.
- Polling follows the existing visible-tab behavior; background tabs may pause.
- No new route/schema was needed and no material contract decision was made.

### Unresolved risks / questions for the board

The existing API requires one full task-detail read per task per polling cycle to
collect audit history, in addition to project-list, per-project task-list and queue
reads. This is suitable for the current endpoint reuse scope but scales poorly as
history grows. A bounded aggregate audit API would require a separately approved
shared schema. Reads are independent snapshots, so widgets may briefly differ
while a polling cycle completes. Partial results are explicitly labeled on errors.

Dispatcher follow-up before acceptance: run the database suite and a live seeded
walkthrough; confirm all four widgets update; check 390 px long-content overflow,
light/dark themes, 1024/1440 px, zoom and keyboard access. Independent review and
human acceptance remain outstanding. No new product question is blocking code.

### Documentation updated

`docs/DEVELOPMENT.md`: dashboard behavior, query reuse, polling, failure handling,
audit scope and scaling limitation. This task contains the plan and handoff.


### Dispatcher validation and testing (2026-09-28)

Run by the dispatcher (Claude) in the shared checkout:

- `pnpm typecheck` and `pnpm build`: all four packages pass.
- `pnpm test`: db 6, shared 19, ui 44, server 197 — **266 passed**, 0 failed.

**Live check with sample data** (`pnpm dev` on ports 3200 and 5280, temporary
database, two projects and five tasks: proposed, approved and claimed).
Playwright walkthrough, **7 of 7 passed:**

- Both projects show counts by state, and both claimed tasks show under
  Active claims.
- The decision-queue summary and recent events show the right data.
- A task approved through the API while the page was open appeared in the
  counts, the queue summary and recent events **within 12 s, without a
  reload**.
- At 390 px in dark mode there is no horizontal scroll. There were no page
  errors.

**Request load, measured:** one 10-second refresh cycle made 9 API requests
for 2 projects and 5 tasks: `/projects` 1, `/decision-queue` 1, the task list 2
(one per project) and task detail 5 (one per task). So the cost is
**one task-detail read per task, every 10 s, including completed and cancelled
tasks.** Each detail read also loads every user and run on the server (TASK-006
note N3). This is fine at the current scale, but it grows with the total
number of tasks ever created. A bounded "recent audit events" read-only route
would fix it, but it needs a response schema in `packages/shared/`, which the
dispatch clarifications kept out of scope. That is a board decision.

**Observation:** at 1440 px each count sits far from its label, in the
decision-queue summary and the per-project counts, so the rows are harder to
scan. This is cosmetic.

## Review

Not reviewed.

## Human acceptance

Pending.
