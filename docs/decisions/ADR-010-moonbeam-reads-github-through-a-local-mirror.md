# ADR-010: Moonbeam reads GitHub through a local mirror and the REST API

Status: Proposed
Date: 2026-09-28
Decision owners: Board (TASK-023 decisions 1 and 2, answered by Patrick on
2026-09-28)
Related tasks and contracts: TASK-023, TASK-024, TASK-032, TASK-034;
CONTRACT-006 (S2 to S8, F1 to F6, N1, N2, I2, I3)

## Context

CONTRACT-006 says what Moonbeam reads from each project's GitHub repository.
It leaves how to read it to implementation. Moonbeam needs:

- **the whole first-parent chain** of the tracked branch, oldest first (H1)
- **each commit's change set** against its first parent. A merge's change set
  is everything it brought in, and a rename counts as both of its paths.
- **file contents at any commit on the chain**:
  - task files at their entry commits
  - old and new versions of changed contracts and ADRs (the Q4 header-only
    test)
  - every file at head
- **ancestry checks**, to detect a rewritten history (F6, FL-10)
- **facts that only GitHub has**:
  - the repository's numeric ID and redirects after a rename (S8, F4)
  - the token's scopes (S4)
  - rate limits (S5, F1)
  - the GitHub login associated with each commit author (I2, I3)

ADR-006 decision 2 said "Moonbeam never holds project repositories". ADR-008
superseded ADR-006 as a whole and made GitHub the reference point (ADR-008
decision 5). It didn't say whether Moonbeam may keep a local copy in order to
read it. ADR-006's rule was a deliberate board value, so this ADR records why
the choice below is consistent with it.

## Decision

1. **Every project has a local bare mirror, which is a cache.**
   - The mirror lives at `$MOONBEAM_HOME/mirrors/<project-id>.git`.
   - It is updated with `git fetch`, which fetches only the tracked branch
     into `refs/moonbeam/tracked` (S2). It fetches no tags and no other
     branches.
   - A pinned ref, `refs/moonbeam/last-processed`, keeps the last processed
     head's objects readable, so the last known state stays available (S7) and
     a force push can be recognized (F6).
   - The mirror is derived, rebuildable data (CONTRACT-006 N2). Deleting it
     costs only a refetch. It is never a source of truth and never shown to
     users as a repository.

2. **Git is used through an allowlist, and every command is a read.**
   - Moonbeam runs only `git fetch` toward GitHub.
   - Locally, it runs only read commands on the mirror. Examples:
     - `log --first-parent --diff-merges=first-parent --no-renames --name-status -z`
       for the chain and change sets
     - `cat-file` and `show` for contents
     - `merge-base --is-ancestor` for ancestry
     - `rev-parse`
   - It never runs `push`, and never changes any remote, branch, or project
     folder.
   - The allowlist is enforced in one place and covered by tests
     (CONTRACT-006 S3, N1, V2).

3. **The REST API is used for GitHub facts, and every request is a GET.**
   - The repository is resolved by its recorded numeric ID
     (`GET /repositories/{id}`). A repository reached under a different
     owner or name produces F4's notice ("now at owner/name; update the
     registration"). A name that resolves to a different ID is not read (S8).
   - Other GET requests:
     - the tracked branch's head
     - the token's reported scopes (`X-OAuth-Scopes`)
     - rate-limit headers (S5, F1)
     - the logins of commit authors, cached per commit SHA (I2, I3)
   - Conditional requests with ETags make a poll with no change cheap:
     - about 2 API calls when nothing changed
     - a fetch plus about 1 call per 100 new commits when something did
   - When rate-limited, Moonbeam waits for the reset time GitHub reports
     (S5).

