# TASK-023: Plan the code rework for ADR-008 and CONTRACT-006

Owner role: Architect
Assigned agent: jarvis (with Claude writing the files)
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-002, ADR-008, ADR-009
Dependencies: TASK-021 (CONTRACT-006 approved)

## Desired outcome

The board has an ordered set of proposed implementation tasks that turn the
current code into what ADR-008 and CONTRACT-006 describe. Each task is small
enough to hand to Codex, with its paths, acceptance criteria, and validation.
Any technical decision the tasks depend on is presented for the board to
decide first.

## Context

The current code is built for the old direction:

- a lifecycle service with claims, leases, and splits
- agent run credentials and the development routes
- a task board, decision queue, and task actions
- registration of local repositories under a projects root

ADR-008 keeps the stack, the users and user select, the audit trail, and the
dashboard shell. It re-points registration at GitHub and shelves the rest.
CONTRACT-006 defines what must be built:

- polling and reading main
- parsing DbC task v1
- task history
- flags and flag records
- identities with several e-mails and logins per member
- the per-project view

## Scope

### Included

- **Decisions to present before any task.** For each, give the options, a
  recommendation, and the consequences.
  1. **How Moonbeam reads GitHub.**
     - A local bare mirror per project, kept up to date with `git fetch`
       (history, diffs, and first-parent walks are local and fast).
     - Or the GitHub REST or GraphQL API only.
     - Or a mix.
     A mirror would be Moonbeam holding a copy of each repository, which
     ADR-006 forbade. ADR-008 supersedes ADR-006, but say explicitly whether
     this needs an ADR.
  2. **Token configuration** per GitHub owner (CONTRACT-006 Q11): where it
     lives and how it is loaded.
  3. **Removing the shelved code** before, during, or after the new features,
     and whether its database tables are dropped or left in place.
  4. **Whether this repository adopts DbC task v1 for its own tasks**, so
     Moonbeam can watch itself as the first project.
- **A proposed task sequence**, each written as a task file in
  `tasks/proposed/` using `docs/templates/task.md`. It will likely include:
  - schema and migrations for the project registration fields, identities,
    history, and flag records
  - the GitHub reader
  - the DbC task v1 parser, with the P and H rules
  - flag evaluation (FL-1 to FL-11)
  - flag records and dismissal (FG)
  - identity management in the UI
  - the per-project view (D rules)
  - the cross-project dashboard
  - removal of the shelved code

  Set dependencies and paths so tasks with separate paths can run in
  parallel.
- A short plan summary in this task's handoff: the order, the dependency
  graph, and the decisions needed.

### Excluded

- Implementing anything.
- Changing CONTRACT-006. If planning finds a gap in the contract, raise it as
  a question. A fix would be a superseding contract.
- The upstream DbC template changes.

### Paths

- `tasks/proposed/` (new task files only)
- this task file

## Acceptance criteria

- [ ] Each of the four decisions is presented with options and a
      recommendation, and none is taken without the board.
- [ ] Every CONTRACT-006 rule group (S, P, H, R, D, FL, FG, I, L, F) is
      covered by at least one proposed task, and the handoff shows the
      mapping.
- [ ] Each proposed task has paths, acceptance criteria, validation, and
      dependencies.
- [ ] No code is changed.

## Validation requirements

The dispatcher checks the rule-group coverage against CONTRACT-006, and checks
that the paths of any tasks planned to run in parallel don't overlap.

## Risks and assumptions

- The proposed tasks assume the board's answers to the four decisions follow
  the recommendations. If the answers differ, the affected tasks are revised
  before approval.

## Blocker

None.

## Implementation handoff

Planned by jarvis (read-only). The dispatcher wrote its 18 task files verbatim
to `tasks/proposed/`, TASK-024 to TASK-041. No code changed.

**Dispatcher checks:** every file follows the template sections, and none
has a `## Human acceptance` section. Each task's dependencies match the graph
below.

### Part 1: Decisions for the board

#### Decision 1: How Moonbeam reads GitHub

