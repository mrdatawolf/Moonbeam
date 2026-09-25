// CONTRACT-001 lifecycle actions. Every public method follows the CONTRACT-002
// order: the caller has resolved the actor (step 1); `run` performs the
// permission check (step 2); the action body evaluates the lifecycle rules and
// then the repository step (step 3). Each action is one transaction.
import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import {
  acceptInputSchema,
  addBlockerInputSchema,
  addSubtasksInputSchema,
  cancelInputSchema,
  createTaskInputSchema,
  devEndRunInputSchema,
  devOpenPauseInputSchema,
  devStartRunInputSchema,
  handoffInputSchema,
  moveInputSchema,
  recordReviewInputSchema,
  releaseClaimInputSchema,
  returnInputSchema,
} from "@moonbeam/shared";
import type { z } from "zod";
import { writeAudit } from "../audit.js";
import { ActionError, AuthorityViolation, parseInput, reject } from "../errors.js";
import { systemActor, type Actor, type AnyActor } from "../identity/actor.js";
import { generateCredential, hashCredential } from "../identity/credentials.js";
import { checkPermission, HUMAN_ONLY_ACTIONS, type ActionName } from "../identity/permission.js";
import type { RepositoryPort, RepositoryTaskRef } from "../repository.js";
import { ActionContext, isTerminal, type ClaimRow, type TaskRow } from "./context.js";
import {
  dependenciesOf,
  projectQueue,
  siblingsOf,
  unfinishedDependencies,
  type Dependency,
} from "./dependencies.js";
import { buildSubtaskEnvelope, buildTopLevelEnvelope } from "./envelope.js";
import { checkPaths, filesOutsidePaths } from "./paths.js";

/** The approved default agent claim lease (CONTRACT-001 "Claim expiry"). */
export const DEFAULT_LEASE_MS = 30 * 60 * 1000;

export interface LifecycleOptions {
  db: Database;
  clock: () => Date;
  repository: RepositoryPort;
  leaseMs?: number;
}

export interface ActionOutcome {
  /** The task the response should show. */
  taskId: string;
  auditIds: number[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function claimantOf(c: ClaimRow) {
  return c.claimantKind === "human" ? { kind: "human", userId: c.userId } : { kind: "agent", runId: c.runId };
}

function isClaimant(actor: Actor, c: ClaimRow): boolean {
  return actor.kind === "human"
    ? c.claimantKind === "human" && c.userId === actor.userId
    : c.claimantKind === "agent" && c.runId === actor.runId;
}

function depRef(d: Dependency) {
  return { kind: d.kind, taskId: d.task.id, number: d.task.number, state: d.task.state, finished: d.finished };
}

/** Board C6: same model identifier (quantization is recorded separately and ignored). */
const sameModel = (a: string | null, b: string | null) =>
  a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

type SubtaskSpec = z.output<typeof addSubtasksInputSchema>["subtasks"][number];

export class LifecycleService {
  readonly db: Database;
  readonly clock: () => Date;
  readonly repository: RepositoryPort;
  readonly leaseMs: number;

  constructor(opts: LifecycleOptions) {
    this.db = opts.db;
    this.clock = opts.clock;
    this.repository = opts.repository;
    this.leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS;
  }

  // -------------------------------------------------------------------------
  // Action runner: permission check, project lock, due expiries, audit of
  // authority violations.
  // -------------------------------------------------------------------------

  /** Record a rejected authority-violation attempt (always audited). */
  async recordViolation(actor: Actor, err: AuthorityViolation): Promise<void> {
    const now = this.clock();
    let { projectId, taskId } = err.target;
    if (taskId && !projectId) {
      const [t] = UUID.test(taskId)
        ? await this.db.select({ projectId: schema.tasks.projectId }).from(schema.tasks).where(eq(schema.tasks.id, taskId))
        : [];
      if (t) projectId = t.projectId;
      else taskId = null; // the requested target does not exist; it is named in details
    }
    await writeAudit(
      this.db,
      actor,
      {
        projectId: projectId ?? null,
        taskId: taskId ?? null,
        subjectUserId: err.target.subjectUserId ?? null,
        action: err.action,
        rejected: true,
        reason: err.message,
        details: { requestedTarget: err.target.requested ?? { taskId: err.target.taskId ?? null } },
      },
      now,
    );
  }

  /** Throw the permission decision as an error (auditing authority violations via the caller). */
  deny(actor: Actor, action: ActionName, target: AuthorityViolation["target"], extra?: Parameters<typeof checkPermission>[2]): void {
    const decision = checkPermission(actor, action, extra);
    if (decision.allow) return;
    if (decision.category === "authority_violation") throw new AuthorityViolation(action, decision.reason, target);
    throw new ActionError(decision.category, decision.reason);
  }

  /**
   * Run one action against a task (or, with `projectId`, a project) in a
   * single transaction. Agents are checked against the human-only list before
   * the target is even loaded, so such an attempt is `authority_violation`
   * whatever the target's state, even if it does not exist (CONTRACT-002 step
   * 2; validation item 8).
   */
  async run(
    actor: Actor,
    action: ActionName,
    target: { taskId: string } | { projectId: string },
    fn: (ctx: ActionContext, task: TaskRow | undefined) => Promise<string>,
  ): Promise<ActionOutcome> {
    try {
      if (actor.kind === "agent" && HUMAN_ONLY_ACTIONS.has(action)) {
        this.deny(actor, action, { ...target, requested: { ...target } });
      }

      let projectId: string;
      if ("taskId" in target) {
        const [head] = UUID.test(target.taskId)
          ? await this.db
              .select({ projectId: schema.tasks.projectId })
              .from(schema.tasks)
              .where(eq(schema.tasks.id, target.taskId))
          : [];
        if (!head) {
          // For an agent, a task that does not exist is outside its binding.
          if (actor.kind === "agent") reject("not_permitted", "The task is outside the run's binding.");
          reject("not_found", "The task does not exist.");
        }
        projectId = head!.projectId;
      } else {
        projectId = target.projectId;
        if (actor.kind === "agent" && projectId !== actor.projectId) {
          reject("not_permitted", "The target is outside the run's project.");
        }
        if (!UUID.test(projectId)) reject("not_found", "The project does not exist.");
      }

      return await this.db.transaction(async (tx) => {
        const [project] = await tx
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, projectId))
          .for("update");
        if (!project) reject("not_found", "The project does not exist.");
        // The action is applied at the moment it holds the project lock.
        const ctx = new ActionContext(tx, this.clock(), project!);
        await this.processDueExpiries(ctx);

        let task: TaskRow | undefined;
        if ("taskId" in target) {
          task = await ctx.mustTask(target.taskId);
          if (actor.kind === "agent") {
            this.deny(actor, action, { taskId: task.id, projectId }, {
              projectId,
              taskId: task.id,
              bindingTaskIds: await this.bindingOf(ctx, actor),
            });
          }
        }
        const taskId = await fn(ctx, task);
        return { taskId, auditIds: ctx.auditIds };
      });
    } catch (err) {
      if (err instanceof AuthorityViolation) await this.recordViolation(actor, err);
      throw err;
    }
  }

