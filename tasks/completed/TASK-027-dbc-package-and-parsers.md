# TASK-027: Create @moonbeam/dbc with the DbC task v1 parser, Paths matcher, and artifact parsers

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008, ADR-002
Dependencies: None

## Desired outcome

A pure TypeScript workspace package, `@moonbeam/dbc`, parses task files (P1 to
P10), matches changed paths against Paths patterns (P7), detects header-only
edits (Q4), and extracts contract and ADR headers (R1 to R3). It has no
database, network, or git dependency.

## Context

This is TASK-023 decision 5. The package holds the engine. TASK-028, TASK-029,
and TASK-030 fill `identity/`, `history/`, and `flags/`. This task creates those
module stubs so they can run in parallel without touching the same files.

## Scope

### Included

- **Package scaffold** in `packages/dbc/`: `package.json` (name `@moonbeam/dbc`, the same `source`/`types`/`default` export conditions and scripts as `@moonbeam/shared`, no runtime dependencies), `tsconfig.json`, and `tsconfig.build.json`. `src/index.ts` re-exports `./parse/index.js`, `./identity/index.js`, `./history/index.js`, and `./flags/index.js`. The last three are stubs (`export {};`).
- **`src/parse/files.ts`:**
  - the `FileRead` type: `{ kind: "text"; text } | { kind: "too_large" } | { kind: "not_utf8" } | { kind: "absent" }`
  - `decodeFile(bytes)`: the P10 limit of 1 MiB (over 1,048,576 bytes is too large); fatal UTF-8 decoding; strips a leading BOM
- **`src/parse/task-path.ts`:** `classifyTaskPath(path)` for P1 and P2. It returns one of:
  - a task, with ID, state, and slug
  - ignored (`tasks/README.md`, any `.gitkeep`)
  - stray, with the reason: bad name, not directly in a state directory, or unknown directory under `tasks/`
- **`src/parse/task-file.ts`:** `parseTaskFile(text)` for P3 to P9:
  - the title line and its ID
  - the header block, with continuation lines, duplicate fields, unknown fields, and case-insensitive names
  - the P5 value formats (name and note, date validity, ID lists by kind, `None`, free text)
  - `Format` detection (v1 or not, P9)
  - the P7 Paths section: first `### Paths` up to the next heading of level 1 to 3; items are the first backtick span or the whole item; `None`; empty
  - CRLF line endings are accepted
- **`src/parse/problems.ts`:** `v1Problems(parsed, state, fileId)` gives the FL-2 problem set from the P6 table:
  - missing or empty required fields
  - invalid dates
  - duplicated fields
  - a missing title or mismatched title ID
  - a missing or empty Paths section where it is required
- **`src/parse/paths.ts`:** `normalizePattern` and `matchesPattern(changedPath, pattern)` exactly as P7 defines them.
- **`src/parse/header-only.ts`:** `isHeaderOnlyEdit(oldText, newText)`. True when both versions have a first `## ` line and are identical from that line to the end (the Q4 definition; see TASK-023 question 1).
- **`src/parse/artifacts.ts`:**
  - `classifyArtifactPath` (R1 `docs/contracts/CONTRACT-<digits>-<slug>.md`, R2 `docs/decisions/ADR-<digits>-<slug>.md`, R3 `docs/PROJECT.md`)
  - `parseContractHeader` (ID, title, Status, Supersedes, Approved by, Approved date, Related tasks)
  - `parseAdrHeader` (ID, title, Status, Date)
  - an unparseable file yields "status unknown" (R6)
- Unit tests next to each module, including the V5 corpus.

### Excluded

- History, identity, and flags logic (TASK-028 to TASK-030).
- Any server or UI change. Reading files from git.

### Paths

- `packages/dbc/`
- `pnpm-lock.yaml`

## Plan

1. Scaffold the package from `packages/shared` and run `pnpm install` to update the lockfile.
2. Implement the parse modules with the types exported from `src/parse/index.ts`.
3. Write the tests, including the V5 corpus and the P7 near misses.

## Acceptance criteria