What CONTRACT-006 needs from GitHub:
- **The whole first-parent chain.** History is always derived from the whole chain (H1).
- **Per-commit change sets against the first parent.** A merge's change set is everything it brought in, and a rename counts as both of its paths.
- **File contents at arbitrary commits:**
  - task files at each entry commit (FL-1 evidence, FL-4 Paths, FL-8 "Approved by at C")
  - the old and new versions of changed contracts and ADRs (the Q4 header-only test)
  - every file at head
- **Ancestry checks** for force-push detection (F6, FL-10).
- **Metadata that git cannot supply:**
  - the numeric repository ID and redirects (S8, F4)
  - token scopes (S4)
  - rate limits (S5, F1)
  - the GitHub login associated with each commit author (I2, I3 rule 1)

**Options**

- **A. A local bare mirror per project**, updated by `git fetch`, with no REST calls. This is not possible. Git cannot report the repository ID, redirects, token scopes, or author logins.
- **B. The REST or GraphQL API only.**
  - The first-parent chain has to be reconstructed from the commit lists.
  - It takes one request per commit for change sets. GitHub caps a commit's file list at 3,000 files, which makes F9 a real case, and merge-commit diffs through the API are harder to be sure of.
  - It takes one request per file version for contents.
  - An initial read of a repository with 1,000 commits costs thousands of requests. Every poll with new commits costs dozens.
  - Force-push detection needs the compare endpoint.
  - Header-only detection needs two content reads per changed contract or ADR.
- **C. A mix (recommended).**
  - A local bare mirror per project at `$MOONBEAM_HOME/mirrors/<project-id>.git` provides the chain, change sets, contents, and ancestry.
    - It fetches only the tracked branch, into `refs/moonbeam/tracked`, with no tags.
    - A pinned `refs/moonbeam/last-processed` keeps the last snapshot's objects readable (S7).
  - The REST API provides:
    - repository metadata (ID, redirect, scopes, rate limit, using ETags so an unchanged poll is a free 304)
    - the branch head
    - commit logins, cached per SHA
  - A poll with no change costs 2 API calls. A poll with new commits costs a fetch plus about 1 extra call per 100 new commits.

**Recommendation: C.**
- One `git log --first-parent --diff-merges=first-parent --no-renames --name-status -z` process yields the chain and all change sets exactly as CONTRACT-006 defines them.
- `--no-renames` gives "a rename counts as both paths" for free.
- `merge-base --is-ancestor` gives F6.
- Rebuilding the whole derived history on every head change becomes cheap, which makes H9, N3, and V3 true by construction.

**Consequences**
- Git 2.31 or later becomes a runtime requirement on the host. It is 2.47 today.
- Disk use is roughly the size of each repository.
- The mirror is a rebuildable cache under N2. Deleting it only costs a refetch.
- The S3/N1 guarantee becomes "only `fetch` and local read commands". It is enforced by an allowlisted git runner and tested (V2).
- The token reaches git through environment-scoped config (`GIT_CONFIG_COUNT`, http extraheader). It is never put in a URL, the mirror's config, or logs.

**Does this need an ADR?** Yes, a short one: ADR-010, written by TASK-024. Strictly, ADR-008 supersedes ADR-006 as a whole, and CONTRACT-006 leaves the mechanism to implementation, so no ADR is mandatory. But ADR-006 decision 2 ("Moonbeam never holds project repositories") was an explicit board value. It is better to record why a read-only, rebuildable cache doesn't violate that value's reasons than to let a superseded ADR imply it silently. The reasons were: duplicating the canonical repository, hiding work from people's folders, and pushing without asking. The ADR also records the new git runtime dependency and the token file (decision 2).

If the board prefers no ADR, drop TASK-024. TASK-032 then records the choice in `docs/DEVELOPMENT.md` and loses its dependency on TASK-024. If the board chooses API only, TASK-024 and TASK-032 are rewritten, TASK-034's adapter changes, TASK-040 has to read through the API or plain git, and F9 handling gains real work.

#### Decision 2: Token configuration (CONTRACT-006 Q11: server configuration per GitHub owner)