4. **Tokens live in a file on the host, not in the database or the UI.**
   - The file is `$MOONBEAM_HOME/github-tokens.json`. It can be overridden
     with `MOONBEAM_GITHUB_TOKENS_FILE`, and its shape is
     `{ "tokens": { "<label>": "<token>" } }`.
   - A label is conventionally the GitHub owner, and labels are matched
     case-insensitively. Each registration records its label, which defaults
     to its owner (CONTRACT-006 S1, Q11).
   - The file is re-read when it changes (checked by modification time), on
     every poll, so a replaced token is picked up without a restart (F2).
   - If the file is missing, a project shows "token not configured", and no
     flag is raised (TASK-023, gap 8). If it is unreadable or invalid, every
     project shows "token configuration unreadable". The server keeps
     running.
   - If the file is readable by group or others, the server logs a warning
     that names only the path.

5. **Tokens never leak** (CONTRACT-006 S4).
   - A token is never sent to the browser, written to a log, or included in an
     audit record, error message, or API response. The API lists labels only,
     with a masked token form such as `••••abcd`.
   - Git receives the token through environment-scoped configuration
     (`GIT_CONFIG_COUNT` with an `http.extraHeader`). It never appears in a
     URL, the mirror's config, or a process argument. Git's error output is
     scrubbed before anything is shown or logged.
   - A write-scope warning is shown only when GitHub reports scopes, which it
     does for classic tokens. For fine-grained tokens nothing is reported, so
     no warning is shown. Reading continues either way.

### Relationship to earlier decisions

- **ADR-006 decision 2** ("Moonbeam never holds project repositories").
  ADR-006 is superseded (ADR-008), but its reasons still matter, and the
  mirror respects them:
  - **Duplicating the canonical repository.** The mirror isn't canonical. No
    one works in it, it holds one branch, it's never pushed from, and it can
    be deleted at any time.
  - **Hiding work from people's folders.** Moonbeam writes to no one's folder,
    and all work stays in the lead developer's clone and on GitHub.
  - **Pushing without asking.** Moonbeam never pushes, anywhere.
- **ADR-008 decision 5** (poll GitHub with a read-only token). This ADR says
  how. GitHub remains the only source, since the mirror is only fetched from
  it, and every interaction is a read.

## Alternatives considered

- **The REST or GraphQL API only.** Rejected.
  - The first-parent chain has to be reconstructed from commit lists.
  - Change sets take one request per commit, capped at 3,000 files, and
    merges are harder to get right.
  - Contents take one request per file version.
  - A first read of a repository with 1,000 commits costs thousands of
    requests.
- **A mirror without the REST API.** Not possible. Git can't report the
  repository ID, redirects, token scopes, rate limits, or author logins.
- **Tokens in environment variables per owner.** Rejected. Owner names need
  encoding, and replacing a token needs a restart, which F2's retry model
  doesn't expect.
- **Tokens entered in the UI and stored in the database.** Rejected by
  CONTRACT-006 Q11. Secrets stay out of the database and the browser.
- **Reading the lead developer's own local folders instead of GitHub.**
  Briefly chosen by the board on 2026-09-28, then reversed the same day. It
  would lose the repository ID, rename detection, and login matching, and
  would need a superseding contract.

## Consequences

### Benefits

- One git process yields the chain and every change set exactly as
  CONTRACT-006 defines them. `--no-renames` makes "a rename counts as both
  paths" automatic.
- Rebuilding the whole derived history on every head change is cheap, which
  makes CONTRACT-006 H9, N3, and V3 hold by construction.
- A poll with no change costs about two API calls.

### Costs and risks

- **Git 2.31 or later** is required on the Moonbeam host, for
  `GIT_CONFIG_COUNT`. The host has 2.47 today.
- **Disk use:** about the size of each tracked branch's history, per project.
- **Write-scope warnings** are possible only for classic tokens.
- **Operators edit a file on the host** to add or replace tokens. There is no
  UI for it.

## Follow-up work

- TASK-032: build the token loader, the allowlisted git runner, the REST
  client, and the mirror, and document the configuration in
  `docs/DEVELOPMENT.md`.
- TASK-034: use them in the poller.
- Revisit if Moonbeam ever needs to read more than the tracked branch, or to
  run on a host without GitHub access.
