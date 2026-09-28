# TASK-016: Implement the CONTRACT-005 changes (edit a proposed task)

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick
Approved date: 2026-09-25
Related contracts: CONTRACT-005
Related ADRs: ADR-002
Dependencies: TASK-015 (CONTRACT-005 approved), TASK-007 (overlapping paths: `packages/shared`, `ui/`), TASK-017 (overlapping paths: `server/`, `packages/shared`; runs first)

## Desired outcome

The server and UI implement CONTRACT-005's changes relative to CONTRACT-001,
chiefly the "edit a proposed task" action. The code references CONTRACT-005
instead of CONTRACT-001.

## Scope additions (board, 2026-09-25)

The board added two items after approval, answering TASK-007's handoff
questions 1 and 2. They are included below.

## Scope

### Included

- The edit-proposed-task API, with its validation, authority, and audit.
- An edit form in the task detail UI for proposed tasks.
- Tests.
- Update contract references in code comments and docs.
- Confirm that the I9 behavior and the other recorded readings match
  CONTRACT-005. TASK-006 already built them, so only adjust them if they
  differ.
- **Allowed actions from the API (TASK-007 Q1):** the API reports, per task
  and acting user, which actions are allowed and the reason for each one that
  is not (CONTRACT-003 "Data each view needs"). The UI uses this instead of
  its own copy of the rules in `ui/src/lib/actions.ts`, which is removed.
- **Decision-queue groups (TASK-007 Q2):** the decision queue also shows the
  "Subtask findings" and "Fell back" groups that the API already returns.

### Excluded

- Anything else in CONTRACT-005 that is unchanged from CONTRACT-001.

### Paths

- `packages/shared/`
- `server/`
- `ui/`
- `docs/DEVELOPMENT.md`

## Plan

1. Add strict T17 input validation and a PATCH action inside the existing project-locked transaction.
2. Report actor-specific action availability on all task response surfaces and remove browser lifecycle rules.
3. Add proposal editing/history and both missing decision-queue groups.
4. Add focused schema, server and UI regressions; confirm I9/R1–R8 and update references/documentation.
5. Run socket-free validation and document the database/live-browser validation gap for the dispatcher.

## Acceptance criteria

- [ ] A human or the authoring agent run can edit a proposed task. Everyone
      else is refused, and the refusal category matches CONTRACT-005.
- [ ] Edits after approval are refused.
- [ ] The UI takes allowed actions and refusal reasons from the API, including
      for the new edit action, and keeps no client-side copy of the rules.
- [ ] The decision queue shows the "Subtask findings" and "Fell back" groups.
- [ ] All tests pass.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. Manually edit a proposed task
in the UI.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Task: TASK-016
Implementer: Codex (openai-coder)
Date: 2026-09-28
Status: implementation handed back to the dispatcher; independent review and
human acceptance pending. Task remains in `in-progress/` as instructed.

### Changes made

- Added `PATCH /api/tasks/:id` for T17. Any active human or the exact authoring
  agent run may edit a proposed top-level task. Permission precedes input checks;
  agent credentials are revalidated under the existing project lock. Edits after
  approval/cancellation are refused. The same lock serializes edit/approve/cancel.
- Strict input accepts only title, desired outcome, criteria and envelope. Omitted
  fields remain unchanged. A supplied envelope is a replacement using creation's
  input shape. Required text, plain paths, unknown fields and normalized no-ops
  are validated. Each success writes one `edited` audit with previous/new values
  for each changed field, including each envelope component. Rejections add no
  edit/authority audit and do not change content.
- Added required `allowedActions` to every summary/detail, including lists,
  project queues, decision-queue entries, nested parent/subtasks and action
  responses. All 14 implemented task action types are reported for the resolved
  human, agent or viewer; every disabled entry has a reason. Detail includes
  per-blocker `blockerActions`. Availability reads have no audit side effects.
- Removed `ui/src/lib/actions.ts` and its rule tests. The UI consumes server
  decisions for task actions, moves, blocker resolution and edits. The replacement
  presentation helper contains only connection/selection readiness, labels and
  review-waiver form presentation. Task-bearing query caches are keyed by selected
  user, preventing permission reuse across selections.
- Added proposed-task edit form, validation/refusal retention, success feedback and
  old/new edit history. Later states have no edit form and explain cancellation
  and re-proposal. Corrected proposal-page copy about editing and invalid paths.
- Added Subtask findings (findings, verdict, same-model flag, parent link) and
  Fell back groups, including empty states.
- Changed lifecycle references to CONTRACT-005 in the allowed source/docs paths.
  Confirmed I9 and R1–R8 against existing service behavior; no service changes
  were needed for those readings. Strengthened randomized I9 assertions and added
  I23 content immutability/audit assertions and randomized edits. T10 availability
  now correctly permits returning an in-review subtask, as the service and contract
  already do; the former browser mirror incorrectly disabled it.
- Added 11 shared schema tests, 16 server availability unit cases, 18 database/API
  cases and 8 UI cases. Added a durable socket-free server Vitest configuration.

### Files changed

