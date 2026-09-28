# TASK-033: Project registration, lead developer, and identities API

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-008, ADR-003, ADR-010
Dependencies: TASK-028, TASK-031, TASK-032

## Desired outcome

Board members can do the following through the API, every change audited with
the selected user:
- register GitHub repositories (S1, S8)
- change or remove a registration
- assign a lead developer (L1)
- manage identities (I1)
- see identity conflicts (I4)
- see configured token labels in masked form (S4)

## Context

This is the re-pointed registration that ADR-008 describes. Registration reads
GitHub once, through the TASK-032 `GitHubApi`, to record the repository ID and
the default baseline. Reads need no selected user. Actions do.

## Scope

### Included

- **`packages/shared/src/projects.ts` (new):** the registration view and input schemas.
- **`packages/shared/src/identities.ts`:** identity and conflict schemas.
- **`errors.ts`:** add `github_unavailable` (503).
- **`index.ts`:** exports.
- **`server/src/projects/service.ts`:**
  - `register({ owner, repo, name?, trackedBranch?, tokenLabel?, leadDeveloperUserId?, baselineSha?, exemptPaths?, staleThresholdDays? })`:
    - the token label defaults to the owner's label
    - resolves the repository with that token, recording the ID and the canonical owner and name
    - checks the branch exists
    - the baseline defaults to the head, or a given SHA is checked with `getCommit`; records `baseline_committed_at`
    - refuses a duplicate ID
  - `update`:
    - name, branch, token label, baseline, exempt paths, threshold
    - owner and name only when they resolve to the recorded ID (F4, Q16)
    - a branch change resets the baseline to the new head unless one is given
  - `setLeadDeveloper(userId | null)` (L1): must be an active user
  - `remove`: sets `removed_at` and hides the project from lists
  - every change writes an audit record with before and after
- **`server/src/identities/service.ts`:**
  - list members with their identities: the CONTRACT-002 e-mail marked automatic, plus stored e-mails, logins, and aliases
  - add an identity (validation: e-mail format; login `^[A-Za-z0-9-]{1,39}$`; alias non-empty, at most 200 characters)
  - remove an identity
  - conflicts from `findConflicts` (dbc)
  - each change audited
- **Routes:**
  - `GET /api/github/tokens` gives `{ state, tokens: [{ label, masked }] }`
  - `GET` and `POST /api/projects`
  - `GET`, `PATCH`, and `DELETE /api/projects/:id`
  - `PUT /api/projects/:id/lead-developer`
  - `GET /api/identities`
  - `POST /api/users/:id/identities`
  - `DELETE /api/identities/:id`
- Harness: an injectable fake `GitHubApi` and a temporary tokens file.
- `server/package.json` adds `@moonbeam/dbc`.
- Tests.
- `docs/DEVELOPMENT.md`: the endpoints and categories.

### Excluded

- Polling and source status (TASK-034).
- Flags and re-evaluation hooks (TASK-035).
- The UI (TASK-037).

### Paths

- `packages/shared/src/projects.ts`
- `packages/shared/src/identities.ts`
- `packages/shared/src/errors.ts`
- `packages/shared/src/index.ts`
- `server/src/projects/`
- `server/src/identities/`
- `server/src/registry.ts`
- `server/src/routes.ts`
- `server/src/index.ts`
- `server/src/test/harness.ts`
- `server/src/test/projects.test.ts`
- `server/src/test/identities.test.ts`
- `server/package.json`
- `pnpm-lock.yaml`
- `docs/DEVELOPMENT.md`

## Plan

1. Shared schemas and the new failure category.
2. The projects service, using the fake API in tests.
3. The identities service.
4. Routes, wiring, and documentation.

## Acceptance criteria

- [ ] S1: registration stores every S1 field with its default: branch `main`, baseline at head (Q3), no exempt paths, threshold 14.
- [ ] S1: registration and every change write an audit record with the selected user, and with before and after.
- [ ] S8: the numeric ID is recorded. Registering the same ID twice is `validation`.
- [ ] F4 and Q16: changing owner or name to a repository with a different ID is `validation` ("repository identity differs"). Moonbeam never updates a registration by itself.
- [ ] S4:
  - an unknown token label is `validation`
  - `GET /api/github/tokens` shows labels and masked values only
  - no response or audit record contains a token
- [ ] Registration failures are reported, and nothing is stored:
  - not found or inaccessible: `validation`, naming both causes (F3 wording)
  - branch missing: `validation`
  - token rejected: `validation`
  - GitHub unreachable or rate-limited: `github_unavailable`
- [ ] L1: assigning or clearing the lead developer is audited. Assigning an inactive or unknown user is refused.
- [ ] I1: identities are added and removed per member and audited. The CONTRACT-002 e-mail is listed as automatic and can't be removed here.
- [ ] I4: `GET /api/identities` lists every conflict with the members involved.
- [ ] Actions without a selected user are `unidentified`. Reads work without one.
- [ ] Removal hides the project. Its data and audit trail are kept (assumption, TASK-023 question 4).

## Validation requirements

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The database suite (`pnpm --filter @moonbeam/server exec vitest run`). Record the counts.

## Risks and assumptions

- The branch-change and removal semantics are assumptions (TASK-023 questions 3 and 4).

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
