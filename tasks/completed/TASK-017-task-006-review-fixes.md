# TASK-017: Fix TASK-006 review findings F1–F7; hide e-mail addresses from agents (N1)

Owner role: Implementer
Assigned agent: openai-coder (Codex); partial work by a general-purpose Claude agent, stopped 2026-09-25
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick
Approved date: 2026-09-25
Related contracts: CONTRACT-005 (supersedes CONTRACT-001), CONTRACT-002
Related ADRs: ADR-003, ADR-006, ADR-007
Dependencies: TASK-006 (completed; this task fixes its review findings). Must
finish before TASK-016 starts, because both change `server/` and TASK-016
builds on this code.

## Desired outcome

The lifecycle server fixes the findings from TASK-006's QA review, and agents
can no longer read users' e-mail addresses.

## Context

TASK-006 was accepted and moved to `completed/`. Its QA review (in the TASK-006
task file, "Review") reported two major findings (F1, F2), four minor findings
(F3–F6), and test gaps (F7). The board decided on 2026-09-25 that these are
fixed in a new task rather than by reopening TASK-006.

The board also answered note N1 on 2026-09-25: agents see only users' display
names, not their e-mail addresses, because they have no need for them.

## Scope

### Included

Each finding, with its scenario and suggested resolution, is described in
TASK-006's review. In short:

- **F1 (major):** a returned subtask can later complete by citing a stale
  review. Clear the pending deferred completion whenever a subtask leaves
  `in_review` and whenever a new handoff is recorded.
- **F2 (major):** an agent action can be applied after its run has ended.
  After taking the project lock, re-check that the run is active and its
  credential is not revoked or expired.
- **F3:** ending a run in the no-claim branch leaves another run's lease
  suspended. Refresh leases for the tasks whose pauses were closed.
- **F4:** a D1 move to the task's current position succeeds and is audited.
  Reject it with `invalid_transition`, or skip the audit record.
- **F5:** an agent repeating its own withdrawal gets `authority_violation`.
  Return `invalid_transition` when the task is already terminal.
- **F6:** changing the projects root can race with project registration. Read
  and check the root inside the locked transaction.
- **F7:** add regression tests for F1–F6, including return and re-handoff
  after a deferred T8 and an agent action racing the end of its run. Consider
  a table-driven state × action × actor matrix.
- **N1 (board decision):** a request with an agent credential gets users'
  display names (and whatever else the agent views need, such as ids and the
  inactive marker) but never their e-mail addresses. This applies to the user
  list and anywhere else a user record reaches an agent. Humans and viewers
  are unchanged.
- Update `docs/DEVELOPMENT.md` where the behavior it documents changes.

### Excluded

- TASK-006 notes N2 (agents adding blockers to their own handoff), N3 (view
  performance), and N4 (dev pause permission name). They stay open.
- TASK-006 handoff questions Q6 and Q10. They await a board decision.
- Anything in CONTRACT-005 that TASK-016 covers.

### Paths

- `server/`
- `packages/shared/`
- `docs/DEVELOPMENT.md`

## Plan

## Acceptance criteria

- [ ] F1–F6 are fixed, each with a regression test that fails without its fix.
- [ ] The F7 test gaps are covered.
- [ ] A request with an agent credential never receives a user's e-mail
      address. A test proves it for the user list and for who-am-I.
- [ ] Humans and viewers still see e-mail addresses where CONTRACT-002 shows
      them.
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. Re-run the TASK-006 review
probes P1–P5 and P8, and record their results in the handoff.

## Risks and assumptions

- Assumes N1 reads CONTRACT-002 as already permitting this: its interface
  lists humans and viewers as callers of "list users", not agents. If the
  implementer finds a contract rule that requires agents to see e-mail
  addresses, stop and ask.
- F2's fix touches every agent action. It must not change human-action
  behavior.

## Blocker

None. Codex's sandbox could not open loopback sockets, so it could not run the
database tests. The dispatcher ran them in the normal checkout on 2026-09-25
(see "Dispatcher validation" below).

## Implementation handoff

Task: TASK-017
Implementer: Codex
Date: 2026-09-25
Status: implementation available for independent review; database validation blocked.
The task stays in `in-progress/` for the dispatcher; no git writes or lifecycle
moves were performed.

### Changes made

Reviewed `git diff HEAD` for all six inherited modified source files and read
the untracked regression suite. The fixes are within scope and their logic
matches F1–F6. Retained them. Corrected an inherited TypeScript error in a test
closure (`w` could be undefined); did not rely on the previous agent's claim
that mutation checks had passed.

- F1: return and a new handoff clear the deferred completion review. Completion
  and cancellation already clear it. Tests cover return while effectively
  blocked, re-handoff, later unblock without stale completion, and completion
  citing a review of the latest handoff.
- F2: after the project lock, recheck the exact credential and run for active
  status, revocation and expiry. Human actors skip that check. Tests cover ten
  agent action methods with an actor resolved before run end, expiry/revocation,
  successful live-agent and human claims, and a lock-controlled HTTP claim race.
