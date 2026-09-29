# TASK-032: GitHub source layer: token file, REST metadata client, bare mirror

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-010 (proposed in TASK-024), ADR-008, ADR-002
Dependencies: TASK-024 (ADR-010 approved), TASK-026

## Desired outcome

The server has a read-only GitHub source layer:
- it loads tokens from the token file
- it reads repository metadata, branch heads, and commit logins over REST
- it keeps a bare mirror per project with `git fetch` and reads the chain, change sets, and file bytes from it

It also has a git fixture builder for tests.

## Context

This is ADR-010 (TASK-023 decisions 1 and 2). This task builds primitives only.
Orchestration, statuses, and storage belong to TASK-034. The layer has no
database access and no dependency on `@moonbeam/dbc`. It returns raw facts and
bytes.

## Scope

### Included

- **`server/src/github/tokens.ts`:**
  - resolve the file (`MOONBEAM_GITHUB_TOKENS_FILE`, or `$MOONBEAM_HOME/github-tokens.json`)
  - validate `{ tokens: Record<label, string> }` with zod
  - look up labels case-insensitively
  - re-read when the file's mtime changes
  - results: `missing`, `unreadable`, or labels
  - `mask(token)` gives `••••` followed by the last 4 characters
  - warn (naming only the path) when the file is readable by group or others
- **`server/src/github/api.ts`:** an interface `GitHubApi` and an implementation using global `fetch`, with an injectable base URL, fetch, and timeout. Methods:
  - `getRepository(owner, repo, token, etag?)`: id, canonical full name, `redirected` when the full name differs, write scopes from `X-OAuth-Scopes` (`repo`, `public_repo`, or `write:*` count as write; null when the header is absent), and the ETag
  - `getBranchHead`
  - `getCommit(sha)`: sha and committer time
  - `listCommitLogins(head, knownShas)`: pages `GET /repos/{o}/{r}/commits?sha=` until it reaches known SHAs
  - every result is a union: `ok`, `not_modified`, `not_found`, `unauthorized`, `rate_limited` (with the reset time from `x-ratelimit-reset` or `retry-after`), or `unreachable` (network error, timeout, 5xx)
  - only GET requests
- **`server/src/github/git.ts`:** a git runner that refuses any subcommand outside the allowlist (`init`, `config`, `fetch`, `rev-parse`, `rev-list`, `log`, `cat-file`, `merge-base`, `update-ref`, `for-each-ref`).
  - Environment: `GIT_TERMINAL_PROMPT=0`, no system or global config, `credential.helper` empty.
  - The token goes in `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_0` and `GIT_CONFIG_VALUE_0`, with the value `http.<origin>/.extraheader = AUTHORIZATION: basic base64(x-access-token:<token>)`.
  - stderr is scrubbed of the token.
- **`server/src/github/mirror.ts`:** a `Mirror` for one directory:
  - `ensure()`: `init --bare` if missing
  - `fetch(url, branch, token)`: `+refs/heads/<branch>:refs/moonbeam/tracked`, `--no-tags`, `--prune`; returns the head, or `branch_missing`
  - `readChain(head)`: one `git log --first-parent --diff-merges=first-parent --no-renames --name-status -z --reverse --format=...` giving sha, parents, subject, author name and e-mail, committer name and e-mail, committer ISO time, and changes (added, modified, deleted)
  - `readFile(sha, path)`: bytes, `too_large` above 1 MiB (checked with `cat-file -s` first), or `absent`
  - `isAncestor(a, b)`
  - `pin(sha)` for `refs/moonbeam/last-processed`
  - the remote URL comes from an injectable builder (default `https://github.com/<owner>/<repo>.git`; tests pass a local path)
- **`server/src/test/git-fixture.ts`:**
  - builds small git repositories in temporary directories with isolated config and fixed dates
  - commits file maps with given authors and times
  - branch, `merge --no-ff`, squash merge, fast-forward, `reset --hard` (for force-push fixtures)
  - returns SHAs
