// Moonbeam-owned data and rebuildable caches (CONTRACT-006 N2).
import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
export const actorKind = pgEnum("actor_kind", ["human", "agent", "system", "setup"]);

/** CONTRACT-002 user registry. Users are never deleted (ID7). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [
    // Display names are unique among active users, ignoring case (names are
    // stored trimmed).
    uniqueIndex("users_active_display_name_uq")
      .on(sql`lower(${t.displayName})`)
      .where(sql`${t.active}`),
  ],
);

/**
 * Append-only audit trail (CONTRACT-001 "Audit record", CONTRACT-002 registry
 * changes). UPDATE and DELETE are refused by a trigger. `rejected` marks a
 * recorded authority-violation attempt.
 */
export const auditRecords = pgTable(
  "audit_records",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id"),
    taskId: uuid("task_id"),
    parentTaskId: uuid("parent_task_id"),
    subjectUserId: uuid("subject_user_id"),
    /** FG7: no foreign key, so audit history remains independent of live rows. */
    flagId: uuid("flag_id"),
    action: text("action").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    rejected: boolean("rejected").notNull().default(false),
    actorKind: actorKind("actor_kind").notNull(),
    actorUserId: uuid("actor_user_id"),
    identityMode: text("identity_mode"),
    actorRunId: uuid("actor_run_id"),
    actorRole: text("actor_role"),
    actorModel: text("actor_model"),
    systemTrigger: text("system_trigger"),
    reason: text("reason"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    /** Effective time of the recorded event. */
    occurredAt: ts("occurred_at").notNull(),
    recordedAt: ts("recorded_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_flag_idx").on(t.flagId, t.id),
    index("audit_task_idx").on(t.taskId, t.id),
    index("audit_project_idx").on(t.projectId, t.id),
    index("audit_recent_task_idx").on(t.occurredAt.desc(), t.id.desc()).where(sql`${t.taskId} is not null`),
    index("audit_project_recent_task_idx").on(t.projectId, t.occurredAt.desc(), t.id.desc()).where(sql`${t.taskId} is not null`),
    index("audit_rejected_idx").on(t.rejected, t.id),
  ],
);

/** CONTRACT-006 I1: extra identities only; users.email counts automatically. */
export const identityKind = pgEnum("identity_kind", ["email", "login", "alias"]);
/** CONTRACT-006 S6–S8, F1–F6; token configuration failures from ADR-010. */
export const sourceStatus = pgEnum("source_status", [
  "never_polled", "ok", "unreachable", "rate_limited", "token_rejected",
  "token_missing", "token_config_unreadable", "not_found", "identity_changed", "branch_missing",
]);
export const flagKind = pgEnum("flag_kind", ["event", "condition"]);
export const flagStatus = pgEnum("flag_status", ["open", "dismissed", "resolved", "withdrawn"]);

/** S1, S8, L1: registrations are owned data; removal is soft (TASK-023 gap 4). */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  githubOwner: text("github_owner").notNull(),
  githubRepo: text("github_repo").notNull(),
  githubRepoId: bigint("github_repo_id", { mode: "bigint" }).notNull(),
  trackedBranch: text("tracked_branch").notNull().default("main"),
  // ADR-010: registration supplies the owner label by default, never a secret.
  tokenLabel: text("token_label").notNull(),
  leadDeveloperUserId: uuid("lead_developer_user_id").references(() => users.id),
  // Q3: registration supplies the selected baseline (default GitHub head).
  baselineSha: text("baseline_sha").notNull(),
  baselineCommittedAt: ts("baseline_committed_at").notNull(),
  exemptPaths: jsonb("exempt_paths").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  staleThresholdDays: integer("stale_threshold_days").notNull().default(14),
  registeredAt: ts("registered_at").notNull(),
  registeredByUserId: uuid("registered_by_user_id").notNull().references(() => users.id),
  removedAt: ts("removed_at"),
}, (t) => [
  uniqueIndex("projects_active_github_repo_id_uq").on(t.githubRepoId).where(sql`${t.removedAt} is null`),
  check("projects_stale_threshold_positive", sql`${t.staleThresholdDays} > 0`),
]);

