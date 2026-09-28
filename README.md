# Moonbeam

A LAN-hosted control plane for human-governed AI software development.

Moonbeam gives a small team leverage from specialist AI agents without handing
them the keys. Agents propose, implement, and review. Only humans approve and
accept.

## Where it comes from

Moonbeam is a superstructure on top of
[Project Template DbC](../Project%20Template%20DbC), a development discipline
for a single repository:

- a human owns the project
- specialist agents (architect, contract designer, implementer, UX, reviewer)
  work within narrow roles
- design comes before code, and behavioral contracts define what gets built
- the human approves each task before work starts and accepts the result at
  the end

That template runs on convention. A task's state is the folder its markdown
file sits in, so nothing stops an agent from "approving" work by moving a file.
Nothing shows work across projects, either.

Moonbeam keeps the discipline and adds the missing operational surface. Its
look and feel come from [Paperclip](https://github.com/paperclipai/paperclip)'s
dashboard and run view. Paperclip's autonomy is deliberately left out: no
heartbeats, no self-waking agents, no agent hierarchies, and no self-approval.

## Goals

1. **The server enforces the gates, not convention.** Task lifecycle, claims,
   splits, runs, and pauses live in Moonbeam's database. An agent credential
   can never approve a task or accept work. Humans may override a gate, but
   every override is recorded and reviewed.
2. **Each repository keeps its own knowledge.** Contracts, ADRs, and the
   records of accepted tasks stay in each project as plain markdown. A project
   remains workable by hand if Moonbeam is unavailable. `TEMPLATE/` is the
   drop-in Moonbeam variant of DbC for managed projects.
3. **The board always reviews the real result.** Each task works on its own
   branch in a worktree Moonbeam manages, so people's folders stay untouched.
   The review screen shows the actual outcome: rendered documents, the diff,
   validation results, and the files changed compared with the paths the task
   declared. Accepting, merging into main, and pushing to a remote are three
   separate human steps. Moonbeam never pushes on its own.
4. **One place to see everything.** A single dashboard covers every project's
   tasks, runs, costs, and the decisions waiting on a human.
5. **The process improves itself.** When an agent stops mid-run to ask a
   question, the pause is logged, categorized, and reviewed, so the gap can be
   closed up front next time. Success means fewer pauses per task over time.
6. **Models earn trust.** Moonbeam keeps a track record per model and
   specialist role, based on accepted versus returned work. Local models
   (llama.cpp on the LAN) take on more work as they prove themselves.

## Working in this repository

Start with `CLAUDE.md`, then `AGENTS.md`, `docs/PROJECT.md`,
`docs/ARCHITECTURE.md`, and the ADRs in `docs/decisions/`. Commands and
conventions are in `docs/DEVELOPMENT.md`.

This repository is developed with the classic folder-based DbC workflow: a
task's state is the `tasks/` directory that holds it. `TEMPLATE/` is a
deliverable for managed projects, not instructions for this repository.

## Origin of Design by Contract

The "DbC" refers to Design by Contract, a methodology originated by Bertrand
Meyer in the 1980s and first realized in the Eiffel programming language. This
system borrows its spirit (explicit obligations, verifiable behavior, clear
responsibility boundaries) and applies it to the human and agent development
process itself.

Further reading: Bertrand Meyer, *Object-Oriented Software Construction*
(Prentice Hall, 1988; 2nd ed. 1997).
