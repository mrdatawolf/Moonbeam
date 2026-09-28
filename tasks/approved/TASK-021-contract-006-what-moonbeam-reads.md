# TASK-021: CONTRACT-006, what Moonbeam reads from a DbC project

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006 (new)
Related ADRs: ADR-008 (Proposed, TASK-020), ADR-007
Dependencies: TASK-020 accepted and ADR-008 approved, including its
template-location decision (A or B)

## Desired outcome

An approved contract defines exactly what Moonbeam reads from a DbC project on
GitHub, and what it shows and flags from that. It is the "DbC is the API"
interface: a project that follows it is fully visible in Moonbeam, and one
that doesn't is flagged, not broken.

## Context

Under ADR-008, Moonbeam is a read-only observer. It polls each project's
GitHub repository and builds its picture from the main branch's history and
the DbC files in it. Proposals and approvals are commits to main. Acceptance is
the merge of the task's branch into main.

## Scope

### Included

`docs/contracts/CONTRACT-006-what-moonbeam-reads.md`, status Proposed,
following `docs/contracts/TEMPLATE.md`. It covers:

- **The source.**
  - the GitHub repository and its main branch
  - polling and its interval
  - a read-only token
  - behavior when GitHub is unreachable, or a repository is renamed, deleted,
    or force-pushed
- **The task file format Moonbeam parses.**
  - required and optional header fields: ID, title, approval, acceptance,
    assigned agent or model, paths, related contracts and ADRs, dependencies
  - tolerance for older or malformed files: flag them, never fail
  - the version of the DbC template the contract reads
- **The derived task history.** When a task was first seen in `proposed/`,
  `approved/`, and `completed/` on main, taken from commits, and who authored
  each commit.
- **The other artifacts read:** contracts, ADRs, and `docs/PROJECT.md`
  (project goals). Moonbeam renders them read-only.
- **The per-project view:**
  - the lead developer, who is a board member assigned in Moonbeam
  - proposed tasks
  - approved tasks and how long they have waited
  - recently completed work
  - activity over time
  - the flags
- **The flags (detection, ADR-007).** For each flag: the exact rule, the
  evidence shown, and whether a board member can dismiss it with a note.
  Start from ADR-008's list, including the staleness threshold.
- **Identity.** How commit authors map to board members, and what happens when
  they don't match.
- **Failure behavior and validation requirements.**

### Excluded

- Any write to a repository or to GitHub.
- Approving, accepting, or any other action from Moonbeam.
- Sub-projects and concurrent lead developers.
- Pauses, runs, costs, and track records.
- UI design beyond the information each view must show.
- Implementation.

### Paths

- `docs/contracts/CONTRACT-006-what-moonbeam-reads.md`

## Acceptance criteria

- [ ] CONTRACT-006 exists with status Proposed and follows the contract
      template.
- [ ] Every header field Moonbeam depends on is named, with its format and
      whether it is required.
- [ ] Every flag has a rule precise enough to test against a sample
      repository history.
- [ ] Every failure case of the source (unreachable, renamed, force-pushed,
      malformed files) has defined behavior.
- [ ] Open questions are listed for the board rather than decided.

## Validation requirements

Dispatcher read-through against ADR-008 and the current DbC task template. Then
a walk-through of the contract against this repository's own `tasks/` history
as a worked example.

## Risks and assumptions

- This repository commits lifecycle moves directly to main, so it is a useful
  worked example. It is not a perfect one, because tasks here aren't branched.

## Blocker

Waiting on ADR-008 approval.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
