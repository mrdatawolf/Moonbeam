// Read-only action preconditions for CONTRACT-005 / CONTRACT-003 views.
// This reports whether the actor can start an action with valid input. Required
// reasons, waivers, a move's destination, and repository checks are evaluated
// by the action transaction, which also rechecks identity and current state.
import { taskActionKeySchema, type ActionAvailability, type AllowedActions, type TaskActionKey } from "@moonbeam/shared";
import type { schema } from "@moonbeam/db";
import type { Actor } from "../identity/actor.js";
import { checkPermission, type ActionName } from "../identity/permission.js";
import { unfinishedDependencies } from "./dependencies.js";
import { checkPaths } from "./paths.js";

type Task = typeof schema.tasks.$inferSelect;
type Claim = typeof schema.claims.$inferSelect;
type Blocker = typeof schema.blockers.$inferSelect;
type Handoff = typeof schema.handoffs.$inferSelect;
export interface AvailabilityData {
  tasks: Task[];
  claims: Map<string, Claim>;
  openBlockerTasks: Set<string>;
  pausedTasks: Set<string>;
  blockers: Blocker[];
  handoffs: Handoff[];
}
const yes: ActionAvailability = { enabled: true };
const no = (reason: string): ActionAvailability => ({ enabled: false, reason });
const terminal = (t: Task) => t.state === "completed" || t.state === "cancelled";
const names: Partial<Record<TaskActionKey, ActionName>> = {
  recordReview: "record_review", addSubtasks: "add_subtasks", addBlocker: "add_blocker", resolveBlocker: "resolve_blocker",
};
function permission(t: Task, key: TaskActionKey, actor: Actor | null, data: AvailabilityData): ActionAvailability {
  if (!actor) return no("Choose who you are to take this action");
  const bound = actor.kind === "agent" ? data.tasks.find((x) => x.id === actor.taskId) : undefined;
  const binding = actor.kind === "agent" ? new Set(data.tasks.filter((x) =>
    x.id === actor.taskId || x.parentId === actor.taskId ||
    (bound?.parentId && (x.id === bound.parentId || x.parentId === bound.parentId)) || x.authorRunId === actor.runId,
  ).map((x) => x.id)) : undefined;
  const p = checkPermission(actor, names[key] ?? key as ActionName, { projectId: t.projectId, taskId: t.id, bindingTaskIds: binding });
  return p.allow ? yes : no(p.reason);
}
export function blockerAvailability(t: Task, b: Blocker, actor: Actor | null, data: AvailabilityData): ActionAvailability {
  const p = permission(t, "resolveBlocker", actor, data);
  if (!p.enabled) return p;
  if (actor?.kind === "agent") {
    if (b.kind === "integration") return no("Only a human resolves the integration blocker.");
    if (b.addedByRunId !== actor.runId) return no("Only a human or the run that added the blocker may resolve it.");
  }
  return b.resolvedAt ? no("The blocker is already resolved.") : yes;
}
export function actionAvailability(t: Task, key: TaskActionKey, actor: Actor | null, data: AvailabilityData): ActionAvailability {
  const p = permission(t, key, actor, data);
  if (!p.enabled || !actor) return p;
  const agent = actor.kind === "agent" ? actor : null;
  const claim = data.claims.get(t.id);
  const own = claim && (actor.kind === "human" ? claim.claimantKind === "human" && claim.userId === actor.userId : claim.runId === actor.runId);
  const subs = data.tasks.filter((s) => s.parentId === t.id);
  const blocked = data.openBlockerTasks.has(t.id) || (t.parentId !== null && data.openBlockerTasks.has(t.parentId));
  switch (key) {
    case "edit":
      if (agent && t.authorRunId !== agent.runId) return no("Only the run that authored the proposed task may edit it.");
      return t.state === "proposed" && t.parentId === null ? yes : no("Only a proposed top-level task can be edited. Cancel and re-propose to change approved content.");
    case "approve": {
      if (t.state !== "proposed") return no(`Only a proposed task can be approved; this task is ${t.state}.`);
      if (t.parentId !== null) return no("Subtasks are approved automatically with their split.");
      const reasons = [];
      if (!t.envelope.inclusions.length) reasons.push("The scope envelope needs at least one inclusion.");
      if (!t.acceptanceCriteria.length) reasons.push("At least one acceptance criterion is required.");
      const paths = checkPaths(t.envelope.paths);
      if (!paths.ok) reasons.push(...paths.reasons);
      return reasons.length ? no(reasons.join(" ")) : yes;
    }
    case "claim": {
      if (agent && t.id !== agent.taskId) return no("A run may claim only the task it is bound to.");
      if (t.state === "in_progress" && claim) return no("The task is already claimed.");
      if (t.state !== "approved") return no(`Only an approved task can be claimed; this task is ${t.state}.`);
      if (subs.some((s) => !terminal(s))) return no("This split parent is claimed through its subtasks.");
      const waiting = unfinishedDependencies(t, data.tasks.filter((x) => x.projectId === t.projectId));
      if (waiting.length) return no(`Waiting for ${waiting.map((d) => `#${d.task.number} (${d.kind})`).join(", ")} to finish.`);
      if (agent && blocked) return no("Agents cannot claim a blocked task.");
      if (agent && [...data.claims.values()].some((c) => c.runId === agent.runId)) return no("This run already holds a claim (I5).");
      return yes;
    }
    case "release":
    case "renew":
      if (t.state !== "in_progress" || !claim) return no("The task has no active claim.");
      if (!own && (agent || key === "renew")) return no(key === "renew" ? "Only the claimant renews its claim." : "Agents may not break another claimant's claim.");
      if (key === "renew" && claim.claimantKind === "human") return no("Human claims have no lease to renew.");
      return yes;
    case "handoff":
      if (t.state !== "in_progress") return no(`Only a task in progress can be handed off; this task is ${t.state}.`);
      if (!claim) return no("A split parent in progress is worked through its subtasks.");
      if (!own) return no("Only the claimant can hand off. Break the claim and claim it first.");
      if (subs.some((s) => s.state === "completed")) return no("A split parent with a completed subtask is never handed off; rework goes through new subtasks.");
      if (blocked) return no("The task is blocked.");
      if (data.pausedTasks.has(t.id)) return no("The task is paused.");
      return yes;
    case "recordReview":
      if (!agent) return no("Only an agent reviewer run records a review.");
      if (t.id !== agent.taskId) return no("A reviewer run reviews only the task it is bound to.");
      if (t.state !== "in_review") return no(`Only a task in review can be reviewed; this task is ${t.state}.`);
      if (t.enteredReviewBy === "handoff" && data.handoffs.find((h) => h.id === t.latestHandoffId)?.runId === agent.runId) return no("The reviewer run is the run whose handoff is under review.");
      return yes;
    case "accept":
      if (t.state !== "in_review") return no(`Only a task in review can be accepted; this task is ${t.state}.`);
      if (t.parentId !== null) return no("Subtasks are not accepted individually.");
      if (subs.some((s) => !terminal(s))) return no("The task has subtasks that are not done.");
      return data.openBlockerTasks.has(t.id) ? no("A blocked task cannot be accepted.") : yes;
    case "return":
      // T10 also permits returning an in-review subtask; completion is terminal.
      return t.state === "in_review" ? yes : no(`Only a task in review can be returned; this task is ${t.state}.`);
    case "addSubtasks":
      if (t.parentId !== null) return no("Only top-level tasks split (A6).");
      if (t.state === "approved" && !claim) {
        if (agent) return no("An agent run must hold the claim to split a task.");
      } else if (t.state === "in_progress" && claim) {
        if (!own) return no("Only the claimant can split a claimed task.");
      } else if (t.state === "in_progress" && !claim) {
        if (agent && !subs.some((s) => !terminal(s) && data.claims.get(s.id)?.runId === agent.runId)) return no("Only the claimant run of one of this task's non-done subtasks may add subtasks.");
      } else return no(`Subtasks cannot be added to a task that is ${t.state}.`);
      return agent && data.openBlockerTasks.has(t.id) ? no("Agents cannot add subtasks to a blocked task.") : yes;
    case "cancel":
      if (agent) {
        if (t.parentId === null) {
          if (t.authorRunId === agent.runId && t.state === "cancelled" && t.approvedAt === null) return no("The proposal has already been withdrawn.");
          if (!(t.state === "proposed" && t.authorRunId === agent.runId)) return no("Only humans may cancel this top-level task.");
        } else {
          if (t.authorRunId !== agent.runId) return no("An agent may cancel only a subtask its own run created.");
          const bound = data.tasks.find((x) => x.id === agent.taskId);
          if (!(agent.taskId === t.parentId || bound?.parentId === t.parentId)) return no("The run must be bound to the parent or to one of its subtasks.");
          if (t.everClaimed) return no("The subtask has been claimed; only a human may cancel it now.");
        }
      }
      if (terminal(t)) return no(`The task is already ${t.state}.`);
      return agent && t.parentId !== null && t.state !== "approved" ? no("An agent may cancel its subtask only while it is approved and never claimed.") : yes;
    case "addBlocker":
      if (agent) {
        if (t.id !== agent.taskId) return no("An agent may add a blocker only to the task its run is bound to.");
        if (!own && t.state !== "in_review") return no("An agent adds blockers as the task's claimant or reviewer.");
      }
      return terminal(t) ? no(`The task is ${t.state}.`) : yes;
    case "resolveBlocker": {
      const blockers = data.blockers.filter((b) => b.taskId === t.id && !b.resolvedAt);
      if (!blockers.length) return no("The task has no open blockers.");
      return blockers.some((b) => blockerAvailability(t, b, actor, data).enabled) ? yes : no("None of the open blockers can be resolved by this actor.");
    }
    case "move":
      return t.parentId === null && t.queuePosition === null ? no("The task is not in the project queue.") : yes;
  }
}
export function allowedActions(t: Task, actor: Actor | null, data: AvailabilityData): AllowedActions {
  return Object.fromEntries(taskActionKeySchema.options.map((key) => [key, actionAvailability(t, key, actor, data)])) as AllowedActions;
}