**Options**
- **A. Environment variables per owner**, such as `MOONBEAM_GITHUB_TOKEN__MRDATAWOLF`.
  - Owner names allow hyphens and mixed case, so they need an encoding.
  - Replacing a token needs a restart, and F2 expects a replaced token to be picked up.
- **B. A JSON file (recommended)** at `$MOONBEAM_HOME/github-tokens.json`, overridable with `MOONBEAM_GITHUB_TOKENS_FILE`, shaped `{ "tokens": { "<label>": "<token>" } }`.
  - By convention the label is the GitHub owner. Labels are matched case-insensitively.
  - A registration stores the label (S1 "which configured token is used"), defaulting to the label equal to its owner.
  - The file is re-read (checked by mtime) on every poll and on the token-list request, so a replaced token is picked up without a restart (F2).
  - It lives outside the repository and the database.
- **C. Tokens entered in the UI and stored in the database.** Q11 already rejected this.

**Recommendation: B.**
- If the file is readable by group or others, the server logs a warning that names only the path.
- If the file is missing, projects show a "token not configured" status.
- If the file is unreadable or invalid JSON, every project shows a "token configuration unreadable" status. The server never crashes.
- The API lists only labels with a masked form such as `••••abcd` (S4).
- Tokens never appear in responses, audit details, logs, or error text. Git stderr is scrubbed.
- S4's write-scope warning is best effort. GitHub reports scopes (`X-OAuth-Scopes`) only for classic tokens. For fine-grained tokens nothing is reported, so no warning is shown.

**Consequences**
- The operator edits one file on the host.
- Tests use a temporary file.
- TASK-032 builds the loader, and TASK-033 exposes the labels.

If the board picks A, TASK-032's token module and TASK-033's token-list endpoint change. Either way, a replaced token then needs a restart.

#### Decision 3: Removing the shelved code, and its tables

**Timing options**
- **Before the new features (recommended).**
  - The shelved code occupies exactly the files the rework must change: `routes.ts`, `registry.ts`, the `projects` table, the harness, `shared/projects.ts`, `Dashboard.tsx`, `queries.ts`.
  - With tasks and claims gone, `projects` can be replaced cleanly. Nothing new has to coexist with lifecycle code, and Codex works on a small codebase.
  - Cost: until TASK-037 and TASK-038 land, the app is only the shell (users, setup, placeholders). Nothing depends on it today, since no agent ever ran through Moonbeam.
- **During**, piece by piece. Every early task would have to preserve lifecycle code it doesn't care about. `projects` would have to be renamed or duplicated while tasks still reference it.
- **After.** This needs a second projects table, such as `github_projects`, and dual routes. It serializes most tasks on `routes.ts` and `registry.ts`, and it spends review effort on code that is about to be deleted.

**Tables: drop or keep**
- **Drop (recommended).** Drop `tasks`, `claims`, `handoffs`, `reviews`, `blockers`, `pauses`, `agent_runs`, `run_credentials`, `settings` (projects root) and the local-path `projects`, with their enums.
  - Keep `users`.
  - Keep `audit_records`, with every row. It is append-only by trigger and has no foreign keys.
  - Keep the `actor_kind` enum, because old audit rows use it.
  - Lifecycle data has no value under ADR-008, since task state now lives in each repository.
  - Local-path registrations can't be converted: they have no owner, name, or repository ID. The audit trail keeps the record that they existed.
- **Keep in place.** The Drizzle schema would have to keep defining the shelved tables, or `db:generate` emits drops anyway. Dead tables confuse every later schema task.

**Recommendation: remove first, in one task (TASK-026), and drop the tables.**

**Consequences**
- Any existing Moonbeam database (for example on 192.168.203.117) loses its lifecycle and test data when it migrates. If the board wants it, take a `pg_dump` first.
- The code stays in git history. ADR-008 says a shelved contract returns only through a new ADR anyway.
- `tools/model-eval` and `ui/screenshots/TASK-007/` stay untouched.

