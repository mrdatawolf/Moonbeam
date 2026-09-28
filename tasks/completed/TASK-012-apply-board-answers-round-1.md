# TASK-012: Apply board answers (round 1) across CONTRACT-001 to CONTRACT-004

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick (instructed in planning session)
Approved date: 2026-09-24
Related contracts: CONTRACT-001, CONTRACT-002, CONTRACT-003, CONTRACT-004
Related ADRs: ADR-005
Dependencies: The board answers `docs/contracts/BOARD-QUESTIONS-2026-09-24.md`

## Desired outcome

All four contracts reflect the board's answers and agree with one another.
Answered questions move to each contract's "Resolved questions". CONTRACT-002,
003, and 004 are ready for board approval.

## Context

Four contracts were written in parallel. Their open questions were merged into
one answer sheet. This task applies the answers back.

## Scope

### Included

- Apply every answer from the board-questions file to the contracts it names.
- Cross-contract consistency:
  - the human-only action list (002) matches the transitions (001)
  - the `unidentified` failure category
  - the merge failure behavior (001 T6/T9 with 004)
  - the run status names (003 with a future runs contract)
- Correct ADR-005's "every run works on its own branch" wording if C1 is
  answered "branch per task". Add an amendment note to the ADR rather than
  rewriting its history.
- Clear the answered items from the open-question lists in
  `TEMPLATE/docs/workflow/lifecycle.md` and `splits.md`.

### Excluded

- New behavior beyond the answers.

