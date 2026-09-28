# TASK-031: Database schema for GitHub projects, identities, snapshots, and flags

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by:
Approved date:
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-008, ADR-009, ADR-002
Dependencies: TASK-026

## Desired outcome

Drizzle tables and one generated migration hold exactly Moonbeam's own data
under N2:
- registrations and lead developers
- identities
- flag records
- poll status and rebuildable caches

## Context

TASK-026 dropped the old tables, including the local-path `projects`. This task
creates the new ones. Services come in TASK-033 to TASK-035.

## Scope

### Included

- **`projects`:**
  - `id`, `name`, `github_owner`, `github_repo`
  - `github_repo_id` (bigint)
  - `tracked_branch` (default `main`), `token_label`
  - `lead_developer_user_id` (nullable, foreign key to users)
  - `baseline_sha`, `baseline_committed_at`
  - `exempt_paths` (jsonb string array, default `[]`)
  - `stale_threshold_days` (int, default 14, check > 0)
  - `registered_at`, `registered_by_user_id`, `removed_at` (nullable)
  - a unique index on `github_repo_id` where `removed_at` is null
- **`user_identities`:**
  - `id`, `user_id` (foreign key), `kind` (enum: `email`, `login`, `alias`), `value`, `normalized` (lowercased and trimmed)
  - `created_at`, `created_by_user_id`
  - unique on `(user_id, kind, normalized)`. Duplicates across users are allowed (I4 is a warning).
- **`project_sources`** (poll status):
  - `project_id` (primary and foreign key)
  - `status` (enum: `never_polled`, `ok`, `unreachable`, `rate_limited`, `token_rejected`, `token_missing`, `token_config_unreadable`, `not_found`, `identity_changed`, `branch_missing`)
  - `status_since`, `last_attempt_at`, `last_success_at`
  - `last_processed_head`, `rate_limited_until`
  - `redirected_full_name`, `token_write_scopes` (boolean, nullable)
  - `consecutive_failures`, `baseline_needs_reset`, `repo_etag`
- **`project_snapshots`:** `project_id` (primary and foreign key), `head_sha`, `polled_at`, `snapshot_version`, `snapshot` (jsonb).
- **`commit_logins`:** `project_id`, `sha`, `login` (nullable); primary key `(project_id, sha)`. A rebuildable cache.
- **`flags`:**
  - `id`, `project_id`, `rule` (text `FL-1` to `FL-11`), `kind` (event or condition)
  - `subject_key`, `subject` (jsonb), `commit_sha` (nullable), `task_id_text` (nullable)
  - `status` (enum: open, dismissed, resolved, withdrawn)
  - `first_raised_at`, `status_changed_at`, `evidence` (jsonb)
  - a unique partial index on `(project_id, rule, subject_key)` where `status = 'open'` (FG2)
  - an index on `(project_id, status)`
- **`audit_records`:** add a nullable `flag_id` uuid column and an index on `(flag_id, id)`. The append-only trigger is untouched.
- Generate the migration with `pnpm db:generate`, and export the new row types.

### Excluded

- Services, routes, and shared API schemas.
- Any change to `users` or to existing `audit_records` columns.

### Paths

- `packages/db/src/schema/index.ts`
- `packages/db/migrations/`

## Plan

1. Add the tables to the schema, with comments citing their rules.
2. Generate the migration. Check that it only creates and alters as listed.
3. Apply it to a fresh database and to a database left by TASK-026.

## Acceptance criteria

- [ ] S1: every registration field is a column, with the defaults of S1, Q1, Q3, Q5, and Q13.
- [ ] S8: `github_repo_id` is recorded and unique among registrations that have not been removed.
- [ ] L1: at most one lead developer per project, by construction.
- [ ] I1: several e-mails, logins, and aliases per member are possible. The CONTRACT-002 e-mail is not duplicated into `user_identities`.
- [ ] N2: no table holds task state. Snapshots, sources, and commit logins are caches, marked as rebuildable in comments.
- [ ] FG1: a flag row holds its rule, subject, project, first raised time, evidence, and status.
- [ ] FG2: a second open row for the same rule and subject is refused by the database.
- [ ] FG7: audit records can reference a flag. The trigger still refuses UPDATE, DELETE, and TRUNCATE.
- [ ] `pnpm db:generate` run again produces nothing. `pnpm db:migrate` succeeds on a fresh database and on a post-TASK-026 database.

## Validation requirements

- `pnpm typecheck`, `pnpm test` (the server's global setup applies all migrations), and `pnpm build`.
- `pnpm db:migrate` against a scratch `MOONBEAM_HOME`. Record the result.

## Risks and assumptions

- The status enum includes `token_missing` and `token_config_unreadable`, which
  CONTRACT-006 doesn't list (TASK-023 question 8).
- `removed_at` assumes soft removal (TASK-023 question 4).

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.
