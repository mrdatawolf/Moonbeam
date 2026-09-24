# ADR-004: The Moonbeam DbC variant lives in Moonbeam's TEMPLATE folder

Status: Approved
Date: 2026-09-24
Decision owners: Board
Related tasks and contracts: ADR-001

## Context

ADR-001 changes how DbC works in managed projects: lifecycle state moves to
Moonbeam, subtasks are approved automatically within their parent's scope
envelope, pauses become a first-class record, and the task record is written
by Moonbeam at acceptance. The upstream `Project Template DbC` repository should
remain the standalone, folder-based system.

## Decision

1. The Moonbeam variant of DbC lives only in this repository, in `TEMPLATE/`.
   The upstream template is not modified.
2. `TEMPLATE/` holds exactly what is dropped into a project so it follows
   Moonbeam principles: CLAUDE.md, AGENTS.md, workflow docs, role docs, and the
   task, contract, ADR, and handoff templates, adjusted for Moonbeam-held state.
3. Moonbeam's own development uses the classic folder-based DbC in this
   repository's root until Moonbeam can manage itself. Moving Moonbeam onto
   itself will be a later decision.

## Alternatives considered

- **Push the changes upstream as a "managed" mode.** Rejected. It couples two
  projects with different goals.
- **Generate the template from code.** Premature. Plain files are easier to
  review and edit.

## Consequences

### Benefits

- The upstream template stays simple and standalone.
- Onboarding a project is a copy of one folder plus registering it in Moonbeam.

### Costs and risks

- The root docs (classic DbC) and `TEMPLATE/` (Moonbeam variant) can confuse
  agents working in this repository. Root CLAUDE.md must state that `TEMPLATE/`
  is a deliverable, not instructions for this repository.
- Improvements to upstream DbC must be ported by hand.

## Follow-up work

- A task to create `TEMPLATE/` from the current DbC files with the ADR-001
  adjustments.
