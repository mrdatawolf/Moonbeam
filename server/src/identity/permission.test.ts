import { describe, expect, it } from "vitest";
import type { AgentActor, HumanActor } from "./actor.js";
import { checkPermission, HUMAN_ONLY_ACTIONS } from "./permission.js";

const human: HumanActor = { kind: "human", userId: "u", displayName: "A", email: "a@x.y", identityMode: "selected" };
const agent: AgentActor = { kind: "agent", runId: "r", taskId: "t", projectId: "p", role: "implementer", model: "m", credentialId: "c" };

describe("checkPermission (CONTRACT-002 V1 policy)", () => {
  it("never denies a human", () => {
    for (const a of HUMAN_ONLY_ACTIONS) expect(checkPermission(human, a).allow).toBe(true);
  });

  it("denies agents every human-only action, whatever the target", () => {
    for (const a of HUMAN_ONLY_ACTIONS) {
      const d = checkPermission(agent, a, { projectId: "p", taskId: "t", bindingTaskIds: new Set(["t"]) });
      expect(d).toMatchObject({ allow: false, category: "authority_violation" });
    }
  });

  it("denies agents targets outside their binding or project", () => {
    expect(checkPermission(agent, "claim", { projectId: "q" })).toMatchObject({ category: "not_permitted" });
    expect(checkPermission(agent, "claim", { projectId: "p", taskId: "x", bindingTaskIds: new Set(["t"]) })).toMatchObject({
      category: "not_permitted",
    });
    expect(checkPermission(agent, "claim", { projectId: "p", taskId: "t", bindingTaskIds: new Set(["t"]) }).allow).toBe(true);
  });

  it("lets agents read their whole project and nothing else", () => {
    expect(checkPermission(agent, "read", { projectId: "p", taskId: "other" }).allow).toBe(true);
    expect(checkPermission(agent, "read", { projectId: "q" }).allow).toBe(false);
  });

  it("lists the human-only actions of CONTRACT-002 that TASK-006 implements", () => {
    expect([...HUMAN_ONLY_ACTIONS].sort()).toEqual(
      [
        "accept",
        "add_user",
        "approve",
        "break_claim",
        "cancel_beyond_agent_allowance",
        "deactivate_user",
        "edit_user",
        "first_run_setup",
        "move",
        "reactivate_user",
        "register_project",
        "return",
        "set_projects_root",
        "start_run",
      ].sort(),
    );
  });
});