- F3: closing pauses when a run has no claim refreshes leases on affected tasks.
- F4: queue/sibling moves to the current position reject without audit.
- F5: repeating withdrawal of the run's own never-approved proposal rejects
  `invalid_transition`; cancelling an approved proposal remains an audited
  authority violation, including after a human cancels it.
- F6: project registration rechecks the root inside the root-change lock; the
  regression drives the interleaving with an advisory lock.
- F7: retained the two named regression scenarios and added a table-driven
  matrix: six states × eight actions × three actors = 144 cells in 18 test
  cases. Each cell creates a separate task through the API. It covers a human
  claimant, independent bound agent and anonymous viewer, with state/claim and
  rejection-audit checks. Focused existing suites cover split, condition,
  author/claimant and system-transition variants; this is not a claim of an
  exhaustive matrix of every relationship and condition.
- N1: retained agent-only user-list projection and its response schema. Reviewed
  who-am-I, lifecycle user references, action/audit responses, setup and user
  management routes: who-am-I already projects agent identity without user
  fields; lifecycle references contain ids/names/inactive status, not e-mail;
  user-management responses are human-only. Strengthened tests to send both
  credential and selected-user headers, assert absent `email` and internal
  `credentialId`, and check anonymous who-am-I. Tests also cover inactive users,
  human/viewer e-mail preservation, and the other read/action response surfaces.

Exact task file set (includes inherited partial changes):

