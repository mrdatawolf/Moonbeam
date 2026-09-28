# TASK-019: Offer the repositories found under the projects root for registration

Owner role: Implementer
Assigned agent: Codex (direct, write-capable)
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-004 (B13 registration), CONTRACT-002 (human-only actions)
Related ADRs: ADR-006 (decision 2)
Dependencies: TASK-006 and TASK-007 (completed; registration API and Projects page)

## Desired outcome

A board member registers projects by picking them from a list of the git
repositories Moonbeam finds under the projects root. They can register several
at once, without typing any paths.

## Context

CONTRACT-004 B13 and ADR-006 decision 2 already say that registration "offers
the repositories it finds under the root, including nested layouts". TASK-006
and TASK-007 built registration by typed absolute path only. Nothing searches
the root. This task closes that gap.

On 2026-09-28 the board chose "pick from a list" over automatic registration.
A board member still chooses each project (B13), but can choose many in one
step. Moonbeam registers nothing on its own.

## Scope

### Included

- **Discovery (server, read-only):** an endpoint, for example
  `GET /api/projects/discover`, that searches the projects root and returns
  the git repositories found at any depth that are not already registered.
  - Each result gives the absolute path, the path relative to the root, a
    suggested name (the folder name), and a suggested main branch: `main` if
    it exists, else `master` if it exists, else the current branch.
  - Search rules (defaults; record them in the handoff):
    - A folder containing `.git` is a repository.
    - Don't descend into a repository once found.
    - Skip hidden folders and `node_modules`.
    - Don't follow symbolic links out of the root. Judge by real location, as
      registration does.
    - Cap depth and the number of folders visited. When a cap is hit, say so
      in the response (`truncated`), and don't fail.
  - The search changes nothing on disk.
  - Authority: humans and viewers may list. An agent credential is refused
    with `not_permitted`, because this reveals the file system outside any
    project. A missing projects root is a `validation` refusal with a clear
    message.
- **Projects page (UI):** a "Found in the projects root" list of unregistered
  repositories.
  - Checkboxes, "Select all", and an editable name and main branch per row.
  - "Register selected as <user>" registers each selected repository through
    the existing registration action. That keeps one audit record per project
    and the existing validation.
  - Show a result per repository. If some fail, the others still register,
    and each failure shows its reason.
  - The list refreshes after registering, and on demand ("Search again").
  - Keep the existing manual path entry as a fallback, behind "Add by path".
- Shared request and response schemas in `packages/shared/`.
- Tests:
  - Server discovery on a temporary folder tree: nested repositories, a
    repository inside a repository (not listed), hidden folders and
    `node_modules` skipped, a symbolic link outside the root not followed,
    already-registered repositories excluded, `truncated`, the agent refused.
  - Main-branch suggestion.
  - UI tests for select, register selected, and partial failure.
- `docs/DEVELOPMENT.md`: the endpoint and the search rules.

### Excluded

- Registering automatically, or on a schedule. That would need a contract
  superseding CONTRACT-004.
- Watching the file system for new repositories.
- Relinking moved projects, and changing the projects root.
- Cosmetic work beyond what the new list needs (board, 2026-09-28).

### Paths

- `packages/shared/`
- `server/`
- `ui/`
- `docs/DEVELOPMENT.md`

## Plan

1. Add shared discovery response schemas and a bounded, read-only filesystem
   scanner, exposed through the registry and a route before `/projects/:id`.
2. Add discovery selection and editable registration rows to Projects, reuse
   the existing registration action, and retain per-repository results.
3. Validate filesystem and UI behavior, add dispatcher API regressions, document
   rules and limits, and report socket-restricted validation separately.

## Acceptance criteria

- [ ] With a projects root that contains repositories at several depths, the
      Projects page lists every unregistered repository, and none that are
      registered or inside another repository.
- [ ] Selecting several repositories and choosing "Register selected"
      registers them all in one step. Each registration is audited and shown
      as a registered project.
- [ ] A failure on one repository doesn't stop the others, and its reason is
      shown.
- [ ] An agent credential cannot list discovered repositories.
- [ ] The search never changes files, and it finishes with `truncated` rather
      than failing or hanging on a large tree.
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass, with the database
      suite actually run.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. The dispatcher runs the
database suite and a live check with a temporary projects root that holds
nested repositories, a repository inside a repository, `node_modules`, and a
symbolic link outside the root. The dispatcher also runs a read-only discovery
against the board's real projects root (`/home/patrick/Documents/Github`), to
check timing and results without registering anything.

## Risks and assumptions

- A large projects root could make the search slow. The caps and `truncated`
  bound it. Report the measured time on the board's real root.
- Assumes "not descending into a repository" matches how the team lays out
  projects. If the board wants repositories inside repositories listed, that
  is a later change.
- A suggested name can collide with an existing project name. The existing
  registration rules decide, and the UI shows the refusal for that row.

## Blocker

None.

