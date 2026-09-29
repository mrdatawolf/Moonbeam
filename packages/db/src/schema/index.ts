// Users and the append-only audit history. Historical actor kinds are retained.
import { sql } from "drizzle-orm";
import { bigserial, boolean, index, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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
    index("audit_task_idx").on(t.taskId, t.id),
    index("audit_project_idx").on(t.projectId, t.id),
    index("audit_recent_task_idx").on(t.occurredAt.desc(), t.id.desc()).where(sql`${t.taskId} is not null`),
    index("audit_project_recent_task_idx").on(t.projectId, t.occurredAt.desc(), t.id.desc()).where(sql`${t.taskId} is not null`),
    index("audit_rejected_idx").on(t.rejected, t.id),
  ],
);
