# TASK-006: Lifecycle data model and API

Owner role: Implementer
Assigned agent: implementer (Claude)
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-001, CONTRACT-002
Related ADRs: ADR-001, ADR-002, ADR-003, ADR-005 (with amendments), ADR-006, ADR-007
Dependencies: TASK-004, TASK-005, TASK-012, TASK-013, TASK-014 (all completed)

## Desired outcome

Projects, users, tasks, subtasks, claims, conditions, and the audit trail exist
in Postgres. The server exposes an API that enforces every CONTRACT-001
transition and the CONTRACT-002 actor rules.

## Context

Phase 2 foundation. The UI tasks build on this API.

## Scope boundaries at dispatch (dispatcher clarification, 2026-09-25)

The contracts were revised several times after this task was written. The
clarifications below describe what this task means against the current
contracts. They do not widen it.

- **In:**
  - All CONTRACT-001 task transitions (T1–T12, T14–T16), including the
    accept-anyway override on T9. T9 records acceptance only and never merges.
  - Conditions C1 and C2, where C2 is data only because there are no runs yet.
  - The per-project queue and D1.
  - Path dependencies, including the rule that they are satisfied when the
    earlier work is on main. Nothing is ever "on main" yet, so dependents keep
    waiting until a human uses D1.
  - Claim leases and expiry.
  - The audit trail, including overrides and identity mode.
- **In (CONTRACT-002):**
  - The user registry (first-run entry, email, rename, deactivate).
  - Actor resolution and the human-only gate, checked before lifecycle rules.
  - Agent run credentials: issue, scope, revoke, and reject when expired.
    There are no runs yet, so provide a test and development-only way to mint
    a run credential bound to a task.
  - The `unidentified` and `authority_violation` categories.
- **In (ADR-006, minimal):**
  - Setting the projects root, with refusal inside Moonbeam's install and data
    directories.
  - Registering a project by path, with checks that it is under the root and
    is a git repository.
  - Registering multiple projects.
- **Out (phase 3 and later):**
  - M1, M2, and M3 (merge, hand-merge detection, early merge).
  - Integration status.
  - Push.
  - Relink.
  - Repository scanning for registration.
  - Any git write.
  - Branch-mergeability preconditions. The T6 clean-merge check and the
    known-conflict refusal on T9 are implemented as a pluggable check that
    always reports "mergeable" until phase 3.
  - Runs, pauses, and reviews as run artifacts. T7 records a review as data,
    with the reviewer identified by an agent credential.

## Scope

### Included

- Drizzle schema and migrations.
- Shared zod schemas for API inputs and outputs.
- Express routes for each transition.
- Atomic transitions and concurrent-claim handling as specified.
- A test for every transition, invariant, and failure category.

### Excluded

- Runs, runners, and pauses.
- Repository write-back and branch merging (stubbed at the T9 boundary).
- UI.

### Paths

- `packages/db/`
- `packages/shared/`
- `server/`
- `docs/DEVELOPMENT.md`

## Plan

## Acceptance criteria

- [ ] Each CONTRACT-001 transition has passing tests for allowed actors and for
      rejected actors.
- [ ] Agent actors cannot approve, accept, or return, and the attempt is
      audited.
