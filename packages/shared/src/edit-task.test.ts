import { describe, expect, it } from "vitest";
import { actionAvailabilitySchema, allowedActionsSchema, editTaskInputSchema, taskActionKeySchema } from "./lifecycle.js";

describe("T17 input", () => {
  it("keeps omitted fields absent and trims supplied text", () => {
    expect(editTaskInputSchema.parse({ title: " New title " })).toEqual({ title: "New title" });
    expect(editTaskInputSchema.parse({})).toEqual({});
  });
  it.each(["author", "state", "queuePosition", "projectId", "parentId", "approvedAt"])("rejects non-editable field %s", (field) => {
    expect(editTaskInputSchema.safeParse({ title: "New", [field]: null }).success).toBe(false);
  });
  it.each(["title", "desiredOutcome"])("does not allow clearing %s", (field) => {
    expect(editTaskInputSchema.safeParse({ [field]: "  " }).success).toBe(false);
  });
  it("allows clearing optional content and rejects unknown envelope fields", () => {
    expect(editTaskInputSchema.parse({ acceptanceCriteria: [], envelope: {} })).toEqual({ acceptanceCriteria: [], envelope: { inclusions: [], exclusions: [], paths: [], constraints: [], contracts: [] } });
    expect(editTaskInputSchema.safeParse({ envelope: { owner: "someone" } }).success).toBe(false);
  });
});
describe("action availability response", () => {
  it("requires a nonempty reason for every disallowed action", () => {
    expect(actionAvailabilitySchema.safeParse({ enabled: false }).success).toBe(false);
    expect(actionAvailabilitySchema.safeParse({ enabled: false, reason: "" }).success).toBe(false);
    const actions = Object.fromEntries(taskActionKeySchema.options.map((key) => [key, { enabled: false, reason: "Choose a user" }]));
    expect(allowedActionsSchema.safeParse(actions).success).toBe(true);
    delete actions.edit;
    expect(allowedActionsSchema.safeParse(actions).success).toBe(false);
  });
});
