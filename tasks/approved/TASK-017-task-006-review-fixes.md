# TASK-017: Fix TASK-006 review findings F1–F7; hide e-mail addresses from agents (N1)

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick
Approved date: 2026-09-25
Related contracts: CONTRACT-005 (supersedes CONTRACT-001), CONTRACT-002
Related ADRs: ADR-003, ADR-006, ADR-007
Dependencies: TASK-006 (completed; this task fixes its review findings). Must
finish before TASK-016 starts, because both change `server/` and TASK-016
builds on this code.

## Desired outcome

The lifecycle server fixes the findings from TASK-006's QA review, and agents
can no longer read users' e-mail addresses.

## Context

TASK-006 was accepted and moved to `completed/`. Its QA review (in the TASK-006
task file, "Review") reported two major findings (F1, F2), four minor findings
(F3–F6), and test gaps (F7). The board decided on 2026-09-25 that these are
fixed in a new task rather than by reopening TASK-006.

The board also answered note N1 on 2026-09-25: agents see only users' display
names, not their e-mail addresses, because they have no need for them.

## Scope

### Included

Each finding, with its scenario and suggested resolution, is described in
TASK-006's review. In short:

- **F1 (major):** a returned subtask can later complete by citing a stale
  review. Clear the pending deferred completion whenever a subtask leaves
  `in_review` and whenever a new handoff is recorded.
- **F2 (major):** an agent action can be applied after its run has ended.
  After taking the project lock, re-check that the run is active and its
  credential is not revoked or expired.
- **F3:** ending a run in the no-claim branch leaves another run's lease
  suspended. Refresh leases for the tasks whose pauses were closed.
- **F4:** a D1 move to the task's current position succeeds and is audited.
  Reject it with `invalid_transition`, or skip the audit record.
- **F5:** an agent repeating its own withdrawal gets `authority_violation`.
  Return `invalid_transition` when the task is already terminal.
- **F6:** changing the projects root can race with project registration. Read
  and check the root inside the locked transaction.
- **F7:** add regression tests for F1–F6, including return and re-handoff
  after a deferred T8 and an agent action racing the end of its run. Consider
  a table-driven state × action × actor matrix.
- **N1 (board decision):** a request with an agent credential gets users'
  display names (and whatever else the agent views need, such as ids and the
  inactive marker) but never their e-mail addresses. This applies to the user
  list and anywhere else a user record reaches an agent. Humans and viewers
  are unchanged.
- Update `docs/DEVELOPMENT.md` where the behavior it documents changes.

### Excluded

- TASK-006 notes N2 (agents adding blockers to their own handoff), N3 (view
  performance), and N4 (dev pause permission name). They stay open.
- TASK-006 handoff questions Q6 and Q10. They await a board decision.
- Anything in CONTRACT-005 that TASK-016 covers.

### Paths

- `server/`
- `packages/shared/`
- `docs/DEVELOPMENT.md`

## Plan

## Acceptance criteria

- [ ] F1–F6 are fixed, each with a regression test that fails without its fix.
- [ ] The F7 test gaps are covered.
- [ ] A request with an agent credential never receives a user's e-mail
      address. A test proves it for the user list and for who-am-I.
- [ ] Humans and viewers still see e-mail addresses where CONTRACT-002 shows
      them.
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. Re-run the TASK-006 review
probes P1–P5 and P8, and record their results in the handoff.

## Risks and assumptions

- Assumes N1 reads CONTRACT-002 as already permitting this: its interface
  lists humans and viewers as callers of "list users", not agents. If the
  implementer finds a contract rule that requires agents to see e-mail
  addresses, stop and ask.
- F2's fix touches every agent action. It must not change human-action
  behavior.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
