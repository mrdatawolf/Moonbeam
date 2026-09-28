# ADR-008: Moonbeam observes DbC projects through GitHub

Status: Approved
Date: 2026-09-28
Decision owners: Board (direction set by Patrick, planning session 2026-09-28)
Related tasks and contracts: TASK-020, TASK-021 (CONTRACT-006); affects
CONTRACT-002, CONTRACT-003, CONTRACT-004, CONTRACT-005; affects ADR-001,
ADR-003, ADR-004, ADR-005, ADR-006

## Context

Moonbeam was started as a superstructure on top of Project Template DbC: a
top-down view of many projects, with DbC doing the work inside each one.
ADR-001 changed that. Once Moonbeam's database owned every task's lifecycle
state, Moonbeam had to re-specify all of DbC's workflow, including:

- claims, leases, and splits
- agent run credentials
- task branches and worktrees
- merges and the write-back of task records
- a review surface

By 2026-09-28 that came to about 4,500 lines of contracts (CONTRACT-003, 004,
and 005), a working lifecycle service, and a board UI. No agent had run
through Moonbeam yet. Phase 3 (runs) still needed a runs contract, a git
layer, and a runner before anything would work end to end. Concurrent work had
already caused trouble in this repository.

In the planning session of 2026-09-28, the board decided that Moonbeam's job
is to track projects from the top down, not to manage them task by task. That
work belongs to DbC, run locally by the person leading each project.

## Decision

1. **Each project has a lead developer.** A board member takes a project and
   becomes its lead developer and primary stakeholder. They clone it from
   GitHub and work it locally with their own AI tools, under folder-based DbC.
   In V1 every board member may act as stakeholder, lead developer, or both.
   Only one lead developer works a project at a time. Sub-projects, for
   several board members working parts of one project, may be added later.

2. **DbC is authoritative for its project, and its files are Moonbeam's
   interface.** A task's state is the `tasks/` directory holding it, as in
   upstream DbC. Moonbeam derives everything it knows about a project's work
   from the DbC files and git history on the project's main branch. It keeps
   no task state of its own. The exact files, fields, and rules Moonbeam reads
   are defined by CONTRACT-006 (TASK-021).

3. **Proposals and approvals are commits to main.**
   - A new task is committed to `tasks/proposed/` on main and pushed, so the
     board can see and discuss it from Moonbeam.
   - Approval is the task moving to `tasks/approved/` on main, pushed.
   - Only a human approves, as in DbC.

4. **The lead developer works each task on a branch, and the merge is
   acceptance.**
   - The lead developer branches from main after approval.
   - The moves through `in-progress/`, `review/`, and back (a return) happen
     on that branch. Moonbeam doesn't track them.
   - When the human accepts, the task moves to `tasks/completed/` on the
     branch, and the branch is merged into main and pushed. On main, a task
     goes straight from `approved/` to `completed/`, and the merge commit that
     makes that move is the acceptance.
   - This restores ADR-005's original "merging is acceptance". Main holds only
     accepted work, together with proposals and approvals, which are
     authorizations rather than work.

5. **GitHub is the common point of reference.** Work happens locally. The
   signal travels through GitHub, which is the shared remote. Moonbeam reads
   each project's GitHub repository by polling with a read-only token, because
   GitHub webhooks cannot reach a LAN host. A lead developer's work is visible
   to Moonbeam only once it is pushed.

6. **Moonbeam is read-only.**
   - It never commits, pushes, approves, accepts, or merges.
   - Board members act in the repository, and Moonbeam observes.
   - Approving from Moonbeam is not offered. It would need write access to
     GitHub, and it would create a second place to approve that could race
     the lead developer's local main.

7. **Moonbeam detects problems and does not enforce gates.** Moonbeam flags
   violations it can see in main's history, in line with ADR-007: record them
   and review them, never block. The initial list, which CONTRACT-006 makes
   precise:
   - **Approval skipped:** a task reaches `completed/` on main without having
     been in `approved/` on main first.
   - **Incomplete record:** a task file on main is missing required header
     fields or has them empty, for example "Approved by" on an approved task,
     or the human acceptance on a completed one.
   - **Unaccounted change:** a commit on main changes files that no completed
     task in the same merge accounts for.
   - **Out of scope:** a completed task changed files outside its declared
     paths.
   - **Stale approval:** an approved task has not reached `completed/` on
     main within a threshold set by CONTRACT-006.

