// Browser readiness only. Lifecycle availability and refusal reasons come from the API.
import type { ActionAvailability, TaskDetail } from "@moonbeam/shared";
import { reviewsOfLatestAttempt } from "./status";
export type Availability = ActionAvailability;
export const CHOOSE_USER = "Choose who you are to take this action";
export const CONNECTION_LOST = "Connection lost. Retrying.";
export function browserAvailability(action: Availability, ctx: { userId: string | null; connectionLost?: boolean }): Availability {
  if (!ctx.userId) return { enabled: false, reason: CHOOSE_USER };
  if (ctx.connectionLost) return { enabled: false, reason: CONNECTION_LOST };
  return action;
}
/** How the release button reads: the claimant releases, anyone else breaks the claim (T4). */
export function releaseMode(task: TaskDetail, userId: string | null): "release" | "break" {
  const c = task.claim;
  return c && c.claimantKind === "human" && c.userId === userId ? "release" : "break";
}

/** Whether accepting needs the review waiver (A5): entered by handoff, no review on the latest handoff. */
export function needsReviewWaiver(task: TaskDetail): boolean {
  return task.enteredReviewBy === "handoff" && reviewsOfLatestAttempt(task).length === 0;
}

export function dependencyKindLabel(kind: "queue" | "inherited" | "sibling"): string {
  return kind === "queue" ? "earlier in the queue" : kind === "inherited" ? "inherited from the parent" : "earlier sibling";
}
