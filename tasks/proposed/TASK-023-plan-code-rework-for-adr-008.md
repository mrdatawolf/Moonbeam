# TASK-023: Plan the code rework for ADR-008 and CONTRACT-006

Owner role: Architect
Assigned agent: jarvis (with Claude writing the files)
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by:
Approved date:
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-002, ADR-008, ADR-009
Dependencies: TASK-021 (CONTRACT-006 approved)

## Desired outcome

The board has an ordered set of proposed implementation tasks that turn the
current code into what ADR-008 and CONTRACT-006 describe. Each task is small
enough to hand to Codex, with its paths, acceptance criteria, and validation.
Any technical decision the tasks depend on is presented for the board to
decide first.

## Context

The current code is built for the old direction:

- a lifecycle service with claims, leases, and splits
- agent run credentials and the development routes
- a task board, decision queue, and task actions
- registration of local repositories under a projects root

ADR-008 keeps the stack, the users and user select, the audit trail, and the
dashboard shell. It re-points registration at GitHub and shelves the rest.
CONTRACT-006 defines what must be built:

- polling and reading main
- parsing DbC task v1
- task history
- flags and flag records
- identities with several e-mails and logins per member
- the per-project view

## Scope

### Included

- **Decisions to present before any task.** For each, give the options, a
  recommendation, and the consequences.
  1. **How Moonbeam reads GitHub.**
     - A local bare mirror per project, kept up to date with `git fetch`
       (history, diffs, and first-parent walks are local and fast).
     - Or the GitHub REST or GraphQL API only.
     - Or a mix.
     A mirror would be Moonbeam holding a copy of each repository, which
     ADR-006 forbade. ADR-008 supersedes ADR-006, but say explicitly whether
     this needs an ADR.
  2. **Token configuration** per GitHub owner (CONTRACT-006 Q11): where it
     lives and how it is loaded.
  3. **Removing the shelved code** before, during, or after the new features,
     and whether its database tables are dropped or left in place.
  4. **Whether this repository adopts DbC task v1 for its own tasks**, so
     Moonbeam can watch itself as the first project.
- **A proposed task sequence**, each written as a task file in
  `tasks/proposed/` using `docs/templates/task.md`. It will likely include:
  - schema and migrations for the project registration fields, identities,
    history, and flag records
  - the GitHub reader
  - the DbC task v1 parser, with the P and H rules
  - flag evaluation (FL-1 to FL-11)
  - flag records and dismissal (FG)
  - identity management in the UI
  - the per-project view (D rules)
  - the cross-project dashboard
  - removal of the shelved code

  Set dependencies and paths so tasks with separate paths can run in
  parallel.
- A short plan summary in this task's handoff: the order, the dependency
  graph, and the decisions needed.

### Excluded

- Implementing anything.
- Changing CONTRACT-006. If planning finds a gap in the contract, raise it as
  a question. A fix would be a superseding contract.
- The upstream DbC template changes.

### Paths

- `tasks/proposed/` (new task files only)
- this task file

## Acceptance criteria

- [ ] Each of the four decisions is presented with options and a
      recommendation, and none is taken without the board.
- [ ] Every CONTRACT-006 rule group (S, P, H, R, D, FL, FG, I, L, F) is
      covered by at least one proposed task, and the handoff shows the
      mapping.
- [ ] Each proposed task has paths, acceptance criteria, validation, and
      dependencies.
- [ ] No code is changed.

## Validation requirements

The dispatcher checks the rule-group coverage against CONTRACT-006, and checks
that the paths of any tasks planned to run in parallel don't overlap.

## Risks and assumptions

- The proposed tasks assume the board's answers to the four decisions follow
  the recommendations. If the answers differ, the affected tasks are revised
  before approval.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
