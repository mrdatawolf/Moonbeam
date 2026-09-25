import { taskStateSchema } from "@moonbeam/shared";
import { describe, expect, it } from "vitest";
import { detail, handoff } from "../test/fixtures";
import { CONDITION, headlineStatus, REVIEW_SUBSTATUS, REVIEW_VERDICT, reviewSubstatus, TASK_STATE, type StatusDef } from "./status";

const uniqueGlyphs = (defs: StatusDef[]) => new Set(defs.map((d) => d.glyph)).size === defs.length;

describe("status vocabulary (CONTRACT-003 SV)", () => {
  it("labels every task state in sentence case with the SV-3 tone", () => {
    for (const s of taskStateSchema.options) expect(TASK_STATE[s].label).toMatch(/^[A-Z][a-z ]+$/);
    expect(TASK_STATE.in_progress.tone).toBe("live");
    expect(TASK_STATE.in_review.tone).toBe("review");
    expect(TASK_STATE.completed.tone).toBe("success");
    expect(CONDITION.blocked.tone).toBe("danger");
    expect(CONDITION.paused.tone).toBe("attention");
  });

  it("uses a distinct glyph shape within each family (SV-2)", () => {
    expect(uniqueGlyphs(Object.values(TASK_STATE))).toBe(true);
    expect(uniqueGlyphs(Object.values(CONDITION))).toBe(true);
    expect(uniqueGlyphs(Object.values(REVIEW_VERDICT))).toBe(true);
  });

  it("puts paused, then blocked, before the lifecycle state (SV-4)", () => {
    expect(headlineStatus(detail({ state: "in_progress", paused: true, blocked: true }))).toBe(CONDITION.paused);
    expect(headlineStatus(detail({ state: "in_progress", blocked: true }))).toBe(CONDITION.blocked);
    expect(headlineStatus(detail({ state: "approved", effectivelyBlocked: true }))).toBe(CONDITION.blockedByParent);
    expect(headlineStatus(detail({ state: "approved" }))).toBe(TASK_STATE.approved);
  });

  it("derives the review sub-status only for tasks in review", () => {
    expect(reviewSubstatus(detail({ state: "approved" }))).toBeNull();
    expect(reviewSubstatus(detail({ state: "in_review", enteredReviewBy: "handoff", handoffs: [handoff] }))).toBe(REVIEW_SUBSTATUS.awaitingAgentReview);
    expect(reviewSubstatus(detail({ state: "in_review", enteredReviewBy: "subtasks" }))).toBe(REVIEW_SUBSTATUS.awaitingDecision);
  });
});
