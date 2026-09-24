# TASK-001: Create the Moonbeam TEMPLATE folder

Owner role: Librarian
Assigned agent:
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

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
