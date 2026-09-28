# TASK-040: V9 walk-through against this repository's history

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by:
Approved date:
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

Not started.

## Review

Not reviewed.
