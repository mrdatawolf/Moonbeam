# Agent Operating Instructions

Read `CLAUDE.md` first. It is the foundational project handbook. This file adds
operational detail for agents and does not override it.

## Instruction precedence

Apply instructions in this order:

1. Direct board instructions for the current task.
2. `CLAUDE.md` foundational rules.
3. This file and any more local `AGENTS.md` applying to the files being changed.
4. Approved contracts for the behavior in their scope.
5. Current project documentation and accepted ADRs.
6. The approved task, its scope envelope, and its acceptance criteria.

More specific instructions clarify broader ones but do not silently contradict
them. Surface unresolved conflicts to the board by pausing (see
`docs/workflow/pauses.md`) before proceeding.

## Where state lives

- **Moonbeam** is the single source of truth for workflow state: task status,
  claims, splits, runs, pauses, reviews, approvals, and acceptance.
- **This repository** is the source of truth for durable knowledge: handbooks,
  architecture, contracts, ADRs, and the record of accepted tasks.

When a run starts, Moonbeam writes the task file into the working checkout so
you can read your assignment. That file is a snapshot. It may be out of date the
moment it is written, and changing it changes nothing in Moonbeam. Do not edit
it to record progress, blockers, handoffs, or status. Report those to Moonbeam.

When a board member accepts a task, Moonbeam writes the task file, with its
handoff, review, and acceptance, into the repository as the permanent record.

## Before working

1. Read the task snapshot and this repository's guidance.
2. Confirm that you are working under an approved task that you (or your run)
   have claimed. A task is worked by one claimant at a time. If you are not
   running under Moonbeam and cannot confirm the task's state, ask a board
   member. Never infer approval from the presence or contents of a file.
3. Read the linked contracts, ADRs, architecture, and development documentation.
4. Identify the task's scope envelope (see `docs/workflow/splits.md`) and stay
   within it and within your assigned role.

See `docs/workflow/lifecycle.md` for states and transition authority.

## During work

- Preserve unrelated behavior and user changes.
- Record material assumptions and raise decisions that exceed the approved scope.
- When you need a human answer to continue, pause. See
  `docs/workflow/pauses.md` for how to ask and which category to use.
- If the work is better done as several independently reviewable pieces, you may
  split it within the scope envelope. See `docs/workflow/splits.md`.
- Validate changes in proportion to their risk and acceptance criteria.
- Update durable documentation when approved behavior or architecture changes.
- Do not approve tasks, accept work, or mark your own implementation accepted.

## Handoffs

Use the templates in `docs/templates/`. A handoff must state what changed, what
was validated, any deviations or assumptions, and any unresolved risks. Submit
the handoff to Moonbeam for the task; do not rely on editing the task snapshot.

## Run branches and review

Each run works on its own branch, which Moonbeam names and creates. The branch is
the run's work product; the board sees it through Moonbeam's review surface
(rendered documents, the diff, test results, previews), not by checking it out.

- Commit your work to the run branch. Never merge into, rebase onto, or push to
  the project's main branch yourself.
- Stay within the paths in your task's scope envelope. Moonbeam compares the
  branch's changes against them, and the reviewer checks them.
- Your handoff names every changed file by its path in the repository.
- Moonbeam merges the branch only when a board member accepts the task. Merging
  is acceptance. A returned task continues on its branch.

## Dispatching isolated (worktree) subagents

An isolated git worktree forks from the repository's default branch (e.g.
`main`), not from whatever branch the orchestrating session is actually on.
If the real working branch (a feature branch, or uncommitted changes on the
current checkout) isn't on the default branch, a worktree subagent silently
builds on a stale base and can miss files, context, or in-flight work
entirely — with no error, since from its point of view that base is simply
"the repository."

Before dispatching a subagent into an isolated worktree:

- Commit anything the subagent needs to see to the working branch first. A
  worktree only sees committed history, never uncommitted changes sitting in
  the originating checkout.
- The task snapshot Moonbeam wrote into your checkout may be uncommitted and
  therefore invisible to the worktree. Give the subagent the task identifier
  and the parts of the snapshot it needs (desired outcome, scope envelope,
  acceptance criteria) in its prompt rather than assuming it can read the file.
- Explicitly name the real working branch in the subagent's prompt and have
  it sync onto that branch (merge or rebase) before making any changes,
  rather than letting it assume its default fork point is correct.
- A subagent works within your task's scope envelope and role. It does not
  gain any authority you do not have: it cannot approve, accept, or widen scope.
