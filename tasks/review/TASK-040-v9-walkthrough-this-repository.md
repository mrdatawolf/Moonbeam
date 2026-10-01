# TASK-040: V9 walk-through against this repository's history

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: TASK-034

## Desired outcome

A repeatable test runs the engine over this repository's own first-parent
history, pinned to a fixed commit, with the baseline at the root commit. It
confirms or corrects each V9 expectation. Any difference from the contract's
stated expectations is reported to the board as a question.

## Context

V9 lists expected results, and some of them say "to be confirmed". This task
confirms them. It doesn't change CONTRACT-006 or bend the engine to match the
contract's expectations.

## Scope

### Included

- **`server/src/test/v9-walkthrough.test.ts`:**
  - opens this repository's `.git` read-only through `Mirror` read commands (no fetch)
  - is pinned to the head of main at dispatch, recorded as a constant
  - builds the chain with the TASK-034 adapter, with no logins
  - `deriveSnapshot`, then `evaluateFlags` with the baseline at the root
  - runs twice: with a member whose e-mails include `patrickmoon@outlook.com`, and with that member's configured e-mail only
  - skips with a clear message when `.git` is missing or shallow
- **Assertions for each V9 bullet:**
  - FL-7 for every task file at head, and no FL-2
  - FL-11 for each dispatch and each "(to review)" commit
  - FL-3 for "(to review)" commits that change files outside `tasks/`
  - no FL-3 for acceptance commits that change only `tasks/` or contract headers
  - FL-1 for none of TASK-004 onward; the actual result recorded for TASK-001 to TASK-003
  - FL-4 not evaluated ("scope not checkable") for TASK-001 to TASK-003
  - FL-8 on every approval and acceptance only in the run without the extra e-mail
  - no FL-5 or FL-6 at the pinned head
- A hand cross-check of a sample of commits with `git log --first-parent` and `git show --stat`, recorded in the handoff.

### Excluded

- Changing CONTRACT-006 or the engine. Discrepancies go to the handoff as questions.
- The local reset of 2026-09-25, which isn't on the pushed chain. It is covered by the FL-10 fixtures in TASK-034.

### Paths

- `server/src/test/v9-walkthrough.test.ts`

## Plan

1. Pin the SHA and build the chain from the local repository.
2. Write an assertion per V9 bullet, with commit subjects in the failure messages.
3. Run it, record the results, and cross-check by hand.

## Acceptance criteria

- [ ] V9: every bullet is asserted, or recorded as the observed result with the contract's expectation next to it.
- [ ] The test is deterministic for the pinned SHA (N3), and uses only read-only git commands (S3).
- [ ] Every discrepancy with the contract's expectations is listed in the handoff as a question for the board.

## Validation requirements

- `pnpm --filter @moonbeam/server exec vitest run src/test/v9-walkthrough.test.ts`.
- `pnpm typecheck` and `pnpm test` at handoff.

## Risks and assumptions

- Git's history in a CI clone may be shallow; the test skips there.

## Blocker

None.

## Implementation handoff

Implemented by Codex on 2026-10-01. Ready for independent review; not accepted,
committed, or moved.

### Files changed

- `server/src/test/v9-walkthrough.test.ts` — 17 tests: one assertion for each
  included V9 bullet in each identity run, plus a full snapshot/flag determinism
  check. Failure output includes commit subjects.
- `tasks/in-progress/TASK-040-v9-walkthrough-this-repository.md` — this
  Implementation handoff section only.

### Inputs and read-only behavior

- Pinned SHA: `86be7ffb3b5e6f8f6cca472fe1530136b0d62c5e` (`moving forward`),
  named `PINNED_SHA` in the test.
- Baseline: first-parent root `83777dc0695811f04904d8eddd1b4a76f0242e60`
  (`initial commit`). There are 116 chain commits. Root events supply prior
  approval context but are excluded from event-flag evaluation.
- Fixed evaluation time: the pin's committer time,
  `2026-10-01T14:34:04-07:00`; threshold 14 days, no exempt paths, no lead developer.
- Both runs use Patrick's configured fixture e-mail `patrick@example.com`
  (the Patrick fixture in `packages/dbc/src/identity/matcher.test.ts`). The
  first also includes `patrickmoon@outlook.com`. This follows the production
  poller's inclusion of the registry e-mail alongside extra identities; no
  live user database or host identity settings are read. No logins or aliases.
- Uses `Mirror.readChain`, TASK-034's `chainSource` with an explicit null-login
  map, `Mirror.readFile`, `deriveSnapshot`, and `evaluateFlags`. A test-local
  GitRunner rejects commands other than `rev-parse`, `log`, and `cat-file`
  before execution. No ensure, fetch, pin, credentials, or repository writes.
- Missing `.git` or shallow history skips the suite with the reason in its
  name and a warning. Other read failures fail rather than silently skip.
- Re-derivation compares the complete snapshot and both flag evaluations.
  The local 2026-09-25 reset is excluded; no reflog or rewrite input is read.

### V9 results

Counts below are per identity run unless noted. Every included bullet is
asserted; discrepancies are documented beside the corresponding assertion.