## Implementation handoff

Task: TASK-019
Implementer: Codex
Date: 2026-09-28

### Changes made

Implemented `GET /api/projects/discover` as a read-only registry operation.
The route resolves identity and precedes `/projects/:id`. Valid agents are
refused `not_permitted` before database/filesystem discovery; viewers and
humans may list. Existing credential resolution preserves `unidentified` for
invalid credentials, with no fallback to a supplied human header. Missing or
unreadable roots return `validation`.

Added the Projects page discovery section, individual selection and Select all,
editable names/branches, selected-user registration, Search again, truncation
notice, and persistent per-repository success/refusal results. Selected rows
use the existing registration mutation independently; one failed registration
does not prevent others. Registered projects and discovery refresh. Manual
registration remains under Add by path. No registration/audit semantics changed.

Changed files (all relative to the shared board checkout):

- `packages/shared/src/projects.ts`: discovery schemas and response type; existing
  registration request schema remains the write contract. GET has no parameters.
- `server/src/discovery.ts`: filesystem scanner and git branch suggestion.
- `server/src/discovery.test.ts`: six socket-free regression tests.
- `server/src/registry.ts`: discovery read gate and registered-path exclusion.
- `server/src/routes.ts`: schema-validated discovery endpoint.
- `server/src/test/projects.test.ts`: two database/API regressions for discovery,
  registration audits, human/viewer reads, and credential handling.
- `server/vitest.unit.config.ts`: includes discovery in socket-free validation.
- `ui/src/api/queries.ts`: discovery query and registration invalidation.
- `ui/src/pages/Projects.tsx`: discovery/registration UI and manual fallback.
- `ui/src/pages/Projects.test.tsx`: three UI regressions.
- `docs/DEVELOPMENT.md`: endpoint, search behavior, limits, and UI behavior.
- `tasks/in-progress/TASK-019-discover-projects-under-root.md`: plan and handoff.

### Validation performed

Commands ran from `/home/patrick/Documents/Github/Moonbeam`. The login shell
initially lacked pnpm (`pnpm typecheck`: command not found, exit 127). Subsequent
commands used the installed Node 24 toolchain with this exact prefix:

```sh
export PATH=/home/patrick/.nvm/versions/node/v24.16.0/bin:$PATH
```

Final validation:

| Exact command (after PATH prefix) | Result |
| --- | --- |
| `pnpm typecheck` | Passed, all four workspace packages. |
| `pnpm build` | Passed, shared/db/server compilation and UI build (264 modules). |
| `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts` | Passed: 5 files, 46 tests, including 6 new discovery tests. Final run 1.03 seconds. |
| `pnpm --filter @moonbeam/ui test` | Passed: 7 files, 47 tests, including 3 new Projects tests. |
| `pnpm --filter @moonbeam/shared test` | Passed: 4 files, 21 tests. |
| `pnpm --filter @moonbeam/db test` | Passed: 1 file, 6 tests. These are package unit tests, not the server database/API suite. |
| `pnpm --filter @moonbeam/server test` | **Not run successfully:** global setup failed `listen EPERM: operation not permitted 127.0.0.1`; no server database/API tests executed. Command misleadingly returned exit 0 despite Vitest's setup error. |
| `pnpm test` | Returned exit 0/package Done output, but does **not** establish that server database/API tests ran; direct suite failure above remains unresolved. |
| `git diff --check` | Passed. |

120 tests passed in independently observed runnable suites. Earlier typechecks
caught test-only mistakes (Testing Library role options and the audit actor
column name), fixed before final validation. The initial UI run had one failing
assertion about a collapsed native details element; corrected to assert
visibility, and the full UI suite then passed.

`pnpm dev` was not attempted because the provided sandbox restriction prevents
loopback listeners. No live browser/server check was possible. The two new
API regressions compile but still require execution by the dispatcher together
with the full server database suite. The real-root read-only timing check at
`/home/patrick/Documents/Github` is reserved for the dispatcher as assigned;
no timing claim is made for that root here.

### Acceptance criteria evidence

- Nested repositories, stop-at-repository (including registered repositories),
  hidden and node_modules exclusions, outside symlinks, in-root aliases/cycles,
  canonical registered-path exclusion, `.git` files, missing roots, and caps
  are exercised in `server/src/discovery.test.ts`. A fixture HEAD is compared
  before/after; scanner implementation uses only filesystem/git reads.
- Branch tests cover local main preference, master fallback, current/unborn
  branch fallback, and detached HEAD. Malformed `.git` metadata is also covered.
- UI tests demonstrate selecting several rows, editing name/branch, submitting
  only those rows with the selected human header, and refreshing discovery.
- Partial failure test submits all three rows, preserves two successes and the
  third row's server refusal, and keeps the failed row available after refresh.
- Viewer UI can search but cannot register; manual form is collapsed initially.
- Agent refusal is verified without sockets at the registry boundary. Added API
  tests cover valid agent plus human header and invalid credential fallback.