- `docs/DEVELOPMENT.md`
- `packages/shared/src/edit-task.test.ts`
- `packages/shared/src/errors.ts`
- `packages/shared/src/lifecycle.ts`
- `server/src/audit.ts`
- `server/src/errors.ts`
- `server/src/identity/permission.ts`
- `server/src/index.ts`
- `server/src/lifecycle/availability.test.ts`
- `server/src/lifecycle/availability.ts`
- `server/src/lifecycle/context.ts`
- `server/src/lifecycle/dependencies.ts`
- `server/src/lifecycle/envelope.test.ts`
- `server/src/lifecycle/envelope.ts`
- `server/src/lifecycle/paths.test.ts`
- `server/src/lifecycle/paths.ts`
- `server/src/lifecycle/service.ts`
- `server/src/routes.ts`
- `server/src/test/concurrency.test.ts`
- `server/src/test/conditions.test.ts`
- `server/src/test/invariants.test.ts`
- `server/src/test/queue.test.ts`
- `server/src/test/splits.test.ts`
- `server/src/test/task016.test.ts`
- `server/src/test/transitions.test.ts`
- `server/src/views.ts`
- `server/vitest.unit.config.ts`
- `tasks/in-progress/TASK-016-implement-contract-005-delta.md`
- `ui/src/api/queries.ts`
- `ui/src/components/EditProposedTask.tsx`
- `ui/src/components/MoveControl.tsx`
- `ui/src/components/TaskActions.tsx`
- `ui/src/lib/actionPresentation.ts`
- `ui/src/lib/actions.test.ts` (removed)
- `ui/src/lib/actions.ts` (removed)
- `ui/src/lib/format.ts`
- `ui/src/lib/paths.ts`
- `ui/src/lib/status.ts`
- `ui/src/pages/DecisionQueue.tsx`
- `ui/src/pages/Project.tsx`
- `ui/src/pages/Projects.tsx`
- `ui/src/pages/ProposeTask.tsx`
- `ui/src/pages/Task.tsx`
- `ui/src/pages/Users.tsx`
- `ui/src/pages/pages.test.tsx`
- `ui/src/pages/task016.test.tsx`
- `ui/src/test/fixtures.tsx`

### Validation performed

All pnpm commands used:
`export PATH=/home/patrick/.nvm/versions/node/v24.16.0/bin:$PATH`.
Counts below are from direct Vitest output, not root runner summaries.

| Exact command | Result / counts |
| --- | --- |
| `pnpm --filter @moonbeam/shared exec vitest run src/edit-task.test.ts` (first) | Exit 1; 1 file failed; 10 tests passed, 1 failed. Caught a create-schema default clearing omitted acceptance criteria. Fixed with explicit optional edit fields. |
| Same command (second) | Exit 0; 1 file, 11 tests passed. |
| `pnpm typecheck` (twice) | Exit 0 both times; all four workspace packages Done. Second run includes all new API/UI/unit tests and I9/I23 invariant changes. |
| `pnpm --filter @moonbeam/server exec vitest run src/test/task016.test.ts` | BLOCKED in global setup: `Error: listen EPERM: operation not permitted 127.0.0.1`, preceded by `No test files found, exiting with code 1`. No tests executed and no pass/fail counts. Wrapper exit 0 is NOT success. |
| `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts src/lifecycle/availability.test.ts` | Exit 0; 1 file, 16 tests passed. |
| `pnpm --filter @moonbeam/ui exec vitest run src/pages/task016.test.tsx` (first) | Exit 1; 1 file failed; 5 tests passed, 3 failed. Test queries omitted the existing Field component's `(required)` label suffix; corrected queries. |
| Same command (second) | Exit 0; 1 file, 8 tests passed. |
| `pnpm --filter @moonbeam/ui test` | Exit 0; 5 files, 36 tests passed. |
| `pnpm --filter @moonbeam/shared test` | Exit 0; 3 files, 19 tests passed. |
| `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts` | Exit 0; 4 files, 40 tests passed (permission, paths, envelope, availability). |
| `pnpm build` | Exit 0; all four packages Done; UI transformed 264 modules. |
| `pnpm --filter @moonbeam/db test` | Exit 0; 1 file, 6 tests passed; socket-free package tests only. |
| `pnpm --filter @moonbeam/ui exec vitest run src/pages/task016.test.tsx` (third, after final fixed-content explanatory text) | Exit 0; 1 file, 8 tests passed. |
| `git diff --check` (before and after handoff) | Exit 0; no whitespace errors. |
| `rg -n 'CONTRACT-001|lib/actions|actions.test.ts' packages/shared/src server/src ui/src docs/DEVELOPMENT.md` | Exit 1 / no matches: old references and client rule imports are absent. |

Final runnable suite total: **101 tests passed** (UI 36 + shared 19 + server
units 40 + db-package units 6). Focused reruns are subsets, not extra tests.
An initial edit-helper invocation, `python /tmp/task016-edit.py`, failed because
`python` is not installed (exit 127); rerun using `python3` succeeded. This was
an editing command, not a validation result.

### Suites and checks that could not be run

