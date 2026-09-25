// Per-action transaction context: every lifecycle action runs inside one
// database transaction that first locks its project row (`SELECT ... FOR
// UPDATE`). All mutations of a project's tasks, claims, blockers and queue are
// therefore serialised, which makes each action atomic and the outcome of
// concurrent actions equal to some sequential order (CONTRACT-001
// "Concurrency rules"). The partial unique indexes on `claims` back this up at
// the database level (I4, I5).
import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { schema, type Transaction } from "@moonbeam/db";
import { writeAudit, type AuditEntry } from "../audit.js";
import type { AnyActor } from "../identity/actor.js";

export type TaskRow = typeof schema.tasks.$inferSelect;
export type ClaimRow = typeof schema.claims.$inferSelect;
export type ProjectRow = typeof schema.projects.$inferSelect;
export type BlockerRow = typeof schema.blockers.$inferSelect;

export const isTerminal = (t: Pick<TaskRow, "state">) => t.state === "completed" || t.state === "cancelled";

export class ActionContext {
  readonly auditIds: number[] = [];

  constructor(
    readonly tx: Transaction,
    readonly now: Date,
    readonly project: ProjectRow,
  ) {}

  async audit(actor: AnyActor, entry: AuditEntry): Promise<number> {
    const id = await writeAudit(this.tx, actor, { projectId: this.project.id, ...entry }, this.now);
    this.auditIds.push(id);
    return id;
  }

  async tasks(): Promise<TaskRow[]> {
    return this.tx.select().from(schema.tasks).where(eq(schema.tasks.projectId, this.project.id));
  }

  async task(id: string): Promise<TaskRow | undefined> {
    const [row] = await this.tx
      .select()
      .from(schema.tasks)
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.projectId, this.project.id)));
    return row;
  }

  async mustTask(id: string): Promise<TaskRow> {
    const t = await this.task(id);
    if (!t) throw new Error(`task ${id} vanished inside a locked transaction`);
    return t;
  }

  async subtasks(parentId: string): Promise<TaskRow[]> {
    return this.tx
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.parentId, parentId))
      .orderBy(asc(schema.tasks.siblingPosition));
  }

  async updateTask(id: string, patch: Partial<typeof schema.tasks.$inferInsert>): Promise<TaskRow> {
    const [row] = await this.tx
      .update(schema.tasks)
      .set({ ...patch, updatedAt: this.now })
      .where(eq(schema.tasks.id, id))
      .returning();
    return row!;
  }

  async activeClaim(taskId: string): Promise<ClaimRow | undefined> {
    const [row] = await this.tx
      .select()
      .from(schema.claims)
      .where(and(eq(schema.claims.taskId, taskId), isNull(schema.claims.endedAt)));
    return row;
  }

  async openBlockers(taskId: string): Promise<BlockerRow[]> {
    return this.tx
      .select()
      .from(schema.blockers)
      .where(and(eq(schema.blockers.taskId, taskId), isNull(schema.blockers.resolvedAt)))
      .orderBy(asc(schema.blockers.addedAt));
  }

  async isBlocked(task: TaskRow): Promise<boolean> {
    return (await this.openBlockers(task.id)).length > 0;
  }

  /** C1: the non-done subtasks of a blocked parent are effectively blocked. */
  async isEffectivelyBlocked(task: TaskRow): Promise<boolean> {
    if (task.parentId === null || isTerminal(task)) return false;
    return (await this.openBlockers(task.parentId)).length > 0;
  }

  /** Blocked or effectively blocked, with the blockers that cause it. */
  async blockingBlockers(task: TaskRow): Promise<BlockerRow[]> {
    const own = await this.openBlockers(task.id);
    const inherited = task.parentId && !isTerminal(task) ? await this.openBlockers(task.parentId) : [];
    return [...own, ...inherited];
  }

  /** C2: a task is paused while an active run on it has an open pause. */
  async openPauses(taskId: string) {
    return this.tx
      .select({ pause: schema.pauses })
      .from(schema.pauses)
      .innerJoin(schema.agentRuns, eq(schema.agentRuns.id, schema.pauses.runId))
      .where(
        and(eq(schema.pauses.taskId, taskId), isNull(schema.pauses.closedAt), eq(schema.agentRuns.status, "active")),
      )
      .then((rows) => rows.map((r) => r.pause));
  }

  async nextTaskNumber(): Promise<number> {
    const [row] = await this.tx
      .select({ n: max(schema.tasks.number) })
      .from(schema.tasks)
      .where(eq(schema.tasks.projectId, this.project.id));
    return (row?.n ?? 0) + 1;
  }

  async latestApprovalAuditId(taskId: string): Promise<number | null> {
    const [row] = await this.tx
      .select({ id: schema.auditRecords.id })
      .from(schema.auditRecords)
      .where(
        and(
          eq(schema.auditRecords.taskId, taskId),
          inArray(schema.auditRecords.action, ["approved", "auto_approved"]),
          eq(schema.auditRecords.rejected, false),
        ),
      )
      .orderBy(desc(schema.auditRecords.id))
      .limit(1);
    return row?.id ?? null;
  }
}