- [ ] Concurrent claim tests show exactly one winner.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build` pass. Exercise the API manually
against the embedded database.

## Risks and assumptions

This is the largest task so far. It may split into subtasks within these paths.

## Blocker

None.

## Implementation handoff

Task: TASK-006 Lifecycle data model and API
Implementer: implementer (Claude)
Date: 2026-09-25

### Changes made

**Database (`packages/db/`)**

- `src/schema/index.ts`: tables `users`, `settings` (projects root),
  `projects`, `agent_runs`, `run_credentials` (SHA-256 hash only), `tasks`
  (parent, envelope with paths as JSON, queue and sibling position, review
  entry, acceptance fields, `work_on_main` reserved for phase 3), `claims`
  (lease deadline or suspended remainder), `handoffs`, `reviews` (verdict,
  findings, same-model flag), `blockers` (manual and integration), `pauses`
  (data only), and `audit_records` (actor kind, identity mode, run and model,
  system trigger, `rejected` for authority violations, overrides in details).
  Partial unique indexes enforce one active claim per task (I4) and per run
  (I5), and unique active display names.
- `migrations/0000_lifecycle.sql` (generated) and
  `migrations/0001_audit_append_only.sql` (custom). The custom migration adds a
  trigger that refuses UPDATE, DELETE and TRUNCATE on `audit_records`.
- `src/client.ts`, `src/index.ts`: export a `Transaction` type and the
  envelope, handoff and finding record types.

**Shared schemas (`packages/shared/src/`)**

- `errors.ts`: the failure categories and their HTTP statuses, and the error
  body.
- `identity.ts`: identity headers, users, setup, actor views, and the
  development run schemas.
- `lifecycle.ts`: states, envelopes, one input schema per transition, and the
  task, claim, blocker, review, dependency, audit and decision-queue views.
- `projects.ts`: projects, registration, projects root, and the queue view.
- `lifecycle.test.ts`: tests for the failure map and the action inputs.

**Server (`server/`)**

- `src/identity/`:
  - `actor.ts`: resolve actor (R1–R3). An agent credential always means agent.
  - `permission.ts`: check permission, with the fixed human-only list.
  - `credentials.ts`: credential generation and hashing.
- `src/lifecycle/`:
  - `service.ts`: every CONTRACT-001 action, the system transitions T5, T8,
    T12, T14 and T16, lease suspension and expiry, and the development run and
    pause helpers.
  - `context.ts`: the per-action transaction context. It locks the project row
    with `SELECT … FOR UPDATE`.
  - `paths.ts`, `envelope.ts`, `dependencies.ts`: path rules, narrowing, and
    queue, inherited and sibling dependencies.
- `src/registry.ts`: user registry, first-run setup, projects root, and
  project registration. Registration only reads the repository, using
  `git rev-parse`.
- `src/views.ts`: task summary and detail, queue view, and decision queue.
- `src/routes.ts`: one route per action and the reads.
- `src/audit.ts`: append-only audit writer.
- `src/repository.ts`: `RepositoryPort` with a stub that reports mergeable,
  no changed files and integrated. It is the phase-3 seam.
- `src/app.ts`: routes, the error to HTTP mapping, and deferred JSON parse
  errors.
- `src/index.ts`: wiring, a 15-second lease sweep, and `MOONBEAM_DEV_ROUTES`.
- Tests: `src/test/` (the harness, global setup and eight API suites), plus
  unit tests in `src/identity/` and `src/lifecycle/`.
- `vitest.config.ts`: global setup for the isolated Postgres.
- `tsconfig.build.json`: excludes `src/test/**` from the build.
- `package.json`: adds `drizzle-orm` and `zod` as dependencies, and `postgres`
  as a dev dependency. `pnpm-lock.yaml` changed as a consequence. The root
  `package.json` is unchanged.

**Docs:** `docs/DEVELOPMENT.md` now covers the API overview, identity headers,
the endpoint table, the failure category to HTTP mapping, how the tests run,
dev routes, and the phase-3 boundary.

### Validation performed

- `pnpm typecheck`: passes in all four packages.
- `pnpm test`: passes. There are 145 tests:

  | Package | Tests |
  |---|---|
  | server | 131 |
  | shared | 8 |
  | db | 6 (existing) |

  The server tests break down as follows:

  | Suite | Tests |
  |---|---|
  | transitions | 40 |
  | splits | 18 |
  | paths | 15 |
  | conditions | 11 |
  | identity | 12 |
  | queue | 7 |
  | concurrency | 6 |
  | invariants | 5 seeds × 150 random steps |
  | projects | 5 |
  | permission | 5 |
  | envelope | 4 |
  | app | 3 |

  The tests run against one embedded Postgres per run. It uses a temporary
  `MOONBEAM_HOME` on a free port, and each test gets a fresh database cloned
  from a migrated template. The developer's `~/.moonbeam/db` is never used, and
  no processes or temporary directories are left behind.
- `pnpm build`: passes.
- Manual exercise: `pnpm dev:server` ran with `MOONBEAM_HOME` set to a scratch
  directory and `MOONBEAM_DEV_ROUTES=1`, on ports 3100 and 54330, which were
  checked free first. A scratch home was used so the developer's real
  first-run setup was not consumed. The exercise ran these steps with curl:
  1. First-run setup created two users and the projects root.
  2. A git repository was registered as a project.
  3. T1 create (Patrick).
  4. T2 approve (Dana). The audit record showed identity mode `selected`,
     queue position and dependencies.
  5. A dev run was started, and `whoami` returned the agent actor.
  6. T3 agent claim, with a lease deadline.
  7. T6 agent handoff with a commit.
  8. The run was ended.
  9. T7 review by a second run with the same model identifier and a different
     quantization. The review was flagged as same-model.
  10. T9 accept (Patrick). The accepted commit was recorded, integration
      status was `not_merged`, and nothing was merged.

  Authority violations: the agent's attempts to approve (while also sending
  Patrick's user header), accept and move each returned 403
  `authority_violation`. Each attempt appears in the task's audit trail with
  `rejected=true` and in the decision queue's authority-violations group. The
  task state did not change.

  Two more checks: a repeated first-run setup returned 409
  `invalid_transition`, and the credential value appeared in no view.

  The second pass showed the path-dependency rule working. A task on the
  same path as an accepted but unmerged task was rejected with `blocked` until
  Dana moved it with D1.

  The server was stopped with SIGINT to its process group. No process remains,
  there is no `postmaster.pid` in the scratch data directory, and the ports
  are free.

### Acceptance criteria evidence

- **Each transition has tests for allowed and rejected actors:**
  - `transitions.test.ts` covers T1–T4, T6, T7, T9, T10, T15, reopen attempts
    and the audit trail.
  - `splits.test.ts` covers T8, T10 for split parents, T11, T12, T14, T16, the
    integration blocker and deferred T8.
  - `conditions.test.ts` covers T5, C1, C2 and renewal.
  - `queue.test.ts` covers queue dependencies and D1.
- **Agents cannot approve, accept or return, and the attempt is audited:**
  - The identity suite ("every human-only action…") covers 15 attempts. They
    include requests that also name a human, requests against missing tasks,
    and requests with a malformed body. Every attempt is recorded, and each
    appears in the decision queue.
  - `transitions.test.ts` also checks these cases for T2, T4 (break claim),
    T9, T10 and T15.
- **Concurrent claims show exactly one winner:** `concurrency.test.ts` sends
  13 simultaneous claims (12 humans and one agent run). Exactly one succeeds
  and the rest get `conflict` with the claimant named. There is one active
  claim row and one `claimed` record. A second test covers four tasks with six
  claimants each. A third shows the partial unique index refuses a second
  active claim even without the service lock. The suite also covers
  concurrent last-subtask completion (T12 exactly once), add-subtask racing
  entry into review, and accept racing cancel.

### Assumptions and deviations

Where the contracts left implementation room, these readings were chosen
(each is marked in code where it applies):

1. **Locking model:**
   - Every action locks its project row, so a project's actions run one at a
     time. This makes the observable outcome equal some sequential order.
   - An action's time is taken after it acquires the lock.
   - Lease expiry is applied lazily inside actions, before reads, and by a
     periodic sweep. The expiry audit record carries the deadline as its
     effective time.
2. **Dev-only runs:**
   - `POST /api/dev/runs` is human-only (starting a run is human-only) and
     returns the credential once.
   - `…/end` ends the run, revokes its credential and triggers T5. Ending is
     restricted to humans until the runs contract exists.
   - Optional `ttlSeconds` gives an "expired credential" case.
   - Starting a run writes a `run_started` record. This is not a contract
     action; it was added for traceability.
3. **Pauses:** pauses exist as data. Dev endpoints open and close them, so
   T6 rejection and lease suspension can be tested.
4. **Review data:**
   - Verdicts use CONTRACT-003's vocabulary: `pass`, `changes_required`,
     `human_decision_required`.
   - Findings are `{severity, text}`.
   - "Same model" compares the run's model identifier, trimmed and
     case-insensitive. Quantization is a separate run field and is ignored.
5. **Accepted commit:** the handoff commit is optional input. For a split
   parent that entered review by subtasks, the accepted commit is `null` until
   phase 3 records branch heads.
6. **Integration status:** "Accepted, not merged" lists completed top-level
   tasks by acceptance time. Ordering refused merges first needs M1.
7. **Relationship checks:** agent binding is the run's task, its parent, the
   parent's subtasks, its own subtasks, and tasks the run authored. The
   per-action rules then narrow this.
8. **Registration and root:**
   - A project path must be the repository's top-level folder, strictly
     inside the root.
   - The root must be an absolute, existing directory.
   - CONTRACT-004 Q25 decision (a) is implemented: the root cannot change
     while projects would fall outside it.
9. **HTTP statuses:**

   | Status | Categories |
   |---|---|
   | 422 | `validation` |
   | 409 | `invalid_transition`, `conflict`, `blocked`, `merge_conflict` |
   | 503 | `repository_unavailable` |
   | 403 | `authority_violation`, `not_permitted` |
   | 401 | `unidentified` |

   `docs/DEVELOPMENT.md` documents the mapping.

### Contract readings chosen conservatively (questions for the board)

1. **I9 vs T14.** T14 lets a fallen-back parent be claimed and handed off. It
   is then `in_review` with every subtask cancelled, which contradicts I9 ("at
   least one `completed`"). The implementation follows T14/T6 and checks I9
   only for parents that entered review by subtasks. Should I9 be scoped that
   way?
2. **Agent cancel categories.** The implementation returns
   `authority_violation` (audited) when an agent cancels a top-level task
   other than a proposed task its run authored. It returns `not_permitted`
   (not audited) when an agent cancels a subtask it did not create, one that
   has been claimed, or one it is not bound to, following the failure table.
   Is that the intended split?
3. **Target-dependent human-only actions and binding.** Breaking a claim and
   cancelling beyond T15 depend on the target. The binding is checked first,
   so an attempt outside the run's binding returns `not_permitted` rather than
   an audited `authority_violation`. Fixed human-only actions (approve, accept,
   return, move, registry, root, register, start run) are checked before the
   target is loaded.
4. **A human recording a review (T7).** This is not on the human-only list,
   and humans are not T7 actors. The implementation returns `not_permitted`.
5. **Audit record count.** With T10 plus new subtasks, the parent gets a
   single `returned` record listing the subtasks, not also `split`. Each new
   subtask gets both `created_by_split` and `auto_approved`, as T11 says,
   although "exactly one record per affected task" says otherwise.
6. **Path validation.** Paths are validated at T1 and T11, as well as at T2.
   Without an edit action, a glob accepted at creation would make the task
   impossible to approve.
7. **Editing a proposed task.** No endpoint edits a proposed task's envelope.
   Editing workflows are excluded, so a draft must be created complete or
   cancelled and re-proposed. Is an edit action wanted, and who may use it
   (the author run, any human)?
8. **Returning a leaf with new subtasks.** This is rejected with
   `invalid_transition`, because T10 defines additions only for split parents.
   The leaf can be split after the return.
9. **Minor readings:**
   - Deactivating an already inactive user, or reactivating an active one,
     returns `invalid_transition`.
   - An out-of-range D1 position returns `validation`.
   - Renewing a suspended lease resets the remaining time to the full 30
     minutes.
   - The authority-violations group lists the latest 100 attempts. There is
     no acknowledge or dismiss action.
10. **D1 ahead of accepted-but-unmerged work.** A human may move a task ahead
    of an overlapping task that is accepted but not yet on main, because only
    started tasks are protected. In phase 2 this is the only way to unblock a
    dependent. The manual exercise used it.

### Unresolved risks

- **Phase 3 and the project lock.** Repository calls happen inside the action
  transaction, which holds the project lock. When phase 3 replaces the stub
  with real git operations, long merges will serialise the project's actions.
  That may need a different design.
- **Reads that write.** Reads run the lease sweep, so a read can write
  `claim_expired` records. This is intended, but it is a side effect of GET.
- **Honor-system identity.** Human identity is honor-system, as ADR-003
  accepts: any LAN client can send any `X-Moonbeam-User`.
- **Out of scope:** merge (M1–M3), push, relink, integration status, scanning
  and git writes have no endpoints. Their human-only entries are not yet
  enforceable, because no route exists.

### Documentation updated

`docs/DEVELOPMENT.md`: repository layout, the `MOONBEAM_DEV_ROUTES` variable,
testing, the lifecycle API (identity, endpoints, failure mapping, dev routes,
phase-3 boundary), and security notes.

## Review

# Review Report

Task: TASK-006 Lifecycle data model and API (implementation commit b0ad16c)
Reviewer: QualityAssurance (Claude), independent reviewer
Date: 2026-09-25
Outcome: Changes required

Lifecycle note: this file was moved from `tasks/review/` to `tasks/completed/`
in commit 9652bcd, before any review had been recorded. Acceptance is the
board's decision, so the board should confirm whether that move was
intentional. Given this outcome, the recommended state is `in-progress`.

## Contract and acceptance review

Reviewed against CONTRACT-001 and CONTRACT-002 (Approved). I treated these as
intended behaviour, as the board instructed: the I9 correction (the T14
fall-back case) and handoff questions 2–5 and 7–9. Questions 6 and 10 were not
covered by that instruction and are listed under "Human decisions required".

Acceptance criteria:

- **Each transition has passing tests for allowed and rejected actors:** met
  for the transitions in scope. The suites cover T1–T12, T14–T16, C1, C2 (data
  only) and D1. There is no full state × action × actor matrix (CONTRACT-001
  validation item 1). The tests use representative cells instead.
- **Agents cannot approve, accept or return, and the attempt is audited:** met.
  I verified this by reading the code and by the identity suite.
  - `LifecycleService.run` (`server/src/lifecycle/service.ts:145`) rejects
    fixed human-only actions for agents before it looks up the target.
  - The registry routes apply the same rule in `RegistryService.guard`
    (`server/src/registry.ts:64`).
  - A rejected attempt is written after the transaction rolls back
    (`recordViolation`, `service.ts:97`), so the record survives.
- **Concurrent claims have exactly one winner:** met. The project row is locked
  with `SELECT … FOR UPDATE` (`service.ts:171-176`), and partial unique indexes
  back this up (`claims_one_active_per_task_uq`, `claims_one_active_per_run_uq`).
  The concurrency suite shows 13 simultaneous claimants produce one winner.

Verified by reading the code:

- **Order of checks:**
  - Actor resolution (`unidentified`) runs before permission.
  - Permission runs before lifecycle rules.
  - Request bodies are parsed last. Invalid JSON is deferred through
    `INVALID_JSON`, so an agent sending a malformed body to accept still gets
    403.
  - An agent attempt at a human-only action on a missing task is
    `authority_violation`.
- **R2 and R3:** any `Authorization` header makes the request an agent
  request, and the `X-Moonbeam-User` header is then ignored. A malformed,
  unknown, ended or expired credential is `unidentified` and is never retried
  as a human (`server/src/identity/actor.ts:64-92`).
- **System actor:** no header or body field can set the actor kind. The system
  actor is only built inside the server (`systemActor`). User ids must be UUIDs.
- **Credential secrecy (ID9):**
  - Only the SHA-256 hash is stored (`run_credentials.token_hash`).
  - The value is returned only by `POST /api/dev/runs`.
  - No view, audit record or log line includes it. The unhandled-error log
    prints the error, not the request headers.
- **Audit append-only:** a trigger refuses UPDATE, DELETE and TRUNCATE
  (`packages/db/migrations/0001_audit_append_only.sql`).
- **Identity mode and overrides:** human records carry `identity_mode =
  selected`. "Accept anyway" records an override with who, when, what was
  bypassed and the reason (`service.ts:848-854`).
- **Agent binding:** agents are held to their own project for reads and writes
  (`registry.getProject`, `readProject`, `run()`).

## Validation reviewed or performed

Run by me in `/home/patrick/Documents/Github/Moonbeam`:

- `pnpm typecheck`: passes in all four packages.
- `pnpm test`: passes (db 6, shared 8, server 131).
- `pnpm build`: completed; every package reported Done.
- Probe tests: I wrote four scratch tests in the session scratchpad, outside
  the repository. They reuse `server/src/test/harness.ts` and ran through a
  scratch Vitest config against the isolated test Postgres. No repository file
  was changed. Results:
  - **P1:** confirmed finding F1.
  - **P2:** confirmed finding F2.
  - **P3:** confirmed finding F3.
  - **P4 and P5:** confirmed findings F4 and F5.
  - **P8:** confirmed note N1.
- No server was started. I did not repeat the implementer's manual curl
  exercise; for that I rely on the handoff's record.
- Leftover processes: none. Only the system Postgres was running afterwards.

## Findings

**F1 — major. I7 and I13: a subtask can complete without a review of its
latest handoff.**

- **Where:**
  - `LifecycleService.returnTask` (`server/src/lifecycle/service.ts:906`) does
    not clear `pendingCompletionReviewId`.
  - `handoff` (`service.ts:707`) does not clear it either.
  - `releaseDeferredCompletions` (`service.ts:398-406`) later completes the
    subtask with that stale review id.
- **Scenario (confirmed by probe P1):**
  1. Subtask S1 is handed off.
  2. A human blocks the parent.
  3. A reviewer run records a review, so T8 is deferred.
  4. A human returns S1. Return is allowed while blocked (C1).
  5. The parent's blocker is resolved.
  6. S1 is claimed and handed off again.
  7. Any blocker is later added to S1 and resolved.
  8. S1 becomes `completed`, citing the old review. There are 0 reviews
     against its latest handoff.
- **Expected:** a subtask completes only through a review recorded against its
  latest handoff (I7, T8). A return must not leave a deferred completion
  pending.
- **Resolution:** clear `pendingCompletionReviewId` whenever a subtask leaves
  `in_review` (T10), and whenever a new handoff is recorded. Add a regression
  test. The randomized invariant test checks I7 but never reached this path.

**F2 — major. Concurrency rule and CONTRACT-001 precondition 3: an agent
action can be applied after its run has ended.**

- **Where:** the actor is resolved before the action's transaction starts
  (`routes.ts:58`, `actor.ts:72-83`). The run's status is not checked again
  once the project lock is held (`service.ts:171-195`).
- **Scenario (confirmed by probe P2, which reproduces the interleaving
  directly):**
  1. An agent's claim request resolves its actor while the run is active.
  2. The run is ended.
  3. The claim then takes the lock and succeeds.
  4. The task is left `in_progress`, with a claim held by an ended run. T5
     "run ended" has already happened, so nothing ends this claim until its
     lease expires. If the task is blocked, the lease is suspended and the
     claim is held indefinitely.
- **Why it matters:** this outcome matches no sequential order of the two
  actions. The same gap applies to every agent action, including handoff,
  review and add-subtasks.
- **Expected:** an agent action is evaluated against whether its run is active
  at the moment it is applied.
- **Resolution:** inside `run()`, after taking the project lock, re-check that
  the agent's run is active and its credential is not revoked or expired.
  Reject with `unidentified` (or `conflict`) otherwise. Add a test.

**F3 — minor. C2 and "Claim expiry": a lease can stay suspended after its
pause has ended.**

- **Where:** `devEndRun` in the no-claim branch (`service.ts:1264-1269`)
  closes the run's pauses but does not call `refreshLeases` for that task.
- **Scenario (confirmed by probe P3):**
  1. Run A claims a task.
  2. Run B, bound to the same task, opens a pause, which suspends A's lease.
  3. B ends. The task is no longer paused, but A's lease stays suspended.
  4. Two hours later, the claim is still active.
- **Scope:** the path is development-only today, but it is the T5 and C2 logic
  the runs contract will build on.
- **Resolution:** call `refreshLeases` for the tasks whose pauses were closed.

**F4 — minor. Idempotence and audit: a no-op D1 move succeeds and is
audited.**

- **Where:** `move` (`service.ts:1124-1163`).
- **Scenario (probe P4):** moving a task to the position it already holds
  returns 200 and writes a `queue_reordered` record, although nothing changed.
- **Resolution:** reject a move to the current position with
  `invalid_transition`, or skip the audit record.

**F5 — minor. Failure category: repeating an agent's withdrawal is reported as
an authority violation.**

- **Where:** `cancel` (`service.ts:958-964`).
- **Scenario (probe P5):** an agent withdraws its own proposal, then repeats
  the request. The second request gets 403 `authority_violation`, and a
  spurious violation lands in the decision queue. The idempotence rule calls
  for `invalid_transition`.
- **Resolution:** check whether the task is terminal before the
  cancel-beyond-allowance gate, but only when the task is one the agent could
  otherwise cancel.

**F6 — minor. ADR-006 and CONTRACT-004 Q25(a): changing the projects root can
race with project registration.**

- **Where:** `registerProject` reads and checks the root before taking
  `PROJECTS_LOCK` (`registry.ts:299-305`, lock at `:318`). `setProjectsRoot`
  checks the registered projects under that lock.
- **Scenario:** both actions run at once. The new root commits between the
  registration's check and its insert. A project is then registered outside
  the current root.
- **Evidence:** reasoning from the code only; not reproduced.
- **Resolution:** read and check the root inside the locked transaction.

**F7 — minor. Test coverage: gaps behind F1 and F2.**

- There is no test of return or re-handoff after a deferred T8.
- There is no test of an agent action racing the end of its run.
- There is no systematic state × action × actor matrix (CONTRACT-001
  validation item 1). Coverage is by representative cases.
- **Resolution:** add targeted tests, and consider a table-driven matrix.

**N1 — note. Agents can read every user's e-mail address.**

- `GET /api/users` answers an agent credential with every user and e-mail
  address (probe P8).
- CONTRACT-002 lists "any human, and any viewer" as callers and limits agents
  to their own project. User records are not part of any project.
- This is low risk on the LAN, but it should be an explicit decision.

**N2 — note. Agents can add blockers to their own handoff as "reviewer".**

- `addBlocker` treats any bound agent on an `in_review` task as a reviewer
  (`service.ts:1038`). That includes the implementing run whose handoff is
  under review.
- This is low impact, because the blocker is visible and a human can resolve
  it.

**N3 — note. Performance of views.**

- `ViewData.load` reads every user and every run in all projects on each view
  (`views.ts:60-61`), including `auditRecords` for every action response.
- This is acceptable at V1 scale.

**N4 — note. The dev pause endpoints use the wrong permission name.**

- `devOpenPause` and `devClosePause` pass the action name `end_run` to `run()`
  (`service.ts:1278`, `:1303`).
- It works, because humans are checked earlier, but it is misleading.

## Regression and security assessment

- **Authority boundary:** holds for every request that carries an agent
  credential.
  - Fixed human-only actions are gated before the target is loaded and are
    audited: approve, accept including waiver and accept-anyway, return, move,
    start run, user management, projects root, and project registration.
  - Target-dependent actions (breaking a claim, cancelling beyond the agent
    allowance) are checked after binding, as the accepted Q3 reading says.
  - I found no path by which an agent reaches a human-only effect.
  - Merge, push, relink and answering a pause have no routes yet, as the
    handoff says.
- **Binding escape:** none found. Agents cannot claim tasks other than their
  bound task. Actions on other projects are `not_permitted`. Cancelling a
  subtask checks the author run, the binding and whether the subtask was ever
  claimed.
- **Actor timing:** F2 is the one gap. An actor resolved before the lock is
  not re-validated.
- **System-actor spoofing:** not possible from client input (identity test and
  code review).
- **Credential leakage:** none found in responses, audit records or logs.
- **Reads that write:** GET requests run the lease sweep, as the handoff
  records. This is acceptable.
- **Not verified:**
  - Behaviour under real phase-3 repository operations. The stub is always
    mergeable.
  - Performance with large projects.
  - The manual curl exercise, which I did not re-run.
  - Contention between the 15-second sweep and heavy action traffic.

## Recommendations

- Fix F1 and F2, with regression tests, before acceptance.
- Fix F3–F6, which are small. They can be deferred if the board prefers.
- Consider re-validating the actor inside the lock as a general rule. This
  fixes F2 and hardens the seam for the runs contract.
- The phase-3 risk the implementer recorded stands: repository calls happen
  while the project lock is held.

## Human decisions required

- **Handoff Q6:** paths are validated at T1 creation. That is stricter than
  T1's "draft may be incomplete". It is reasonable without an edit action, but
  it is a deviation.
- **Handoff Q10:** D1 can move a task ahead of accepted but unmerged
  overlapping work. That matches the literal D1 constraint, but it lets
  overlapping work proceed before the earlier work is on main.
- **N1:** should agents be able to list users and their e-mail addresses?
- **Lifecycle:** the task file is in `tasks/completed/` without a review.
  Recommended transition: back to `in-progress` for F1 and F2.
