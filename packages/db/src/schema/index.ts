// Drizzle table definitions for Moonbeam's lifecycle data (TASK-006).
//
// The database is the single authority for workflow state (ADR-001). The
// behavior these tables serve is specified by CONTRACT-001 (task lifecycle)
// and CONTRACT-002 (identity). Transitions are applied by the server; the
// tables only hold state, and `audit_records` is append-only (enforced by a
// trigger in the migrations).
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const taskState = pgEnum("task_state", [
  "proposed",
  "approved",
  "in_progress",
  "in_review",
  "completed",
  "cancelled",
]);
export const actorKind = pgEnum("actor_kind", ["human", "agent", "system", "setup"]);
export const claimantKind = pgEnum("claimant_kind", ["human", "agent"]);
export const runStatus = pgEnum("run_status", ["active", "finished", "failed", "stopped"]);
export const reviewEntry = pgEnum("review_entry", ["handoff", "subtasks"]);
export const reviewVerdict = pgEnum("review_verdict", ["pass", "changes_required", "human_decision_required"]);
export const blockerKind = pgEnum("blocker_kind", ["manual", "integration"]);
export const blockerResolution = pgEnum("blocker_resolution", ["resolved", "moot"]);
export const pauseCloseReason = pgEnum("pause_close_reason", ["answered", "superseded", "cancelled"]);

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

/** Single-row settings table (id = 1). Holds the projects root (ADR-006). */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey(),
  projectsRoot: text("projects_root"),
  updatedAt: ts("updated_at").notNull(),
});

/** A registered git repository under the projects root (CONTRACT-004 B13). */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull().unique(),
  mainBranch: text("main_branch").notNull().default("main"),
  registeredAt: ts("registered_at").notNull(),
  registeredByUserId: uuid("registered_by_user_id").references(() => users.id),
});

/**
 * An agent run. Runs arrive with a later task; for now they exist so that a
 * run credential has something to be bound to (CONTRACT-002).
 */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    taskId: uuid("task_id")
      .notNull()
      .references((): AnyPgColumn => tasks.id),
    role: text("role").notNull(),
    /** Model identifier; "same model" compares this (CONTRACT-001 T7, Board C6). */
    model: text("model").notNull(),
    quantization: text("quantization"),
    status: runStatus("status").notNull().default("active"),
    startedByUserId: uuid("started_by_user_id")
      .notNull()
      .references(() => users.id),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
  },
  (t) => [index("agent_runs_task_idx").on(t.taskId)],
);

/** One credential per run (ID4). Only a hash of the value is stored (ID9). */
export const runCredentials = pgTable("run_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .unique()
    .references(() => agentRuns.id),
  tokenHash: text("token_hash").notNull().unique(),
  issuedAt: ts("issued_at").notNull(),
  expiresAt: ts("expires_at"),
  revokedAt: ts("revoked_at"),
});

export interface InclusionRecord {
  key: string;
  text: string;
  /** For a subtask, the key of the parent inclusion this one narrows. */
  derivedFrom: string | null;
}

export interface ScopeEnvelopeRecord {
  inclusions: InclusionRecord[];
  exclusions: string[];
  constraints: string[];
  contracts: string[];
  paths: string[];
}

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    /** Per-project display number. */
    number: integer("number").notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id),
    title: text("title").notNull(),
    desiredOutcome: text("desired_outcome").notNull(),
    acceptanceCriteria: jsonb("acceptance_criteria").$type<string[]>().notNull(),
    envelope: jsonb("envelope").$type<ScopeEnvelopeRecord>().notNull(),
    state: taskState("state").notNull(),
    authorKind: claimantKind("author_kind").notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id),
    authorRunId: uuid("author_run_id").references((): AnyPgColumn => agentRuns.id),
    /** The task the proposing run was bound to, for agent-created tasks. */
    originTaskId: uuid("origin_task_id").references((): AnyPgColumn => tasks.id),
    /** Position in the project queue (top-level tasks only; null when not queued). */
    queuePosition: integer("queue_position"),
    /** Position among siblings (subtasks only). */
    siblingPosition: integer("sibling_position"),
    approvedAt: ts("approved_at"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    enteredReviewBy: reviewEntry("entered_review_by"),
    latestHandoffId: uuid("latest_handoff_id"),
    returnNotes: text("return_notes"),
    acceptedAt: ts("accepted_at"),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id),
    acceptedCommit: text("accepted_commit"),
    reviewWaiverReason: text("review_waiver_reason"),
    /**
     * Whether the accepted work is on main (CONTRACT-001 "On main"). Only the
     * phase-3 merge (M1) and hand-merge detection (M2) set it; nothing in
     * TASK-006 does.
     */
    workOnMain: boolean("work_on_main").notNull().default(false),
    /** Set by T14; cleared when the parent is claimed, split again, or cancelled. */
    fellBackAt: ts("fell_back_at"),
    everClaimed: boolean("ever_claimed").notNull().default(false),
    /** A review recorded while the subtask was blocked: T8 is deferred (C1). */
    pendingCompletionReviewId: uuid("pending_completion_review_id"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("tasks_project_number_uq").on(t.projectId, t.number),
    index("tasks_project_state_idx").on(t.projectId, t.state),
    index("tasks_parent_idx").on(t.parentId),
  ],
);

