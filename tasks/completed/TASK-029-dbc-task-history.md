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

Implemented TASK-029; ready for independent review. Task remains in `in-progress/` for the dispatcher. No git write commands were run.

Files changed:

- `packages/dbc/src/history/types.ts`
- `packages/dbc/src/history/derive.ts`
- `packages/dbc/src/history/compare.ts`
- `packages/dbc/src/history/fixtures.ts`
- `packages/dbc/src/history/index.ts`
- `packages/dbc/src/history/derive.test.ts`
- `packages/dbc/src/history/compare.test.ts`
- `packages/dbc/src/history/fixtures.test.ts`
- `tasks/in-progress/TASK-029-dbc-task-history.md` (Implementation handoff only)

Public API:

- `deriveSnapshot(chain, readFile): Promise<ProjectSnapshot>` rebuilds the versioned snapshot from an oldest-first first-parent chain.
- `compareSnapshots(previous, next): SnapshotComparison` returns `droppedCommitCount` and sorted `changedTaskIds`, comparing event commit facts rather than snapshot-local indexes.
- `buildChainFixture(fixtures, head?)` returns a first-parent `chain` and `readFile` from full file maps, supporting merges, authors, timestamps, and unreadable files.
- `SNAPSHOT_VERSION = 1`; exported types: `ChainCommit`, `FileReader`, `FileReadStatus`, `CommitFacts`, `TaskFileRecord`, `TaskEvent`, `TaskEntry`, `TaskHistory`, `ArtifactRecord`, `ProjectSnapshot`, `SnapshotComparison`, and `FixtureCommit`.

Validation (all exited 0; commands used `/home/patrick/.nvm/versions/node/v24.16.0/bin` prepended to PATH):

- `pnpm --filter @moonbeam/dbc typecheck`: passed.
- `pnpm --filter @moonbeam/dbc test`: 129 tests passed across 12 files, including 26 new history tests across 3 files.
- `pnpm typecheck`: all 5 workspace packages passed.
- `pnpm test`: 172 tests passed across 21 files: dbc 129, db 6, shared 4, server 12, UI 21. Database/API tests ran successfully.
- `pnpm build`: all 5 workspace packages passed.
- `git diff --check`: passed. No task-started server or process remains running.

Acceptance criteria evidence:

- H1: histories are keyed by filename ID across directory moves and slug changes.
- H2/H3: set-based presence produces exact enter, leave, and removed events; duplicate slugs and multiple directories are covered.
- H3 merges: fixture diffs use the first parent; second-parent-only commits produce no events, while merged work appears in the merge change set.
- H4/H5: events reference the commit facts table, including author, committer, timestamp, subject, SHA, and merge status. First proposal/approval/completion, latest approval, and first acceptance with merged/direct classification are retained.
- H6: in-progress and review entries are recorded and tested.
- H7: all current states are retained; absent IDs become withdrawn only when exclusively proposed, otherwise removed. Re-entry preserves history.
- H8: head approval values remain per-file and unreconciled, including conflicting or invalid values.
- H9/N3/V3: full rebuilding uses no clock; repeated derivation and prefix-poll rebuilding produce identical JSON despite reversed change ordering and different read completion order.
- Q4/W(C): task paths and header-only edits are excluded; body edits, additions, deletions, sectionless files, and unreadable comparisons remain work paths, using the existing parser helper.
- Entry files: every approved/completed entry retains all matching files parsed at that commit, including historical Paths and approval fields.
- P10: too-large, non-UTF-8, and absent read outcomes do not remove tracked task presence.
- F7/R1–R3/R6: head task-directory presence, contracts, ADRs, and project-definition presence/readability are retained; artifacts remain visible without tasks.
- F9: incomplete change-set status is carried on each commit.
- N4: malformed/pre-v1 files, duplicate headers, stray paths, and missing reads are tolerated.
- FL-10: rewritten fixtures report dropped commits and changed/new/vanished histories; index shifts and text-only edits do not falsely change event history.

Assumptions and deviations:

