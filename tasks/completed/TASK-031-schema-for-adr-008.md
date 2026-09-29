# TASK-031: Database schema for GitHub projects, identities, snapshots, and flags

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
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

Implemented TASK-031; ready for dispatcher review. No git write commands or lifecycle moves were performed.

Files changed:
- `packages/db/src/schema/index.ts`: six tables, four enums, audit flag reference/index, and select/insert row types.
- `packages/db/src/index.ts`: added only type export lines.
- `packages/db/migrations/0004_equal_sunfire.sql`.
- `packages/db/migrations/meta/0004_snapshot.json`.
- `packages/db/migrations/meta/_journal.json`.
- `tasks/in-progress/TASK-031-schema-for-adr-008.md`: only this handoff.

Migration `0004_equal_sunfire`, generated by `pnpm db:generate`:
- Creates tables `projects`, `user_identities`, `project_sources`, `project_snapshots`, `commit_logins`, and `flags`, with all assigned columns.
- Creates enums `identity_kind` (email/login/alias), `source_status` (all ten assigned statuses), `flag_kind` (event/condition), and `flag_status` (open/dismissed/resolved/withdrawn).
- Adds nullable `audit_records.flag_id`; no existing column, row, enum, or trigger is changed.
- Creates primary keys/indexes `projects_pkey`, `user_identities_pkey`, `project_sources_pkey`, `project_snapshots_pkey`, `flags_pkey`, and composite `commit_logins_project_id_sha_pk`.
- Creates unique indexes `projects_active_github_repo_id_uq` (repository ID where removed_at is null), `user_identities_user_kind_normalized_uq` (user/kind/normalized), and `flags_open_subject_uq` (project/rule/subject_key where status is open).
- Creates indexes `flags_project_status_idx` (project_id/status) and `audit_flag_idx` (flag_id/id).
- Creates checks `projects_stale_threshold_positive` (> 0) and `flags_rule_valid` (FL-1 through FL-11).
- Creates foreign keys `projects_lead_developer_user_id_users_id_fk`, `projects_registered_by_user_id_users_id_fk`, `user_identities_user_id_users_id_fk`, `user_identities_created_by_user_id_users_id_fk`, `project_sources_project_id_projects_id_fk`, `project_snapshots_project_id_projects_id_fk`, `commit_logins_project_id_projects_id_fk`, and `flags_project_id_projects_id_fk`; all use NO ACTION for update/delete.
- Required fields are NOT NULL; optional fields are nullable. UUID entity IDs default to gen_random_uuid(); branch/exempt paths/threshold default to main/[]/14; source status/failures/reset default to never_polled/0/false; flag status defaults to open. Snapshot metadata was generated, never hand-edited.

Validation:
- Used Node/pnpm from `/home/patrick/.nvm/versions/node/v24.16.0/bin`.
- `pnpm db:generate`: generated 0004; second run succeeded with “No schema changes, nothing to migrate”.
- `pnpm typecheck`: all five packages passed.
- `pnpm test`: 172 tests passed across 21 files: db 6, dbc 129, shared 4, server database/API 12, UI 21; no skipped suite.
- `pnpm build`: all five packages passed.
- `packages/db/node_modules/.bin/tsx /tmp/task031-upgrade.mts`: 25 checks passed. The temporary harness ran actual `pnpm db:migrate` successfully on a fresh database and on a seeded post-0003 database, using `MOONBEAM_HOME=/tmp/task031-pg-TSoIDL`, `MOONBEAM_EMBEDDED_PG_PORT=38839`, and no DATABASE_URL. It verified both seeded users and both historical audit rows unchanged, all six tables and eleven new indexes present, unchanged audit trigger definitions, UPDATE/DELETE/TRUNCATE refusal, defaults, bigint precision, foreign-key/check enforcement, identity uniqueness, flag uniqueness/reopening, audit flag references, and cache persistence. An initial harness assertion failed because Drizzle changed timestamp decoding; comparison was corrected to PostgreSQL timestamp text, preserving microsecond precision, and the full harness passed.
- `git diff --check`: passed. Scratch database connections and Postgres processes were stopped; no server was launched or process left running. `~/.moonbeam` was not used.

Acceptance evidence:
- S1/Q1/Q3/Q5/Q13: every registration field exists; static defaults are main, [], and 14. Baseline SHA/time and token label are required inputs; registration supplies GitHub head and the owner-based token label.
- S8: bigint repository IDs are retained without JavaScript number rounding; the partial unique index rejects duplicate active registrations and permits re-registration after soft removal.
- L1: one nullable user foreign key permits at most one lead developer per project.
- I1: multiple e-mails, logins, and aliases are supported; per-user duplicates are rejected while cross-user duplicates remain allowed. No users.email values are copied.
- N2: no authoritative task-state table is introduced; sources, snapshots, and commit logins are explicitly documented as rebuildable caches.
- FG1: flags persist project, rule, subject/key, kind, first-raised/status-change times, evidence, status, and optional commit/task references.
- FG2: duplicate open flags and conflicting reopens fail with PostgreSQL unique violations; closed history can coexist with a new open occurrence.
- FG7: nullable flag_id and its index support audit references. Existing audit history and both append-only triggers survive; UPDATE, DELETE, and TRUNCATE still fail.
- Migration repeatability: second generation is empty; fresh and post-0003 CLI migrations both succeed.

Assumptions and deviations:
- No scope deviation. Services, routes, shared API schemas, existing migrations, and unrelated files were not changed.
- Identity normalization is supplied by the future identity service; the schema stores and uniquely indexes its lowercased/trimmed value. JSON shapes use Drizzle types rather than additional database shape checks.
- GitHub-dependent baseline and owner-based token defaults belong to registration service logic, since SQL defaults cannot fetch GitHub or reference another column.
- Audit flag references deliberately have no foreign key, preserving the existing independent, append-only audit design.
- New registration/identity creator references are required user foreign keys. Poll timestamps are explicit inputs; last-attempt/success fields are nullable before polling.
- Validation harness and logs remain under /tmp, outside the repository change set. No unresolved implementation blocker; independent review and board acceptance remain pending.

**Dispatcher check:**

- `packages/db/src/index.ts` gained only a `export type { ... }` block.
- Migration 0004 contains no DROP and no trigger statements. On
  `audit_records` it only adds `flag_id` and its index.
- Re-ran server tests (12 passed). No scratch Postgres left running.

## Review

Not reviewed.