export const claims = pgTable(
  "claims",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    claimantKind: claimantKind("claimant_kind").notNull(),
    userId: uuid("user_id").references(() => users.id),
    runId: uuid("run_id").references(() => agentRuns.id),
    startedAt: ts("started_at").notNull(),
    /** Agent-run leases only; null for human claims and while suspended. */
    leaseExpiresAt: ts("lease_expires_at"),
    /** Remaining lease while suspended (blocked or paused); null otherwise. */
    leaseSuspendedRemainingMs: integer("lease_suspended_remaining_ms"),
    lastRenewedAt: ts("last_renewed_at"),
    endedAt: ts("ended_at"),
    endReason: text("end_reason"),
  },
  (t) => [
    // I4: at most one active claim per task.
    uniqueIndex("claims_one_active_per_task_uq").on(t.taskId).where(sql`${t.endedAt} is null`),
    // I5: an agent run holds at most one active claim.
    uniqueIndex("claims_one_active_per_run_uq")
      .on(t.runId)
      .where(sql`${t.endedAt} is null and ${t.runId} is not null`),
  ],
);

export interface HandoffRecordContent {
  changes: string;
  validation: string;
  deviations: string;
  risks: string;
}

export const handoffs = pgTable("handoffs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  claimId: uuid("claim_id")
    .notNull()
    .references(() => claims.id),
  claimantKind: claimantKind("claimant_kind").notNull(),
  userId: uuid("user_id").references(() => users.id),
  runId: uuid("run_id").references(() => agentRuns.id),
  model: text("model"),
  record: jsonb("record").$type<HandoffRecordContent>().notNull(),
  commit: text("commit"),
  createdAt: ts("created_at").notNull(),
});

export interface ReviewFinding {
  severity: string;
  text: string;
}

/** Reviews as data (T7). Reviewer is always an agent run. */
export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id),
  handoffId: uuid("handoff_id").references(() => handoffs.id),
  reviewerRunId: uuid("reviewer_run_id")
    .notNull()
    .references(() => agentRuns.id),
  reviewerModel: text("reviewer_model").notNull(),
  verdict: reviewVerdict("verdict").notNull(),
  findings: jsonb("findings").$type<ReviewFinding[]>().notNull(),
  sameModel: boolean("same_model").notNull(),
  createdAt: ts("created_at").notNull(),
});

/** C1 blockers. */
export const blockers = pgTable(
  "blockers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    kind: blockerKind("kind").notNull(),
    whatIsNeeded: text("what_is_needed").notNull(),
    whoCanResolve: text("who_can_resolve").notNull(),
    effect: text("effect").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    addedByKind: actorKind("added_by_kind").notNull(),
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
    addedByRunId: uuid("added_by_run_id").references(() => agentRuns.id),
    addedAt: ts("added_at").notNull(),
    resolvedAt: ts("resolved_at"),
    resolvedByKind: actorKind("resolved_by_kind"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolvedByRunId: uuid("resolved_by_run_id").references(() => agentRuns.id),
    resolution: blockerResolution("resolution"),
  },
  (t) => [index("blockers_task_idx").on(t.taskId)],
);

/**
 * C2 pauses, as data only. The pauses contract (phase 4) defines how they are
 * opened and answered; the lifecycle only reads them.
 */
export const pauses = pgTable(
  "pauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => agentRuns.id),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    question: text("question").notNull(),
    openedAt: ts("opened_at").notNull(),
    closedAt: ts("closed_at"),
    closeReason: pauseCloseReason("close_reason"),
  },
  (t) => [index("pauses_task_idx").on(t.taskId)],
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
    /** Effective time (for expiry, the lease deadline). */
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