| V9 bullet | Contract expectation | Observed result at the pin |
| --- | --- | --- |
| FL-7 / FL-2 | FL-7 for every task file; no FL-2 | Matches: 42 pre-v1 task files, 42 FL-7, zero FL-2. |
| FL-11 | Every dispatch and move to review | Matches: 81 task-entry flags (39 in-progress, 42 review), including multi-task dispatches, worktree merges, and rework. |
| FL-3 on review | Every to-review commit with non-task changes | Matches: all 37 such commits have FL-3, including the combined “both to review” commit. The remaining to-review commit (TASK-023) changes only tasks. |
| FL-3 on acceptance | None for acceptances changing only tasks or document headers | Matches: all 13 qualifying acceptance commits have no FL-3. |
| FL-1 | None for TASK-004 onward; investigate TASK-001..003 | **Discrepancy:** exactly TASK-012, TASK-014, TASK-015 raise FL-1. TASK-001..003 raise none: each is approved at root and completed at `2851241` (“stage 1”). Each early task also has an FL-11 review entry at its worktree merge. |
| FL-4 | TASK-001..003 scope not checkable | Matches: their common completion `2851241` is scope-not-checkable, with no FL-4; Paths are absent. |
| FL-8 | Every approval/acceptance only without Outlook identity | Matches for evaluated events: configured-only run has 76 FL-8 (36 approvals, 40 acceptances); adding Outlook yields zero. The three root approvals are baseline context. |
| FL-5 / FL-6 | None at head; explanation says TASK-021 is in-progress | Zero FL-5 and zero FL-6, as expected. **Explanation differs:** TASK-021 is completed at this later pin. Time is fixed to the pinned head, not today. |
| Local reset / FL-10 | Only if rewritten main was pushed | Excluded as directed; not inferred from local reflog. |

For context, total flags are 181 with Outlook and 257 without it. Both runs
have 54 FL-3 overall and one FL-4, at `9652bcd` (TASK-006 completes while
`docs/contracts/CONTRACT-005-task-lifecycle.md` is outside its Paths). V9's
FL-4 expectation concerns only TASK-001..003, so this is not a discrepancy.

### Hand cross-check

Read `git log --first-parent --format='%h %s'
86be7ffb3b5e6f8f6cca472fe1530136b0d62c5e` to verify chain membership/order.
Then read `git show --stat` for each sample below (and the three additional
FL-1 precursor commits). All sampled authors are Patrick Moon with
`patrickmoon@outlook.com`.

| Commit and subject | Stat/history observation | Engine result |
| --- | --- | --- |
| `0ddb79b` Dispatch TASK-016 to Codex (in-progress) | One task file moves approved → in-progress, 1 insertion / 1 deletion. | FL-11; no FL-3. |
| `0052b85` TASK-005: propose CONTRACT-002 identity and permission interface (to review) | Adds the 427-line contract and moves the task in-progress → review; 3 files changed, 527 insertions / 75 deletions. | FL-11 and FL-3. |
| `707c085` Board accepts TASK-015 (moved by Patrick) | Only review → completed rename, no content changes. | No FL-3; FL-1 because no earlier approved entry exists. |
| `83777dc` initial commit | Adds TASK-001, TASK-002, TASK-003 under approved/ (74, 78, 63 lines); 37 files overall. | Root approval context prevents FL-1 for these tasks. |
| `2851241` stage 1 | Moves all three early tasks review → completed and changes one ADR-005 header line; 4 files. | No FL-1 or FL-3; scope not checkable, no FL-4. |

Additional discrepancy cross-check: `554254f` (“Board answers round 1; approve
and dispatch TASK-012”) moves TASK-012 directly from proposed to in-progress;
`d9adb6b` (“Propose ADR-007 ...; dispatch TASK-014 ...”) introduces TASK-014
in-progress; `9652bcd` (“Contracts are immutable ...; dispatch TASK-007”)
introduces TASK-015 in-progress. The chain adapter's state entries agree with
these stats and show no intervening approved state. Their later acceptances
are `1d78ccc`, `860e2be`, and `707c085`, respectively.

### Validation

Commands used Node 24.16.0 via
`PATH=/home/patrick/.nvm/versions/node/v24.16.0/bin:$PATH`.

- `pnpm --filter @moonbeam/server exec vitest run src/test/v9-walkthrough.test.ts`:
  passed, **17 tests / 1 file**, none skipped.
- `pnpm typecheck`: passed across **5 packages**, no errors.
- `pnpm test`: passed, **439 tests / 36 files**: db 6/1, dbc 182/13,
  shared 4/1, server 186/15, UI 61/6. No failures or skips.
- `git diff --check`: passed.

No validation was blocked by the sandbox. No install, dependency changes,
pnpm-store changes, dev server, or git write commands were used. Tests used
existing isolated test infrastructure. Missing/shallow skip paths were
inspected but not exercised by modifying this repository's `.git`.

### Outside-path changes

None beyond this expressly authorized task handoff. No engine or contract edits.

### Questions for the board

1. Should V9's “FL-1 for none of TASK-004 onward” be corrected to name
   TASK-012, TASK-014, and TASK-015 as exceptions? They bypassed an observable
   approved/ state despite recorded approval wording. The test asserts these
   three observed flags and leaves the engine and contract unchanged.
2. Should V9's FL-5/FL-6 explanation be anchored to its original historical
   head, or updated for this pin where TASK-021 is completed? The asserted
   absence of both flags remains correct at the fixed head time.

Independent review and board decisions on these discrepancies remain open.

## Review

Not reviewed.