/** I1, I4: multiple identities per member; shared identities across members are allowed. */
export const userIdentities = pgTable("user_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  kind: identityKind("kind").notNull(),
  value: text("value").notNull(),
  // The identity service supplies the lowercased, trimmed matching value.
  normalized: text("normalized").notNull(),
  createdAt: ts("created_at").notNull(),
  createdByUserId: uuid("created_by_user_id").notNull().references(() => users.id),
}, (t) => [
  uniqueIndex("user_identities_user_kind_normalized_uq").on(t.userId, t.kind, t.normalized),
]);

/** N2: rebuildable poll-status cache, not task state (S6–S8, F1–F6). */
export const projectSources = pgTable("project_sources", {
  projectId: uuid("project_id").primaryKey().references(() => projects.id),
  status: sourceStatus("status").notNull().default("never_polled"),
  statusSince: ts("status_since").notNull(),
  lastAttemptAt: ts("last_attempt_at"),
  lastSuccessAt: ts("last_success_at"),
  lastProcessedHead: text("last_processed_head"),
  rateLimitedUntil: ts("rate_limited_until"),
  redirectedFullName: text("redirected_full_name"),
  tokenWriteScopes: boolean("token_write_scopes"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  baselineNeedsReset: boolean("baseline_needs_reset").notNull().default(false),
  repoEtag: text("repo_etag"),
});

/** N2, S6, S7: rebuildable, versioned snapshot; never authoritative task state. */
export const projectSnapshots = pgTable("project_snapshots", {
  projectId: uuid("project_id").primaryKey().references(() => projects.id),
  headSha: text("head_sha").notNull(),
  polledAt: ts("polled_at").notNull(),
  snapshotVersion: integer("snapshot_version").notNull(),
  snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
});

/** N2, I2, ADR-010: rebuildable GitHub login cache; null means no associated login. */
export const commitLogins = pgTable("commit_logins", {
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sha: text("sha").notNull(),
  login: text("login"),
}, (t) => [primaryKey({ columns: [t.projectId, t.sha] })]);

/** FG1–FG7: durable flag records; notes and every status change live in the audit trail. */
export const flags = pgTable("flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  rule: text("rule").notNull(),
  kind: flagKind("kind").notNull(),
  subjectKey: text("subject_key").notNull(),
  subject: jsonb("subject").$type<Record<string, unknown>>().notNull(),
  commitSha: text("commit_sha"),
  taskIdText: text("task_id_text"),
  status: flagStatus("status").notNull().default("open"),
  firstRaisedAt: ts("first_raised_at").notNull(),
  statusChangedAt: ts("status_changed_at").notNull(),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull(),
}, (t) => [
  check("flags_rule_valid", sql`${t.rule} in ('FL-1', 'FL-2', 'FL-3', 'FL-4', 'FL-5', 'FL-6', 'FL-7', 'FL-8', 'FL-9', 'FL-10', 'FL-11')`),
  uniqueIndex("flags_open_subject_uq").on(t.projectId, t.rule, t.subjectKey).where(sql`${t.status} = 'open'`),
  index("flags_project_status_idx").on(t.projectId, t.status),
]);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type UserIdentity = typeof userIdentities.$inferSelect;
export type NewUserIdentity = typeof userIdentities.$inferInsert;
export type ProjectSource = typeof projectSources.$inferSelect;
export type NewProjectSource = typeof projectSources.$inferInsert;
export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type NewProjectSnapshot = typeof projectSnapshots.$inferInsert;
export type CommitLogin = typeof commitLogins.$inferSelect;
export type NewCommitLogin = typeof commitLogins.$inferInsert;
export type Flag = typeof flags.$inferSelect;
export type NewFlag = typeof flags.$inferInsert;
