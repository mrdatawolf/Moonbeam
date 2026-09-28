// Read models for the API (CONTRACT-005 "Interfaces": every task view exposes
// state and conditions, claimant and lease, parent and subtasks, envelope,
// queue position and path dependencies in both directions, reviews with the
// same-model flag, and the full audit history).
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import type {
  ActorRef,
  AuditRecordView,
  BlockerView,
  ClaimView,
  DecisionQueue,
  PathDependency,
  ReviewView,
  RecentAuditRecord,
  TaskDetail,
  TaskSummary,
} from "@moonbeam/shared";
import { dependenciesOf, dependents, projectQueue } from "./lifecycle/dependencies.js";
import type { Actor } from "./identity/actor.js";
import { allowedActions, blockerAvailability } from "./lifecycle/availability.js";
import { pathsOverlap } from "./lifecycle/paths.js";

type TaskRow = typeof schema.tasks.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type RunRow = typeof schema.agentRuns.$inferSelect;
type ClaimRow = typeof schema.claims.$inferSelect;
type AuditRow = typeof schema.auditRecords.$inferSelect;

const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

/** Everything needed to render tasks of one or more projects. */
export class ViewData {
  private constructor(
    readonly tasks: TaskRow[],
    readonly claims: Map<string, ClaimRow>,
    readonly openBlockerTasks: Set<string>,
    readonly pausedTasks: Set<string>,
    readonly users: Map<string, UserRow>,
    readonly runs: Map<string, RunRow>,
    readonly blockers: (typeof schema.blockers.$inferSelect)[],
    readonly handoffs: (typeof schema.handoffs.$inferSelect)[],
    readonly actor: Actor | null,
  ) {}