8. **The DbC changes needed live in one of two places (board decision
   required).** The new rules are:
   - commit proposals and approvals to main
   - merge a task's branch only from `completed/`
   - use a fixed, parseable task header

   See "Alternatives considered" for where they could live.
   **Recommendation: alternative A.**
   - **A.** Change the upstream Project Template DbC directly, and retire
     Moonbeam's `TEMPLATE/`.
   - **B.** Keep `TEMPLATE/` in Moonbeam as "DbC plus Moonbeam conventions".

9. **Deferred.**
   - Agent runs in Moonbeam: the phase 3 plan is on hold.
   - Pauses and pause review are deferred and may be dropped.
   - Costs and model track records.
   - Sub-projects and several lead developers on one project.

### Relationship to earlier decisions

| ADR | Effect |
|---|---|
| ADR-001 | **Superseded.** Decisions 1 and 3 are reversed: Moonbeam's database no longer owns lifecycle state, and the lifecycle directories are back. Decision 2 (repositories hold durable knowledge) stands and now covers task state too. Decision 4 (link to contracts and ADRs, don't copy them) stands. |
| ADR-002 | **Kept.** The stack is unchanged. |
| ADR-003 | **Amended.** Honor-system identity and the user select stay. Decision 3 (agents are never board members, enforced by the server) no longer has an object: agents don't use Moonbeam at all. Decision 4 (the identity seam) stands. |
| ADR-004 | **Superseded in part.** The Moonbeam variant with Moonbeam-held state no longer applies. Where the DbC changes live is decision 8 above. Decision 3 (this repository uses classic DbC) stands. |
| ADR-005 | **Superseded.** There is no Moonbeam-managed task branch, review surface, overlap queue, or merge action. Its original decision 3 ("merging is acceptance") returns in DbC form (decision 4 above). The later amendments separating acceptance from merging lapse. |
| ADR-006 | **Superseded.** The local projects root, the single host, worktrees in `MOONBEAM_HOME`, and the merge and push actions are replaced by GitHub as the reference (decision 5). Its intent that nothing is published without a human holds more strongly than before: Moonbeam doesn't write at all. |
| ADR-007 | **Kept.** "Record and review, never block" becomes Moonbeam's whole stance (decision 7). Its override review is the review of detected flags. |

### Contracts affected

| Contract | Effect |
|---|---|
| CONTRACT-001 | Already superseded by CONTRACT-005. No change. |
| CONTRACT-002 | **Superseded in part.** The user registry, user select, and replacement seam stay. Agent run credentials, the human-only action list, and agent refusal rules no longer apply. A successor contract is needed only if the kept parts change. |
| CONTRACT-003 | **Shelved.** No run view, review surface, or integration panel. The status vocabulary may be reused where it still fits. |
| CONTRACT-004 | **Shelved.** No task branches, worktrees, merges, pushes, or write-back by Moonbeam. |
| CONTRACT-005 | **Shelved.** Moonbeam doesn't run a task lifecycle. |

"Shelved" means the contract no longer governs any planned work, and its status
line will say so. It stays in the repository as a record, and could return
only through a new ADR.

### What happens to the current code

- **Kept:**
  - the stack and monorepo
  - users and the user select
  - the audit trail
  - the dashboard and layout shell
- **Re-pointed:** project registration, from local repositories under a
  projects root to GitHub repositories.
- **Shelved and later removed:**
  - the lifecycle service
  - claims, leases, and splits
  - agent run credentials and the development routes
  - the task board, decision queue, and task actions

  Removing them needs its own task.
- **Kept for now:** the `tools/model-eval` harness. It is independent and not
  wired in.

## Alternatives considered

- **Continue the ADR-001 direction** (Moonbeam owns the lifecycle and runs
  agents). Rejected. It re-specifies DbC inside Moonbeam, it isn't close to
  running end to end, and it makes Moonbeam necessary for every project's
  day-to-day work.
- **Approving from Moonbeam.** Rejected for now. It needs GitHub write tokens,
  and it gives two places to approve, which can race the lead developer's
  local main. The lead developer is a board member and can approve in the
  repository.
