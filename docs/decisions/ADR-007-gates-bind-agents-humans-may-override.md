# ADR-007: Gates bind agents; humans may override, and every override is recorded

Status: Approved
Approved by: Patrick
Approved date: 2026-09-25
Date: 2026-09-25
Decision owners: Board (principle drawn from Patrick's answers, 2026-09-25)
Related tasks and contracts: CONTRACT-001, CONTRACT-004, ADR-003, ADR-005, ADR-006

## Context

Separating acceptance from merging (the ADR-005 amendment) raised a run of edge
cases in which a person acts on a repository outside Moonbeam's steps:

- merging before acceptance
- merging by hand after a refused merge
- a merge authored by someone other than the acceptor
- accepting work with a known conflict

The board answered each one the same way: the human's action stands, and
Moonbeam notes it for later review.

## Decision

1. **Gates bind agents, not humans.** The approval, acceptance, merge, and push
   gates exist so that agents cannot act beyond the board's decisions. They
   do not stop a board member from acting directly.
2. **Moonbeam never blocks or reverts a human override** made outside it, such
   as a hand merge, a hand commit, or a hand push. It detects the override where
   it can and reconciles its own state to what happened.
3. **Inside Moonbeam, the default path follows the process, and an explicit
   override is available where the board has decided so.** Example: accepting
   a task with a known merge conflict is refused by default and offers an
   "accept anyway" override.
4. **Every override is recorded**: who, when, what was bypassed, and the
   reason when one was given. It is noted on the task and in the task record
   written to the repository.
5. **Overrides are reviewed like pauses.** Moonbeam lists them in an override
   review, so the board can see where the process creates friction and improve
   it.

## Consequences

### Benefits

- Future edge cases of the "a human acted outside the process" kind have a
  default answer.
- The process stays honest: nothing is hidden, and friction becomes visible
  data.

### Costs and risks

- Overrides can become habitual. The override review exists to catch that.
- Detection is best-effort for actions taken outside Moonbeam (for example, a
  hand squash merge may not be recognizable). Undetected overrides are a known
  limit.

## Follow-up work

- TASK-014 applies the 2026-09-25 board answers that rely on this principle.
- The override review screen belongs with the pause review work (phase 4).

## Amendment — 2026-09-28: decision 4 superseded in part by ADR-009

The decision text above is left as approved. ADR-009 (Approved) rejects the
clause of decision 4 that notes overrides "in the task record written to the
repository". Under ADR-008, Moonbeam is read-only. Overrides are detected as
flags (CONTRACT-006), and flags, dismissals, and notes live only in Moonbeam.
Decisions 1, 2, 3, and 5 stand. Decision 5's override review is the flag
review in CONTRACT-006.
