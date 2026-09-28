// CONTRACT-003 SV: the status vocabulary shared by every Moonbeam screen.
// One label per concept (sentence case), one tone (SV-1), and a glyph whose
// shape differs between statuses of the same family (SV-2). The phase-2 subset:
// task states, task conditions, review verdicts, review sub-status, the
// same-model warning and "Not merged". Run, pause, check, scope, branch and
// push statuses arrive with phase 3 and 4.
import type { ReviewVerdict, TaskDetail, TaskState, TaskSummary } from "@moonbeam/shared";

export type Tone = "neutral" | "live" | "attention" | "review" | "success" | "danger";

export type Glyph =
  | "circle-dashed"
  | "circle"
  | "circle-half"
  | "circle-dot"
  | "circle-check"
  | "circle-slash"
  | "octagon"
  | "octagon-outline"
  | "pause"
  | "triangle"
  | "diamond"
  | "hourglass"
  | "square-dashed"
  | "branch";

export interface StatusDef {
  /** The family, read before the label by screen readers ("Task state: In review"). */
  family: string;
  label: string;
  tone: Tone;
  glyph: Glyph;
}

const def = (family: string, label: string, tone: Tone, glyph: Glyph): StatusDef => ({ family, label, tone, glyph });

export const TASK_STATE: Record<TaskState, StatusDef> = {
  proposed: def("Task state", "Proposed", "neutral", "circle-dashed"),
  approved: def("Task state", "Approved", "neutral", "circle"),
  in_progress: def("Task state", "In progress", "live", "circle-half"),
  in_review: def("Task state", "In review", "review", "circle-dot"),
  completed: def("Task state", "Completed", "success", "circle-check"),
  cancelled: def("Task state", "Cancelled", "neutral", "circle-slash"),
};

/** Conditions are badges on top of the state, never a state (CONTRACT-005 UX). */
export const CONDITION = {
  blocked: def("Condition", "Blocked", "danger", "octagon"),
  blockedByParent: def("Condition", "Blocked by parent", "danger", "octagon-outline"),
  paused: def("Condition", "Paused", "attention", "pause"),
} as const;

export const REVIEW_VERDICT: Record<ReviewVerdict | "none" | "waived", StatusDef> = {
  pass: def("Agent review", "Pass", "success", "circle-check"),
  changes_required: def("Agent review", "Changes required", "attention", "triangle"),
  human_decision_required: def("Agent review", "Human decision required", "attention", "diamond"),
  none: def("Agent review", "Not reviewed", "neutral", "square-dashed"),
  waived: def("Agent review", "Review waived", "neutral", "circle-slash"),
};

/** Shown only with In review (SV-3). Phase 2 has no live reviewer runs or accepting state. */
export const REVIEW_SUBSTATUS = {
  awaitingAgentReview: def("Review", "Awaiting agent review", "review", "hourglass"),
  awaitingDecision: def("Review", "Awaiting decision", "review", "circle-dot"),
} as const;

export const WARNING = {
  sameModel: def("Warning", "Same model as implementer", "attention", "triangle"),
} as const;

export const INTEGRATION = {
  notMerged: def("Integration", "Not merged", "attention", "branch"),
} as const;

/** Conditions of a task, in SV-4 precedence order. */
export function conditionsOf(task: Pick<TaskSummary, "paused" | "blocked" | "effectivelyBlocked">): StatusDef[] {
  const out: StatusDef[] = [];
  if (task.paused) out.push(CONDITION.paused);
  if (task.blocked) out.push(CONDITION.blocked);
  else if (task.effectivelyBlocked) out.push(CONDITION.blockedByParent);
  return out;
}

/**
 * SV-4 headline status: the one that most needs a human, where only one fits.
 * Phase 2 has no runs or merges, so the order is paused, blocked, then the
 * lifecycle state.
 */
export function headlineStatus(task: Pick<TaskSummary, "state" | "paused" | "blocked" | "effectivelyBlocked">): StatusDef {
  return conditionsOf(task)[0] ?? TASK_STATE[task.state];
}

/** The latest handoff of a task (the attempt the decision is about). */
export function latestHandoff(task: Pick<TaskDetail, "handoffs">) {
  return [...task.handoffs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

/** Reviews recorded against the latest handoff, newest first. */
export function reviewsOfLatestAttempt(task: Pick<TaskDetail, "handoffs" | "reviews">) {
  const h = latestHandoff(task);
  if (!h) return [];
  return task.reviews.filter((r) => r.handoffId === h.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The review sub-status of an In review task (SV-3), or null for other states. */
export function reviewSubstatus(task: Pick<TaskDetail, "state" | "enteredReviewBy" | "handoffs" | "reviews">): StatusDef | null {
  if (task.state !== "in_review") return null;
  if (task.enteredReviewBy === "subtasks") return REVIEW_SUBSTATUS.awaitingDecision;
  return reviewsOfLatestAttempt(task).length ? REVIEW_SUBSTATUS.awaitingDecision : REVIEW_SUBSTATUS.awaitingAgentReview;
}

/** Board columns, in lifecycle order. */
export const BOARD_STATES: readonly TaskState[] = ["proposed", "approved", "in_progress", "in_review", "completed", "cancelled"];
