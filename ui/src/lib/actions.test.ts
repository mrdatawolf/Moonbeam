import { describe, expect, it } from "vitest";
import { detail, handoff, HANDOFF_ID, humanClaim, otherUser, summary, user, USER_ID } from "../test/fixtures";
import { availability, CHOOSE_USER, CONNECTION_LOST, needsReviewWaiver, releaseMode, type ActionKey } from "./actions";

const ctx = { userId: USER_ID };
const enabled = (t: ReturnType<typeof detail>, k: ActionKey) => availability(t, k, ctx).enabled;
const reason = (t: ReturnType<typeof detail>, k: ActionKey) => {
  const a = availability(t, k, ctx);
  return a.enabled ? null : a.reason;
};
const review = (over: Partial<ReturnType<typeof detail>["reviews"][number]> = {}) => ({
  id: "88888888-8888-4888-8888-888888888888",
  handoffId: HANDOFF_ID,
  reviewerRunId: "99999999-9999-4999-8999-999999999999",
  reviewerModel: "gpt-x",
  verdict: "pass" as const,
  findings: [],
  sameModel: false,
  createdAt: "2026-09-25T10:05:00.000Z",
  ...over,
});

describe("action availability", () => {
  it("requires a selected user for every action, and a connection", () => {
    const t = detail();
    for (const k of ["approve", "claim", "release", "handoff", "accept", "return", "cancel", "addBlocker"] as ActionKey[]) {
      expect(availability(t, k, { userId: null })).toEqual({ enabled: false, reason: CHOOSE_USER });
    }
    expect(availability(t, "approve", { userId: USER_ID, connectionLost: true })).toEqual({ enabled: false, reason: CONNECTION_LOST });
  });

  it("approve: proposed top-level task with an inclusion, a criterion and plain paths", () => {
    expect(enabled(detail(), "approve")).toBe(true);
    expect(reason(detail({ state: "approved" }), "approve")).toMatch(/Only a proposed task/);
    expect(reason(detail({ parentId: user.id }), "approve")).toMatch(/Subtasks are approved automatically/);
    expect(reason(detail({ acceptanceCriteria: [] }), "approve")).toMatch(/acceptance criterion/);
    const env = detail().envelope;
    expect(reason(detail({ envelope: { ...env, inclusions: [] } }), "approve")).toMatch(/inclusion/);
    expect(reason(detail({ envelope: { ...env, paths: ["src/*.ts"] } }), "approve")).toMatch(/glob/);
    expect(reason(detail({ envelope: { ...env, paths: ["../x"] } }), "approve")).toMatch(/leaves the repository root/);
    expect(reason(detail({ envelope: { ...env, paths: ["/abs"] } }), "approve")).toMatch(/absolute/);
    expect(enabled(detail({ envelope: { ...env, paths: [] } }), "approve")).toBe(true);
  });

  it("claim: approved, unclaimed, no open subtasks, no unfinished path dependency; blocked allowed for humans", () => {
    expect(enabled(detail({ state: "approved" }), "claim")).toBe(true);
    expect(enabled(detail({ state: "approved", blocked: true }), "claim")).toBe(true);
    expect(reason(detail({ state: "proposed" }), "claim")).toMatch(/Only an approved task/);
    expect(reason(detail({ state: "in_progress", claim: humanClaim(otherUser) }), "claim")).toMatch(/Already claimed by Dana/);
    expect(reason(detail({ state: "approved", subtasks: [summary({ state: "approved", parentId: user.id })] }), "claim")).toMatch(/through its subtasks/);
    const dep = { kind: "queue" as const, taskId: user.id, number: 7, title: "Earlier", state: "in_progress" as const, finished: false };
    expect(reason(detail({ state: "approved", dependsOn: [dep] }), "claim")).toMatch(/Waiting for #7/);
    expect(enabled(detail({ state: "approved", dependsOn: [{ ...dep, finished: true }] }), "claim")).toBe(true);
  });

  it("release reads as release for the claimant and break claim for anyone else", () => {
    const mine = detail({ state: "in_progress", claim: humanClaim(user) });
    const theirs = detail({ state: "in_progress", claim: humanClaim(otherUser) });
    expect(releaseMode(mine, USER_ID)).toBe("release");
    expect(releaseMode(theirs, USER_ID)).toBe("break");
    expect(enabled(theirs, "release")).toBe(true);
    expect(reason(detail({ state: "approved" }), "release")).toMatch(/No one holds a claim/);
  });

  it("hand off: only the claimant, not blocked, not paused", () => {
    expect(enabled(detail({ state: "in_progress", claim: humanClaim(user) }), "handoff")).toBe(true);
    expect(reason(detail({ state: "in_progress", claim: humanClaim(otherUser) }), "handoff")).toMatch(/Only the claimant/);
    expect(reason(detail({ state: "in_progress", claim: humanClaim(user), blocked: true }), "handoff")).toMatch(/blocked/);
    expect(reason(detail({ state: "in_progress", claim: humanClaim(user), paused: true }), "handoff")).toMatch(/paused/);
  });

  it("accept and return: only a top-level task in review; accept not while blocked or with open subtasks", () => {
    const inReview = detail({ state: "in_review", enteredReviewBy: "handoff", handoffs: [handoff], reviews: [review()] });
    expect(enabled(inReview, "accept")).toBe(true);
    expect(enabled(inReview, "return")).toBe(true);
    expect(reason(detail({ state: "approved" }), "accept")).toMatch(/Only a task in review/);
    expect(reason({ ...inReview, parentId: user.id }, "accept")).toMatch(/Subtasks aren't accepted individually/);
    expect(reason({ ...inReview, parentId: user.id }, "return")).toMatch(/Subtasks aren't returned individually/);
    expect(reason({ ...inReview, blocked: true }, "accept")).toMatch(/blocked task cannot be accepted/);
    expect(enabled({ ...inReview, blocked: true }, "return")).toBe(true);
    expect(reason({ ...inReview, subtasks: [summary({ state: "in_progress" })] }, "accept")).toMatch(/not done/);
  });

  it("accept needs the review waiver when no review is recorded against the latest handoff", () => {
    const base = detail({ state: "in_review", enteredReviewBy: "handoff", handoffs: [handoff] });
    expect(needsReviewWaiver(base)).toBe(true);
    expect(needsReviewWaiver({ ...base, reviews: [review()] })).toBe(false);
    expect(needsReviewWaiver({ ...base, reviews: [review({ handoffId: null })] })).toBe(true);
    expect(needsReviewWaiver({ ...base, enteredReviewBy: "subtasks" })).toBe(false);
  });

  it("cancel and add blocker: any non-terminal task", () => {
    expect(enabled(detail({ state: "in_review" }), "cancel")).toBe(true);
    expect(reason(detail({ state: "completed" }), "cancel")).toMatch(/Completed/);
    expect(reason(detail({ state: "cancelled" }), "addBlocker")).toMatch(/Cancelled/);
  });
});
