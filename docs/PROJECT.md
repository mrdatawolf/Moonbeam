# Project Definition

Status: Draft — pending board approval of this document. Rewritten on
2026-09-28 (TASK-022) for ADR-008, which is approved, together with ADR-009 and
CONTRACT-006. Where this document and an approved ADR or contract differ, the
ADR or contract governs.

## Purpose

Moonbeam is a LAN-hosted, read-only, top-down observer of software projects
that follow Design by Contract (DbC), the upstream Project Template DbC
workflow.

DbC does the work inside each project: design before code, behavioral
contracts, independent review, and human approval and acceptance. A task's
state is the `tasks/` directory that holds it. Moonbeam does not replace any of
that. It reads each project's main branch on GitHub and shows the board what is
proposed, what is approved, what has been accepted, and where the recorded
process looks wrong (ADR-008).

Moonbeam deliberately does **not** manage work. It keeps no task state, runs no
agents, and never writes to a repository or to GitHub. It detects problems and
flags them for review. It does not enforce gates (ADR-008 decisions 6 and 7,
ADR-007).

## Users and stakeholders

- **Board members** — the whole team: the owner, the office manager, two
  primary developers, and two part-time developers. In V1 every board member
  may act as stakeholder, lead developer, or both, and has full authority in
  Moonbeam (ADR-003, ADR-008 decision 1).
- **Lead developer** — the one board member who takes a project and becomes
  its lead developer and primary stakeholder. They clone it from GitHub and
  work it locally with their own AI tools, under DbC. They act in the
  repository, not in Moonbeam.
- **Agents** — AI tools that the lead developer runs locally inside a project.
  They do not use Moonbeam. Moonbeam sees their work only as commits on main.
- **Projects** — DbC repositories on GitHub that are registered in Moonbeam.

## Desired outcomes

1. DbC stays authoritative in each project. A project works the same whether or
   not Moonbeam is running.
2. The board sees each project's state from the top down: proposals waiting
   for discussion, approved work not yet accepted, recently accepted work, and
   activity over time.
3. The board sees the same summary across all projects in one place.
4. Deviations from the recorded process on main are flagged with evidence, so
   the board can review them. Flags never block anything.
5. Every part of the process stays checkable after the fact from main's
   history alone.

## Scope

### Included (V1)

- Registering a project by its GitHub repository, with a tracked branch
  (`main` by default), a lead developer, and a baseline commit (CONTRACT-006
  S1).
- Polling each project's GitHub repository with a read-only token
  (CONTRACT-006 S).
- Reading task files in the "DbC task v1" format of the upstream Project
  Template DbC, and tolerating older or malformed files (CONTRACT-006 P).
- Deriving each task's history from the commits on main (CONTRACT-006 H).
- Flags FL-1 to FL-11, with evidence, and dismissal or reopening with a note
  (CONTRACT-006 FL, FG). Flags and notes live only in Moonbeam (ADR-009).
- A per-project view, including read-only rendered contracts, ADRs, and
  `docs/PROJECT.md` (CONTRACT-006 D, R).
- A cross-project dashboard. It needs its own task.
- A simple user select to set who is acting. No login in V1 (ADR-003).
- Git e-mails, GitHub logins, and name aliases per board member, to attribute
  commits (CONTRACT-006 I).

### Excluded (V1)

- Any write to a repository or to GitHub, including comments, statuses,
  checks, and labels (ADR-008 decision 6).
- Approving, accepting, merging, or any other lifecycle action from Moonbeam.
- Enforcing gates. Moonbeam flags, it does not block (ADR-008 decision 7).
- Running agents, or giving agents credentials for Moonbeam.
- Tracking branches other than the tracked branch, pull requests, issues, and
  tags. Work in `in-progress/` and `review/` on the lead developer's branch is
  not tracked.
- GitHub webhooks. Polling is used, because webhooks cannot reach a LAN host.
- Authentication, RBAC, and roles. A global login system will be integrated
  through an API later.
- Access from outside the LAN, mobile-specific UI, and multi-tenant isolation.
- Scheduled or self-waking agents, agent hierarchies, and agent self-approval
  (Paperclip-style autonomy).

### Deferred (ADR-008 decision 9)

- Agent runs in Moonbeam. The earlier phase 3 plan is on hold.
- Pauses and pause review. These may be dropped.
- Costs and model track records. The `tools/model-eval` harness is kept for
  now but is not wired in.
- Sub-projects, and several lead developers on one project.

## Constraints