- Unit tests for tokens, api (with a fake fetch), git, and mirror (with fixture remotes). Register them in `server/vitest.unit.config.ts`.
- **`docs/DEVELOPMENT.md`:**
  - the token file format and location
  - `MOONBEAM_GITHUB_TOKENS_FILE`
  - the mirror location
  - the git 2.31 or later requirement
  - the token scopes to grant (contents read and metadata read)

### Excluded

- Polling, statuses, snapshots, and storage (TASK-034).
- Registration (TASK-033).
- Decoding and parsing (dbc).
- GraphQL.

### Paths

- `server/src/github/`
- `server/src/test/git-fixture.ts`
- `server/vitest.unit.config.ts`
- `docs/DEVELOPMENT.md`

## Plan

1. Tokens module and tests.
2. The API client, with a fake-fetch test double that records every request.
3. The git runner and allowlist, then the mirror, then the fixture builder.
4. Mirror tests against fixture remotes.
5. Documentation.

## Acceptance criteria

- [ ] S3 and V2:
  - the API client issues only GET, and a test double asserts it
  - the git runner rejects `push`, `commit`, `remote set-url --push`, and anything outside the allowlist, and a test asserts it
  - the mirror never writes to the remote
- [ ] S2: the mirror fetches only the tracked branch into `refs/moonbeam/tracked`, with no tags.
- [ ] S4:
  - tokens never appear in thrown errors, returned results, logged output, the mirror's `config` file, or process arguments
  - `mask` shows only the last 4 characters
  - write scopes are detected from `X-OAuth-Scopes`
- [ ] S8 and F4: `getRepository` returns the numeric ID and the canonical full name, and marks a redirect.
- [ ] F1, F2, F3, F5: timeout, network error, 5xx, 401, 404, rate limit (403 or 429 with a reset or retry-after), and a missing branch each map to their result kind.
- [ ] H1 and the change-set definition: `readChain` on a fixture with a merge commit, a rename, and a root commit returns the first-parent chain oldest first. Merges are diffed against their first parent, a rename appears as a delete plus an add, and the root is diffed against the empty tree.
- [ ] P10 input: `readFile` reports `too_large` without reading the blob.
- [ ] F6 input: `isAncestor` is true for a fast-forward and false after a `reset --hard` rewrite.
- [ ] I2 input: `listCommitLogins` stops at known SHAs and returns null for commits GitHub hasn't linked.
- [ ] The tokens module reports `missing` and `unreadable` distinctly and picks up an edited file without a restart (F2).

## Validation requirements

- `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts` during work.
- `pnpm typecheck`, `pnpm test`, `pnpm build`, and the database suite (`pnpm --filter @moonbeam/server exec vitest run`) at handoff. Record the counts.

## Risks and assumptions

- Assumes TASK-023 decisions 1 and 2 as recommended.
- Fine-grained tokens don't report scopes, so no write warning is possible for
  them.

## Blocker

None.

## Implementation handoff

Implemented TASK-032 in the shared `main` checkout. Ready for dispatcher review; not marked accepted or moved, and no repository git write commands were run.

Files changed:

- `server/src/github/tokens.ts` and `server/src/github/tokens.test.ts`
- `server/src/github/api.ts` and `server/src/github/api.test.ts`
- `server/src/github/git.ts` and `server/src/github/git.test.ts`
- `server/src/github/mirror.ts` and `server/src/github/mirror.test.ts`
- `server/src/test/git-fixture.ts`
- `server/vitest.unit.config.ts`
- `docs/DEVELOPMENT.md`
- `tasks/in-progress/TASK-032-github-source-layer.md` (Implementation handoff only)

Public API:

- `tokenFile`, `mask`, and `TokenFile.labels()/lookup(label)`: masked label listings and private server-side credential lookup, with `missing`/`unreadable` results and automatic reload.
- `GitHubApi` and `RestGitHubApi`: `getRepository`, `getRepositoryById`, `getBranchHead`, `getCommit`, and `listCommitLogins`. Injectable fetch/base URL/timeout; discriminated result unions, ETags, write scopes, and ISO rate-limit reset times.
- `GitRunner.run`, `isolatedGitEnvironment`, and `scrubGitOutput`: allowlisted execution with injectable executor and ephemeral authentication.
- `Mirror`, `mirrorDirectory`, and `githubRemoteUrl`: `ensure`, `fetch`, `readChain`, `readFile`, `isAncestor`, and `pin`; injectable remote builder and runner. Files return raw buffers.
- `GitFixture.create`: temporary repositories with deterministic commits, branches, merges, squash merges, fast-forwards, resets, publishing to a local bare remote, and cleanup.

