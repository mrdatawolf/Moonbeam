import { describe, expect, it } from "vitest";
import type { schema } from "@moonbeam/db";
import { taskActionKeySchema } from "@moonbeam/shared";
import type { AgentActor, HumanActor } from "../identity/actor.js";
import { actionAvailability, allowedActions, blockerAvailability, type AvailabilityData } from "./availability.js";

type Task = typeof schema.tasks.$inferSelect;
const now = new Date();
const human: HumanActor = { kind: "human", userId: "u", displayName: "A", email: "a@x.y", identityMode: "selected" };
const agent: AgentActor = { kind: "agent", runId: "r", taskId: "t", projectId: "p", role: "implementer", model: "m", credentialId: "c" };
function task(patch: Partial<Task> = {}): Task {
  return { id: "t", projectId: "p", number: 1, parentId: null, title: "Title", desiredOutcome: "Outcome", acceptanceCriteria: ["Criterion"],
    envelope: { inclusions: [{ key: "I1", text: "Scope", derivedFrom: null }], exclusions: [], contracts: [], constraints: [], paths: ["src"] },
    state: "proposed", authorKind: "human", authorUserId: "u", authorRunId: null, originTaskId: null, queuePosition: null, siblingPosition: null,
    approvedAt: null, approvedByUserId: null, enteredReviewBy: null, latestHandoffId: null, returnNotes: null, acceptedAt: null, acceptedByUserId: null,
    acceptedCommit: null, reviewWaiverReason: null, workOnMain: false, fellBackAt: null, everClaimed: false, pendingCompletionReviewId: null,
    createdAt: now, updatedAt: now, ...patch };
}
function data(t: Task, others: Task[] = []): AvailabilityData {
  return { tasks: [t, ...others], claims: new Map(), openBlockerTasks: new Set(), pausedTasks: new Set(), blockers: [], handoffs: [] };
}
function claim(d: AvailabilityData, runId: string | null = null, taskId = "t") {
  d.claims.set(taskId, { id: "c", taskId, claimantKind: runId ? "agent" : "human", userId: runId ? null : "u", runId, startedAt: now,
    leaseExpiresAt: null, leaseSuspendedRemainingMs: null, lastRenewedAt: null, endedAt: null, endReason: null });
}

