# TASK-029: Derive task history and the project snapshot in @moonbeam/dbc

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: TASK-027

## Desired outcome

`deriveSnapshot(chain, readFile)` turns a first-parent chain into a serializable,
deterministic project snapshot: task history (H1 to H9), per-commit facts for
flag evaluation, the head's task files and artifacts (R1 to R3), and the source
notices F7 and F9.

## Context

This is TASK-023 decision 5. The snapshot is rebuilt from the whole chain on
every head change and stored by TASK-034. It depends on the chain alone (H9).
Exempt paths, the baseline, identities, and time are applied later, by the flag
rules (TASK-030).

## Scope

### Included

- **`packages/dbc/src/history/types.ts`:**
  - `ChainCommit`: sha, parents, subject; author (name, email, login or null); committer (name, email); `committedAt` as an ISO string; changes (path, and added, modified, or deleted), compared with the first parent, or the empty tree for the root, with no rename detection; `changesComplete`.
  - `FileReader = (sha, path) => Promise<FileRead>`.
  - `ProjectSnapshot`, carrying `SNAPSHOT_VERSION`.
- **`derive.ts`:**
  - H2: presence per commit, from applying change sets under `tasks/` starting from an empty tree, classified by `classifyTaskPath`. Files with read problems still count as present (P10).
  - H3: events keyed by ID (H1): enters S, leaves S, removed.
  - H4: event facts, stored as a commit index plus a commits table (sha, subject, author, committer, `committedAt`, `isMerge`).
  - H5 per task: first entries into proposed, approved, and completed, with their commit; the most recent approved entry; the acceptance commit, merged or direct.
  - H6: `in-progress` and `review` entries recorded as events.
  - H7: current states at head, with "removed" and "withdrawn".
  - H8: `Approved by` and `Approved date` at head.
  - Entry files: for every entry into `approved/` or `completed/`, the file at that commit, parsed. These feed FL-1 evidence, FL-4 Paths, and the FL-8 `Approved by`.
  - Per commit: `baseWorkPaths` (change set minus `tasks/**` minus header-only edits of `docs/contracts/` and `docs/decisions/`, reading the old and new versions), `completedIds`, `changesComplete`.
  - At head:
    - every path under `tasks/` with its classification, read result, parse (for FL-2, FL-6, FL-7, D8), and the commit that last added it (FL-6 evidence)
    - `hasTasksDirectory` (F7)
    - contracts and ADRs (R1, R2)
    - the presence and readability of `docs/PROJECT.md` (R3, R6)
    - the ordered list of chain SHAs
- **`compare.ts`:** `compareSnapshots(previous, next)` counts previously processed chain commits that are no longer on the chain, and lists task IDs whose event histories differ (FL-10 evidence).
- **`fixtures.ts`:** an in-memory chain builder, with commits as file maps, merges, authors, and times. It yields `ChainCommit[]` and a `FileReader`, and is exported for tests in this package.
- Tests, and replacing the `history/index.ts` stub.

### Excluded

- Flag rules (TASK-030).
- Git and GitHub access (TASK-032).
- Storage (TASK-034).
- Exempt paths and the baseline.

### Paths

- `packages/dbc/src/history/`

## Plan

1. Define the types and the fixture builder.
2. Implement the presence walk and the events. Read files only where needed:
   entry files, header-only candidates, and head files.
3. Add the per-task summaries and the head inventory.
4. Add `compareSnapshots`.
5. Write the tests.

## Acceptance criteria

- [ ] H1: a task keeps one history across a move and a slug change.
- [ ] H2 and H3: enter, leave, and removed events are exact for moves, a task in two directories, and a deleted task.
- [ ] H3 for merges: a merge commit's events and change set are computed against its first parent. Commits reachable only through the second parent produce no events.
- [ ] H4 and H5: facts and dates are recorded as specified. The acceptance commit is marked merged or direct.
- [ ] H6: entries into `in-progress/` and `review/` are recorded as events.
- [ ] H7: current state, including multiple states, removed, and withdrawn (only ever in `proposed/`).
- [ ] H8: header values at head are carried and not reconciled.
- [ ] H9 and N3: deriving twice over the same chain gives deep-equal JSON. The result doesn't depend on the order of file reads, and no clock is used.
- [ ] Q4 and W(C): a commit changing only `tasks/**` and a contract status line has an empty `baseWorkPaths`. A contract body edit appears in it.
- [ ] Each entry into `approved/` or `completed/` carries the file parsed at that commit.
- [ ] P10: an unreadable task file is still present in its state directory.
- [ ] F7: `hasTasksDirectory` is false for a repository without `tasks/`, and artifacts are still listed.
- [ ] F9: `changesComplete: false` is carried to the commit record.
- [ ] N4: malformed files never throw.
- [ ] `compareSnapshots` reports dropped commits and changed task histories for a rewritten fixture.

## Validation requirements

- `pnpm --filter @moonbeam/dbc typecheck` and `pnpm --filter @moonbeam/dbc test`.
- The full `pnpm typecheck`, `pnpm test`, `pnpm build` at handoff.

## Risks and assumptions

- A snapshot for a large repository may be a few MB of JSON. That is acceptable
  for V1. File texts are not stored in it; TASK-036 reads them on demand.
- Type changes to a file (such as a symlink) count as modified.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
