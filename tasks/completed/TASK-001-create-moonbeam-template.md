# TASK-001: Create the Moonbeam TEMPLATE folder

Owner role: Librarian
Assigned agent: librarian
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts:
Related ADRs: ADR-001, ADR-004
Dependencies: ADR-001 and ADR-004 accepted

## Desired outcome

`TEMPLATE/` contains everything a new project needs to follow Moonbeam
principles, adapted from the current DbC files.

## Context

ADR-001 moves lifecycle state out of the repository and into Moonbeam. ADR-004
places the resulting DbC variant in `TEMPLATE/`.

## Scope

### Included

- Copy the DbC handbook, agent instructions, workflow docs, role docs, and
  templates into `TEMPLATE/`.
- Remove the lifecycle directories. Rewrite `lifecycle.md` and
  `approval-gates.md` so that Moonbeam holds state, agents never approve or
  accept, and a task file in a checkout is a read-only snapshot.
- Add rules for splits (subtasks inherit and may only narrow the parent's
  scope envelope, and are approved automatically) and for pauses (how to ask,
  plus the pause categories).
- Add a scope envelope section to the task template.
- Add a note to the root CLAUDE.md that `TEMPLATE/` is a deliverable, not
  instructions for this repository.

### Excluded

- Any Moonbeam code.
- Changes to the upstream `Project Template DbC` repository.

## Plan

## Acceptance criteria

- [ ] `TEMPLATE/` can be copied into an empty repository and read coherently
      with no references to lifecycle directories.
- [ ] Split and pause rules are documented.
- [ ] The root CLAUDE.md distinguishes this repository's process from
      `TEMPLATE/`.

## Validation requirements

A human read-through of `TEMPLATE/` as a newcomer.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Task: TASK-001
Implementer: librarian
Date: 2026-09-24

### Changes made

- Created `TEMPLATE/` (24 files): `CLAUDE.md`, `AGENTS.md`,
  `docs/AI_DEVELOPMENT_SYSTEM.md`; `docs/workflow/` (`lifecycle.md`,
  `approval-gates.md`, `definition-of-done.md`, `change-classification.md`, new
  `splits.md`, new `pauses.md`); `docs/roles/` (architect, contract-designer,
  implementer, reviewer, ux-specialist); `docs/templates/` (task,
  implementation-report, review-report); `docs/contracts/` (README, TEMPLATE);
  `docs/decisions/` (README, ADR-TEMPLATE); blank placeholders
  `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`.
- Lifecycle rewritten for Moonbeam-held state: states `proposed`, `approved`,
  `in_progress`, `in_review`, `completed`, `cancelled`; conditions `blocked`,
  `paused`. Agents never approve or accept. A task file in a checkout is a
  read-only snapshot written by Moonbeam, and editing it changes nothing
  (ADR-001).
- Split rules in `splits.md`: the scope envelope is inherited and can only be
  narrowed; subtasks are auto-approved; each gets its own agent review; there
  is no individual acceptance; the parent enters review when all subtasks are
  done; the board accepts the parent or returns it, optionally reopening
  subtasks (PROJECT.md resolved question).
- Pause rules in `pauses.md`: when to pause, how to ask (category, question,
  context, options, recommendation, effect), five categories, and each
  category's usual fix, which feeds pause review.
- Task template: new "Scope envelope" section (Included, Excluded, Contracts,
  Constraints), a "Parent task" field, and a snapshot notice. The "Blocker"
  section was removed.
- `AGENTS.md` keeps the worktree-subagent guidance. The bullet about duplicate
  lifecycle files is replaced with guidance on passing the uncommitted task
  snapshot to the subagent.
- Root `CLAUDE.md`: added a "This repository versus `TEMPLATE/`" section.

### Validation performed

- Searched `TEMPLATE/` for lifecycle-directory references (`tasks/`,
  `approved/`, `review/`, and similar). There were none.
- Checked the content against ADR-001 through ADR-004 and against the
  PROJECT.md domain language and resolved questions.
- The human read-through required by this task has not been done yet.

### Assumptions and deviations

- The five pause categories come from the dispatch instructions, not from an
  ADR or PROJECT.md. `pauses.md` lists "whether the category list is final" as
  an open question.
- Roles are named by responsibility (Architect (Jarvis), Implementer, UX
  Specialist, Reviewer) rather than by model-bound agent names such as
  openai-coder. This follows PROJECT.md outcome 4, which measures track records
  per model and role.
- Where the ADRs are silent, each workflow doc ends with an "Open questions"
  section. One conservative interim rule is stated there: agents do not cancel
  tasks and may only recommend cancellation.
- No librarian role doc was added, because the root has none.
- Deviation: the implementer session had no shell tool, so it could not run
  `git mv` or `git commit`. This file was edited in place in
  `tasks/approved/`. The coordinator must move it to `tasks/review/` and
  commit.

### Open questions for the board

Who may cancel a task; the mechanism for handoffs, blockers, splits, and
pauses; where accepted task records are written and the commit policy for
write-back; claim timeouts; how a project is worked by hand without Moonbeam;
who may split a task, and whether a subtask can be split again; when a subtask
counts as done; whether helper subagents inside a run count as splits; whether
a run may continue independent work while paused; whether a pause answer can
widen the scope envelope; whether the pause categories are final.

### Unresolved risks

- `TEMPLATE/` refers to "Moonbeam's task lifecycle contract" (CONTRACT-001,
  being written in parallel). It will need reconciling once that contract is
  approved.

### Documentation updated

Root `CLAUDE.md` and all of `TEMPLATE/`.

### Amendment after handoff (2026-09-24, board direction)

After the board chose option C (ADR-005), the dispatcher made these changes to
`TEMPLATE/`:

- `AGENTS.md`: added a "Run branches and review" section.
- `docs/templates/task.md`: added "Paths" to the scope envelope.
- `docs/workflow/splits.md`: added paths to the envelope and to the narrowing
  rule.

The reviewer should include these changes.

## Review

Not reviewed.

## Human acceptance

Pending.
