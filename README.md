# Moonbeam

A LAN-hosted, read-only view across software projects that are developed with
Design by Contract (DbC).

Moonbeam watches DbC projects on GitHub from the top down. It shows the board
what each project has proposed, approved, and accepted, and flags where the
recorded process looks wrong. It does not manage the work. That stays with DbC
and with the person leading each project.

## Where it comes from

Moonbeam sits on top of
[Project Template DbC](../Project%20Template%20DbC), a development discipline
for a single repository:

- a human owns the project
- specialist agents (architect, contract designer, implementer, UX, reviewer)
  work within narrow roles
- design comes before code, and behavioral contracts define what gets built
- the human approves each task before work starts and accepts the result at
  the end

DbC works well inside one repository. It does not show work across projects.
Moonbeam adds that view and leaves the discipline where it is.

## Goals

1. **DbC stays authoritative in each project.** A task's state is the
   `tasks/` directory that holds it. DbC's files are Moonbeam's interface:
   Moonbeam reads them and keeps no task state of its own. A project works the
   same whether or not Moonbeam is running.
2. **Each project has a lead developer.** A board member takes a project,
   becomes its lead developer, and works it locally with their own AI tools
   under DbC.
3. **Proposals and approvals are commits to main.** A proposed task is
   committed to `tasks/proposed/` on main, and approval moves it to
   `tasks/approved/`. Each task is worked on a branch. Merging that branch into
   main, with the task in `tasks/completed/`, is the acceptance.
4. **GitHub is the shared reference point.** Work happens locally and becomes
   visible when it is pushed. Moonbeam polls each project's GitHub repository
   with a read-only token.
5. **Moonbeam is read-only.** It never commits, pushes, approves, accepts, or
   merges. Board members act in the repository, and Moonbeam observes.
6. **Detection, not enforcement.** Moonbeam flags what it can see on main, such
   as a task accepted without an approval or a change no task accounts for.
   Flags never block anything. A board member reviews each flag and may
   dismiss it with a note. Flags and dismissals live in Moonbeam, not in the
   project (ADR-009).
7. **A top-down view.** One view per project, and one across all projects,
   covering proposals, approved work, accepted work, activity, and open flags.

The UI takes its look from
[Paperclip](https://github.com/paperclipai/paperclip)'s dashboard. Paperclip's
autonomy is deliberately left out.

The full definition is in `docs/PROJECT.md`, and the governing decision is
ADR-008 in `docs/decisions/`.

## Working in this repository

Start with `CLAUDE.md`, then `AGENTS.md`, `docs/PROJECT.md`,
`docs/ARCHITECTURE.md`, and the ADRs in `docs/decisions/`. Commands and
conventions are in `docs/DEVELOPMENT.md`.

This repository is developed with the classic folder-based DbC workflow: a
task's state is the `tasks/` directory that holds it.

## Origin of Design by Contract

The "DbC" refers to Design by Contract, a methodology originated by Bertrand
Meyer in the 1980s and first realized in the Eiffel programming language. This
system borrows its spirit (explicit obligations, verifiable behavior, clear
responsibility boundaries) and applies it to the human and agent development
process itself.

Further reading: Bertrand Meyer, *Object-Oriented Software Construction*
(Prentice Hall, 1988; 2nd ed. 1997).
