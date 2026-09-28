# ADR-009: Detection records live in Moonbeam, not in the repository

Status: Approved
Date: 2026-09-28
Decision owners: Board (decided by Patrick, 2026-09-28, CONTRACT-006 Q17)
Related tasks and contracts: TASK-021, CONTRACT-006 (FG7, Q17); ADR-007,
ADR-008

## Context

ADR-007 decision 4 says every override is recorded (who, when, what was
bypassed, and the reason when given) and "noted on the task and in the task
record written to the repository".

ADR-008 made Moonbeam strictly read-only. It never commits or pushes.
Overrides now show up in Moonbeam as flags (CONTRACT-006 FL-1 to FL-11). A
board member may dismiss a flag with a note. Under ADR-008, Moonbeam has no way
to write that note into the repository.

The board considered letting lead developers dismiss flags by committing a
note in the task file, which Moonbeam would read. It chose instead to reject
the repository-record requirement outright.

## Decision

1. **The repository clause of ADR-007 decision 4 is rejected.** The words
   "and in the task record written to the repository" no longer apply.
2. **Flags, dismissals, and their notes live only in Moonbeam**, in its audit
   trail. That record includes who dismissed a flag, when, and the note.
   Moonbeam never writes them to a project repository.
3. **Moonbeam does not read dismissals from the repository.** A note a lead
   developer writes in a task file is ordinary project text. It does not
   dismiss a flag.
4. **The rest of ADR-007 stands:**
   - gates bind agents, not humans
   - Moonbeam never blocks or reverts a human action
   - every override is recorded, now in Moonbeam
   - overrides are reviewed, now through the flag review defined in
     CONTRACT-006

## Alternatives considered

- **Dismiss by committing a note in the repository** (CONTRACT-006 Q17 option
  B).
  - Pros: the explanation lives with the project, and Moonbeam stays
    read-only.
  - Rejected by the board because it adds a convention to DbC for Moonbeam's
    sake.
  - It also still needs Moonbeam-side dismissal for flags that have no task,
    such as a direct commit to main.
- **Moonbeam writes the note to the repository.** Rejected: it contradicts
  ADR-008 decision 6.

## Consequences

### Benefits

- One place for flag history. Moonbeam stays strictly read-only.
- DbC gains no Moonbeam-specific rules for flags.

### Costs and risks

- A project's repository doesn't show why a flagged event was accepted.
  Someone reading the project without Moonbeam sees the history but not the
  board's notes about it.
- Flag history depends on Moonbeam's database being kept and backed up.

## Follow-up work

- CONTRACT-006: resolve Q17 by referring to this ADR (done with this ADR).
- Once this ADR is approved, add a note to ADR-007 that its decision 4 is
  superseded in part by ADR-009.
