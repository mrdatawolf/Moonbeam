# Agent Operating Instructions

Read `CLAUDE.md` first. It is the foundational project handbook. This file adds
operational detail for agents and does not override it.

## Instruction precedence

Apply instructions in this order:

1. Direct human instructions for the current task.
2. `CLAUDE.md` foundational rules.
3. This file and any more local `AGENTS.md` applying to the files being changed.
4. Approved contracts for the behavior in their scope.
5. Current project documentation and accepted ADRs.
6. The approved task plan and acceptance criteria.

More specific instructions clarify broader ones but do not silently contradict
them. Surface unresolved conflicts to the human before proceeding.

## Before working

1. Read the applicable task file and repository guidance.
2. Confirm that the task is in the correct lifecycle directory.
3. Read linked contracts, ADRs, architecture, and development documentation.
4. Stay within the assigned role and scope.

Implementation requires a task in `tasks/approved/`. When assigned, the
implementer moves it to `tasks/in-progress/`. See
`docs/workflow/lifecycle.md` for all transition rules.

## During work

- Preserve unrelated behavior and user changes.
- Record material assumptions and raise decisions that exceed the approved scope.
- Validate changes in proportion to their risk and acceptance criteria.
- Update durable documentation when approved behavior or architecture changes.
- Do not mark your own implementation accepted.

## Handoffs

Use the templates in `docs/templates/`. A handoff must state what changed, what
was validated, any deviations or assumptions, and any unresolved risks.

## Dispatching subagents

The board plans work up front, the work happens out of sight, and the board
reviews the result at the end. That final review only works if the board can see
the result in its normal checkout. These rules exist to guarantee that.

### Work in the shared checkout by default

- Subagents work directly in the orchestrating checkout on the working branch.
  They do not use isolated worktrees unless the rule below applies.
- Tasks may run in parallel only when their **scope envelopes declare
  non-overlapping paths** (see "Paths" in `docs/templates/task.md`). If paths
  overlap or are unknown, the later-approved task depends on the earlier one.
  Record that under its "Dependencies" and do not dispatch it until the earlier
  task has reached `review/` with its work committed. If the earlier task is
  returned, pause the later one until the rework is back in `review/`.
- Only the dispatcher runs git write operations (`git mv`, `git add`,
  `git commit`). Subagents edit files and report. This avoids index-lock
  collisions and supports agents that have file access but no shell.

### The dispatcher owns lifecycle moves

- The dispatcher moves task files between lifecycle directories on the working
  branch: to `in-progress/` when it dispatches, and to `review/` when the handoff
  arrives. Lifecycle state never lives only on a side branch.
- When a task reaches `review/`, the dispatcher commits the task's work together
  with its move. The handoff and the dispatcher's summary must name the changed
  files by their paths in the board's checkout.
- In this repository, work on the working branch in `review/` is not accepted
  work. Acceptance is still the board moving the task to `completed/`. A returned
  task is fixed forward on the working branch.

### Isolated worktrees are the exception

Use an isolated worktree only when parallel tasks must touch overlapping paths or
need an independent build or run environment. In that case:

- Commit everything the subagent needs to see (including its task file) to the
  working branch first. A worktree forks from committed history only, and
  possibly from the default branch rather than the branch you are on. Name the
  real working branch in the prompt and have the subagent sync onto it before
  changing anything.
- When the task reaches review, the dispatcher merges the worktree branch into
  the working branch **before presenting it to the board**. Merge one task at a
  time, in the order they finish, and resolve conflicts within the task's scope.
  Then remove the worktree and its branch.
- Check for duplicate task-lifecycle files left by the merge and remove any
  superseded copy.

These rules come from a run in which three parallel worktree tasks reached
review but existed only on hidden side branches. The board could not see
CONTRACT-001 or the other results, and lifecycle state was split across four
copies of the repository.