- [ ] P1: `TASK-021-x.md` gives ID `TASK-021`. `TASK-21-x.md` gives ID `TASK-21`, a different ID. Two digits, uppercase slugs, and underscores are not task names (stray, FL-7 reason).
- [ ] P2: `tasks/README.md` and `.gitkeep` are ignored. `tasks/notes.md`, `tasks/approved/sub/TASK-001-x.md`, and `tasks/archive/TASK-001-x.md` are stray, each with its reason.
- [ ] P3 and P4:
  - the title ID is compared with the file-name ID
  - continuation lines join with one space (TASK-020's wrapped "Related contracts" parses)
  - a duplicated field keeps its first value and is reported
  - unknown fields are kept
  - field names are matched case-insensitively
- [ ] P5:
  - "Patrick (instructed in planning session)" gives the name "Patrick"
  - `2026-02-30` is invalid
  - `None` in any case is an empty list
  - text with no ID and not `None` is valid free text
- [ ] P6, P9, FL-2 input:
  - `v1Problems` reports exactly the problems listed in FL-2 for each state
  - `Format: DbC task v2` and a missing `Format:` mark the file not v1; for those files `v1Problems` is not what flags use
- [ ] P7:
  - `server/`, `server`, and `server/**` all match `server/src/a.ts`
  - `server` does not match `serverless/a.ts`
  - `*` stays within one segment
  - `**/` may match no segments
  - matching is case-sensitive
  - a leading `/` or `./` is removed
  - an item with backticks uses only the first backtick span
  - `None` and an empty section are distinguished
- [ ] P10: `decodeFile` returns `too_large` above 1 MiB and `not_utf8` for invalid bytes.
- [ ] The V5 corpus parses without throwing (N4): non-UTF-8, over 1 MiB, no title, ID mismatch, duplicate field, wrapped values, unknown fields, missing `Format:`, `Format: DbC task v2`, a stray file, an unknown directory.
- [ ] Q4: a status-line change is header-only. Any change at or after the first `## ` line is not. Added and deleted files are not.
- [ ] R1, R2, R6: the headers of `docs/contracts/CONTRACT-006-*.md` and `docs/decisions/ADR-008-*.md` in this repository parse. A file without a `# ` line gives "status unknown".

## Validation requirements

- `pnpm --filter @moonbeam/dbc typecheck` and `pnpm --filter @moonbeam/dbc test` during work.
- `pnpm typecheck`, `pnpm test`, `pnpm build` at handoff. Report any failure outside `packages/dbc/` as interference from parallel work.

## Risks and assumptions

- CRLF and BOM tolerance are assumptions. The contract doesn't mention them.
- The header-only reading depends on TASK-023 question 1.

## Blocker

None.

## Implementation handoff

A first Codex run wrote the scaffold and four modules (`files`, `task-path`,
`paths`, `header-only`), then hung and was cancelled by the board. Claude
finished the task at the board's request (2026-09-29).

**Changed:**

- `packages/dbc/`:
  - `package.json`, `tsconfig.json`, and `tsconfig.build.json`
  - `src/index.ts`
  - stubs: `src/{identity,history,flags}/index.ts`
- `src/parse/`: `files`, `task-path`, `header` (the P4 header block, shared
  with R1 and R2), `values` (P5), `task-file` (P3 to P9), `problems` (P6 and
  FL-2, plus a stable `problemKey`), `paths` (P7), `header-only` (Q4),
  `artifacts` (R1 to R3 and R6), and `index`
- 8 test files, including `corpus.test.ts` (V5)
- `pnpm-lock.yaml`: the workspace importer entry for `@moonbeam/dbc` only (12
  lines). No new dependencies.

**Public API** (from `src/parse/index.ts`):

- `decodeFile` and `FileRead`
- `classifyTaskPath`, `TASK_STATES`, `TaskPath`, and `TaskState`
- `parseTaskFile`, `taskField`, `DBC_TASK_V1`, `ParsedTaskFile`,
  `PathsSection`, and `TaskTitle`
- `parseHeaderBlock`, `getField`, `fieldKey`, and `HeaderField`
- `parseName`, `isValidDate`, `parseIdList`, and `IdList`
- `v1Problems`, `problemKey`, `REQUIRED_FIELDS`, and `V1Problem`
- `matchesPattern` and `normalizePattern`
- `isHeaderOnlyEdit`
- `classifyArtifactPath`, `parseContractHeader`, `parseAdrHeader`, and
  `Unknown`

**Validated:**

- `pnpm --filter @moonbeam/dbc typecheck`, `test` (8 files, 78 passed), and
  `build`.
- Workspace-wide `pnpm typecheck`, `pnpm test`, and `pnpm build` all pass,
  with TASK-026 in the tree.

**Every acceptance criterion has tests.** Rule IDs are named in the test
names:

- P1 and P2
- P3 and P4, including TASK-020's wrapped value, a wrapped value containing a
  colon, duplicates, unknown fields, and case
- P5
- P6, P9, and FL-2 in every state, with no acceptance fields (U2)
- P7 near misses, and a check against backtracking blow-up
- P10
- the V5 corpus, plus an empty file and odd UTF-8
- Q4
- R1, R2, and R6, against this repository's CONTRACT-006 and ADR-008

**Deviations and readings:**

1. **P1 versus the task text.** The task's criterion said `TASK-21-x.md`
   "gives ID `TASK-21`", but also said two digits are not task names.
   CONTRACT-006 P1 requires at least three digits, so `TASK-21-x.md` is stray
   (`bad_name`). `TASK-21` still parses as an ID in titles and ID lists, and
   it never equals `TASK-021`.
2. **Paths outside `tasks/`** classify as `{ kind: "outside" }`, not stray.
   P2 concerns only paths under `tasks/`.
3. **Header block without a title.** It runs from the top of the file to the
   first `## ` line. A non-blank line before the first field is kept in
   `unattached`, not dropped.
4. **Field names** start with a letter and contain letters, digits, spaces,
   hyphens, or underscores. So a wrapped value such as
   `ADR-003 (context: ADR-002)` is a continuation, not a field.
5. **The Paths section** accepts `-`, `*`, `+`, and numbered list items,
   ignores fenced code, and uses the first section only. `None` next to other
   items is an ordinary pattern.
6. **A date field** that is present, non-empty, and invalid is an FL-2
   problem in every state, even where it is optional.
7. **CRLF and a leading BOM are accepted.** These were assumptions in the
   task.

## Review

Not reviewed.
