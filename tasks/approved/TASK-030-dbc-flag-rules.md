# TASK-030: Evaluate flags FL-1 to FL-11 in @moonbeam/dbc

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008, ADR-007, ADR-009
Dependencies: TASK-028, TASK-029

## Desired outcome

`evaluateFlags(snapshot, registration, matcher, now)` returns every flag that
holds, each with its rule, subject, canonical subject key, kind, and evidence.
`rewriteFlag(...)` builds FL-10. The result is pure and deterministic (N3).

## Context

The flag rules come from the approved contract. Persistence and dismissal happen
in TASK-035. The poller detects rewrites (TASK-034) and uses `rewriteFlag`.

## Scope

### Included

- **`packages/dbc/src/flags/`:**
  - Input: `registration { baselineSha, baselineCommittedAt, exemptPaths, staleThresholdDays, leadDeveloper }`.
  - **Evaluated commits:** the chain commits strictly after the baseline. If the baseline is not on the chain, evaluation starts after the newest chain commit whose committer time is not later than `baselineCommittedAt`, and the result sets `baselineNeedsReset` (F6).
  - W(C) = `baseWorkPaths` minus the exempt paths (Q5). Exempt paths use the P7 pattern semantics.
  - **Rules:**
    - FL-1, FL-3, FL-4, FL-8, FL-9, FL-11: event flags, for evaluated commits only
    - FL-2, FL-5, FL-6, FL-7: condition flags, at head, for all tasks regardless of the baseline
    - FL-8 is marked `autoResolves`
  - Each flag's subject and evidence are exactly as CONTRACT-006 states them.
  - Evaluation annotations:
    - `scopeNotCheckable` commits (FL-4 not evaluated)
    - `notFullyChecked` commits (F9)
  - `rewriteFlag(previousHead, newHead, detectedAt, comparison)` for FL-10, which is raised whatever the baseline.
  - An observational `message` per flag (UX4), for example "No approval on main was found before this task was completed".
- Tests using the TASK-029 fixture builder.
- Replacing the `flags/index.ts` stub.

### Excluded

- Flag records, statuses, dismissals, the FL-5 re-raise after dismissal, and FG5 withdrawal (TASK-035).
- Detecting rewrites (TASK-034).

### Paths

- `packages/dbc/src/flags/`

## Plan

1. Compute the evaluated commits and W(C).
2. Implement each rule with a typed subject, a `subjectKey` (a stable string such
   as `FL-1|TASK-012|<sha>`), and evidence.
3. Write a raising case and a near miss per rule (V1).

## Acceptance criteria

- [ ] **FL-1:** raised when a task enters `completed/` with no earlier approved presence on the chain. Near miss: a task approved in an older commit, then completed by a merge commit.
- [ ] **FL-2:** v1 files only. The subject includes the problem set, so a different set gives a different key. Pre-v1 files never raise FL-2 (P9).
- [ ] **FL-3:** W(C) is non-empty and no task is completed at C. Near miss: a commit with only proposals, approvals, or header-only contract edits. Exempt paths suppress it.
- [ ] **FL-4:**
  - raised for paths outside the union of the completing tasks' Paths
  - not evaluated, and the commit listed as `scopeNotCheckable`, when any completing task lacks Paths
  - best-effort Paths used for pre-v1 files (P9)
  - near misses: a directory pattern with and without its trailing `/`, and `**`
- [ ] **FL-5:** the task is in `approved/` only, and its age since the most recent approved entry exceeds the threshold. The subject is (task, entry commit). The evidence includes the lead developer (L2) and `Assigned agent`.
- [ ] **FL-6:** the subject is (ID, set of paths). The evidence gives the commit that last added each path.
- [ ] **FL-7:** every P2 stray reason, P10 unreadable files, and P9 not-v1 files, each with its own reason.
- [ ] **FL-8:** the commit author is unmatched for an approval or an acceptance, or the recorded `Approved by` at C is empty or unmatched (approvals only). The evidence says which check failed.
- [ ] **FL-9:** raised on removal after approval or completion. Near miss: a withdrawn proposal.
- [ ] **FL-10:** `rewriteFlag` evidence carries both heads, the detection time, the count of dropped commits, and the changed tasks. Near miss, tested in TASK-034: an ordinary fast-forward.
- [ ] **FL-11:** raised on entry into `in-progress/` or `review/` at an evaluated commit.
- [ ] **Baseline:** no event flag for the baseline commit or older commits. Condition flags ignore the baseline. The F6 fallback start and `baselineNeedsReset` are tested.
- [ ] **N3:** the same inputs give deep-equal results. `now` is the only clock.
- [ ] **UX4:** messages are observational. None contains "violation" or "blocked".

## Validation requirements

- `pnpm --filter @moonbeam/dbc typecheck` and `pnpm --filter @moonbeam/dbc test`.
- The full `pnpm typecheck`, `pnpm test`, `pnpm build` at handoff.

## Risks and assumptions

- Exempt paths use the P7 pattern semantics. The contract says "paths", so this
  is an assumption.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
