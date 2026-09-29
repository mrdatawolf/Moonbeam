# TASK-042: Clean up loose ends found by TASK-022

Owner role: Librarian
Assigned agent: Claude (dispatcher), small edits
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: TASK-022 (completed)

## Desired outcome

No file refers to the deleted `TEMPLATE/` folder as if it still exists. The
"Shelved" contract status is defined where contract statuses are described.
CONTRACT-006 carries its correct approval date.

## Context

TASK-022 retired `TEMPLATE/` and introduced the "Shelved" status for
CONTRACT-003, 004, and 005. Its handoff listed three loose ends outside its
paths:

- `tools/model-eval/README.md` (line 109) and
  `tools/model-eval/fixtures/categorize/cases.json` (line 3) cite
  `TEMPLATE/docs/workflow/pauses.md`. That file no longer exists. It is still
  in git history, last at commit `7cea412`.
- `docs/contracts/README.md` defines only superseding. "Shelved" is defined
  only inside ADR-008 ("Contracts affected").
- CONTRACT-006 says `Approved date: 2026-09-25`. It was proposed and approved
  on 2026-09-28 (commit `7b4b198`).

## Scope

### Included

- **The model-eval references.** Point both to the historical file, for
  example "`TEMPLATE/docs/workflow/pauses.md` as of commit `7cea412` (the
  folder was retired by ADR-008)". Don't change the fixture's cases or
  scoring, only the description string.
- **`docs/contracts/README.md`.** Add a short paragraph defining "Shelved":
  - the contract governs no planned work
  - only its status line changes, to `Status: Shelved by <ADR> (date)`
  - its body stays as a record
  - it returns only through a new ADR

  This follows ADR-008's definition.
- **CONTRACT-006.** Correct `Approved date:` to `2026-09-28`. This is the
  approval metadata, recorded wrongly, not the contract's behavior, so it is
  not a change under the "an approved contract is never changed" rule. The
  board authorized it by approving this task.

### Excluded

- Any change to the model-eval harness's code, fixture cases, or results.
- Any other part of any contract.

### Paths

- `tools/model-eval/README.md`
- `tools/model-eval/fixtures/categorize/cases.json`
- `docs/contracts/README.md`
- `docs/contracts/CONTRACT-006-what-moonbeam-reads.md` (the `Approved date`
  line only)

## Plan

1. Edit the two model-eval references.
2. Add the "Shelved" paragraph.
3. Fix the date line.

## Acceptance criteria

- [ ] `grep -rn "TEMPLATE/" tools/ docs/contracts/README.md` finds only
      references that name the historical commit.
- [ ] `cases.json` is still valid JSON, and its cases are unchanged.
- [ ] `docs/contracts/README.md` defines "Shelved" as ADR-008 does.
- [ ] CONTRACT-006 differs from before only in its `Approved date` line.

## Validation requirements

- `node -e "JSON.parse(require('fs').readFileSync('tools/model-eval/fixtures/categorize/cases.json'))"`
- `git diff -U0` on CONTRACT-006 shows one changed line.
- The model-eval tests still pass, if they read the fixture description.

## Risks and assumptions

None of note.

## Blocker

None.

## Implementation handoff

Done by Claude.

**Changed:**

- `tools/model-eval/README.md` and
  `tools/model-eval/fixtures/categorize/cases.json`: the `pauses.md`
  reference now reads "as of commit `7cea412`; the folder was retired by
  ADR-008". In the JSON, only the `description` string changed.
- `docs/contracts/README.md`: a "shelved" paragraph, as ADR-008 defines it.
- `docs/contracts/CONTRACT-006-what-moonbeam-reads.md`: `Approved date`
  changed from 2026-09-25 to 2026-09-28. That is the only change.

**Validated:**

- `cases.json` parses as JSON.
- `node --test tools/model-eval/test/*.test.mjs`: 8 of 8 pass.
- `git diff -U0` on CONTRACT-006 shows one changed line.
- The grep for `TEMPLATE/` in `tools/` and `docs/contracts/README.md` finds
  only the two references, both of which now name the historical commit.

## Review

Not reviewed.
