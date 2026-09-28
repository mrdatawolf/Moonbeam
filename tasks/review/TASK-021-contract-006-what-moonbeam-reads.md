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

None. ADR-008 was approved on 2026-09-28, with decision 8 resolved as
alternative A (upstream DbC template).

## Implementation handoff

**Changed:** `docs/contracts/CONTRACT-006-what-moonbeam-reads.md` (new, status
Proposed, 784 lines). No other file changed. Drafted by contract-architect.

**Contents:** the contract defines "DbC task v1", a named version of the
upstream task template. Its numbered rules are:

- S1–S8: the source, including GitHub polling
- P1–P10: parsing
- H1–H9: history from main's first-parent commits
- R1–R6: other documents
- D1–D10: the per-project view
- FL-1 to FL-11: the flags
- FG1–FG7: flag records and dismissal with a note
- I1–I8: identity mapping
- L1–L2: the lead developer
- N1–N6: invariants
- F1–F10: failures
- U1–U9: the upstream template changes required
- V1–V9: validation

Q1–Q16 are open for the board, each with a recommendation.

**Deviations reported by the agent:**

- Upstream `docs/templates/task.md` has no Paths section. Only this
  repository's template has one, so adding it upstream is U3.
- FL-7 (unreadable file) and FL-10 (history rewritten) were added because the
  failure-behavior requirements need them.
- FL-8, FL-9, and FL-11 are proposed additions, left for the board as Q6.
- Flag dismissals live only in Moonbeam (FG7). ADR-008's read-only rule
  prevents writing them to the repository, which departs from ADR-007
  decision 4.

**Dispatcher validation (the agent had no shell):**

- `git log --first-parent --name-status` for TASK-001 to TASK-003. Each was
  added to `tasks/approved/` in the initial commit (83777dc), so none raises
  FL-1. Each moved to `review/` through a worktree merge (67fb264, 988f72f,
  7692d94), which FL-11 would flag. This settles the one unconfirmed item in
  V9.
- Every commit in this repository is authored as
  `Patrick Moon <patrickmoon@outlook.com>`, which confirms V9's FL-8 note.
- `origin` is `github.com/mrdatawolf/Moonbeam`, and only `main` exists
  locally.
- The other V9 expectations are consistent with the first-parent log, and the
  FL-10 reset fixture was not re-derived.

## Review

Not reviewed.

## Human acceptance

Pending.