If the board picks "after": TASK-026 moves to the end, TASK-031 and TASK-033 introduce differently named tables and routes, and the parallelism in the graph shrinks. If it picks "keep tables": TASK-026 drops no tables and keeps their schema definitions.

#### Decision 4: Should this repository adopt DbC task v1 for its own tasks?

The tension: U5 (proposals and approvals on main, work on a branch, merge from `completed/` without fast-forwarding) conflicts with how this repository works today.
- Lifecycle moves are committed straight to main.
- Several subagents work in parallel in one shared checkout on one branch (AGENTS.md "Dispatching subagents", and the "never review from hidden worktrees" rule).
- One branch per task in a single checkout can't run tasks in parallel without worktrees.

**Options**
- **A. Adopt fully now**, format and main-branch rules.
  - Parallel tasks would share a batch branch: one branch cut from main for a set of approved tasks, with subagents working in the shared checkout exactly as today.
  - The branch is merged to main with `--no-ff` only when every task on it is in `completed/`. The branch's `in-progress/` and `review/` moves never appear on main's first-parent chain, and FL-4 handles several tasks completing in one merge.
  - Approvals must be committed on main. The dispatcher either approves between batches, or uses a dedicated main worktree for lifecycle commits and then merges main into the batch branch.
  - Cost: the workflow changes in the middle of an 18-task rework.
- **B. Adopt the format now and the main-branch rules once Moonbeam can show this repository (recommended).**
  - TASK-025 adds `Format: DbC task v1` and the U3/U4 guidance to this repository's template now, so every new task file at head is v1 when Moonbeam first reads itself.
  - TASK-041 adopts U5–U8 and the batch-branch dispatch model after the per-project view works (TASK-038), so the board can watch the switch in Moonbeam.
  - The default baseline is head at registration (Q3), so commits made before the switch raise no event flags unless the board moves the baseline back.
- **C. Don't adopt.** This repository stays classic DbC and pre-v1: FL-7 on every task file, plus FL-11 and FL-3 noise if the baseline is moved back. Another project serves as the first v1 project.

**Recommendation: B.**

**Consequences**
- Old task files stay pre-v1 and each raises FL-7 at head. They can be dismissed, and they are never rewritten.
- If the board approves TASK-025 before approving TASK-026 onward, the dispatcher can add `Format: DbC task v1` as the first header line of those files at approval. I didn't add it, because the instruction was to follow the current template exactly.
- A: TASK-041 moves to the front (after TASK-022 and TASK-025), and the dispatch of every later task follows the batch-branch model. C: drop TASK-025 and TASK-041. TASK-040 (V9) is unaffected either way.

#### Decision 5 (smaller, architectural): where the engine lives and how it recomputes

**Recommendation**
- Put the pure logic (parsers, history, identity matching, flag rules) in a new workspace package, `packages/dbc` (`@moonbeam/dbc`). It has no dependency on the database, Express, git, or the network.
- On every head change, derive the whole snapshot again from the chain rather than updating it incrementally.
- Store the result as one versioned JSON snapshot row per project, replaced in the same transaction as source status and flag reconciliation (S6: a viewer sees the whole old result or the whole new one).

**Why**
- The package can be tested and validated in isolation, and its lane runs in parallel with the server lane without typecheck interference.
- The engine is pure and deterministic (H9, N3, V3).
- Registration and identity changes re-evaluate flags from the stored snapshot without touching GitHub.

**Alternative:** `server/src/dbc/` inside the server package. This is simpler wiring, but a half-finished server task can break the engine lane's validation.

**Consequences:** one more workspace package. The snapshot has a version number, so a code change forces a rebuild without raising FL-10.

If the board prefers `server/src/dbc/`: TASK-027 through TASK-030 change their paths and can no longer run their validation in isolation while TASK-026 is in flight. TASK-027 would then need to depend on TASK-026.

### Part 2: Handoff summary

#### Order and dependency graph