  /**
   * The tasks an agent run may act on (CONTRACT-002 "Bound to the run's task
   * and project", with the CONTRACT-001 precondition 3 exceptions): its bound
   * task, that task's parent and subtasks, the parent's other subtasks, and
   * tasks this run authored. The per-action relationship rules narrow this.
   */
  private async bindingOf(ctx: ActionContext, actor: Extract<Actor, { kind: "agent" }>): Promise<Set<string>> {
    const ids = new Set<string>([actor.taskId]);
    const all = await ctx.tasks();
    const bound = all.find((t) => t.id === actor.taskId);
    for (const t of all) {
      if (t.parentId === actor.taskId) ids.add(t.id);
      if (bound?.parentId && (t.id === bound.parentId || t.parentId === bound.parentId)) ids.add(t.id);
      if (t.authorRunId === actor.runId) ids.add(t.id);
    }
    return ids;
  }

  private repoRef(ctx: ActionContext, task: TaskRow): RepositoryTaskRef {
    return { projectId: ctx.project.id, repoPath: ctx.project.repoPath, taskId: task.id, parentId: task.parentId };
  }

  // -------------------------------------------------------------------------
  // Claims: ending, leases, expiry (T4/T5 mechanics)
  // -------------------------------------------------------------------------

  private async endClaim(ctx: ActionContext, claim: ClaimRow, reason: string, pauseClose: "superseded" | "cancelled" = "superseded") {
    await ctx.tx
      .update(schema.claims)
      .set({ endedAt: ctx.now, endReason: reason, leaseExpiresAt: null, leaseSuspendedRemainingMs: null })
      .where(eq(schema.claims.id, claim.id));
    if (claim.runId) {
      // T4/T5: any open pause of that run is closed (pauses contract).
      await ctx.tx
        .update(schema.pauses)
        .set({ closedAt: ctx.now, closeReason: pauseClose })
        .where(and(eq(schema.pauses.runId, claim.runId), isNull(schema.pauses.closedAt)));
    }
  }

  /**
   * Suspend or resume agent-run leases: a lease is suspended while its task is
   * blocked, effectively blocked, or paused, and resumes with its remaining
   * time (C1, C2, "Claim expiry").
   */
  async refreshLeases(ctx: ActionContext, taskIds: string[]): Promise<void> {
    for (const id of taskIds) {
      const claim = await ctx.activeClaim(id);
      if (!claim || claim.claimantKind !== "agent") continue;
      const task = await ctx.mustTask(id);
      const suspended =
        (await ctx.blockingBlockers(task)).length > 0 || (await ctx.openPauses(task.id)).length > 0;
      if (suspended && claim.leaseExpiresAt) {
        const remaining = Math.max(0, claim.leaseExpiresAt.getTime() - ctx.now.getTime());
        await ctx.tx
          .update(schema.claims)
          .set({ leaseExpiresAt: null, leaseSuspendedRemainingMs: remaining })
          .where(eq(schema.claims.id, claim.id));
      } else if (!suspended && claim.leaseSuspendedRemainingMs !== null) {
        await ctx.tx
          .update(schema.claims)
          .set({
            leaseExpiresAt: new Date(ctx.now.getTime() + claim.leaseSuspendedRemainingMs),
            leaseSuspendedRemainingMs: null,
          })
          .where(eq(schema.claims.id, claim.id));
      }
    }
  }

  private async withSubtaskIds(ctx: ActionContext, task: TaskRow): Promise<string[]> {
    return [task.id, ...(await ctx.subtasks(task.id)).map((s) => s.id)];
  }

