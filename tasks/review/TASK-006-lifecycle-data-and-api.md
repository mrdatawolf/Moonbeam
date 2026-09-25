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

Not reviewed.

## Human acceptance

Pending.