```
TASK-024 ADR-010 (docs)            ─────────────────────────────┐
TASK-025 v1 format here (docs)     ──────────────────────────────────────────────┐
TASK-026 remove shelved code ──┬── TASK-031 schema ──┐                            │
                               └── TASK-032 GitHub source (needs 024) ─┤           │
TASK-027 @moonbeam/dbc + parsers ─┬─ TASK-028 identity match ──┬───────┤           │
                                  └─ TASK-029 history ─────────┤       │           │
                                                               TASK-030 flag rules │
                                   TASK-033 registration+identities API (028,031,032)
                                        ├── TASK-037 UI registration+identities    │
                                        └── TASK-034 poller (029,030,033)          │
                                              ├── TASK-040 V9 walk-through         │
                                              └── TASK-035 flag records+dismissal  │
                                                    └── TASK-036 project view API  │
                                                          └── TASK-038 UI project view (036,037)
                                                                ├── TASK-039 dashboard
                                                                └── TASK-041 main-branch rules (025,038)
```

Waves, each group mutually path-disjoint:
- **Wave 1:** 024, 025, 026, 027
- **Wave 2:** 028, 029 (after 027); 031 (after 026); 032 (after 024, 026)
- **Wave 3:** 030 (after 028, 029); 033 (after 028, 031, 032)
- **Wave 4:** 034 (after 029, 030, 033); 037 (after 033)
- **Wave 5:** 035 (after 034); 040 (after 034); 037 may still be running
- **Wave 6:** 036 (after 035), alongside 037 and 040 if they are still running
- **Wave 7:** 038 (after 036, 037), alongside 040 if still running
- **Wave 8:** 039 (after 036, 038); 041 (after 025, 038)

Shared hotspots, serialized through dependencies:
- `server/src/routes.ts`, `server/src/index.ts`, `server/src/test/harness.ts`, `packages/shared/src/index.ts`: 026 → 033 → 034 → 035 → 036 → 039.
- `ui/src/api/queries.ts`: 026 → 037 → 038 → 039.
- `pnpm-lock.yaml`: 027, 033, 038. Of these, only 027 falls in the same wave as other tasks, and none of those touch the lockfile.
- `docs/DEVELOPMENT.md`: 026, 032, 033, 034, 035, 036, 038, 039. No two of them are in the same wave.
- `tasks/README.md`: 025 → 041.

Validation note for parallel waves: during work, each task runs only its package-scoped commands. The full `pnpm typecheck && pnpm test && pnpm build` runs at handoff. A failure outside the task's paths is reported as interference, not fixed.

#### Coverage of CONTRACT-006 rule groups

| Group | Rules | Tasks |
|---|---|---|
| S Source | S1 registration fields and audit | 031 (tables), 033 (API), 037 (UI) |
| | S2 main only, S3 read only | 032 (allowlisted git, GET-only client), 034 (V2) |
| | S4 token | 024, 032 (loader, masking, scopes), 033 (labels), 037 |
| | S5 polling and refresh, S6 poll outcome, S7 last known state | 034, 038 (refresh control, labels) |
| | S8 repository identity | 032 (primitives), 033 (recorded at registration), 034 (checked every poll) |
| P Parse | P1–P10 | 027. Used by 029 and 030. V5 corpus in 027. |
| H History | H1–H9 | 029. H9 and V3 end to end in 034. |
| R Artifacts | R1–R3 parsing | 027 |
| | R3–R6 in the view | 036 (content, links, unreadable), 038 (R4 safe rendering, V7) |
| D View | D1–D10 | 036 (API), 038 (UI); D10 also 039 |
| FL Flags | FL-1–FL-11 rules and evidence | 030 |
| | FL-10 detection | 034 |
| | persistence | 035 |
| | display | 038 |
| FG Flag lifecycle | FG1–FG7 | 035; FG4 UI in 038 |
| I Identity | I2–I5, I7 matching | 028 |
| | I1 and I4 data and API | 033 |
| | I1 and I4 UI | 037 |
| | I6 re-attribution | 035 (re-evaluation), 036 (mapping at read time) |
| | I8 | wording in 038 |
| L Lead developer | L1 | 033, 037 |
| | L2 | 030 (FL-5 evidence), 036, 038 |
| N Invariants | N1 | 032, 034 |
| | N2 | 031, 034 |
| | N3 | 029, 034 |
| | N4 | 027, 029, 034 |
| | N5 | 035 |
| | N6 | 036, 038 |
| F Failures | F1–F6, F10 | 034 |
| | F7, F8 | 029, 036 |
| | F9 | 029, 030 (annotations) |
| V Validation | V1 | 029, 030, with git end to end in 034 |
| | V2–V4 | 034 |
| | V5 | 027 |
| | V6 | 028, 035 |
| | V7 | 038 |
| | V8 | 035 |
| | V9 | 040 |
| UX | UX1–UX6 | 038, 039 |
| U Upstream | U1–U9 | Out of scope (excluded by TASK-023). This repository's own adoption is 025 (U1, U3, U4, U8 first half) and 041 (U5–U8). |