- `packages/shared/src/identity.ts`
- `server/src/identity/actor.ts`
- `server/src/identity/permission.test.ts`
- `server/src/lifecycle/service.ts`
- `server/src/registry.ts`
- `server/src/routes.ts`
- `server/src/test/review-fixes.test.ts` (new)
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-017-task-006-review-fixes.md`

### Validation performed

Every validation command run in this continuation is recorded below. Commands
using pnpm after the first attempt used
`export PATH=/home/patrick/.nvm/versions/node/v24.16.0/bin:$PATH`.
No `pnpm dev` was run. No developer database was used.

| Command | Result / verbatim counts |
| --- | --- |
| `pnpm --filter @moonbeam/server exec vitest run src/test/review-fixes.test.ts` (initial shell) | Could not run: `/bin/bash: line 1: pnpm: command not found`; exit 127; no counts. |
| Same command with Node 24 PATH (twice, before and after additions) | Both blocked during global setup: `No test files found, exiting with code 1` and `Error: listen EPERM: operation not permitted 127.0.0.1`; no pass/fail counts. Tool process nevertheless returned exit 0 after completion; not a passing test result. |
| `pnpm --filter @moonbeam/server --filter @moonbeam/shared typecheck` (first) | Shared `Done`; server `Failed`, TS18048 at regression-test line 150 (`w` possibly undefined); exit 1. Fixed. No test counts. |
| Same scoped typecheck (second) | Both `Done`, exit 0. |
| `pnpm --filter @moonbeam/shared test` | `Test Files  2 passed (2)`; `Tests  8 passed (8)`; exit 0. |
| `pnpm --filter @moonbeam/server exec vitest run --config vitest.task017.config.ts` | `Test Files  3 passed (3)`; `Tests  24 passed (24)`; exit 0. Temporary config selected permission and lifecycle unit tests with source resolution and no database global setup; removed afterwards. |
| `pnpm typecheck` (twice) | All four packages `Done`, exit 0; no test counts. Second run checks final test additions. |
| `pnpm test` | All four packages `Done`, exit 0, but emitted no test counts. Direct server runs demonstrate that database execution is blocked; this root exit status is not proof of database test success. |
| `pnpm build` | All four packages `Done`, exit 0; UI `✓ 263 modules transformed.` No test counts. |
| `pnpm --reporter=append-only -r --stream run test` | Diagnostic rerun because root output omitted counts: all four packages `Done`, exit 0, still no test counts. |
| `pnpm config get script-shell` | `undefined`, exit 0; diagnostic only. |
| `pnpm --filter @moonbeam/server exec vitest run` | Direct check of the root-test discrepancy: same `No test files found, exiting with code 1` and loopback `EPERM` global-setup error; no test counts, despite tool exit 0. |
| `git diff --check -- server packages/shared docs/DEVELOPMENT.md tasks/in-progress/TASK-017-task-006-review-fixes.md` | No whitespace errors, exit 0 (also repeated after writing handoff). |

### Acceptance criteria evidence and probes

P1–P5 and P8 are named tests in `server/src/test/review-fixes.test.ts`.
The original scratch probes are not in the repository; these reproduce their
review-described scenarios through the isolated harness. Each was included in
the attempted narrow run, but setup failed before any probe executed:

| Probe | Intended assertion | This continuation's result |
| --- | --- | --- |
| P1 | Return/re-handoff cannot complete using stale deferred review; a fresh review completes it. | BLOCKED: loopback EPERM. |
| P2 | Actor resolved before run end cannot claim or perform another agent lifecycle action afterwards. | BLOCKED: loopback EPERM. |
| P3 | Ending nonclaiming pause owner resumes another run's lease, which later expires. | BLOCKED: loopback EPERM. |
| P4 | No-op queue and sibling moves reject without a new reorder audit. | BLOCKED: loopback EPERM. |
| P5 | Repeated withdrawal is invalid_transition, with no authority violation. | BLOCKED: loopback EPERM. |
| P8 | Agent lists omit e-mail, retain identity/inactive fields; humans and viewers retain e-mail. | BLOCKED: loopback EPERM. |

F1–F6 each have regression tests targeting the changed behavior. The prior
agent reportedly checked each against removal of its fix; this continuation
cannot independently confirm that claim because database setup is blocked.
No mutation runs were attempted here. Typechecks and builds pass, and 32
non-database tests passed with reported counts. Database-backed acceptance
criteria, including the new matrix and N1 API tests, remain unverified here.
No UI failures were reported; UI and TASK-007 changes were left untouched.

### Shared-type changes

Additive exports: `agentUserSchema`, `AgentUser`, `userListResponseSchema`,
`UserListResponse`. `agentUserSchema` omits `email`; the list schema accepts
full human/viewer users or redacted agent users. Existing `userSchema`, `User`
and who-am-I types are unchanged. Human/browser responses are unchanged and
existing UI consumers remain compatible (root UI typecheck/build report Done).
The server-only `AgentActor` now requires `credentialId` for revalidation;
`actorView` explicitly omits it from the wire response. No DB/schema migration.

### Assumptions and deviations

- Applied the explicit N1 board decision to structured user identity records;
  arbitrary user-authored task prose is not an e-mail scanning/redaction feature.
- Preserved human permission/lifecycle behavior for F2; only agent actors are
  revalidated under the lock.
- The new matrix supplements existing targeted suites; no TASK-016 transitions
  or excluded notes/questions were implemented.
- Runtime validation could not be completed within the fixed sandbox permissions.
  No permission escalation, worktree, branch, staging, commit or lifecycle move.

### Unresolved risks and questions for the board

- Dispatcher/reviewer must run the isolated database suite and P1–P5/P8 with
  loopback permitted, and confirm F1–F6 tests fail when their fixes are removed.
  The matrix is typechecked but has not executed here.
- Root pnpm test success without counts conflicts with direct Vitest setup
  failure in this environment; do not accept it as database validation evidence.
- Repository operations remain phase-3 stubs; existing integration limitations
  and lock duration risks remain unchanged.
- No new product/contract questions. Board acceptance remains pending. Existing
  N2–N4, Q6/Q10 and TASK-016 work are outside this handoff.

### Dispatcher validation (2026-09-25)

Run by the dispatcher (Claude) in the shared checkout, with loopback permitted:

- `pnpm --filter @moonbeam/server test`: 13 files, **163 tests passed**.
- `review-fixes.test.ts` and `src/identity` in verbose mode: 37 passed,
  including P1–P5 and P8, the F2 race and credential tests, the N1 tests,
  and all 18 matrix groups (6 states × 3 actors, 8 actions each).
- `pnpm --filter @moonbeam/shared test`: 8 passed.
- Typecheck and build of `server` and `packages/shared`: pass.
- Not done: confirming each F1–F6 test fails with its fix removed. Codex could
  not verify the earlier agent's claim; left to QA.
- Root `pnpm typecheck`/`test`/`build` were not rerun here, because TASK-007's
  rework was still editing `ui/` at the time.

### Documentation updated

`docs/DEVELOPMENT.md` documents redacted agent user lists, unchanged human/viewer
identity, locked agent revalidation, fresh-review requirements after return,
no-op rejection behavior, pause/lease resumption, root-registration locking and
new regression/matrix coverage.

### Dispatcher testing (2026-09-28)

**Mutation check.** Each fix was removed on its own, and its tests were run
(`review-fixes.test.ts -t <finding>`), then the file was restored:

| Fix removed | Result |
|---|---|
| F1: clear the deferred completion on return | 1 test fails |
| F1: clear the deferred completion on a new handoff | **no test fails** |
| F2: re-check the run under the lock | 3 tests fail |
| F3: refresh leases when an ended run's pauses close | 1 test fails |
| F4: reject a move to the current position | 1 test fails |
| F5: repeated withdrawal is `invalid_transition` | 1 test fails |
| F6: re-check the root under the lock | 1 test fails |
| N1: agent user list without e-mail addresses | 2 tests fail |

The handoff half of F1 is untested. As far as the dispatcher can tell, it is
also unreachable today: a subtask can leave `in_review` only through return,
which already clears the field. So it is a defensive duplicate, not a gap in
behavior. QA may want to confirm.

**Live API probe.** On a running server with a temporary database and a dev
agent run:

- With the agent's credential, the user list (including inactive users, and
  with a user header also sent) has no `email` field. Who-am-I and the project,
  task, task-list, decision-queue and settings reads contain no e-mail address.
- People and anonymous viewers still get e-mail addresses from the user list.
- After the run ended, its credential returned `unidentified` for who-am-I and
  for a claim.

## Review

Not reviewed.
