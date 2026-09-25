import { describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  createTaskInputSchema,
  failureCategorySchema,
  failureHttpStatus,
  subtaskInputSchema,
} from "./index.js";

describe("failure categories", () => {
  it("every category has an HTTP status", () => {
    for (const c of failureCategorySchema.options) expect(failureHttpStatus[c]).toBeGreaterThanOrEqual(400);
  });

  it("parses an error body", () => {
    expect(apiErrorSchema.parse({ error: { category: "conflict", message: "Claimed" } }).error.category).toBe("conflict");
    expect(apiErrorSchema.safeParse({ error: { category: "nope", message: "x" } }).success).toBe(false);
  });
});

describe("action inputs", () => {
  it("T1 needs only a title and a desired outcome; the envelope defaults to empty", () => {
    const parsed = createTaskInputSchema.parse({ title: "t", desiredOutcome: "o" });
    expect(parsed.envelope).toEqual({ inclusions: [], exclusions: [], constraints: [], contracts: [], paths: [] });
    expect(createTaskInputSchema.safeParse({ title: " ", desiredOutcome: "o" }).success).toBe(false);
  });

  it("a subtask needs acceptance criteria, an inclusion derived from the parent, and explicit paths", () => {
    const ok = {
      title: "s",
      desiredOutcome: "o",
      acceptanceCriteria: ["c"],
      envelope: { inclusions: [{ text: "x", derivedFrom: "I1" }], paths: [] },
    };
    expect(subtaskInputSchema.safeParse(ok).success).toBe(true);
    expect(subtaskInputSchema.safeParse({ ...ok, acceptanceCriteria: [] }).success).toBe(false);
    expect(subtaskInputSchema.safeParse({ ...ok, envelope: { inclusions: [{ text: "x" }], paths: [] } }).success).toBe(false);
    expect(subtaskInputSchema.safeParse({ ...ok, envelope: { inclusions: [{ text: "x", derivedFrom: "I1" }] } }).success).toBe(false);
  });
});