  static async load(db: Database, projectIds: string[] | "all", actor: Actor | null = null): Promise<ViewData> {
    const scope = projectIds === "all" ? undefined : inArray(schema.tasks.projectId, projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]);
    const tasks = await db.select().from(schema.tasks).where(scope).orderBy(asc(schema.tasks.number));
    const claims = await db
      .select({ claim: schema.claims })
      .from(schema.claims)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.claims.taskId))
      .where(and(isNull(schema.claims.endedAt), scope));
    const blockers = await db
      .select({ blocker: schema.blockers })
      .from(schema.blockers)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.blockers.taskId))
      .where(and(isNull(schema.blockers.resolvedAt), scope));
    const pauses = await db
      .select({ taskId: schema.pauses.taskId })
      .from(schema.pauses)
      .innerJoin(schema.agentRuns, eq(schema.agentRuns.id, schema.pauses.runId))
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.pauses.taskId))
      .where(and(isNull(schema.pauses.closedAt), eq(schema.agentRuns.status, "active"), scope));
    const handoffs = await db.select({ handoff: schema.handoffs }).from(schema.handoffs)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.handoffs.taskId)).where(scope);
    const users = await db.select().from(schema.users);
    const runs = await db.select().from(schema.agentRuns);
    return new ViewData(
      tasks,
      new Map(claims.map((c) => [c.claim.taskId, c.claim])),
      new Set(blockers.map((b) => b.blocker.taskId)),
      new Set(pauses.map((p) => p.taskId)),
      new Map(users.map((u) => [u.id, u])),
      new Map(runs.map((r) => [r.id, r])),
      blockers.map((b) => b.blocker),
      handoffs.map((h) => h.handoff),
      actor,
    );
  }

  task(id: string) {
    return this.tasks.find((t) => t.id === id);
  }

  projectTasks(projectId: string) {
    return this.tasks.filter((t) => t.projectId === projectId);
  }

  userRef(userId: string | null): Pick<ActorRef, "userId" | "displayName" | "userActive"> {
    const u = userId ? this.users.get(userId) : undefined;
    // Board B1: records show the user's current display name.
    return { userId, displayName: u?.displayName ?? null, userActive: u ? u.active : null };
  }

  claimView(c: ClaimRow): ClaimView {
    const run = c.runId ? this.runs.get(c.runId) : undefined;
    return {
      id: c.id,
      claimantKind: c.claimantKind,
      ...this.userRef(c.userId),
      runId: c.runId,
      model: run?.model ?? null,
      startedAt: iso(c.startedAt),
      leaseDeadline: isoOrNull(c.leaseExpiresAt),
      leaseSuspended: c.leaseSuspendedRemainingMs !== null,
      lastRenewedAt: isoOrNull(c.lastRenewedAt),
    };
  }

  summary(t: TaskRow): TaskSummary {
    const claim = this.claims.get(t.id);
    const terminal = t.state === "completed" || t.state === "cancelled";
    return {
      id: t.id,
      projectId: t.projectId,
      number: t.number,
      parentId: t.parentId,
      title: t.title,
      state: t.state,
      blocked: this.openBlockerTasks.has(t.id),
      effectivelyBlocked: !terminal && t.parentId !== null && this.openBlockerTasks.has(t.parentId),
      paused: this.pausedTasks.has(t.id),
      queuePosition: t.queuePosition,
      siblingPosition: t.siblingPosition,
      claim: claim ? this.claimView(claim) : null,
      paths: t.envelope.paths,
      isSplitParent: this.tasks.some((s) => s.parentId === t.id),
      fellBack: t.fellBackAt !== null && t.state === "approved",
      workOnMain: t.workOnMain,
      updatedAt: iso(t.updatedAt),
      allowedActions: allowedActions(t, this.actor, this),
    };
  }

  actorRef(row: {
    kind: ActorRef["kind"];
    userId?: string | null;
    identityMode?: string | null;
    runId?: string | null;
    role?: string | null;
    model?: string | null;
    systemTrigger?: string | null;
  }): ActorRef {
    const run = row.runId ? this.runs.get(row.runId) : undefined;
    return {
      kind: row.kind,
      ...this.userRef(row.userId ?? null),
      identityMode: row.identityMode ?? null,
      runId: row.runId ?? null,
      role: row.role ?? run?.role ?? null,
      model: row.model ?? run?.model ?? null,
      systemTrigger: row.systemTrigger ?? null,
    };
  }

  audit(r: AuditRow): AuditRecordView {
    return {
      id: r.id,
      projectId: r.projectId,
      taskId: r.taskId,
      parentTaskId: r.parentTaskId,
      subjectUserId: r.subjectUserId,
      action: r.action,
      fromState: r.fromState,
      toState: r.toState,
      rejected: r.rejected,
      actor: this.actorRef({
        kind: r.actorKind,
        userId: r.actorUserId,
        identityMode: r.identityMode,
        runId: r.actorRunId,
        role: r.actorRole,
        model: r.actorModel,
        systemTrigger: r.systemTrigger,
      }),
      reason: r.reason,
      details: r.details,
      occurredAt: iso(r.occurredAt),
      recordedAt: iso(r.recordedAt),
    };
  }

  dependencyViews(t: TaskRow): { dependsOn: PathDependency[]; dependedOnBy: PathDependency[] } {
    const all = this.projectTasks(t.projectId);
    return {
      dependsOn: dependenciesOf(t, all).map((d) => ({
        kind: d.kind,
        taskId: d.task.id,
        number: d.task.number,
        title: d.task.title,
        state: d.task.state,
        finished: d.finished,
      })),
      dependedOnBy: dependents(t, all).map((d) => ({
        kind: d.kind,
        taskId: d.task.id,
        number: d.task.number,
        title: d.task.title,
        state: d.task.state,
        finished: dependenciesOf(d.task, all).find((x) => x.task.id === t.id)?.finished ?? false,
      })),
    };
  }
}

function reviewView(r: typeof schema.reviews.$inferSelect): ReviewView {
  return {
    id: r.id,
    handoffId: r.handoffId,
    reviewerRunId: r.reviewerRunId,
    reviewerModel: r.reviewerModel,
    verdict: r.verdict,
    findings: r.findings,
    sameModel: r.sameModel,
    createdAt: iso(r.createdAt),
  };
}