- Server database/API suite: loopback forbidden. The 18 new TASK-016 API cases,
  modified randomized invariants and existing lifecycle/race tests need the
  dispatcher's direct `pnpm --filter @moonbeam/server test` run with loopback.
- `server/src/app.test.ts` also opens HTTP loopback sockets; it is deliberately
  excluded from the socket-free unit config and was not run separately.
- Live manual browser editing, real-browser accessibility/visual checks and a
  running `pnpm dev` walkthrough were not performed. No dev server was started.
  The jsdom UI interaction tests exercise editing, errors, fields, selection
  changes, history and queue groups; they are not a live end-to-end walkthrough.
- Root `pnpm test` was deliberately not used as evidence, because its wrapper
  can hide database setup failure. Direct runnable package commands are above.

### Acceptance criteria evidence

- T17/I23: strict schemas and service transaction; `task016.test.ts` asserts every
  editable field's audit values, partial-edit preservation, exact authoring run,
  locked credential revalidation, validation/no-op atomicity, all later states,
  subtask refusal and edit racing approval/cancellation. The API suite is written
  and typechecked but runtime verification is blocked.
- Availability: unit cases cover six states, humans/agents/viewers, binding,
  claimant/reviewer/author relationships, blocked/paused conditions, dependencies,
  splits/fallback and exact blocker authorship. API cases exercise all response
  surfaces and no audit on reads. UI tests deliberately provide decisions that
  differ from local state to prove the UI obeys the API, and switch users to
  verify a fresh permission request.
- UI: all eight new cases passed; full UI suite passes. No client lifecycle-rule
  file remains. Both additional groups have populated and empty-state coverage.
- I9/R1–R8: comparison table in `docs/DEVELOPMENT.md` names the existing code and
  regression coverage. I9 now explicitly asserts all cancelled on handoff entry;
  no new lifecycle behavior was invented for the recorded readings.

### Assumptions and deviations

- Used the existing T1 `desiredOutcome` prose field for the contract's description
  including desired outcome; no separate description database field/migration.
- PATCH callers may omit unchanged top-level fields; supplying `envelope` replaces its
  components using T1 defaults. This API shape is documented and tested.
- Availability means the action can be started with valid input. It does not
  promise success regardless of input: reasons, waiver/warning confirmation,
  move destination and repository checks remain submission-time checks. Actions
  recheck live identity and state under the project lock. Server view preconditions
  and transactional checks must stay aligned as lifecycle behavior evolves.
- Q27 follows the contract's explicit interim rule: approval approves current
  content when applied; no version-match gate was invented.
- M4 and repository integration remain outside this task's phase-2 delta.
- No git writes, lifecycle moves, branches, worktrees, dependency changes or
  unrelated uncommitted work were involved. Initial checkout was clean.

### Unresolved risks

Database execution and live-browser validation remain the material gaps. The
new response fields require the server/shared/UI update to ship together. Existing
phase-3 repository stubs are unchanged. Independent review and board acceptance
are outstanding; this handoff does not mark the implementation accepted.

### Documentation updated

`docs/DEVELOPMENT.md`: current contract references, PATCH semantics/audit,
action metadata and its boundaries, per-user caches, queue groups, unit-test
command and limitations, and the I9/R1–R8 comparison. This task records the plan,
implementation evidence and validation gaps.

### Questions for the board

No new product or contract question. Dispatcher follow-up: run the full server
suite with loopback permitted and perform the live proposal-edit walkthrough
before acceptance.


### Dispatcher validation and testing (2026-09-28)

Run by the dispatcher (Claude) in the shared checkout, with loopback permitted:

- `pnpm typecheck` and `pnpm build`: all four packages pass.
- `pnpm test`: db 6, shared 19, ui 36, server 197 — **258 passed**, 0 failed.
  This includes the server database suite that Codex could not run.

**Live API check** (`pnpm dev` on ports 3200 and 5280, temporary database):

- Any human can edit a proposed task. The audit records an `edited` entry with
  the previous and new values. A viewer gets `unidentified`.
- The authoring agent run can edit its own proposal. Another run gets
  `not_permitted`, both for that proposal and for a human's proposal. This
  matches CONTRACT-005.
- After approval, an edit gets `invalid_transition`, and `allowedActions.edit`
  is disabled with the same reason.
- An empty title gets `validation`.
- `allowedActions` gives per-user reasons, for example approval being blocked
  by a missing inclusion or criterion, and "Choose who you are" for a viewer.
- The decision queue API returns `subtaskFindings` and `fellBack`.

**Browser walkthrough**, 12 of 12 checks passed: the edit form opens prefilled,
saves, and the page and history update. Approve becomes available only once
the task is complete. After approval, editing is replaced by "Content is fixed
after approval". A viewer sees "Choose who you are" reasons. The decision queue
shows "Subtask findings" and "Fell back". There were no page errors.

**Observations, not blockers:**

- In the history, an edit to scope inclusions shows the raw value
  (`[{"key":"I1","text":"The thing","derivedFrom":null}]`), not readable text.
- Disabled primary buttons (Approve, Accept) use a faded fill. This predates
  this task.

## Review

Not reviewed.