- **GitHub webhooks instead of polling.** Rejected. They can't reach a LAN
  host without exposing Moonbeam or adding a relay. Polling is enough for a
  handful of projects.
- **Tracking branches as well as main.** Rejected. It would show in-progress
  and review work, but it depends on lead developers pushing working branches
  and would bring back per-task tracking. Proposals and approvals on main give
  the board what it needs to discuss and authorize work.
- **Template location, alternative A: change the upstream DbC template and
  retire `TEMPLATE/` (recommended).**
  - The new rules are good practice with or without Moonbeam.
  - The Moonbeam-held-state variant in `TEMPLATE/` no longer applies, because
    state is back in folders.
  - There is one DbC, and Moonbeam declares which template version it reads.
  - Cost: ADR-004 decision 1 (upstream is not modified) is reversed, and
    upstream picks up conventions that Moonbeam motivated.
- **Template location, alternative B: keep `TEMPLATE/` as "DbC plus Moonbeam
  conventions".**
  - Upstream stays untouched.
  - Cost: two templates drift and have to be ported by hand, which ADR-004
    already listed as a cost.

## Consequences

### Benefits

- DbC stays the single authority for its project. Projects work exactly as
  they do today whether or not Moonbeam is running.
- Concurrency is left to git. Each task is its own file, so branches that move
  different task files don't conflict.
- Moonbeam gets much smaller:
  - no agent credentials
  - no runner
  - no git write path
  - no lifecycle engine
- Every gate stays checkable, after the fact, from main's history alone.

### Costs and risks

- **Gates are not enforced.** An agent or person can skip approval. Moonbeam
  only flags it after it reaches GitHub. The board accepted this trade
  (2026-09-28).
- **Visibility depends on pushing.** Unpushed work is invisible, and in-flight
  work shows only as "approved, not yet completed".
- **The task file format becomes an interface.** Changes to DbC's templates
  can break Moonbeam's parsing. CONTRACT-006 must name the template version
  and treat unreadable files as flags, not failures.
- **Task IDs are allocated on main.** Two proposals made at the same time
  could take the same `TASK-NNN`. This is unlikely with one lead developer per
  project, and Moonbeam can flag duplicate IDs.
- **Sunk cost.** Much of phases 1 and 2, and all of the phase 3 contracts, are
  shelved.
- **GitHub dependency.** Moonbeam needs network access to GitHub and a token
  per project or organization. A GitHub outage delays updates but loses
  nothing.

## Follow-up work

- TASK-021: CONTRACT-006, what Moonbeam reads from a DbC project.
- The board's choice on decision 8 (template alternative A or B). Then a task
  to make the DbC changes in the chosen place.
- Once this ADR is approved:
  - mark ADR-001, ADR-005, and ADR-006 superseded, and ADR-003 and ADR-004
    amended or superseded in part, pointing to this ADR
  - mark CONTRACT-002 superseded in part, and CONTRACT-003, 004, and 005
    shelved
  - rewrite `README.md`, `docs/PROJECT.md` (purpose, scope, domain language,
    delivery phases), and `docs/ARCHITECTURE.md` for this direction
- Plan the code rework:
  - re-point registration at GitHub
  - build the GitHub poller and parser to CONTRACT-006
  - build the per-project view
  - remove the shelved code

## Amendment — 2026-09-28: board answers at approval

Recorded when TASK-020 was accepted. The decision text above is left as
approved.

- **Decision 8 is resolved as alternative A.** The DbC changes are made in the
  upstream Project Template DbC, and Moonbeam's `TEMPLATE/` is retired. This
  supersedes ADR-004 decisions 1 and 2. CONTRACT-006 reads a named version of
  the upstream template.
- **CONTRACT-003, CONTRACT-004, and CONTRACT-005 are shelved**, as the
  "Contracts affected" table defines. They are not marked superseded.
- **No acceptance section or fields (Board, 2026-09-28).** Acceptance is
  recorded by git: the merge commit that brings the task to `completed/` on
  main, and its author. Task files have no `## Human acceptance` section and no
  acceptance header fields, so decision 7's "incomplete record" example "or the
  human acceptance on a completed one" does not apply. CONTRACT-006 U2 defines
  this.