Validation (Node/pnpm path prepended as instructed; git 2.47.3):

- `pnpm --filter @moonbeam/server exec vitest run --config vitest.unit.config.ts`: passed, 53 tests across 4 files. An initial run exposed two log-separator parsing failures; these were corrected before the passing runs.
- `pnpm typecheck`: passed for all 5 packages.
- `pnpm test`: passed, 278 tests across 26 files: db 6, dbc 182, shared 4, server 65, UI 21.
- `pnpm build`: passed for all 5 packages.
- `pnpm --filter @moonbeam/server exec vitest run`: passed separately, 65 tests across 6 files, including 12 database/API tests and 53 source tests.
- `git diff --check`: passed. Test subprocesses and embedded Postgres stopped; no server was started or left running. Tests used temporary homes/token files and local `file://` remotes with stubbed HTTP, never real GitHub or real `~/.moonbeam`.

Acceptance criterion evidence:

1. S3/V2: HTTP doubles assert GET-only requests; git tests reject push, commit, remote changes, and other disallowed commands. Mirror tests verify remote refs remain unchanged.
2. S2: only the tracked branch reaches `refs/moonbeam/tracked`; other remote branches and tags are excluded.
3. S4: token masking, write-scope detection, environment-only git authentication, sanitized errors/output, credential-free argv, and token-free mirror config are covered.
4. S8/F4: repository results expose numeric ID, canonical name, and redirect indication; numeric-ID resolution refuses mismatches.
5. F1/F2/F3/F5: timeout, network error, 5xx, 401, 404, 403/429 rate limits, and missing branches have tested outcomes.
6. H1/change sets: root, first-parent merge, rename, empty commit, identities, timestamps, and unusual paths are tested oldest-first; renames become delete/add pairs.
7. P10: oversized blobs return `too_large` after size inspection without reading contents; exactly 1 MiB remains readable.
8. F6: fast-forward ancestry is true, rewritten ancestry is false, and pinned old objects remain readable.
9. I2: login pagination stops at known SHAs and preserves null for unlinked authors.
10. F2/token configuration: missing versus unreadable configuration, absent labels, edits, replacement, deletion, and recovery are tested without restarting.

Assumptions and deviations: no path or dependency deviations. Added `getRepositoryById` alongside the task's name-based registration lookup to implement ADR-010. Duplicate case-insensitive token labels are unreadable. Missing labels return `missing` without creating flags. Numeric-ID mismatches return `not_found`; plain non-rate-limit 403 returns `unauthorized`; an absent reset time is null. Non-branch git fetch failures return `unreachable`, leaving detailed source classification to REST. Mirror operations require caller serialization; incomplete or failed reads throw generic errors rather than returning partial history. Git execution defaults to a 60-second timeout and 128 MiB output bound.

No unresolved blockers. Registration, polling/status orchestration, storage, decoding, and flag handling remain outside this task. `docs/DEVELOPMENT.md` documents configuration, token permissions/scopes, mirror location, git requirement, APIs, and test isolation.

**Dispatcher check:**

- The token reaches git only through `GIT_CONFIG_COUNT` with an
  `http.<origin>.extraheader`. REST uses a `Bearer` header with
  `method: "GET"` and `redirect: "manual"`.
- The git allowlist excludes `push`. Re-ran the server suite: 6 files, 65
  passed, including the database tests.
- **Notes for review:**
  - The allowlist also includes `init`, `config`, and `update-ref`. They
    write only to Moonbeam's own mirror, never to GitHub or a project
    folder, but ADR-010 lists only "fetch plus local read commands".
  - `protocol.file.allow=always` is set for the `file://` test fixtures. In
    production it could be limited to https only.

## Review

Not reviewed.