describe("server action availability", () => {
  it("gives viewers a reason for every action", () => {
    const t = task();
    const result = allowedActions(t, null, data(t));
    expect(Object.keys(result)).toEqual(taskActionKeySchema.options);
    for (const value of Object.values(result)) expect(value).toEqual({ enabled: false, reason: "Choose who you are to take this action" });
  });
  it.each(["proposed", "approved", "in_progress", "in_review", "completed", "cancelled"] as const)("enforces human edit/approval/claim/review gates in %s", (state) => {
    const t = task({ state }); const d = data(t); if (state === "in_progress") claim(d);
    const a = allowedActions(t, human, d);
    expect(a.edit.enabled).toBe(state === "proposed");
    expect(a.approve.enabled).toBe(state === "proposed");
    expect(a.claim.enabled).toBe(state === "approved");
    expect(a.release.enabled).toBe(state === "in_progress");
    expect(a.handoff.enabled).toBe(state === "in_progress");
    expect(a.accept.enabled).toBe(state === "in_review");
    expect(a.return.enabled).toBe(state === "in_review");
    expect(a.cancel.enabled).toBe(!["completed", "cancelled"].includes(state));
    expect(a.addBlocker.enabled).toBe(a.cancel.enabled);
    expect(a.recordReview.enabled).toBe(false);
    expect(a.renew.enabled).toBe(false);
    for (const v of Object.values(a)) if (!v.enabled) expect(v.reason.length).toBeGreaterThan(0);
  });
  it("allows any human and only the authoring run to edit a proposal", () => {
    const t = task({ id: "proposal", authorRunId: "r", authorKind: "agent" }); const d = data(t, [task()]);
    expect(actionAvailability(t, "edit", human, d).enabled).toBe(true);
    expect(actionAvailability(t, "edit", agent, d).enabled).toBe(true);
    expect(actionAvailability(t, "edit", { ...agent, runId: "other", taskId: t.id }, d).enabled).toBe(false);
    t.state = "approved";
    expect(actionAvailability(t, "edit", agent, d).enabled).toBe(false);
  });
  it("checks approval content and paths on the server", () => {
    const t = task({ acceptanceCriteria: [] }); t.envelope.inclusions = []; t.envelope.paths = ["*.ts"];
    const a = actionAvailability(t, "approve", human, data(t));
    expect(a).toMatchObject({ enabled: false, reason: expect.stringMatching(/inclusion.*criterion.*glob/i) });
  });
  it("respects dependency completion and human/agent blocker differences", () => {
    const earlier = task({ id: "earlier", state: "completed", queuePosition: 1 });
    const t = task({ state: "approved", queuePosition: 2 }); const d = data(t, [earlier]);
    expect(actionAvailability(t, "claim", human, d).enabled).toBe(false);
    earlier.workOnMain = true;
    d.openBlockerTasks.add(t.id);
    expect(actionAvailability(t, "claim", human, d).enabled).toBe(true);
    expect(actionAvailability(t, "claim", agent, d).enabled).toBe(false);
  });
  it("checks claim ownership, handoff conditions and agent lease renewal", () => {
    const t = task({ state: "in_progress" }); const d = data(t); claim(d);
    expect(actionAvailability(t, "release", { ...human, userId: "other" }, d).enabled).toBe(true);
    expect(actionAvailability(t, "handoff", { ...human, userId: "other" }, d).enabled).toBe(false);
    expect(actionAvailability(t, "release", agent, d).enabled).toBe(false);
    claim(d, agent.runId);
    expect(actionAvailability(t, "renew", agent, d).enabled).toBe(true);
    d.pausedTasks.add(t.id);
    expect(actionAvailability(t, "renew", agent, d).enabled).toBe(true);
    expect(actionAvailability(t, "handoff", agent, d).enabled).toBe(false);
    d.pausedTasks.clear(); d.openBlockerTasks.add(t.id);
    expect(actionAvailability(t, "handoff", agent, d).enabled).toBe(false);
  });
  it("handles split parent claims, I9 fallback, I20 and claimant-only splits", () => {
    const t = task({ state: "approved" }); const sub = task({ id: "s", parentId: t.id, state: "approved" }); const d = data(t, [sub]);
    expect(actionAvailability(t, "claim", human, d).enabled).toBe(false);
    sub.state = "cancelled";
    expect(actionAvailability(t, "claim", human, d).enabled).toBe(true);
    t.state = "in_progress"; claim(d);
    expect(actionAvailability(t, "handoff", human, d).enabled).toBe(true);
    sub.state = "completed";
    expect(actionAvailability(t, "handoff", human, d).enabled).toBe(false);
    expect(actionAvailability(t, "addSubtasks", human, d).enabled).toBe(true);
    expect(actionAvailability(t, "addSubtasks", { ...human, userId: "other" }, d).enabled).toBe(false);
    d.claims.clear(); sub.state = "in_progress"; claim(d, agent.runId, sub.id);
    expect(actionAvailability(t, "addSubtasks", { ...agent, taskId: sub.id }, d).enabled).toBe(true);
  });
  it("checks reviewer independence while permitting reviews under blockers", () => {
    const t = task({ state: "in_review", enteredReviewBy: "handoff", latestHandoffId: "h" }); const d = data(t);
    d.handoffs.push({ id: "h", taskId: t.id, claimId: "c", claimantKind: "agent", userId: null, runId: agent.runId, model: "m", record: { changes: "x", validation: "v", deviations: "n", risks: "n" }, commit: null, createdAt: now });
    d.openBlockerTasks.add(t.id);
    expect(actionAvailability(t, "recordReview", agent, d).enabled).toBe(false);
    expect(actionAvailability(t, "recordReview", { ...agent, runId: "reviewer" }, d).enabled).toBe(true);
    expect(actionAvailability(t, "accept", human, d).enabled).toBe(false);
    expect(actionAvailability(t, "return", human, d).enabled).toBe(true);
  });
  it("supports exact blocker author rules including integration blockers", () => {
    const t = task(); const d = data(t);
    const b: typeof schema.blockers.$inferSelect = { id: "b", taskId: t.id, kind: "manual", whatIsNeeded: "x", whoCanResolve: "x", effect: "x", details: null,
      addedByKind: "agent", addedByUserId: null, addedByRunId: "r", addedAt: now, resolvedAt: null, resolvedByKind: null, resolvedByUserId: null, resolvedByRunId: null, resolution: null };
    d.blockers.push(b);
    expect(blockerAvailability(t, b, agent, d).enabled).toBe(true);
    expect(blockerAvailability(t, b, { ...agent, runId: "other" }, d).enabled).toBe(false);
    b.kind = "integration";
    expect(blockerAvailability(t, b, agent, d).enabled).toBe(false);
    expect(blockerAvailability(t, b, human, d).enabled).toBe(true);
    b.resolvedAt = now;
    expect(blockerAvailability(t, b, human, d).enabled).toBe(false);
  });
  it("enforces binding and all fixed human-only actions before lifecycle checks", () => {
    const t = task({ projectId: "elsewhere", state: "completed" }); const d = data(t);
    for (const key of ["approve", "accept", "return", "move"] as const) expect(actionAvailability(t, key, agent, d)).toMatchObject({ enabled: false, reason: expect.stringContaining("human-only") });
    expect(actionAvailability(t, "edit", agent, d)).toMatchObject({ enabled: false, reason: expect.stringContaining("project") });
  });
  it("limits agent cancellations to own proposals and never-claimed authored subtasks", () => {
    const parent = task({ state: "in_progress" }); const t = task({ id: "s", parentId: parent.id, state: "approved", authorKind: "agent", authorRunId: "r" }); const d = data(t, [parent]);
    expect(actionAvailability(t, "cancel", agent, d).enabled).toBe(true);
    t.everClaimed = true;
    expect(actionAvailability(t, "cancel", agent, d).enabled).toBe(false);
    t.everClaimed = false; t.authorRunId = "another";
    expect(actionAvailability(t, "cancel", agent, d).enabled).toBe(false);
    expect(actionAvailability(parent, "cancel", agent, d).enabled).toBe(false);
  });
});