export async function taskDetail(db: Database, taskId: string, actor: Actor | null = null): Promise<TaskDetail | null> {
  const [head] = await db.select({ projectId: schema.tasks.projectId }).from(schema.tasks).where(eq(schema.tasks.id, taskId));
  if (!head) return null;
  const data = await ViewData.load(db, [head.projectId], actor);
  const t = data.task(taskId)!;
  const [blockers, pauses, handoffs, reviews, audit] = await Promise.all([
    db.select().from(schema.blockers).where(eq(schema.blockers.taskId, taskId)).orderBy(asc(schema.blockers.addedAt)),
    db.select().from(schema.pauses).where(eq(schema.pauses.taskId, taskId)).orderBy(asc(schema.pauses.openedAt)),
    db.select().from(schema.handoffs).where(eq(schema.handoffs.taskId, taskId)).orderBy(asc(schema.handoffs.createdAt)),
    db.select().from(schema.reviews).where(eq(schema.reviews.taskId, taskId)).orderBy(asc(schema.reviews.createdAt)),
    db.select().from(schema.auditRecords).where(eq(schema.auditRecords.taskId, taskId)).orderBy(asc(schema.auditRecords.id)),
  ]);
  const parent = t.parentId ? data.task(t.parentId) : undefined;
  const subtasks = data.tasks
    .filter((s) => s.parentId === t.id)
    .sort((a, b) => (a.siblingPosition ?? 0) - (b.siblingPosition ?? 0));
  const blockerView = (b: (typeof blockers)[number]): BlockerView => ({
    id: b.id,
    kind: b.kind,
    whatIsNeeded: b.whatIsNeeded,
    whoCanResolve: b.whoCanResolve,
    effect: b.effect,
    details: b.details ?? null,
    addedBy: data.actorRef({
      kind: b.addedByKind,
      userId: b.addedByUserId,
      identityMode: b.addedByKind === "human" ? "selected" : null,
      runId: b.addedByRunId,
      systemTrigger: b.addedByKind === "system" ? "subtask_integration_failed" : null,
    }),
    addedAt: iso(b.addedAt),
    resolvedAt: isoOrNull(b.resolvedAt),
    resolution: b.resolution,
  });
  const humanRef = (userId: string | null) =>
    userId ? data.actorRef({ kind: "human", userId, identityMode: "selected" }) : null;
  return {
    ...data.summary(t),
    desiredOutcome: t.desiredOutcome,
    acceptanceCriteria: t.acceptanceCriteria,
    envelope: t.envelope,
    author: data.actorRef({
      kind: t.authorKind,
      userId: t.authorUserId,
      identityMode: t.authorKind === "human" ? "selected" : null,
      runId: t.authorRunId,
    }),
    originTaskId: t.originTaskId,
    approvedAt: isoOrNull(t.approvedAt),
    approvedBy: t.parentId
      ? t.approvedAt
        ? data.actorRef({ kind: "system", systemTrigger: "auto_approved" })
        : null
      : humanRef(t.approvedByUserId),
    enteredReviewBy: t.enteredReviewBy,
    returnNotes: t.returnNotes,
    acceptedAt: isoOrNull(t.acceptedAt),
    acceptedBy: humanRef(t.acceptedByUserId),
    acceptedCommit: t.acceptedCommit,
    reviewWaiverReason: t.reviewWaiverReason,
    parent: parent ? data.summary(parent) : null,
    subtasks: subtasks.map((s) => data.summary(s)),
    blockers: blockers.map(blockerView),
    blockerActions: Object.fromEntries(blockers.map((b) => [b.id, blockerAvailability(t, b, actor, data)])),
    pauses: pauses.map((p) => ({
      id: p.id,
      runId: p.runId,
      question: p.question,
      openedAt: iso(p.openedAt),
      closedAt: isoOrNull(p.closedAt),
      closeReason: p.closeReason,
    })),
    handoffs: handoffs.map((h) => ({
      id: h.id,
      claimantKind: h.claimantKind,
      userId: h.userId,
      runId: h.runId,
      model: h.model,
      record: h.record,
      commit: h.commit,
      createdAt: iso(h.createdAt),
    })),
    reviews: reviews.map(reviewView),
    ...data.dependencyViews(t),
    audit: audit.map((a) => data.audit(a)),
    createdAt: iso(t.createdAt),
  };
}

export async function auditRecords(db: Database, ids: number[]): Promise<AuditRecordView[]> {
  if (!ids.length) return [];
  const rows = await db.select().from(schema.auditRecords).where(inArray(schema.auditRecords.id, ids)).orderBy(asc(schema.auditRecords.id));
  const data = await ViewData.load(db, []);
  return rows.map((r) => data.audit(r));
}

export async function listTasks(db: Database, projectId: string, states: string[] | null, actor: Actor | null = null): Promise<TaskSummary[]> {
  const data = await ViewData.load(db, [projectId], actor);
  return data.tasks.filter((t) => !states || states.includes(t.state)).map((t) => data.summary(t));
}

export async function projectQueueView(db: Database, projectId: string, actor: Actor | null = null) {
  const data = await ViewData.load(db, [projectId], actor);
  const queue = projectQueue(data.tasks);
  return queue.map((t) => ({
    task: data.summary(t),
    overlapsWith: queue.filter((o) => o.id !== t.id && pathsOverlap(o.envelope.paths, t.envelope.paths)).map((o) => o.id),
  }));
}

/**
 * The decision queue groups of CONTRACT-005 "UX expectations" that exist in
 * phase 2. "Accepted, not merged" lists completed top-level tasks (none is on
 * main yet); ordering refused merges first needs merge requests (phase 3).
 */
