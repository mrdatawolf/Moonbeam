// Which human actions are available on a task right now, and why not.
//
// The TASK-006 API does not report allowed actions, so this module mirrors
// the CONTRACT-001 preconditions for a human actor, using only what the task
// detail reports (state, claim, blockers, subtasks, dependencies, reviews).
// It never decides state: the server still evaluates every action, and a
// refusal is shown with its category. Keep this in step with
// `server/src/lifecycle/service.ts`; `actions.test.ts` covers each rule.
import type { TaskDetail, TaskState } from "@moonbeam/shared";
import { TASK_STATE, reviewsOfLatestAttempt } from "./status";
import { pathProblems } from "./paths";

export type Availability = { enabled: true } | { enabled: false; reason: string };

export type ActionKey = "approve" | "claim" | "release" | "handoff" | "accept" | "return" | "cancel" | "addBlocker";

export interface ActionContext {
  /** The selected user, or null when nobody is selected in this browser. */
  userId: string | null;
  connectionLost?: boolean;
}

export const CHOOSE_USER = "Choose who you are to take this action";
export const CONNECTION_LOST = "Connection lost. Retrying.";

const yes: Availability = { enabled: true };
const no = (reason: string): Availability => ({ enabled: false, reason });
const stateLabel = (s: TaskState) => TASK_STATE[s].label;
const isTerminal = (s: TaskState) => s === "completed" || s === "cancelled";

/** How the release button reads: the claimant releases, anyone else breaks the claim (T4). */
export function releaseMode(task: TaskDetail, userId: string | null): "release" | "break" {
  const c = task.claim;
  return c && c.claimantKind === "human" && c.userId === userId ? "release" : "break";
}

/** Whether accepting needs the review waiver (A5): entered by handoff, no review on the latest handoff. */
export function needsReviewWaiver(task: TaskDetail): boolean {
  return task.enteredReviewBy === "handoff" && reviewsOfLatestAttempt(task).length === 0;
}

function rule(task: TaskDetail, key: ActionKey, userId: string): Availability {
  const s = task.state;
  const top = task.parentId === null;
  const openSubtasks = task.subtasks.filter((x) => !isTerminal(x.state));
  const completedSubtasks = task.subtasks.filter((x) => x.state === "completed");
  const blocked = task.blocked || task.effectivelyBlocked;
  switch (key) {
    case "approve": {
      if (s !== "proposed") return no(`Only a proposed task can be approved. This task is ${stateLabel(s)}.`);
      if (!top) return no("Subtasks are approved automatically with their split.");
      const reasons: string[] = [];
      if (task.envelope.inclusions.length === 0) reasons.push("The scope envelope needs at least one inclusion.");
      if (task.acceptanceCriteria.length === 0) reasons.push("At least one acceptance criterion is required.");
      reasons.push(...pathProblems(task.envelope.paths));
      return reasons.length ? no(reasons.join(" ")) : yes;
    }
    case "claim": {
      if (s === "in_progress" && task.claim) return no(`Already claimed by ${claimantName(task)}.`);
      if (s === "in_progress") return no("This split parent is worked through its subtasks.");
      if (s !== "approved") return no(`Only an approved task can be claimed. This task is ${stateLabel(s)}.`);
      if (openSubtasks.length) return no("This split parent is claimed through its subtasks.");
      const waiting = task.dependsOn.filter((d) => !d.finished);
      if (waiting.length) {
        return no(`Waiting for ${waiting.map((d) => `#${d.number} (${dependencyKindLabel(d.kind)})`).join(", ")} to finish.`);
      }
      return yes;
    }
    case "release": {
      if (!task.claim) return no(s === "in_progress" ? "No one holds a claim; the work goes through its subtasks." : "No one holds a claim on this task.");
      return yes;
    }
    case "handoff": {
      if (s !== "in_progress") return no(`Only a task in progress can be handed off. This task is ${stateLabel(s)}.`);
      if (!task.claim) return no("A split parent in progress is worked through its subtasks.");
      if (!(task.claim.claimantKind === "human" && task.claim.userId === userId)) {
        return no("Only the claimant can hand off. Break the claim and claim it first.");
      }
      if (completedSubtasks.length) return no("A split parent with a completed subtask is never handed off; rework goes through new subtasks.");
      if (blocked) return no("The task is blocked. Resolve its blockers first.");
      if (task.paused) return no("The task is paused. Answer the open question first.");
      return yes;
    }
    case "accept": {
      if (!top) return no("Subtasks aren't accepted individually. Accept the parent task.");
      if (s !== "in_review") return no(`Only a task in review can be accepted. This task is ${stateLabel(s)}.`);
      if (openSubtasks.length) return no("The task has subtasks that are not done.");
      if (task.blocked) return no("A blocked task cannot be accepted. Resolve its blockers, or return it.");
      return yes;
    }
    case "return": {
      if (!top) return no("Subtasks aren't returned individually. Return the parent task.");
      if (s !== "in_review") return no(`Only a task in review can be returned. This task is ${stateLabel(s)}.`);
      return yes;
    }
    case "cancel":
    case "addBlocker":
      return isTerminal(s) ? no(`The task is ${stateLabel(s)}.`) : yes;
  }
}

export function availability(task: TaskDetail, key: ActionKey, ctx: ActionContext): Availability {
  if (!ctx.userId) return no(CHOOSE_USER);
  if (ctx.connectionLost) return no(CONNECTION_LOST);
  return rule(task, key, ctx.userId);
}

/** Resolving a blocker: any human may resolve any open blocker, including the integration blocker (C1). */
export function blockerAvailability(ctx: ActionContext): Availability {
  if (!ctx.userId) return no(CHOOSE_USER);
  if (ctx.connectionLost) return no(CONNECTION_LOST);
  return yes;
}

/** Moving in the project queue or among siblings (D1). The server checks started tasks. */
export function moveAvailability(
  task: { parentId: string | null; queuePosition: number | null; siblingPosition: number | null },
  ctx: ActionContext,
): Availability {
  if (!ctx.userId) return no(CHOOSE_USER);
  if (ctx.connectionLost) return no(CONNECTION_LOST);
  if (task.parentId === null && task.queuePosition === null) return no("Only approved tasks are in the project queue.");
  return yes;
}

export function claimantName(task: Pick<TaskDetail, "claim">): string {
  const c = task.claim;
  if (!c) return "nobody";
  if (c.claimantKind === "agent") return `an agent run (${c.model ?? "unknown model"})`;
  return c.displayName ?? "an unknown user";
}

export function dependencyKindLabel(kind: "queue" | "inherited" | "sibling"): string {
  return kind === "queue" ? "earlier in the queue" : kind === "inherited" ? "inherited from the parent" : "earlier sibling";
}
