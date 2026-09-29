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

Implemented TASK-030 in the shared checkout on main. Ready for independent
review; not marked accepted. The task remains in-progress for the dispatcher.

### Flags work

Files changed:
- `packages/dbc/src/flags/index.ts`
- `packages/dbc/src/flags/types.ts`
- `packages/dbc/src/flags/evaluate.ts`
- `packages/dbc/src/flags/evaluate.test.ts`

Public API: `evaluateFlags(snapshot, registration, matcher, now)` returns typed
flags, canonical project-local subject keys, baseline-reset information,
evaluated commit SHAs, and scope/incomplete-check annotations.
`rewriteFlag(previousHead, newHead, detectedAt, comparison)` builds FL-10.
Exports include `EvaluatedFlag`, `FlagFor`, `FlagRule`, `FlagRegistration`,
`FlagEvaluation`, `FlagHistoryEvent`, and `UnreadableReason`.
Times are explicit ISO strings; lead developer is
`{ userId, displayName } | null`. Event flags expose `subjectCommitSha` for
FG5; FL-8 exposes `autoResolves: true` for FG3. Evidence includes resolved
commit facts rather than only snapshot-local indexes.

### Parse and history evidence changes

Files changed:
- `packages/dbc/src/parse/task-file.ts`
- `packages/dbc/src/parse/task-file.test.ts`
- `packages/dbc/src/history/types.ts`
- `packages/dbc/src/history/derive.test.ts`

Audited FL-1–FL-11 evidence and FG3/FG5 needs before implementation. The sole
remaining retention gap was FL-2's header block. Added
`ParsedTaskFile.rawHeaderLines`, retained automatically in snapshot head and
historical task records, and bumped `SNAPSHOT_VERSION` from 2 to 3.
Duplicate values, continuation layout, whitespace, and blank lines survive;
LF/CRLF terminators are normalized. Existing normalized field behavior is
unchanged. Regression tests distinguish Alice/Bob duplicate-header evidence
and verify historical versus head headers.

### Validation performed

Commands used `/home/patrick/.nvm/versions/node/v24.16.0/bin` on PATH.
Final results, all exit 0:
- `pnpm --filter @moonbeam/dbc typecheck`: passed.
- `pnpm --filter @moonbeam/dbc test`: 182 tests passed in 13 files.
- `pnpm typecheck`: passed across all five workspace packages.
- `pnpm test`: 225 tests passed in 22 files: dbc 182, db 6, shared 4,
  server 12, UI 21.
- `pnpm build`: passed across all five workspace packages.
- `git diff --check`: passed.

All 133 existing dbc tests remain passing; 49 tests were added.

### Acceptance criteria evidence

- FL-1: detects completion without strictly earlier approval; an older
  approval followed by a merge is a tested near miss.
- FL-2: v1-only problems, canonical problem-set subjects, and raw header
  evidence; valid v1 and pre-v1 near misses tested.
- FL-3: evaluates non-exempt W(C); proposals, approvals, header-only contract
  edits, and exempt work are tested near misses.
- FL-4: checks the union of completing tasks' patterns; missing/unreadable
  Paths annotate scope as uncheckable. Best-effort pre-v1 paths, directory
  patterns with/without trailing slash, and `**` are tested.
- FL-5: approved-only state, strictly exceeded threshold, most recent entry,
  lead developer, and per-file Assigned agent are tested.
- FL-6: canonical duplicate path sets retain each path's latest addition
  commit; a single file is a tested near miss.
- FL-7: all P2 stray reasons, P10 failures, absent reads, and not-v1 files
  preserve reason-specific evidence; ignored paths and valid files are tested.
- FL-8: author and approval-name failures are distinguished; acceptance
  checks author alone. Historical names, ambiguity, pre-v1 names, and
  resolution after identity remapping are tested.
- FL-9: removal after approval/completion retains last paths and history,
  including rename/reappearance cases; withdrawn proposals are near misses.
- FL-10: helper retains both heads, detection time, dropped count, and changed
  tasks. Rewrite/fast-forward detection remains TASK-034, as assigned.
- FL-11: each work-state entry raises a flag; edits and departures do not.
- Baseline: events exclude baseline/older commits; all condition rules ignore
  baseline. F6 fallback includes nonmonotonic timestamps and no eligible commit.
- N3/N4: deterministic, JSON-safe evaluation without clock reads or input
  mutation; malformed files and empty snapshots remain evaluable.
- UX4: messages are observational and contain neither prohibited term.
  F9 annotations accompany best-effort FL-3/FL-4 evaluation.

### Assumptions, deviations, and unresolved risks

No scope deviations or unresolved implementation blockers. Exempt paths use P7
semantics. Empty Paths sections are present but declare no matching patterns;
absent or unreadable Paths make scope uncheckable. Duplicate task records
retain evidence per file. FL-10's subject commit is its new head.

Version-2 snapshots require rebuilding before use with this evaluator.
Persistence, dismissals, stale-flag re-raising, and withdrawal/attachment of
withdrawn records to FL-10 remain TASK-035; rewrite detection remains TASK-034.

The only documentation edit is this Implementation handoff section in
`tasks/in-progress/TASK-030-dbc-flag-rules.md`. No git write commands were run,
no unrelated files were changed, and no server or process was left running.

**Dispatcher check:**

- Outside `flags/`, the changes are `parse/task-file.ts` (plus its test),
  which adds `rawHeaderLines`, and `history/types.ts` (plus the derive test),
  which bumps `SNAPSHOT_VERSION` to 3. Both are within the board's widened
  scope.
- Re-ran dbc tests (182 passed) and workspace typecheck.

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