### Paths

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md`
- `docs/decisions/ADR-005-review-surface-and-merge-on-acceptance.md`
- `TEMPLATE/docs/workflow/`

## Plan

## Acceptance criteria

- [ ] Every answer is traceable to the contract text it changed (a mapping
      table in the handoff).
- [ ] No two contracts contradict each other on shared terms, actions, or
      failure categories.
- [ ] Any new question is flagged, not decided.

## Validation requirements

The board reviews the diffs.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Agent: contract-architect, 2026-09-24. No git write commands were run; the
dispatcher commits.

### Files changed

- `docs/contracts/CONTRACT-001-task-lifecycle.md` (Status stays Approved; new
  revision entry)
- `docs/contracts/CONTRACT-002-identity.md` (Proposed; revision entry added)
- `docs/contracts/CONTRACT-003-run-and-review-views.md` (Proposed; revision
  entry added)
- `docs/contracts/CONTRACT-004-run-branches.md` (Proposed; retitled "Task
  branches, …"; file name unchanged)
- `docs/decisions/ADR-005-review-surface-and-merge-on-acceptance.md` (dated
  Amendment section only; decision text untouched)
- `TEMPLATE/docs/workflow/lifecycle.md`, `splits.md`, `pauses.md`,
  `definition-of-done.md`, `approval-gates.md`

### Mapping: board item → sections changed

| Item | CONTRACT-001 | CONTRACT-002 | CONTRACT-003 | CONTRACT-004 | Other |
|---|---|---|---|---|---|
| A1 paths/overlap | Definitions (paths, overlap), T2, Scope envelope, T9 out-of-scope for pathless tasks, UX, V11; Q21 resolved; new Q23 | — | SV-3 scope rows, RS-11, state coverage | — | lifecycle.md "Paths and waiting", splits.md envelope |
| A2 inherited/sibling deps | Definitions, T3, T11, "Project queue and path dependencies", I17, V11; Q14 resolved | — | — | B2, B3; Q3 resolved | lifecycle.md, splits.md rule 7 |
| A3 queue position | Definitions (project queue), T2, D1 rewritten ("move task in project queue"), audit `queue_reordered`, I2, I19, failures, Interfaces, UX, V2, V11; Q15 resolved; new Q22 | Human-only list (D1) | — | B2 | lifecycle.md, splits.md open question |
| A4 merge failure | Actors (system), Definitions (system blocker), T6 mergeable precondition, T8 integration, T9 reject-on-failure and merge+record atomic, T12 note, C1 system blocker, I18, repository failure categories, V6/V9/V12; Q17 resolved | System actor section | Revision note, RS-12 note, RS-13, A-1 step 6, Failure behavior, state coverage | B3, B5, B6, B7, B9, R8, R12, Failure behavior, Interfaces; Q4, Q5, Q8 resolved | lifecycle.md, definition-of-done.md, approval-gates.md |
| A5 returned split parent | T3, T6, T9 (review keyed to entry by handoff vs subtasks), T10, T14 note, I4, I20, UX, V1, V7; Q16 resolved | — | RS-12, RS-13, A-3 | Definitions (writing run), B3, B10, R6 | lifecycle.md, splits.md |
| A6 add/cancel runs | Precondition 3, T7 (fix subtasks atomically with review), T11, T12 race, T15, C1, I13, failures, V5, V8; Q18, Q19 resolved | Binding text | — | — | splits.md "Who may split" |
| A7 unblocking | C1, V9; Q20 resolved | — | — | — | — |
| A8 identity basics | Actors, Precondition 1, Audit (identity mode), failure table (`unidentified`, order of checks), V2, V13 | Known limits (Q2), read access (Q4), identity mode (Q5), human-only list aligned (Q7) | — | — | — |
| B1 users | — | User registry (first-run setup, current name in history, any human manages), Interfaces, UX, V6; Q1, Q6, Q8 resolved | — | — | — |
| B2 viewing | — | Human user selection, Interfaces, V5; Q3 resolved | Preconditions; Q15 resolved | — | — |
| B3 display | — | — | SV-5 (USD), SV-6 tab title (new), RV-7, Interfaces pause card; Q7, Q8, Q14, Q16 resolved | — | — |
| C1 branches | Scope (Excluded) wording | — | RV-3, RV-9, RS-2 "task branch" | B1, B2, B7, B11, title; Q1, Q2, Q6, Q12 resolved | ADR-005 Amendment |
| C2 repo location | — | — | — | Definitions, Preconditions 1–2, B13; Q15 resolved; new Q17, Q18 | lifecycle.md open question |
| C3 authorship/records | I18 (hand commits) | Registry e-mail field, resolve-actor fields | SV-3 hand-commit warning, RS-4 branch line, A-1 | Preconditions 3–4, B8, B9, B14; Q7, Q9, Q14 resolved | lifecycle.md, definition-of-done.md, approval-gates.md |
| C4 review evidence | T9 (out-of-scope reason, warnings confirmation, main moved), Audit, UX | — | RS-4, RS-4a, RS-7, RS-11, A-1, A-2; Q3, Q6, Q10 resolved | B6, B7; Q10 resolved | approval-gates.md |
| C5 runs/pauses | T5 (finished/failed/stopped), C2 | Credential lifetime wording | SV-3 canonical run statuses, RV-5, RV-6, RV-8, A-6; Q1, Q2, Q4, Q5, Q17 resolved | B4, B12, R5; Q11, Q13, Q16 resolved | pauses.md (category correction, several pauses) |
| C6 display details | T7 same-model definition | — | Definitions, RS-5, RV-10, RS-13; Q9, Q11, Q12, Q13 resolved | B3 combined result | — |

### Cross-contract consistency checks

- Human-only list (002) = 001's human-only transitions: T2, T9 (incl. review
  waiver), T10, D1, T4 break, T15 beyond agent cases, plus start run, answer
  pause, and user management. Reopen removed.
- Failure categories: `unidentified`, `authority_violation`, `not_permitted`,
  `invalid_transition`, `conflict`, `blocked`, `validation`, `not_found`, plus
  repository categories `merge_conflict`, `repository_unavailable`,
  `branch_name_taken`, `history_rewritten`. Same names in 001, 002, 003 and 004.
  001 states the evaluation order (identity, permission, lifecycle,
  repository), matching 002.
- Merge failure: 001 T6/T9 match 004 B6/B7/B9 (handoff refused unless
  mergeable; failed accept leaves `in_review`; merge and record atomic). 003
  "Merge pending" removed.
- Run statuses: 003 SV-3 declared canonical; 001 T5 and 002 use
  finished/failed/stopped.

### Assumptions and applied readings (for board attention)

- A3: "cannot be moved behind an unfinished task" is checked against tasks with
  overlapping paths, covers moving another task ahead of a started one, and is
  judged by whether the move gives a started task a new dependency.
- A4: the system integration blocker is resolved by a human; the system never
  resolves blockers. T12 is not changed; a parent that enters review with that
  blocker cannot be accepted and is returned with a fix subtask.
- A5: the "no direct work" rule applies to split parents with at least one
  completed subtask. A parent that fell back under T14 (none completed) can
  still be worked like a leaf, as before. The T9 review requirement is keyed to
  whether the task entered review by handoff (T6) or by subtasks (T12).
- A6: "while no one has claimed it" is read as "has never been claimed". A
  reviewer may add fix subtasks only if its review has at least one finding.
- A2: a cancelled earlier sibling also finishes a sibling dependency.
- B1: first-run setup is available only while the registry is empty, and is
  recorded as actor "first-run setup". E-mail is required.
- CONTRACT-002 now lists "answer a pause" as human-only (follows from
  CONTRACT-001's pause definition and C5). Flagged in its revision note.

### New open questions (flagged, not decided)

- CONTRACT-001 Q22: may a human reorder overlapping sibling subtasks? Interim:
  no, creation order is fixed.
- CONTRACT-001 Q23: how is it confirmed that a pathless task changes no files?
  Interim: approval without paths means "changes no files"; any changed file is
  out of scope and needs a reason at acceptance.
- CONTRACT-004 Q17: how existing GitHub repositories are imported as canonical
  repositories, and how commits pushed directly to GitHub (including hand
  commits) reach the canonical repository, or whether GitHub becomes read-only
  for humans.
- CONTRACT-004 Q18: what Moonbeam does when the GitHub mirror's main has
  diverged. Interim: never force-push; record and show the failure.

### Follow-ups outside this task's paths

- `TEMPLATE/AGENTS.md` ("Run branches and review") still says "Each run works
  on its own branch"; it now contradicts the ADR-005 amendment and needs a task
  covering `TEMPLATE/AGENTS.md`.
- `TEMPLATE/docs/templates/task.md` "Paths" section could state the no-globs
  rule and "no paths = changes no files" (A1).
- ADR-001 lists "handling for write failures" of write-back as a consequence;
  CONTRACT-004 B9 now makes the record part of the acceptance merge. No edit
  was made to ADR-001.

### Validation

Board review of the diffs (per the task). A grep sweep found no remaining
references in contract bodies to the removed questions, `path_dependency_reordered`,
"reopen subtask", "Merge pending", or "run branch" (outside revision history).

## Review

Not reviewed.
