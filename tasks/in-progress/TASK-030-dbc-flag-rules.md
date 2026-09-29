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
- `packages/dbc/src/parse/` and `packages/dbc/src/history/`: only to keep
  evidence the flags need (board, 2026-09-29, see "Board notes")

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

None. The TASK-029 rework (event paths, snapshot version 2) is in review.

## Implementation handoff

Stopped before implementation: FL-2 requires evidence that the version-2
snapshot does not retain. The FL-9 event-path blocker from the earlier run is
fixed, but this separate gap requires changes outside the authorized paths.

- Files changed: only `tasks/in-progress/TASK-030-dbc-flag-rules.md`, this
  Implementation handoff section. `packages/dbc/src/flags/index.ts` remains
  the stub. No public API or flag implementation was added.
- Blocker: CONTRACT-006 FL-2 requires "the header block as found" in evidence.
  `ParsedTaskFile.header` retains normalized fields, duplicate field names,
  and unattached lines, but loses duplicate values, original whitespace,
  blank lines, and continuation layout. `ProjectSnapshot` retains neither
  the raw header nor task text. A pure evaluator cannot reconstruct it.
- Reproduction: executed a Node fixture against the freshly built DBC
  exports using `buildChainFixture` and `deriveSnapshot`. Both fixtures have
  root → head and `tasks/proposed/TASK-001-example.md`, a valid v1 header
  except for duplicated `Proposed by`. The first occurrence is `Patrick`;
  the second is `Alice` in one fixture and `Bob` in the other. Result:
  `snapshotVersion: 2`, `identicalSnapshots: true`. `v1Problems` returns
  exactly `{ kind: "duplicate_field", field: "Proposed by" }` in both.
  The headers required as evidence differ, but the evaluator inputs do not.
- Required dependency repair: retain the original header block in the parsed
  task record and expose it through the snapshot, including duplicate lines.
  This requires changes under `packages/dbc/src/parse/` and/or
  `packages/dbc/src/history/`, which this assignment prohibits. No such
  changes were made. A file-reader input would also change the assigned
  pure snapshot-based API and was not introduced.
- Validation of existing code (all exit 0; not evidence of implemented flags):
  - `pnpm --filter @moonbeam/dbc typecheck`: passed.
  - `pnpm --filter @moonbeam/dbc test`: 133 tests passed in 12 files.
  - `pnpm typecheck`: passed across all five workspace packages.
  - `pnpm test`: 176 tests passed in 21 files: dbc 133, db 6, shared 4,
    server 12, UI 21.
  - `pnpm build`: passed across all five workspace packages.
  - Commands used `/home/patrick/.nvm/versions/node/v24.16.0/bin` on PATH.
- Acceptance criteria: FL-2's required evidence cannot be produced from the
  supplied snapshot. FL-1–FL-11, Baseline, N3, and UX4 remain unimplemented
  and unverified for TASK-030; no acceptance criterion is claimed complete.
- Deviations and assumptions: stopped under the explicit instruction to stop
  when an out-of-scope change is necessary. "Header block as found" means
  preserving the original header, not substituting normalized fields that
  omit the offending duplicate value. Persistence remains TASK-035 and
  rewrite detection TASK-034. No git write commands were run; no server or
  process was left running. The task remains in-progress for the dispatcher.

## Review

Not reviewed.

## Board notes

**Scope widened by Patrick, 2026-09-29.** The second Codex run stopped
because FL-2's evidence needs "the header block as found". The parser keeps
only normalized fields (a duplicate field's second value is lost), and the
snapshot keeps no raw header.

- This task may also change `packages/dbc/src/parse/` and
  `packages/dbc/src/history/`, only to keep evidence the flags need, such as
  the raw header lines.
- It first checks every flag's evidence (FL-1 to FL-11) against the snapshot
  and fixes every gap in one pass, so it doesn't stop again.
- The handoff lists the parse and history changes separately for review.
  Existing tests keep passing. A snapshot shape change bumps
  `SNAPSHOT_VERSION`.

