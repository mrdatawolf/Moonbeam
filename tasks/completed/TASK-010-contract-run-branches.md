# TASK-010: CONTRACT-004: run branches and merge on acceptance

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-004 (produced, Proposed); boundaries with
CONTRACT-001, CONTRACT-002, CONTRACT-003
Related ADRs: ADR-001, ADR-005
Dependencies: None

## Desired outcome

An approved contract for:

- run branch naming and creation
- where checkouts live on runner machines
- updating a stale branch from main
- conflict handling
- the merge on acceptance, with its commit and author policy
- task-record write-back (ADR-001)
- branch cleanup

## Context

These are ADR-005's follow-ups. They are needed before phase 3 runs.

## Scope

### Included

- Behavior for local LAN repositories. External remotes are optional.

### Excluded

- The runner process design itself.

### Paths

- `docs/contracts/CONTRACT-004-run-branches.md`

## Plan

## Acceptance criteria

- [ ] A rejected or cancelled task never changes the main branch.
- [ ] A merge conflict at acceptance has defined behavior.

## Validation requirements

Board review.

## Risks and assumptions



## Blocker

None.

## Implementation handoff

Contract designer (contract-architect), 2026-09-24.

### What changed

- Created `docs/contracts/CONTRACT-004-run-branches.md` (Status: Proposed).
- Updated this task file's "Related contracts" field and this section.

### Behavior defined

- One task branch per task, `moonbeam/TASK-NNN`, created from main at the first
  claim (from the parent branch for subtasks). It is reused across runs and
  returns and is never renamed or reused.
- A split parent's branch is the integration branch. A subtask branch is merged
  into it when the subtask completes (T8). Subtasks never merge into main.
- Only writing runs get a checkout, on the runner's machine (the dev box, or
  the caller's machine for local models, never the llama.cpp host). Read-only
  runs read a fixed commit. The task snapshot is excluded from commits.
- Stale branches: before each writing run, Moonbeam merges the target in if it
  merges cleanly. If it conflicts, the run starts with the conflict stated and
  the claimant resolves it. Moonbeam never resolves conflicts and never
  rebases.
- Acceptance: a no-fast-forward merge commit. The acceptor is the author and
  Moonbeam is the committer, with task, acceptor, and time trailers. The
  merge, the permanent record, and the lifecycle change are all or nothing. A
  conflict at acceptance rejects the accept (`merge_conflict`), leaves main
  unchanged, and the board returns the task. An interrupted accept is rolled
  forward on recovery and main is never reverted.
- Returned tasks continue on their branch. Cancelled and rejected tasks never
  change main. Cleanup covers accepted branches (deleted), cancelled branches
  (retained 30 days), and checkouts. External remotes are optional mirrors
  whose failures never affect acceptance.
- Invariants R1 to R11. The key one is R1: only an acceptance merge changes
  main (scoped to Moonbeam's actions).

### Acceptance criteria

- A rejected or cancelled task never changes main: R1, B10, B11, and
  validation item 9.
- A merge conflict at acceptance has defined behavior: B7 and the
  `merge_conflict` failure category.

### Deviations and assumptions

- ADR-005's "every run works on its own branch" is read as one branch per task,
  worked by its runs in turn. This is flagged as Q1.
- The contract relies on CONTRACT-001 as the board answered it (A2: no
  reopening; A4: returned leaves go to `approved`). That contract is being
  revised in parallel (TASK-004), so transition references use its stable IDs.

### Decisions requiring board approval

Q1 to Q16 in the contract. These need changes to other contracts: Q3 (sibling
overlap on T3), Q4 (system-held parent on subtask integration conflict), Q5
(clean mergeability as a T6 precondition), and Q8 (merge and record all or
nothing, which replaces T9's write-back wording) touch CONTRACT-001. Q7 needs
e-mail addresses in the CONTRACT-002 user registry.

### Validation

Board review. No code or tests are in scope.

## Review

Not reviewed.