export async function decisionQueue(db: Database, projectIds: string[] | "all", actor: Actor | null = null): Promise<DecisionQueue> {
  const data = await ViewData.load(db, projectIds, actor);
  const open = (t: TaskRow) => t.state !== "completed" && t.state !== "cancelled";
  const reviews = data.tasks.length
    ? await db
        .select()
        .from(schema.reviews)
        .where(inArray(schema.reviews.taskId, data.tasks.map((t) => t.id)))
        .orderBy(desc(schema.reviews.createdAt))
    : [];
  const latestReview = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) if (!latestReview.has(r.taskId)) latestReview.set(r.taskId, r);

  const violations = await db
    .select()
    .from(schema.auditRecords)
    .where(
      and(
        eq(schema.auditRecords.rejected, true),
        projectIds === "all" ? undefined : inArray(schema.auditRecords.projectId, projectIds.length ? projectIds : ["00000000-0000-0000-0000-000000000000"]),
      ),
    )
    .orderBy(desc(schema.auditRecords.id))
    .limit(100);

  return {
    proposed: data.tasks.filter((t) => t.state === "proposed").map((t) => data.summary(t)),
    inReview: data.tasks.filter((t) => t.state === "in_review" && t.parentId === null).map((t) => data.summary(t)),
    subtaskFindings: data.tasks
      .filter((t) => {
        if (t.parentId === null) return false;
        const parent = data.task(t.parentId);
        const r = latestReview.get(t.id);
        return parent !== undefined && open(parent) && r !== undefined && r.findings.length > 0;
      })
      .map((t) => ({ task: data.summary(t), review: reviewView(latestReview.get(t.id)!) })),
    blocked: data.tasks.filter((t) => open(t) && data.openBlockerTasks.has(t.id)).map((t) => data.summary(t)),
    fellBack: data.tasks.filter((t) => t.state === "approved" && t.fellBackAt !== null).map((t) => data.summary(t)),
    authorityViolations: violations.map((v) => data.audit(v)),
    acceptedNotMerged: data.tasks
      .filter((t) => t.state === "completed" && t.parentId === null && !t.workOnMain)
      .sort((a, b) => (a.acceptedAt?.getTime() ?? 0) - (b.acceptedAt?.getTime() ?? 0))
      .map((t) => data.summary(t)),
  };
}

/** One bounded indexed read; do not load ViewData or entire user/run registries. */
export async function recentAudit(db: Database, limit: number, actor: Actor | null): Promise<RecentAuditRecord[]> {
  const a = schema.auditRecords;
  const rows = await db.select({
    audit: a,
    task: { number: schema.tasks.number, title: schema.tasks.title },
    project: { id: schema.projects.id, name: schema.projects.name },
    displayName: schema.users.displayName,
    userActive: schema.users.active,
    runRole: schema.agentRuns.role,
    runModel: schema.agentRuns.model,
  }).from(a)
    .innerJoin(schema.tasks, and(eq(schema.tasks.id, a.taskId), eq(schema.tasks.projectId, a.projectId)))
    .innerJoin(schema.projects, eq(schema.projects.id, a.projectId))
    .leftJoin(schema.users, eq(schema.users.id, a.actorUserId))
    .leftJoin(schema.agentRuns, eq(schema.agentRuns.id, a.actorRunId))
    .where(and(isNotNull(a.taskId), actor?.kind === "agent" ? eq(a.projectId, actor.projectId) : undefined))
    // Match drizzle-kit's DESC NULLS LAST indexes (both ordering columns are non-null).
    .orderBy(sql`${a.occurredAt} desc nulls last`, sql`${a.id} desc nulls last`)
    .limit(limit);
  return rows.map(({ audit: r, task, project, displayName, userActive, runRole, runModel }) => ({
    id: r.id, projectId: project.id, taskId: r.taskId!, parentTaskId: r.parentTaskId,
    subjectUserId: r.subjectUserId, action: r.action, fromState: r.fromState, toState: r.toState,
    rejected: r.rejected, reason: r.reason, details: r.details,
    occurredAt: iso(r.occurredAt), recordedAt: iso(r.recordedAt),
    actor: {
      kind: r.actorKind, userId: r.actorUserId, displayName, userActive,
      identityMode: r.identityMode, runId: r.actorRunId,
      role: r.actorRole ?? runRole, model: r.actorModel ?? runModel, systemTrigger: r.systemTrigger,
    },
    task, project,
  }));
}