#### Gaps and ambiguities in CONTRACT-006 (questions, not fixes)

1. **Header-only edits (Q4) for added, deleted, or section-less files.**
   - A new contract or ADR file added to main is never header-only, so it raises FL-3 unless a task completes in the same commit. Does the board confirm that new contracts and ADRs must arrive through a task's merge?
   - A file with no `## ` line would count as header-only for any edit. Is that intended?
   - Planned reading: header-only means both versions have a first `## ` line and are identical from it to the end.
2. **The root commit is never evaluated.** Evaluated commits are "strictly newer than the baseline", so with the baseline at the root (as in V9), the root commit's own changes are never checked. Should there be a "no baseline, evaluate everything" option?
3. **Changing the tracked branch** of a registration: the new head won't descend from the last processed head. Is that FL-10, or a reset? What happens to the baseline? Planned: no FL-10, reset the last processed head, and require a new baseline, defaulting to the new head.
4. **Removing a registration** (F3 mentions it): should flags, dismissals, and snapshots be deleted, or archived? Planned: soft removal that keeps the data and audit, and allows re-registering the same repository ID.
5. **FL-5 re-raise timing.** Does "Dismissal lasts one further threshold period" count from the dismissal time, or from the end of the first period? Planned: from the dismissal time.
6. **An event flag withdrawn under FG5 whose commit returns to the chain** after a second force-push: reopen the old record with its dismissal, or raise a new flag? Planned: a new flag.
7. **A dismissed condition flag whose condition clears:** does it become resolved, and is a recurrence a new flag? Planned: yes to both.
8. **A token label that isn't configured** is not among F1–F10. Planned: a distinct source status, "token not configured", which raises no flag.
9. **FG7 and the audit trail.** Should raising, resolving, and withdrawing flags write audit records (system actor), or only dismissals and reopens? Planned: all of them, with a `flag_id` column on audit records.
10. **D6 "last 12 weeks".** Calendar weeks (which start day, which timezone) or rolling 7-day windows? Planned: rolling windows ending now.
11. **I4 ambiguity versus I3's order.** If a login matches two members, is the identity unmatched, or does matching fall through to the e-mail step? Planned: the first step that matches anything decides, and two or more members there means unmatched.

## Review

Not reviewed.

## Board notes

Board answers to the five decisions (Patrick, 2026-09-28):

1. **How Moonbeam reads GitHub:** option C as recommended: a local bare
   mirror plus the REST API, recorded in ADR-010 (TASK-024). The board first
   chose to read the user's own local folders, then reversed that the same
   day: "we can do token, ... we would be there later anyway".
2. **Tokens:** option B as recommended, a JSON token file in
   `$MOONBEAM_HOME`.
3. **Remove the shelved code first and drop its tables:** agreed.
4. **Adopt the task format now and the main-branch rules later
   (TASK-025, then TASK-041):** agreed, as a trial.
5. **`packages/dbc`, with the whole snapshot rebuilt on each head change:**
   agreed.

The board approved the planned readings of all 11 CONTRACT-006 gaps and
ambiguities, as listed in the handoff (Patrick, 2026-09-28). The tasks
implement them as planned. They are to be collected into a superseding
CONTRACT-007 later, together with anything the implementation finds.