- No scope deviations or changes to the parse/identity layers. Snapshot read results retain status and parsed metadata, not raw file text, as required by the task.
- The source supplies the oldest-first first-parent chain and its diffs. Incomplete diffs are applied as supplied; a modified path with no observed addition has a null last-added index. Directory presence means at least one tracked descendant, including ignored files.
- File-level failures use `FileRead` outcomes. Rejected reader promises propagate to the poller rather than silently converting transport failures into successful snapshots.
- No unresolved implementation blockers. Independent review and human acceptance remain outstanding.

**Dispatcher check:**

- Changes are only under `packages/dbc/src/history/` and in this handoff.
- Re-ran dbc tests (12 files, 129 passed) and workspace typecheck.

### Rework (2026-09-29)

Implemented the returned path-evidence requirement; ready for independent review.

Files changed:

- `packages/dbc/src/history/types.ts`
- `packages/dbc/src/history/derive.ts`
- `packages/dbc/src/history/compare.ts`
- `packages/dbc/src/history/derive.test.ts`
- `packages/dbc/src/history/compare.test.ts`
- `tasks/in-progress/TASK-029-dbc-task-history.md` (this subsection only)

API and behavior:

- Bumped `SNAPSHOT_VERSION` from 1 to 2. Every `TaskEvent` now requires `paths: string[]`, sorted by path.
- Enter events retain all matching paths in their state at C. Leave events retain that state's paths at C's first parent. Removed events retain all paths for the ID across states at C's first parent.
- Each removal event exposes its own last paths through `TaskHistory.events`, preserving repeated removals and duplicate IDs. For an absent task, the latest removal event supplies its last paths. No extra file reads or new event kinds are needed; same-state renames still produce no state transition.
- `compareSnapshots` now includes event paths when detecting changed histories. Function signatures are unchanged.

Validation (all commands exited 0, with `/home/patrick/.nvm/versions/node/v24.16.0/bin` prepended to PATH):

- `pnpm --filter @moonbeam/dbc typecheck`: passed.
- `pnpm --filter @moonbeam/dbc test`: 133 tests passed across 12 files; history has 30 tests, including 4 new regression tests.
- `pnpm typecheck`: all 5 workspace packages passed.
- `pnpm test`: 176 tests passed across 21 files: dbc 133, db 6, shared 4, server 12, UI 21. Database/API tests passed.
- `pnpm build`: all 5 workspace packages passed.
- `git diff --check`: passed.

Rework evidence: the two rename-then-remove fixtures now serialize differently and each reports its own final filename. Tests also cover repeated removals, sorted duplicate paths within and across states, unreadable files, removal at a merge against its first parent, historical work-state paths, path-sensitive comparisons, and deterministic prefix rebuilds with reversed changes. Existing read-completion-order determinism tests pass.

Other evidence gaps: FL-11's historical in-progress/review paths are now preserved after rename or deletion. FL-10 comparison now detects differences in event path evidence. Reviewed FL-1 through FL-11; other required paths are already retained in entry files, head files, or commit work paths.

No scope deviations or unresolved blockers. Parse and identity files are unchanged. No git write commands were run, and no task-started server or process remains running. The task remains in `in-progress/` for the dispatcher; independent review and human acceptance are outstanding.

**Dispatcher check (rework):** changes are only under
`packages/dbc/src/history/` and in this handoff. Re-ran dbc tests (133
passed) and workspace typecheck.

## Review

Not reviewed.

## Board notes

**Returned by Patrick, 2026-09-29.** TASK-030 found that the snapshot loses
task file paths.

- `TaskEvent` records a state and a commit index, but no path.
  `TaskHistory.entries` keeps files only on entry into `approved/` or
  `completed/`, and `headFiles` is empty after a removal.
- So a rename within a state, followed by a removal, loses the last path.
  Two such histories with different final names give identical snapshots.
- FL-9 needs "T's last path" as evidence, and cannot get it.

**Rework:** every task event carries the path or paths involved. An enter
event has the path at C. A leave or removed event has the path at C's first
parent. The snapshot then gives a removed task's last path, including after
repeated removals and with duplicate IDs. Add a test for the
rename-then-remove case.

