// CONTRACT-002 "Check permission". V1 policy: humans are always allowed; an
// agent is denied every human-only action (`authority_violation`) and, for
// everything else, any target outside its run's binding (`not_permitted`).
// Lifecycle relationships (claimant, author, reviewer) are checked afterwards
// by the lifecycle service (CONTRACT-005).
import type { Actor } from "./actor.js";

export type ActionName =
  // CONTRACT-005
  | "create_task"
  | "edit"
  | "approve"
  | "claim"
  | "release"
  | "break_claim"
  | "renew"
  | "handoff"
  | "record_review"
  | "accept"
  | "return"
  | "add_subtasks"
  | "cancel"
  | "cancel_beyond_agent_allowance"
  | "add_blocker"
  | "resolve_blocker"
  | "move"
  | "read"
  // CONTRACT-002 / CONTRACT-004 B13
  | "start_run"
  | "end_run"
  | "first_run_setup"
  | "add_user"
  | "edit_user"
  | "deactivate_user"
  | "reactivate_user"
  | "set_projects_root"
  | "register_project";

/**
 * The fixed human-only list (CONTRACT-002 "Human-only actions") restricted to
 * the actions TASK-006 implements. Merge into main, push, relink and answering
 * a pause are human-only too but have no endpoint yet. `accept` covers the
 * review waiver and "accept anyway"; `return` covers adding subtasks with it.
 */
export const HUMAN_ONLY_ACTIONS: ReadonlySet<ActionName> = new Set<ActionName>([
  "approve",
  "accept",
  "return",
  "move",
  "break_claim",
  "cancel_beyond_agent_allowance",
  "start_run",
  "first_run_setup",
  "add_user",
  "edit_user",
  "deactivate_user",
  "reactivate_user",
  "set_projects_root",
  "register_project",
]);

export type PermissionDecision =
  | { allow: true }
  | { allow: false; category: "authority_violation" | "not_permitted"; reason: string };

export interface PermissionTarget {
  /** Project of the target; `undefined` when the action has no project target. */
  projectId?: string;
  /** Task targeted, when there is one. */
  taskId?: string;
  /**
   * The tasks within the agent run's binding (CONTRACT-002 "Agent run
   * credentials"), computed by the caller from the run's bound task.
   */
  bindingTaskIds?: ReadonlySet<string>;
  /** Whether the target is a user record (agents may never change the registry). */
  userRecord?: boolean;
}

export function checkPermission(actor: Actor, action: ActionName, target: PermissionTarget = {}): PermissionDecision {
  if (actor.kind === "human") return { allow: true };

  if (HUMAN_ONLY_ACTIONS.has(action)) {
    return {
      allow: false,
      category: "authority_violation",
      reason: `Agents may not ${action.replaceAll("_", " ")}: it is a human-only action.`,
    };
  }
  if (target.userRecord) {
    return { allow: false, category: "not_permitted", reason: "Agents may not act on user records." };
  }
  if (target.projectId !== undefined && target.projectId !== actor.projectId) {
    return { allow: false, category: "not_permitted", reason: "The target is outside the run's project." };
  }
  if (action === "read") return { allow: true };
  if (target.taskId !== undefined && !target.bindingTaskIds?.has(target.taskId)) {
    return { allow: false, category: "not_permitted", reason: "The task is outside the run's binding." };
  }
  return { allow: true };
}
