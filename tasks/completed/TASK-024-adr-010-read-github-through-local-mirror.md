# TASK-024: Record ADR-010, Moonbeam reads GitHub through a local mirror

Owner role: Architect
Assigned agent: jarvis (with Claude writing the file)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008, ADR-006, ADR-002
Dependencies: None (records the board's answers to TASK-023 decisions 1 and 2)

## Desired outcome

`docs/decisions/ADR-010-moonbeam-reads-github-through-a-local-mirror.md` exists
with status Proposed. It records how Moonbeam reads GitHub and where tokens are
configured, so the board can approve it before the GitHub source layer
(TASK-032) is built.

## Context

CONTRACT-006 leaves the mechanism to implementation (Scope, Excluded;
Interfaces). ADR-006 decision 2 said Moonbeam never holds project repositories.
ADR-008 superseded ADR-006 but did not address a read-only cache. TASK-023
decision 1 recommends a mix:
- a bare mirror per project for history and contents
- the REST API for metadata and commit logins

Decision 2 recommends a token file per owner label.

## Scope

### Included

- **Decision text:**
  - the mirror at `$MOONBEAM_HOME/mirrors/<project-id>.git`
  - fetching only the tracked branch into `refs/moonbeam/tracked`, with no tags
  - a pinned `refs/moonbeam/last-processed`
  - an allowlist of git subcommands; never push
  - the mirror is a rebuildable cache (N2)
  - REST for the repository ID and redirects (S8, F4), scopes (S4), rate limits (S5, F1), the branch head, and commit logins (I2)
  - the token file `$MOONBEAM_HOME/github-tokens.json`, overridable with `MOONBEAM_GITHUB_TOKENS_FILE`, holding `{ "tokens": { "<label>": "<token>" } }`
  - labels conventionally named after the owner, re-read on every poll
  - tokens handed to git through environment-scoped config, never in a URL, the mirror config, or logs
- **Alternatives considered:**
  - API only
  - a mirror without REST (not possible)
  - environment-variable tokens
  - tokens in the database (rejected by Q11)
- **Relationship to ADR-006 decision 2 and ADR-008 decision 5.** Explain why a read-only, rebuildable cache doesn't bring back what ADR-006 rejected.
- **Consequences:**
  - git 2.31 or later on the host
  - disk use
  - classic tokens are the only kind for which a write-scope warning is possible

### Excluded

- Any code or `docs/DEVELOPMENT.md` change. TASK-032 documents the configuration.
- Other ADRs' status lines.

### Paths

- `docs/decisions/ADR-010-moonbeam-reads-github-through-a-local-mirror.md`

## Plan

1. Draft the ADR from `docs/decisions/ADR-TEMPLATE.md` using TASK-023
   decisions 1 and 2 as the board answered them.
2. Hand the draft to the dispatcher for the board.

## Acceptance criteria

- [ ] The ADR follows `docs/decisions/ADR-TEMPLATE.md` and has `Status: Proposed`.
- [ ] It states that every GitHub interaction is a read (S3, N1): only `git fetch` plus local read commands, and only GET requests.
- [ ] It names the tracked branch as the only fetched ref (S2).
- [ ] It states the token rules of S4:
  - never sent to the browser, logged, or shown except masked
  - a write-scope warning only when GitHub reports scopes
- [ ] It states the relationship to ADR-006 decision 2 and ADR-008 decision 5 explicitly.
- [ ] It lists the alternatives with the reasons for rejecting them.
- [ ] No other file changes.

## Validation requirements

The dispatcher checks the text against TASK-023 decisions 1 and 2 and CONTRACT-006
S2 to S8 and F1 to F5. No build or test is needed.

## Risks and assumptions

- Assumes the board chose decision 1 option C and decision 2 option B. If not,
  this task is rewritten or dropped (see TASK-023).

## Blocker

None.

## Implementation handoff

**Changed:**
`docs/decisions/ADR-010-moonbeam-reads-github-through-a-local-mirror.md`
(new, status Proposed). No other file changed.

**Written by:** Claude directly, not jarvis. The task fully specifies the
content.

**Acceptance criteria:**

- Follows the ADR template, with status Proposed.
- Reads only: decisions 2 and 3.
- Tracked branch only: decision 1.
- S4 token rules: decision 5.
- ADR-006 decision 2 and ADR-008 decision 5: "Relationship to earlier
  decisions".
- Alternatives, each with its reason.

**Additions beyond the task text:**

- The repository is resolved by its recorded numeric ID
  (`GET /repositories/{id}`). This gives S8 and F4 directly, and follows
  renames without trusting the old name.
- The alternatives record the board's brief "read local folders" choice and
  its reversal.
- A missing token shows "token not configured" with no flag, following
  TASK-023 gap 8.

**Validated:** read against CONTRACT-006 S2 to S8, F1 to F6, I2, I3, N1, and
N2, and against the TASK-023 board notes.

## Review

Not reviewed.
