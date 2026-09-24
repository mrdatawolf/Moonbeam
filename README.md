# Moonbeam

A LAN-hosted control plane for human-governed AI software development. Moonbeam
combines the DbC development system (approval gates, behavioral contracts,
independent review, human acceptance) with a dashboard and run view that span
many projects. Agents propose, implement, and review. Only humans approve and
accept.

Start with `CLAUDE.md`, then `AGENTS.md`, `docs/PROJECT.md`, and the ADRs in
`docs/decisions/`.

This repository is developed with the classic folder-based DbC workflow. Task
state is the directory in `tasks/` that holds the task. `TEMPLATE/` (once
created) is the Moonbeam variant of DbC that gets dropped into managed projects.
It is a deliverable, not instructions for this repository.

## Origin of Design by Contract

The "DbC" refers to Design by Contract, a methodology originated by Bertrand
Meyer in the 1980s and first realized in the Eiffel programming language. This
system borrows its spirit (explicit obligations, verifiable behavior, clear
responsibility boundaries) and applies it to the human and agent development
process itself.

Further reading: Bertrand Meyer, *Object-Oriented Software Construction*
(Prentice Hall, 1988; 2nd ed. 1997).