- Runs on the office LAN. It needs network access to GitHub.
- Reads GitHub only, with a token that grants repository contents read and
  metadata read. Tokens are configured on the server and never reach the
  browser (CONTRACT-006 S4, Q11).
- Stack follows Paperclip's (ADR-002) so its UI patterns and components can be
  borrowed under its MIT license. PGlite is explicitly not used.
- Reads a named version of the upstream Project Template DbC ("DbC task v1").
  The changes that define it are made upstream by a separate task
  (ADR-008 decision 8, alternative A; CONTRACT-006 U).
- Projects must stay fully workable without Moonbeam. Nothing in a project
  depends on Moonbeam.

## Domain language

- **Board** — the humans who govern work. In V1, every user is a board member.
- **Lead developer** — the one board member assigned to a project, who works
  it locally under DbC (ADR-008 decision 1).
- **Project** — a DbC repository on GitHub, registered in Moonbeam. The
  repository is canonical. Moonbeam holds no task state for it.
- **Tracked branch (main)** — the branch Moonbeam reads, `main` by default.
- **Task** — a DbC unit of work with a desired outcome, scope, and acceptance
  criteria. Its state is the `tasks/` directory that holds it on main.
- **DbC task v1** — the task file format Moonbeam parses, defined in
  CONTRACT-006.
- **Paths** — the files and directories a task declares it may change.
  Moonbeam compares them with what the task's merge actually changed.
- **Proposal** — a task committed to `tasks/proposed/` on main and pushed, so
  the board can discuss it.
- **Approval** — a human moving a task to `tasks/approved/` on main and
  pushing.
- **Acceptance** — a human accepting a task. The task moves to
  `tasks/completed/` on its branch, and the merge commit that brings that move
  to main is the acceptance. Its author is the acceptor (ADR-008 decision 4
  and its amendment).
- **Poll** — one read of a project's GitHub repository by Moonbeam.
- **Baseline** — the commit chosen at registration. Event flags are raised only
  for newer commits.
- **Flag** — a record that something on main does not match the process, with
  its evidence. A flag never blocks anything.
- **Dismissal** — a board member closing a flag with a note, recorded only in
  Moonbeam (ADR-009).
- **Contract / ADR** — as defined by DbC. They live in the project repository,
  and Moonbeam renders them read-only.

## Delivery phases (proposed)

The earlier phase plan (foundation, board surface, runs, pauses, local models,
hardening) was built for ADR-001 and is superseded by ADR-008. Its phases 1
and 2 were built. What that code keeps, re-points, or shelves is in
`docs/ARCHITECTURE.md`.

The work that follows from ADR-008 is listed below. The board sets the order.
TASK-023 is planning the code rework.

1. **Contract:** what Moonbeam reads from a DbC project (CONTRACT-006).
2. **Upstream template:** the DbC changes that define DbC task v1, made in the
   upstream Project Template DbC (CONTRACT-006 U).
3. **Code rework:**
   - re-point project registration at GitHub
   - build the GitHub poller and the parser to CONTRACT-006
   - build the per-project view
   - remove the shelved code
4. **Cross-project dashboard**, under its own task.
5. **Hardening:** roles and permissions, and global login integration.

## Resolved questions

- **Subtask acceptance (2026-09-24).** *Superseded by ADR-008.* Moonbeam no
  longer runs a task lifecycle, so it has no subtasks or splits. Original
  answer: the parent task is the unit of human approval and acceptance.
  Subtasks are approved automatically and reviewed by an agent, but not
  accepted individually. A subtask is done once its agent review is recorded,
  and a fix is a new subtask (CONTRACT-001).
- **Budgets (2026-09-24).** *Superseded by ADR-008.* Costs are deferred.
  Original answer: V1 shows costs but does not budget or enforce them.
- **DbC presentation material (2026-09-24):** removed from this repository.
- **Phase 3 approach (2026-09-28).** *Superseded by ADR-008.* Agent runs in
  Moonbeam are on hold. Original answer: build runs as a thin end-to-end slice
  first, then deepen it. A board member starts a run on an approved task, it
  works on the task branch in a Moonbeam worktree, it hands off, and the board
  reviews and accepts.
- **Where the DbC changes live (2026-09-28).** In the upstream Project Template
  DbC. Moonbeam's `TEMPLATE/` is retired (ADR-008 decision 8, alternative A,
  resolved in its amendment).
- **Acceptance record (2026-09-28).** Task files have no acceptance section or
  fields. Git records acceptance through the merge commit and its author
  (ADR-008 amendment, CONTRACT-006 U2).
- **Where flags and dismissals live (2026-09-28).** Only in Moonbeam, never in
  the repository (ADR-009).
