# Project AI Handbook

This repository uses a human-led, specialist-agent development process. The human
owns project goals, priorities, architecture, implementation order, and final
acceptance.

## Foundational rules

1. Understand and design meaningful changes before implementing them.
2. Do not begin implementation without an approved task.
3. Implement approved behavior without silently expanding scope or inventing
   architecture.
4. Escalate material ambiguity, architectural decisions, and conflicting
   instructions to the human.
5. Keep lasting project knowledge in the repository rather than in chat history.
6. Treat independent review and human acceptance as distinct from implementation.
7. Do not continue beyond the responsibility assigned to your role.

## Required reading

- `AGENTS.md` expands this handbook into detailed operating instructions.
- `docs/AI_DEVELOPMENT_SYSTEM.md` describes the development philosophy and team.
- `docs/workflow/lifecycle.md` defines task movement and authority.
- `docs/DEVELOPMENT.md` contains project-specific commands and conventions when
  they have been selected.

`AGENTS.md` may clarify this file but must not contradict it. If instructions
appear inconsistent, stop and ask the human to resolve the conflict.

## This repository versus `TEMPLATE/`

This repository is developed with the classic folder-based DbC workflow
described above: a task's state is the `tasks/` directory that holds it.

`TEMPLATE/` is a deliverable for Moonbeam-managed projects, not instructions for
this repository (ADR-004). Its CLAUDE.md, AGENTS.md, and workflow docs describe
the Moonbeam variant, in which Moonbeam holds task state and there are no
lifecycle directories. Do not follow them when working here; edit them only
under a task that covers `TEMPLATE/`.