- Added API test verifies no audit writes during discovery and exactly two
  attributed `project_registered` audits for two registrations. Execution pending.
- All runnable validation passed. The full database/live acceptance criterion
  remains pending dispatcher validation; acceptance boxes are not self-approved.

### Assumptions and deviations

Search rules/caps chosen:

- Root is resolved to its real directory. A child containing `.git` (file or
  directory) is offered, then traversal stops even if already registered.
- Hidden directories and `node_modules` are skipped at every level.
- All directory symlinks are skipped, including aliases within the root. Their
  eligible targets are visited through the real directory tree. This avoids
  cycles, duplicates and outside traversal. Real locations are rechecked before
  descending. Aliases cannot bypass hidden-folder or repository boundaries.
- Root depth is 0; maximum depth is 32. At most 10,000 folders are visited,
  counting the root. Eligible unexplored children at either cap set `truncated`.
- An additional 10-second traversal budget bounds large entry scans and git
  suggestion work; directory entries are streamed. Each git read has a timeout
  of at most 1 second, reduced near the deadline. Limit hits and unreadable
  subtrees return partial results with `truncated`, rather than failing the scan.
- The root itself is never offered, matching existing registration's strict
  below-root requirement. If it contains `.git`, traversal stops there too.
- Names use the real folder basename; paths are absolute canonical paths plus
  root-relative paths; final results are sorted by relative path.
- Branch preference means local `refs/heads/main`, then `refs/heads/master`,
  then symbolic HEAD. If none is readable (e.g. detached HEAD without either
  preferred branch), suggestion is empty so the human supplies a branch.
- No new GET request body/schema is needed; the shared response schema and
  existing shared registration input schema define the boundary.

No new branch/worktree, commits, staging, stash, reset, task move, dependency,
or out-of-scope edits. Task remains in its assigned lifecycle directory.

### Unresolved risks

- Dispatcher must run the database/API suite and live temporary-tree check,
  plus read-only timing/results against the real projects root. Full acceptance
  is not claimed until those pass.
- Time budget checks cannot interrupt a blocked operating-system filesystem
  call. Host filesystem responsiveness remains a limit. Concurrent filesystem
  edits may invalidate discovery results; registration independently revalidates
  each selected path and reports its refusal.
- Truncated searches can omit repositories; the UI states this and keeps manual
  Add by path available. Directory enumeration order can affect the subset
  returned before a cap, although returned results are sorted.
- Branch suggestions are advisory and may be empty when metadata cannot be
  read. Existing registration owns validation; no branch policy was added.

Questions: none requiring a scope decision. Pending validation belongs to the
dispatcher, as instructed.

### Documentation updated

`docs/DEVELOPMENT.md` documents the endpoint, authorization, response fields,
search exclusions, symlink handling, caps, branch fallback and UI behavior.
This task records the implementation and validation handoff using the sections
from `docs/templates/implementation-report.md`.


### Dispatcher validation and testing (2026-09-28)

Codex was started directly with write access (`task-mulk3ae6-ranyul`). The
dispatcher (Claude) then ran the checks in the shared checkout:

- `pnpm typecheck` and `pnpm build`: all four packages pass.
- `pnpm test`: db 6, shared 21, ui 47, server 208 — **282 passed**, 0 failed.
  This includes the database suite.

**Live API check** (`pnpm dev` on ports 3200 and 5280, temporary database).
The test projects root held:

- `alpha`, registered first;
- `clients/acme/app`, with a repository inside it at `vendor/inner`;
- `legacy`, on `master`;
- `feature-only`, on `topic`;
- `.hidden/secret` and `web/node_modules/pkg`;
- a link to a repository outside the root.

Results:

- Before a root was set, discovery returned `validation`.
- Discovery returned exactly `clients/acme/app` [main], `feature-only` [topic]
  and `legacy` [master], with `truncated: false`. Excluded as required: the
  registered repository, the one inside a repository, the hidden folder,
  `node_modules`, and the repository reached through the link.
- An agent credential got `not_permitted`.
- Nothing on disk changed.

**Browser walkthrough**, 11 of 11 passed:

- The found list shows the three repositories and none of the excluded ones.
- `legacy` was broken (its `.git` removed) after it was listed. Then `app` and
  `legacy` were registered together: `app` registered, `legacy` was refused
  with "is not a git repository", and the unselected repository was still
  offered.
- "Select all" then "Register selected" registered `feature-only`.
- The "Add by path" fallback is present. At 390 px in dark mode there is no
  horizontal scroll. There were no page errors.

**Board's real projects root, read-only.** `discoverRepositories` was called
directly on `/home/patrick/Documents/Github`, so nothing was registered and no
settings changed. It found **56 repositories in 454 ms**, with `truncated:
false`. Main branches were suggested correctly, including `master`, `dev` and
`source`.

## Review

Not reviewed.

## Human acceptance

Pending.
