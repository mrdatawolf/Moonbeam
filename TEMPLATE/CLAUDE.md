# Project AI Handbook

This repository uses a human-led, specialist-agent development process governed
through Moonbeam. The board (the humans who govern work) owns project goals,
priorities, architecture, implementation order, and final acceptance.

Moonbeam holds the workflow state of every task: whether it is proposed,
approved, in progress, in review, completed, or cancelled, and who acted and
when. This repository holds the durable knowledge: this handbook, architecture,
contracts, decisions, and the record of accepted tasks.

## Foundational rules

1. Understand and design meaningful changes before implementing them.
2. Do not begin implementation without a task that Moonbeam shows as approved.
3. A task file in your checkout is a read-only snapshot written by Moonbeam.
   Editing, moving, or deleting it does not change the task's state.
4. Agents never approve tasks and never accept work. Only a board member does.
5. Implement approved behavior within the task's scope envelope without silently
   expanding scope or inventing architecture.
6. When you cannot proceed without a human answer, pause and ask. Do not guess.
7. Keep lasting project knowledge in the repository rather than in chat history.
8. Treat independent review and human acceptance as distinct from
   implementation.
9. Do not continue beyond the responsibility assigned to your role.

## Required reading

- `AGENTS.md` expands this handbook into detailed operating instructions.
- `docs/AI_DEVELOPMENT_SYSTEM.md` describes the development philosophy and team.
- `docs/workflow/lifecycle.md` defines task states and transition authority.
- `docs/workflow/splits.md` and `docs/workflow/pauses.md` define how work is
  divided and how questions are asked mid-run.
- `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, and `docs/DEVELOPMENT.md` contain
  this project's goals, architecture, commands, and conventions.

`AGENTS.md` may clarify this file but must not contradict it. If instructions
appear inconsistent, pause and ask the board to resolve the conflict.
