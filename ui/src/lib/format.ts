// Shared formatters (CONTRACT-003 SV-5): one per kind of machine value.
import type { ActorRef, FailureCategory } from "@moonbeam/shared";
import type { ErrorCategory } from "../api/client";

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return absoluteTime(iso);
}

export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A person, agent, system trigger or first-run setup, as shown in history. */
export function actorLabel(a: ActorRef | null): string {
  if (!a) return "Unknown";
  switch (a.kind) {
    case "human":
      return `${a.displayName ?? "Unknown user"}${a.userActive === false ? " (inactive)" : ""}`;
    case "agent":
      return `Agent${a.role ? ` ${a.role}` : ""}${a.model ? ` (${a.model})` : ""}`;
    case "system":
      return `Moonbeam${a.systemTrigger ? ` (${a.systemTrigger.replace(/_/g, " ")})` : ""}`;
    case "setup":
      return "First-run setup";
  }
}

/** Plain-language names for the failure categories. The code itself is always shown too. */
export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  unidentified: "Not identified",
  authority_violation: "Human-only action",
  not_permitted: "Not permitted",
  not_found: "Not found",
  invalid_transition: "Not allowed in this state",
  conflict: "Changed by someone else",
  blocked: "Blocked",
  validation: "Missing or invalid input",
  merge_conflict: "Merge conflict",
  working_folder_unsafe: "Working folder unsafe",
  repository_unavailable: "Repository unavailable",
  branch_name_taken: "Branch name taken",
  history_rewritten: "History rewritten",
  connection: "Connection lost",
  unexpected: "Unexpected response",
} satisfies Record<FailureCategory | "connection" | "unexpected", string>;

/** Audit action names as sentences for the history table. */
const AUDIT_LABEL: Record<string, string> = {
  created: "Proposed",
  edited: "Proposal edited",
  approved: "Approved",
  auto_approved: "Approved automatically with the split",
  created_by_split: "Created by a split",
  claimed: "Claimed",
  claim_released: "Claim released",
  claim_expired: "Claim expired",
  claim_ended_run_finished: "Claim ended when the run ended",
  handed_off: "Handed off",
  review_recorded: "Agent review recorded",
  subtask_completed_on_review: "Completed on review",
  accepted: "Accepted",
  returned: "Returned",
  split: "Split into subtasks",
  entered_review_all_subtasks_done: "Entered review: all subtasks done",
  split_abandoned_all_subtasks_cancelled: "Fell back: all subtasks cancelled",
  cancelled: "Cancelled",
  cancelled_by_parent: "Cancelled with its parent",
  blocker_added: "Blocker added",
  blocker_resolved: "Blocker resolved",
  queue_reordered: "Moved in the queue",
  path_dependencies_changed: "Path dependencies changed",
  paused: "Paused",
  resumed: "Resumed",
  run_started: "Run started",
};

export function auditLabel(action: string, rejected: boolean): string {
  const base = AUDIT_LABEL[action] ?? action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return rejected ? `Rejected attempt: ${action.replace(/_/g, " ")}` : base;
}