  /** T5 lease expiry for every due agent claim in the locked project. */
  private async processDueExpiries(ctx: ActionContext): Promise<void> {
    const due = await ctx.tx
      .select({ claim: schema.claims })
      .from(schema.claims)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.claims.taskId))
      .where(
        and(
          eq(schema.tasks.projectId, ctx.project.id),
          isNull(schema.claims.endedAt),
          isNotNull(schema.claims.leaseExpiresAt),
          lte(schema.claims.leaseExpiresAt, ctx.now),
        ),
      );
    for (const { claim } of due) {
      const task = await ctx.mustTask(claim.taskId);
      await this.endClaim(ctx, claim, "expired");
      await ctx.updateTask(task.id, { state: "approved" });
      await ctx.audit(systemActor("claim_expired"), {
        taskId: task.id,
        parentTaskId: task.parentId,
        action: "claim_expired",
        fromState: task.state,
        toState: "approved",
        occurredAt: claim.leaseExpiresAt!,
        details: { claimId: claim.id, formerClaimant: claimantOf(claim), leaseDeadline: claim.leaseExpiresAt!.toISOString() },
      });
    }
  }

  /** Expire due leases in every project (periodic sweep and before reads). */
  async sweepExpiredClaims(): Promise<void> {
    const now = this.clock();
    const rows = await this.db
      .selectDistinct({ projectId: schema.tasks.projectId })
      .from(schema.claims)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.claims.taskId))
      .where(and(isNull(schema.claims.endedAt), isNotNull(schema.claims.leaseExpiresAt), lte(schema.claims.leaseExpiresAt, now)));
    for (const { projectId } of rows) {
      await this.db.transaction(async (tx) => {
        const [project] = await tx.select().from(schema.projects).where(eq(schema.projects.id, projectId)).for("update");
        await this.processDueExpiries(new ActionContext(tx, this.clock(), project!));
      });
    }
  }

  // -------------------------------------------------------------------------
  // System transitions: T8, T12, T14, integration blocker
  // -------------------------------------------------------------------------

  /** T8: complete a reviewed subtask and integrate it into the parent's branch. */
  private async completeSubtask(ctx: ActionContext, subtask: TaskRow, reviewId: string): Promise<void> {
    const parent = await ctx.mustTask(subtask.parentId!);
    const integration = await this.repository.integrateSubtask(this.repoRef(ctx, subtask));
    await ctx.updateTask(subtask.id, { state: "completed", pendingCompletionReviewId: null });
    await ctx.audit(systemActor("review_recorded"), {
      taskId: subtask.id,
      parentTaskId: parent.id,
      action: "subtask_completed_on_review",
      fromState: "in_review",
      toState: "completed",
      details: {
        reviewId,
        integration: integration.ok ? "integrated" : { failed: true, conflictingFiles: integration.conflictingFiles },
      },
    });
    if (!integration.ok) {
      // C1 / Board A4: the one blocker the system raises.
      const [blocker] = await ctx.tx
        .insert(schema.blockers)
        .values({
          taskId: parent.id,
          kind: "integration",
          whatIsNeeded: `The work of subtask #${subtask.number} ("${subtask.title}") could not be integrated into this task's branch. Conflicting files: ${integration.conflictingFiles.join(", ") || "unknown"}.`,
          whoCanResolve: "A board member, typically after adding a fix subtask that redoes or ports the work.",
          effect: "The task cannot be accepted, and agents cannot claim or add its subtasks, until this is resolved.",
          details: { subtaskId: subtask.id, conflictingFiles: integration.conflictingFiles },
          addedByKind: "system",
          addedAt: ctx.now,
        })
        .returning();
      await ctx.audit(systemActor("subtask_integration_failed"), {
        taskId: parent.id,
        action: "blocker_added",
        fromState: parent.state,
        toState: parent.state,
        details: { blockerId: blocker!.id, kind: "integration", triggeringSubtaskId: subtask.id, conflictingFiles: integration.conflictingFiles },
      });
      await this.refreshLeases(ctx, await this.withSubtaskIds(ctx, parent));
    }
    await this.reevaluateParent(ctx, parent.id, subtask.id);
  }

  /** T12 / T14 after a subtask became done (never after T16). */
  private async reevaluateParent(ctx: ActionContext, parentId: string, triggerId: string): Promise<void> {
    const parent = await ctx.mustTask(parentId);
    if (parent.state !== "in_progress") return;
    if (await ctx.activeClaim(parent.id)) return;
    const subs = await ctx.subtasks(parent.id);
    if (subs.length === 0 || subs.some((s) => !isTerminal(s))) return;
    if (subs.some((s) => s.state === "completed")) {
      await ctx.updateTask(parent.id, { state: "in_review", enteredReviewBy: "subtasks" });
      await ctx.audit(systemActor("all_subtasks_done"), {
        taskId: parent.id,
        action: "entered_review_all_subtasks_done",
        fromState: "in_progress",
        toState: "in_review",
        details: { triggeringSubtaskId: triggerId },
      });
    } else {
      await ctx.updateTask(parent.id, { state: "approved", fellBackAt: ctx.now });
      await ctx.audit(systemActor("all_subtasks_cancelled"), {
        taskId: parent.id,
        action: "split_abandoned_all_subtasks_cancelled",
        fromState: "in_progress",
        toState: "approved",
        details: { triggeringSubtaskId: triggerId },
      });
    }
  }

  /** C1: deferred T8 completions take effect once nothing blocks them. */
  private async releaseDeferredCompletions(ctx: ActionContext, task: TaskRow): Promise<void> {
    const candidates = task.parentId === null ? await ctx.subtasks(task.id) : [task];
    for (const c of candidates) {
      const fresh = await ctx.mustTask(c.id);
      if (fresh.state !== "in_review" || !fresh.pendingCompletionReviewId) continue;
      if ((await ctx.blockingBlockers(fresh)).length > 0) continue;
      await this.completeSubtask(ctx, fresh, fresh.pendingCompletionReviewId);
    }
  }

  // -------------------------------------------------------------------------
  // T11 core, shared by split/add, T7 additions and T10 returns
  // -------------------------------------------------------------------------

  private async addSubtasksTo(
    ctx: ActionContext,
    parent: TaskRow,
    inputs: SubtaskSpec[],
    actor: Actor,
    via: "split" | "review" | "return",
  ): Promise<TaskRow[]> {
    const reasons: string[] = [];
    const envelopes = inputs.map((input, i) => {
      const r = buildSubtaskEnvelope(parent.envelope, input.envelope, `subtasks[${i}]`);
      if (!r.ok) reasons.push(...r.reasons);
      return r.ok ? r.envelope : null;
    });
    if (reasons.length) reject("validation", reasons.join("; "), { issues: reasons });

    const siblings = await ctx.subtasks(parent.id);
    let position = siblings.reduce((m, s) => Math.max(m, s.siblingPosition ?? 0), 0);
    let number = await ctx.nextTaskNumber();
    const parentApproval = await ctx.latestApprovalAuditId(parent.id);

    const claim = await ctx.activeClaim(parent.id);
    if (claim) await this.endClaim(ctx, claim, "split");

    const created: TaskRow[] = [];
    for (const [i, input] of inputs.entries()) {
      const [row] = await ctx.tx
        .insert(schema.tasks)
        .values({
          projectId: ctx.project.id,
          number: number++,
          parentId: parent.id,
          title: input.title,
          desiredOutcome: input.desiredOutcome,
          acceptanceCriteria: input.acceptanceCriteria,
          envelope: envelopes[i]!,
          state: "approved",
          authorKind: actor.kind,
          authorUserId: actor.kind === "human" ? actor.userId : null,
          authorRunId: actor.kind === "agent" ? actor.runId : null,
          siblingPosition: ++position,
          approvedAt: ctx.now,
          createdAt: ctx.now,
          updatedAt: ctx.now,
        })
        .returning();
      created.push(row!);
    }

    const fromState = parent.state;
    await ctx.updateTask(parent.id, { state: "in_progress", fellBackAt: null });
    const list = created.map((c) => ({ id: c.id, number: c.number, title: c.title }));
    if (via !== "return") {
      // On a return, the parent's single record is `returned`, listing these subtasks.
      await ctx.audit(actor, {
        taskId: parent.id,
        action: "split",
        fromState,
        toState: "in_progress",
        details: { subtasks: list, via, endedClaimId: claim?.id ?? null },
      });
    }
    const splitter = actor.kind === "human" ? { kind: "human", userId: actor.userId } : { kind: "agent", runId: actor.runId, model: actor.model };
    for (const c of created) {
      const base = { taskId: c.id, parentTaskId: parent.id, details: { parentApprovalAuditId: parentApproval, splittingActor: splitter } };
      await ctx.audit(systemActor("split"), { ...base, action: "created_by_split", fromState: null, toState: "approved" });
      await ctx.audit(systemActor("split"), { ...base, action: "auto_approved", fromState: "approved", toState: "approved" });
    }
    return created;
  }

  // -------------------------------------------------------------------------
  // Transitions
  // -------------------------------------------------------------------------

  /** T1 Create. */
  createTask(actor: Actor, projectId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "create_task", { projectId }, async (ctx) => {
      const input = parseInput(createTaskInputSchema, body);
      const env = buildTopLevelEnvelope(input.envelope);
      if (!env.ok) reject("validation", env.reasons.join("; "), { issues: env.reasons });
      const [row] = await ctx.tx
        .insert(schema.tasks)
        .values({
          projectId: ctx.project.id,
          number: await ctx.nextTaskNumber(),
          title: input.title,
          desiredOutcome: input.desiredOutcome,
          acceptanceCriteria: input.acceptanceCriteria,
          envelope: env.ok ? env.envelope : undefined!,
          state: "proposed",
          authorKind: actor.kind,
          authorUserId: actor.kind === "human" ? actor.userId : null,
          authorRunId: actor.kind === "agent" ? actor.runId : null,
          originTaskId: actor.kind === "agent" ? actor.taskId : null,
          createdAt: ctx.now,
          updatedAt: ctx.now,
        })
        .returning();
      await ctx.audit(actor, {
        taskId: row!.id,
        action: "created",
        fromState: null,
        toState: "proposed",
        details: { authorKind: actor.kind, runId: actor.kind === "agent" ? actor.runId : null },
      });
      return row!.id;
    });
  }

  /** T2 Approve (human only). */
  approve(actor: Actor, taskId: string): Promise<ActionOutcome> {
    return this.run(actor, "approve", { taskId }, async (ctx, task) => {
      const t = task!;
      if (t.state !== "proposed") reject("invalid_transition", `Only a proposed task can be approved; this task is ${t.state}.`);
      if (t.parentId !== null) reject("invalid_transition", "Subtasks are approved automatically with their split.");
      const reasons: string[] = [];
      if (t.envelope.inclusions.length === 0) reasons.push("The scope envelope needs at least one inclusion.");
      if (t.acceptanceCriteria.length === 0) reasons.push("At least one acceptance criterion is required.");
      const paths = checkPaths(t.envelope.paths);
      if (!paths.ok) reasons.push(...paths.reasons);
      if (reasons.length) reject("validation", reasons.join(" "), { issues: reasons });

      const queue = projectQueue(await ctx.tasks());
      const queuePosition = queue.reduce((m, q) => Math.max(m, q.queuePosition!), 0) + 1;
      const updated = await ctx.updateTask(t.id, {
        state: "approved",
        approvedAt: ctx.now,
        approvedByUserId: actor.kind === "human" ? actor.userId : null,
        queuePosition,
      });
      const deps = dependenciesOf(updated, await ctx.tasks());
      await ctx.audit(actor, {
        taskId: t.id,
        action: "approved",
        fromState: "proposed",
        toState: "approved",
        details: { queuePosition, pathDependencies: deps.map(depRef), changesNoFiles: t.envelope.paths.length === 0 },
      });
      return t.id;
    });
  }

  /** T3 Claim. */
  claim(actor: Actor, taskId: string): Promise<ActionOutcome> {
    return this.run(actor, "claim", { taskId }, async (ctx, task) => {
      const t = task!;
      if (actor.kind === "agent" && t.id !== actor.taskId) {
        reject("not_permitted", "A run may claim only the task it is bound to.");
      }
      if (t.state === "in_progress") {
        const current = await ctx.activeClaim(t.id);
        if (current) {
          reject("conflict", "The task is already claimed.", { state: t.state, claimant: claimantOf(current) });
        }
        reject("invalid_transition", "A split parent in progress is worked through its subtasks.");
      }
      if (t.state !== "approved") reject("invalid_transition", `Only an approved task can be claimed; this task is ${t.state}.`);
      const subs = await ctx.subtasks(t.id);
      if (subs.some((s) => !isTerminal(s))) {
        reject("invalid_transition", "This split parent is claimed through its subtasks.");
      }
      const unfinished = unfinishedDependencies(t, await ctx.tasks());
      if (unfinished.length) {
        reject("blocked", "The task has unfinished path dependencies.", { unfinishedDependencies: unfinished.map(depRef) });
      }
      if (actor.kind === "agent") {
        const blocking = await ctx.blockingBlockers(t);
        if (blocking.length) {
          reject("blocked", "Agents cannot claim a blocked task.", { openBlockers: blocking.map((b) => b.id) });
        }
        const [held] = await ctx.tx
          .select()
          .from(schema.claims)
          .where(and(eq(schema.claims.runId, actor.runId), isNull(schema.claims.endedAt)));
        if (held) reject("conflict", "This run already holds a claim (I5).");
      }
      const leaseExpiresAt = actor.kind === "agent" ? new Date(ctx.now.getTime() + this.leaseMs) : null;
      const [claim] = await ctx.tx
        .insert(schema.claims)
        .values({
          taskId: t.id,
          claimantKind: actor.kind,
          userId: actor.kind === "human" ? actor.userId : null,
          runId: actor.kind === "agent" ? actor.runId : null,
          startedAt: ctx.now,
          leaseExpiresAt,
          lastRenewedAt: leaseExpiresAt ? ctx.now : null,
        })
        .returning();
      await ctx.updateTask(t.id, { state: "in_progress", everClaimed: true, fellBackAt: null });
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "claimed",
        fromState: "approved",
        toState: "in_progress",
        details: { claimId: claim!.id, claimant: claimantOf(claim!), leaseDeadline: leaseExpiresAt?.toISOString() ?? null },
      });
      await this.refreshLeases(ctx, [t.id]);
      return t.id;
    });
  }

  /** T4 Release claim / break claim. */
  release(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "release", { taskId }, async (ctx, task) => {
      const t = task!;
      const claim = t.state === "in_progress" ? await ctx.activeClaim(t.id) : undefined;
      if (!claim) reject("invalid_transition", "The task has no active claim to release.");
      const own = isClaimant(actor, claim!);
      // Breaking another claimant's claim is human-only (CONTRACT-002).
      if (!own) this.deny(actor, "break_claim", { taskId: t.id, projectId: t.projectId });
      const input = parseInput(releaseClaimInputSchema, body);
      if (!own && !input.reason) reject("validation", "Breaking someone else's claim requires a reason.");
      await this.endClaim(ctx, claim!, own ? "released" : "broken");
      await ctx.updateTask(t.id, { state: "approved" });
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "claim_released",
        fromState: "in_progress",
        toState: "approved",
        reason: input.reason ?? null,
        details: { claimId: claim!.id, formerClaimant: claimantOf(claim!), break: !own },
      });
      return t.id;
    });
  }

  /** Renew an agent-run lease. No transition and not audited (A12). */
  renew(actor: Actor, taskId: string): Promise<ActionOutcome> {
    return this.run(actor, "renew", { taskId }, async (ctx, task) => {
      const t = task!;
      const claim = t.state === "in_progress" ? await ctx.activeClaim(t.id) : undefined;
      if (!claim) reject("invalid_transition", "The task has no active claim.");
      if (!isClaimant(actor, claim!)) reject("not_permitted", "Only the claimant renews its claim.");
      if (claim!.claimantKind === "human") reject("invalid_transition", "Human claims have no lease to renew.");
      await ctx.tx
        .update(schema.claims)
        .set(
          claim!.leaseSuspendedRemainingMs !== null
            ? { leaseSuspendedRemainingMs: this.leaseMs, lastRenewedAt: ctx.now }
            : { leaseExpiresAt: new Date(ctx.now.getTime() + this.leaseMs), lastRenewedAt: ctx.now },
        )
        .where(eq(schema.claims.id, claim!.id));
      return t.id;
    });
  }

  /** T6 Hand off. */
  handoff(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "handoff", { taskId }, async (ctx, task) => {
      const t = task!;
      if (t.state !== "in_progress") reject("invalid_transition", `Only a task in progress can be handed off; this task is ${t.state}.`);
      const claim = await ctx.activeClaim(t.id);
      if (!claim) reject("invalid_transition", "A split parent in progress is worked through its subtasks.");
      if (!isClaimant(actor, claim!)) reject("not_permitted", "Only the claimant can hand off. Break the claim and claim it first.");
      const subs = await ctx.subtasks(t.id);
      if (subs.some((s) => s.state === "completed")) {
        reject("invalid_transition", "A split parent with a completed subtask is never handed off; rework goes through new subtasks (I20).");
      }
      const input = parseInput(handoffInputSchema, body);
      const blocking = await ctx.blockingBlockers(t);
      if (blocking.length) reject("blocked", "The task is blocked.", { openBlockers: blocking.map((b) => b.id) });
      const pauses = await ctx.openPauses(t.id);
      if (pauses.length) reject("blocked", "The task is paused.", { openPauses: pauses.map((p) => p.id) });

      // Repository step (pluggable until phase 3).
      const merge = await this.repository.checkMergeable(this.repoRef(ctx, t), "integration_target");
      if (!merge.mergeable) {
        reject("merge_conflict", "The branch does not merge cleanly into its integration target.", {
          conflictingFiles: merge.conflictingFiles,
        });
      }

      let model: string | null = null;
      if (claim!.runId) {
        const [run] = await ctx.tx.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, claim!.runId));
        model = run?.model ?? null;
      }
      const [handoff] = await ctx.tx
        .insert(schema.handoffs)
        .values({
          taskId: t.id,
          claimId: claim!.id,
          claimantKind: claim!.claimantKind,
          userId: claim!.userId,
          runId: claim!.runId,
          model,
          record: input.record,
          commit: input.commit ?? null,
          createdAt: ctx.now,
        })
        .returning();
      await this.endClaim(ctx, claim!, "handed_off");
      await ctx.updateTask(t.id, { state: "in_review", enteredReviewBy: "handoff", latestHandoffId: handoff!.id });
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "handed_off",
        fromState: "in_progress",
        toState: "in_review",
        details: { handoffId: handoff!.id, handoffCommit: handoff!.commit, claimant: claimantOf(claim!) },
      });
      return t.id;
    });
  }

  /** T7 Record review (→ T11 additions, T8, T12). */
  recordReview(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "record_review", { taskId }, async (ctx, task) => {
      const t = task!;
      if (actor.kind !== "agent") {
        // CONTRACT-001 T7 allows only an agent reviewer run. A human is not a
        // human-only-list violation, so the conservative category is
        // `not_permitted` (see the TASK-006 handoff, board question).
        reject("not_permitted", "Only an agent reviewer run records a review.");
      }
      const agent = actor as Extract<Actor, { kind: "agent" }>;
      if (t.id !== agent.taskId) reject("not_permitted", "A reviewer run reviews only the task it is bound to.");
      const input = parseInput(recordReviewInputSchema, body);
      if (t.state !== "in_review") reject("invalid_transition", `Only a task in review can be reviewed; this task is ${t.state}.`);

      const [handoff] =
        t.enteredReviewBy === "handoff" && t.latestHandoffId
          ? await ctx.tx.select().from(schema.handoffs).where(eq(schema.handoffs.id, t.latestHandoffId))
          : [];
      if (handoff?.runId === agent.runId) {
        reject("not_permitted", "The reviewer run is the run whose handoff is under review.");
      }
      const flagged = handoff?.claimantKind === "agent" && sameModel(handoff.model, agent.model);

      const additions = input.addSubtasks ?? [];
      let added: TaskRow[] = [];
      if (additions.length) {
        if (t.parentId === null) reject("invalid_transition", "Only a review of a subtask may add subtasks to its parent.");
        if (input.findings.length === 0) reject("validation", "Adding subtasks with a review requires at least one finding.");
        const blocking = await ctx.blockingBlockers(t);
        if (blocking.length) {
          reject("blocked", "Agents cannot add subtasks while the task or its parent is blocked.", {
            openBlockers: blocking.map((b) => b.id),
          });
        }
        const parent = await ctx.mustTask(t.parentId!);
        if (parent.state !== "in_progress" || (await ctx.activeClaim(parent.id))) {
          reject("invalid_transition", "Subtasks can be added with a review only while the parent is in progress with no claim.");
        }
        added = await this.addSubtasksTo(ctx, parent, additions, actor, "review");
      }

      const [review] = await ctx.tx
        .insert(schema.reviews)
        .values({
          taskId: t.id,
          handoffId: handoff?.id ?? null,
          reviewerRunId: agent.runId,
          reviewerModel: agent.model,
          verdict: input.verdict,
          findings: input.findings,
          sameModel: flagged,
          createdAt: ctx.now,
        })
        .returning();
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "review_recorded",
        fromState: "in_review",
        toState: "in_review",
        details: {
          reviewId: review!.id,
          handoffId: handoff?.id ?? null,
          verdict: input.verdict,
          findingCount: input.findings.length,
          sameModel: flagged,
          implementingModel: handoff?.model ?? null,
          addedSubtasks: added.map((a) => ({ id: a.id, number: a.number, title: a.title })),
        },
      });

      if (t.parentId !== null) {
        const blocked = (await ctx.blockingBlockers(t)).length > 0;
        if (blocked) await ctx.updateTask(t.id, { pendingCompletionReviewId: review!.id });
        else await this.completeSubtask(ctx, await ctx.mustTask(t.id), review!.id);
      }
      return t.id;
    });
  }

  /** T9 Accept (human only). Records acceptance; never merges. */
  accept(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "accept", { taskId }, async (ctx, task) => {
      const t = task!;
      const input = parseInput(acceptInputSchema, body);
      if (t.state !== "in_review") reject("invalid_transition", `Only a task in review can be accepted; this task is ${t.state}.`);
      if (t.parentId !== null) reject("invalid_transition", "Subtasks are not accepted individually.");
      const subs = await ctx.subtasks(t.id);
      if (subs.some((s) => !isTerminal(s))) reject("invalid_transition", "The task has subtasks that are not done.");
      const blockers = await ctx.openBlockers(t.id);
      if (blockers.length) reject("blocked", "A blocked task cannot be accepted.", { openBlockers: blockers.map((b) => b.id) });

      let reviewIds: string[] = [];
      let waived = false;
      let handoffCommit: string | null = null;
      if (t.enteredReviewBy === "handoff") {
        const [handoff] = t.latestHandoffId
          ? await ctx.tx.select().from(schema.handoffs).where(eq(schema.handoffs.id, t.latestHandoffId))
          : [];
        handoffCommit = handoff?.commit ?? null;
        const reviews = handoff
          ? await ctx.tx.select().from(schema.reviews).where(eq(schema.reviews.handoffId, handoff.id))
          : [];
        reviewIds = reviews.map((r) => r.id);
        if (reviews.length === 0) {
          if (!input.waiveReviewReason) {
            reject("validation", "No agent review is recorded against the latest handoff; waive the review with a reason to accept.");
          }
          waived = true;
        }
      }

      // Repository step: the changed-file set (Board C4), then the known conflict (Q25).
      const ref = this.repoRef(ctx, t);
      const changed = await this.repository.changedFiles(ref);
      const outOfScope = filesOutsidePaths(changed, t.envelope.paths);
      if (outOfScope.length && !input.outOfScopeReason) {
        reject("validation", "Files outside the task's paths changed; give a reason to accept.", { outOfScopeFiles: outOfScope });
      }
      const merge = await this.repository.checkMergeable(ref, "main");
      let override: Record<string, unknown> | null = null;
      if (!merge.mergeable) {
        if (!input.acceptAnyway) {
          reject("merge_conflict", "The branch is known not to merge cleanly into main. Return the task, or accept anyway.", {
            conflictingFiles: merge.conflictingFiles,
          });
        }
        override = {
          kind: "accept_anyway",
          who: { userId: actor.kind === "human" ? actor.userId : null, identityMode: "selected" },
          when: ctx.now.toISOString(),
          bypassed: { knownConflict: { conflictingFiles: merge.conflictingFiles } },
          reason: input.acceptAnywayReason ?? null,
        };
      }

      await ctx.updateTask(t.id, {
        state: "completed",
        acceptedAt: ctx.now,
        acceptedByUserId: actor.kind === "human" ? actor.userId : null,
        // For a split parent that entered review by subtasks the accepted
        // commit is its branch head, which only exists from phase 3.
        acceptedCommit: handoffCommit,
        reviewWaiverReason: waived ? input.waiveReviewReason! : null,
      });
      await ctx.audit(actor, {
        taskId: t.id,
        action: "accepted",
        fromState: "in_review",
        toState: "completed",
        reason: waived ? input.waiveReviewReason! : null,
        details: {
          reviewIds,
          reviewWaived: waived,
          waiverReason: waived ? input.waiveReviewReason : null,
          outOfScopeFiles: outOfScope,
          outOfScopeReason: input.outOfScopeReason ?? null,
          warningsConfirmed: input.warningsConfirmed,
          acceptedCommit: handoffCommit,
          integrationStatus: "not_merged",
          override,
        },
      });
      return t.id;
    });
  }

  /** T10 Return (human only). */
  returnTask(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "return", { taskId }, async (ctx, task) => {
      const t = task!;
      const input = parseInput(returnInputSchema, body);
      if (t.state !== "in_review") reject("invalid_transition", `Only a task in review can be returned; this task is ${t.state}.`);
      const subs = await ctx.subtasks(t.id);
      const newSubtasks = input.subtasks ?? [];
      let added: TaskRow[] = [];
      let toState: "approved" | "in_progress" = "approved";
      if (subs.length === 0) {
        // T10 defines adding subtasks on return only for a split parent. A
        // leaf is returned to `approved` and can be split afterwards (T11).
        if (newSubtasks.length) reject("invalid_transition", "Only a split parent gets new subtasks on return; return it, then split it.");
      } else if (newSubtasks.length) {
        added = await this.addSubtasksTo(ctx, t, newSubtasks, actor, "return");
        toState = "in_progress";
      }
      await ctx.updateTask(t.id, { state: toState, returnNotes: input.reason, enteredReviewBy: null });
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "returned",
        fromState: "in_review",
        toState,
        reason: input.reason,
        details: { newSubtasks: added.map((a) => ({ id: a.id, number: a.number, title: a.title })) },
      });
      return t.id;
    });
  }

  /** T11 Split / add subtasks. */
  addSubtasks(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "add_subtasks", { taskId }, async (ctx, task) => {
      const t = task!;
      if (t.parentId !== null) reject("invalid_transition", "Only top-level tasks split (A6).");
      const claim = await ctx.activeClaim(t.id);
      if (t.state === "approved" && !claim) {
        if (actor.kind === "agent") reject("not_permitted", "An agent run must hold the claim to split a task.");
      } else if (t.state === "in_progress" && claim) {
        if (!isClaimant(actor, claim)) reject("not_permitted", "Only the claimant can split a claimed task.");
      } else if (t.state === "in_progress" && !claim) {
        if (actor.kind === "agent") {
          const subs = await ctx.subtasks(t.id);
          let eligible = false;
          for (const s of subs.filter((x) => !isTerminal(x))) {
            const c = await ctx.activeClaim(s.id);
            if (c && isClaimant(actor, c)) eligible = true;
          }
          if (!eligible) reject("not_permitted", "Only the claimant run of one of this task's non-done subtasks may add subtasks.");
        }
      } else {
        reject("invalid_transition", `Subtasks cannot be added to a task that is ${t.state}.`);
      }
      const input = parseInput(addSubtasksInputSchema, body);
      if (actor.kind === "agent") {
        const blockers = await ctx.openBlockers(t.id);
        if (blockers.length) reject("blocked", "Agents cannot add subtasks to a blocked task.", { openBlockers: blockers.map((b) => b.id) });
      }
      await this.addSubtasksTo(ctx, t, input.subtasks, actor, "split");
      return t.id;
    });
  }

  /** T15 Cancel (→ T16, T12, T14). */
  cancel(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "cancel", { taskId }, async (ctx, task) => {
      const t = task!;
      if (actor.kind === "agent") {
        if (t.parentId === null) {
          // T15: an agent may withdraw only a proposed task it authored.
          // Anything else on a top-level task is "cancel beyond what T15
          // allows" (human-only, audited).
          if (!(t.state === "proposed" && t.authorRunId === actor.runId)) {
            this.deny(actor, "cancel_beyond_agent_allowance", { taskId: t.id, projectId: t.projectId });
          }
        } else {
          // CONTRACT-001 lists "not the subtask's creating run, or the
          // subtask has been claimed" under `not_permitted`.
          if (t.authorRunId !== actor.runId) reject("not_permitted", "An agent may cancel only a subtask its own run created.");
          const bound = await ctx.task(actor.taskId);
          if (!(actor.taskId === t.parentId || bound?.parentId === t.parentId)) {
            reject("not_permitted", "The run must be bound to the parent or to one of its subtasks.");
          }
          if (t.everClaimed) reject("not_permitted", "The subtask has been claimed; only a human may cancel it now.");
        }
      }
      const input = parseInput(cancelInputSchema, body);
      if (isTerminal(t)) reject("invalid_transition", `The task is already ${t.state}.`);
      if (actor.kind === "agent" && t.parentId !== null && t.state !== "approved") {
        reject("not_permitted", "An agent may cancel its subtask only while it is approved and never claimed.");
      }

      const cancelId = await this.cancelOne(ctx, t, actor, "cancelled", input.reason);
      const subs = await ctx.subtasks(t.id);
      for (const s of subs.filter((x) => !isTerminal(x))) {
        await this.cancelOne(ctx, s, systemActor("parent_cancelled"), "cancelled_by_parent", null, cancelId);
      }
      if (t.parentId !== null) await this.reevaluateParent(ctx, t.parentId, t.id);
      return t.id;
    });
  }

  private async cancelOne(
    ctx: ActionContext,
    t: TaskRow,
    actor: AnyActor,
    action: "cancelled" | "cancelled_by_parent",
    reason: string | null,
    parentCancellationAuditId?: number,
  ): Promise<number> {
    const claim = await ctx.activeClaim(t.id);
    if (claim) await this.endClaim(ctx, claim, "cancelled", "cancelled");
    await ctx.tx
      .update(schema.pauses)
      .set({ closedAt: ctx.now, closeReason: "cancelled" })
      .where(and(eq(schema.pauses.taskId, t.id), isNull(schema.pauses.closedAt)));
    await ctx.tx
      .update(schema.blockers)
      .set({ resolvedAt: ctx.now, resolution: "moot" })
      .where(and(eq(schema.blockers.taskId, t.id), isNull(schema.blockers.resolvedAt)));
    await ctx.updateTask(t.id, {
      state: "cancelled",
      queuePosition: null,
      pendingCompletionReviewId: null,
      fellBackAt: null,
    });
    return ctx.audit(actor, {
      taskId: t.id,
      parentTaskId: t.parentId,
      action,
      fromState: t.state,
      toState: "cancelled",
      reason,
      details: {
        endedClaimId: claim?.id ?? null,
        ...(parentCancellationAuditId !== undefined ? { parentCancellationAuditId } : {}),
      },
    });
  }

  /** C1 add blocker. */
  addBlocker(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "add_blocker", { taskId }, async (ctx, task) => {
      const t = task!;
      if (actor.kind === "agent") {
        if (t.id !== actor.taskId) reject("not_permitted", "An agent may add a blocker only to the task its run is bound to.");
        const claim = await ctx.activeClaim(t.id);
        const asClaimant = claim !== undefined && isClaimant(actor, claim);
        const asReviewer = t.state === "in_review";
        if (!asClaimant && !asReviewer) reject("not_permitted", "An agent adds blockers as the task's claimant or reviewer.");
      }
      const input = parseInput(addBlockerInputSchema, body);
      if (isTerminal(t)) reject("invalid_transition", `The task is ${t.state}.`);
      const [blocker] = await ctx.tx
        .insert(schema.blockers)
        .values({
          taskId: t.id,
          kind: "manual",
          ...input,
          addedByKind: actor.kind,
          addedByUserId: actor.kind === "human" ? actor.userId : null,
          addedByRunId: actor.kind === "agent" ? actor.runId : null,
          addedAt: ctx.now,
        })
        .returning();
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "blocker_added",
        fromState: t.state,
        toState: t.state,
        details: { blockerId: blocker!.id, kind: "manual", ...input },
      });
      await this.refreshLeases(ctx, await this.withSubtaskIds(ctx, t));
      return t.id;
    });
  }

  /** C1 resolve blocker (→ deferred T8, T12). */
  resolveBlocker(actor: Actor, taskId: string, blockerId: string): Promise<ActionOutcome> {
    return this.run(actor, "resolve_blocker", { taskId }, async (ctx, task) => {
      const t = task!;
      const [blocker] = UUID.test(blockerId)
        ? await ctx.tx
            .select()
            .from(schema.blockers)
            .where(and(eq(schema.blockers.id, blockerId), eq(schema.blockers.taskId, t.id)))
        : [];
      if (!blocker) reject("not_found", "The blocker does not exist on this task.");
      if (actor.kind === "agent") {
        if (blocker!.kind === "integration") reject("not_permitted", "Only a human resolves the integration blocker.");
        if (blocker!.addedByRunId !== actor.runId) reject("not_permitted", "Only a human or the run that added the blocker may resolve it.");
      }
      if (blocker!.resolvedAt) reject("invalid_transition", "The blocker is already resolved.");
      await ctx.tx
        .update(schema.blockers)
        .set({
          resolvedAt: ctx.now,
          resolution: "resolved",
          resolvedByKind: actor.kind,
          resolvedByUserId: actor.kind === "human" ? actor.userId : null,
          resolvedByRunId: actor.kind === "agent" ? actor.runId : null,
        })
        .where(eq(schema.blockers.id, blocker!.id));
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "blocker_resolved",
        fromState: t.state,
        toState: t.state,
        details: { blockerId: blocker!.id, kind: blocker!.kind, whatIsNeeded: blocker!.whatIsNeeded },
      });
      await this.refreshLeases(ctx, await this.withSubtaskIds(ctx, t));
      await this.releaseDeferredCompletions(ctx, await ctx.mustTask(t.id));
      return t.id;
    });
  }

  /** D1 Move a task in the project queue, or a subtask among its siblings (human only). */
  move(actor: Actor, taskId: string, body: unknown): Promise<ActionOutcome> {
    return this.run(actor, "move", { taskId }, async (ctx, task) => {
      const t = task!;
      const input = parseInput(moveInputSchema, body);
      const all = await ctx.tasks();
      let order: TaskRow[];
      let scope: "queue" | "siblings";
      if (t.parentId === null) {
        if (t.queuePosition === null) reject("invalid_transition", "The task is not in the project queue.");
        order = projectQueue(all);
        scope = "queue";
      } else {
        order = siblingsOf(all, t.parentId);
        scope = "siblings";
      }
      if (input.position > order.length) {
        reject("validation", `Position must be between 1 and ${order.length}.`);
      }
      const from = order.findIndex((o) => o.id === t.id) + 1;
      const reordered = order.filter((o) => o.id !== t.id);
      reordered.splice(input.position - 1, 0, t);
      const field = scope === "queue" ? "queuePosition" : "siblingPosition";
      const positions = new Map(reordered.map((o, i) => [o.id, i + 1]));
      const after = all.map((o) => (positions.has(o.id) ? { ...o, [field]: positions.get(o.id)! } : o));

      // Constraint: no started task gains an unfinished path dependency.
      const key = (d: Dependency) => `${d.kind}:${d.task.id}`;
      const offenders: { taskId: string; number: number; gained: number[] }[] = [];
      for (const before of all) {
        if (before.state !== "in_progress" && before.state !== "in_review") continue;
        const now = after.find((a) => a.id === before.id)!;
        const had = new Set(unfinishedDependencies(before, all).map((d) => d.task.id));
        const gained = unfinishedDependencies(now, after).filter((d) => !had.has(d.task.id));
        if (gained.length) offenders.push({ taskId: before.id, number: before.number, gained: gained.map((g) => g.task.number) });
      }
      if (offenders.length) {
        reject(
          "invalid_transition",
          `The move would make started task(s) ${offenders.map((o) => `#${o.number}`).join(", ")} wait on an unfinished task.`,
          { startedTasks: offenders },
        );
      }

      for (const o of reordered) {
        const p = positions.get(o.id)!;
        if (o[field] !== p) await ctx.updateTask(o.id, { [field]: p });
      }
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "queue_reordered",
        fromState: t.state,
        toState: t.state,
        details: { scope, fromPosition: from, toPosition: input.position },
      });
      for (const before of all) {
        if (before.id === t.id) continue;
        const now = after.find((a) => a.id === before.id)!;
        const b = new Map(dependenciesOf(before, all).map((d) => [key(d), d]));
        const a = new Map(dependenciesOf(now, after).map((d) => [key(d), d]));
        const gained = [...a.keys()].filter((k) => !b.has(k)).map((k) => depRef(a.get(k)!));
        const lost = [...b.keys()].filter((k) => !a.has(k)).map((k) => depRef(b.get(k)!));
        if (gained.length || lost.length) {
          await ctx.audit(actor, {
            taskId: before.id,
            parentTaskId: before.parentId,
            action: "path_dependencies_changed",
            fromState: before.state,
            toState: before.state,
            details: { movedTaskId: t.id, gained, lost },
          });
        }
      }
      return t.id;
    });
  }

  // -------------------------------------------------------------------------
  // Development/test only: runs, credentials, pauses (no runs contract yet)
  // -------------------------------------------------------------------------

  /** Start a run bound to a task and mint its credential. Starting a run is human-only. */
  async devStartRun(actor: Actor, body: unknown): Promise<{ runId: string; credential: string }> {
    const raw = (body ?? {}) as { taskId?: unknown };
    const taskId = typeof raw.taskId === "string" ? raw.taskId : "";
    let result: { runId: string; credential: string } | undefined;
    await this.run(actor, "start_run", { taskId }, async (ctx, task) => {
      const input = parseInput(devStartRunInputSchema, body);
      const t = task!;
      if (isTerminal(t)) reject("invalid_transition", `The task is ${t.state}.`);
      const [run] = await ctx.tx
        .insert(schema.agentRuns)
        .values({
          projectId: t.projectId,
          taskId: t.id,
          role: input.role,
          model: input.model,
          quantization: input.quantization ?? null,
          startedByUserId: (actor as Extract<Actor, { kind: "human" }>).userId,
          startedAt: ctx.now,
        })
        .returning();
      const credential = generateCredential();
      await ctx.tx.insert(schema.runCredentials).values({
        runId: run!.id,
        tokenHash: hashCredential(credential),
        issuedAt: ctx.now,
        expiresAt: input.ttlSeconds ? new Date(ctx.now.getTime() + input.ttlSeconds * 1000) : null,
      });
      await ctx.audit(actor, {
        taskId: t.id,
        parentTaskId: t.parentId,
        action: "run_started",
        fromState: t.state,
        toState: t.state,
        details: { runId: run!.id, role: input.role, model: input.model, devOnly: true },
      });
      result = { runId: run!.id, credential };
      return t.id;
    });
    return result!;
  }

  private async runTarget(runId: string) {
    const [run] = UUID.test(runId) ? await this.db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId)) : [];
    if (!run) reject("not_found", "The run does not exist.");
    return run!;
  }

  /** End a run (finished, failed, stopped): its credential stops resolving, and T5 ends its claim. */
  async devEndRun(actor: Actor, runId: string, body: unknown): Promise<ActionOutcome> {
    if (actor.kind !== "human") reject("not_permitted", "Runs are ended by the runner or a human (development endpoint).");
    const run = await this.runTarget(runId);
    return this.run(actor, "end_run", { taskId: run.taskId }, async (ctx) => {
      const input = parseInput(devEndRunInputSchema, body);
      const [fresh] = await ctx.tx.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run.id));
      if (fresh!.status !== "active") reject("invalid_transition", `The run has already ended (${fresh!.status}).`);
      await ctx.tx.update(schema.agentRuns).set({ status: input.status, endedAt: ctx.now }).where(eq(schema.agentRuns.id, run.id));
      await ctx.tx.update(schema.runCredentials).set({ revokedAt: ctx.now }).where(eq(schema.runCredentials.runId, run.id));
      const [claim] = await ctx.tx
        .select()
        .from(schema.claims)
        .where(and(eq(schema.claims.runId, run.id), isNull(schema.claims.endedAt)));
      if (claim) {
        const t = await ctx.mustTask(claim.taskId);
        await this.endClaim(ctx, claim, "run_ended");
        await ctx.updateTask(t.id, { state: "approved" });
        await ctx.audit(systemActor("run_ended"), {
          taskId: t.id,
          parentTaskId: t.parentId,
          action: "claim_ended_run_finished",
          fromState: t.state,
          toState: "approved",
          details: { claimId: claim.id, formerClaimant: claimantOf(claim), runOutcome: input.status },
        });
      } else {
        await ctx.tx
          .update(schema.pauses)
          .set({ closedAt: ctx.now, closeReason: "superseded" })
          .where(and(eq(schema.pauses.runId, run.id), isNull(schema.pauses.closedAt)));
      }
      return run.taskId;
    });
  }

  /** Open a pause for a run (C2 data only; the pauses contract defines the real flow). */
  async devOpenPause(actor: Actor, runId: string, body: unknown): Promise<ActionOutcome> {
    if (actor.kind !== "human") reject("not_permitted", "Development endpoint: humans only.");
    const run = await this.runTarget(runId);
    return this.run(actor, "end_run", { taskId: run.taskId }, async (ctx, task) => {
      const input = parseInput(devOpenPauseInputSchema, body);
      const [fresh] = await ctx.tx.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, run.id));
      if (fresh!.status !== "active") reject("invalid_transition", "The run has ended.");
      const [pause] = await ctx.tx
        .insert(schema.pauses)
        .values({ runId: run.id, taskId: run.taskId, question: input.question, openedAt: ctx.now })
        .returning();
      await ctx.audit(actor, {
        taskId: task!.id,
        action: "paused",
        fromState: task!.state,
        toState: task!.state,
        details: { pauseId: pause!.id, runId: run.id },
      });
      await this.refreshLeases(ctx, [run.taskId]);
      return run.taskId;
    });
  }

  /** Close a pause as answered. */
  async devClosePause(actor: Actor, pauseId: string): Promise<ActionOutcome> {
    if (actor.kind !== "human") reject("not_permitted", "Development endpoint: humans only.");
    const [pause] = UUID.test(pauseId) ? await this.db.select().from(schema.pauses).where(eq(schema.pauses.id, pauseId)) : [];
    if (!pause) reject("not_found", "The pause does not exist.");
    return this.run(actor, "end_run", { taskId: pause!.taskId }, async (ctx, task) => {
      const [fresh] = await ctx.tx.select().from(schema.pauses).where(eq(schema.pauses.id, pause!.id));
      if (fresh!.closedAt) reject("invalid_transition", "The pause is already closed.");
      await ctx.tx
        .update(schema.pauses)
        .set({ closedAt: ctx.now, closeReason: "answered" })
        .where(eq(schema.pauses.id, pause!.id));
      await ctx.audit(actor, {
        taskId: task!.id,
        action: "resumed",
        fromState: task!.state,
        toState: task!.state,
        details: { pauseId: pause!.id },
      });
      await this.refreshLeases(ctx, [task!.id]);
      return task!.id;
    });
  }
}
