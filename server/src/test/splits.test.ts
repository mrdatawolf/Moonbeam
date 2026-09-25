// CONTRACT-001 T8, T10 (split parents), T11, T12, T14, T15/T16 and the
// integration blocker (C1, Board A4).
import { afterEach, describe, expect, it } from "vitest";
import {
  approvedTask,
  auditActions,
  expectOk,
  expectRejected,
  fullEnvelope,
  getTask,
  handoffBody,
  startRun,
  subtask,
  world,
  type World,
} from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

const blockerBody = { whatIsNeeded: "Decision", whoCanResolve: "Board", effect: "Waits" };

async function split(paths: string[][] = [["src/a"], ["src/b"]]) {
  const parent = await approvedTask(w, { envelope: fullEnvelope(["src"], { exclusions: ["No UI"], contracts: ["CONTRACT-001"] }) });
  const res = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, {
    as: w.A,
    body: { subtasks: paths.map((p, i) => subtask(p, `Sub ${i + 1}`, { exclusions: ["No UI"], contracts: ["CONTRACT-001"] })) },
  });
  expectOk(res);
  return { parent: res.body.task, subs: res.body.task.subtasks as { id: string }[] };
}

/** Claim, hand off (as a run with `model`) and return the subtask's reviewer run. */
async function handOff(id: string, model = "impl-model") {
  const run = await startRun(w, id, model);
  expectOk(await w.h.req("POST", `/tasks/${id}/claim`, { as: run.as }));
  expectOk(await w.h.req("POST", `/tasks/${id}/handoff`, { as: run.as, body: handoffBody() }));
  return startRun(w, id, "review-model", "reviewer");
}

async function complete(id: string) {
  const reviewer = await handOff(id);
  expectOk(await w.h.req("POST", `/tasks/${id}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }));
}

describe("T11 Split", () => {
  it("a human splits an approved task; subtasks are born approved with audit lineage", async () => {
    w = await world();
    const { parent, subs } = await split();
    expect(parent).toMatchObject({ state: "in_progress", claim: null, isSplitParent: true });
    expect(parent.audit.at(-1)).toMatchObject({ action: "split", toState: "in_progress" });
    const approval = parent.audit.find((a: { action: string }) => a.action === "approved");
    const s = await getTask(w, subs[0]!.id);
    expect(s).toMatchObject({ state: "approved", parentId: parent.id, siblingPosition: 1, queuePosition: null });
    expect(s.audit.map((a) => a.action)).toEqual(["created_by_split", "auto_approved"]);
    expect(s.audit[1]).toMatchObject({ actor: { kind: "system" }, details: { parentApprovalAuditId: approval.id, splittingActor: { kind: "human", userId: w.alice.id } } });
    expect(s.approvedBy).toMatchObject({ kind: "system" });
  });

  it("enforces envelope narrowing and is atomic", async () => {
    w = await world();
    const parent = await approvedTask(w, { envelope: fullEnvelope(["src"], { exclusions: ["No UI"], contracts: ["C-1"] }) });
    const res = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, {
      as: w.A,
      body: {
        subtasks: [
          subtask(["src/ok"], "Good", { exclusions: ["No UI"], contracts: ["C-1"] }),
          subtask(["docs"], "Bad", { contracts: ["C-1", "C-2"] }),
        ],
      },
    });
    expectRejected(res, "validation", 422);
    const issues: string[] = res.body.error.details.issues;
    expect(issues.join("\n")).toMatch(/subtasks\[1\]: missing parent exclusion/);
    expect(issues.join("\n")).toMatch(/adds contract "C-2"/);
    expect(issues.join("\n")).toMatch(/outside the parent's paths/);
    const after = await getTask(w, parent.id);
    expect(after.subtasks).toHaveLength(0);
    expect(after.state).toBe("approved");
  });

  it("rejects nested splits", async () => {
    w = await world();
    const { subs } = await split();
    expectRejected(await w.h.req("POST", `/tasks/${subs[0]!.id}/subtasks`, { as: w.A, body: { subtasks: [subtask(["src/a"])] } }), "invalid_transition", 409);
  });

  it("the human claimant splits a claimed task and the claim ends", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: w.B, body: { subtasks: [subtask(["src"])] } }), "not_permitted", 403);
    const res = await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: w.A, body: { subtasks: [subtask(["src"])] } });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "in_progress", claim: null });
  });

  it("an agent claimant of the parent, or of a non-done sibling, adds subtasks; other runs are not_permitted", async () => {
    w = await world();
    const t = await approvedTask(w);
    const unclaimedRun = await startRun(w, t.id);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: unclaimedRun.as, body: { subtasks: [subtask(["src/a"])] } }), "not_permitted", 403);
    await w.h.req("POST", `/dev/runs/${unclaimedRun.runId}/end`, { as: w.A, body: { status: "finished" } });

    const parentRun = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: parentRun.as }));
    const r1 = await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: parentRun.as, body: { subtasks: [subtask(["src/a"])] } });
    expectOk(r1);
    expect(r1.body.task.audit.at(-1)).toMatchObject({ action: "split", actor: { kind: "agent", runId: parentRun.runId } });
    const s1 = r1.body.task.subtasks[0].id;

    const subRun = await startRun(w, s1);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: subRun.as, body: { subtasks: [subtask(["src/b"])] } }), "not_permitted", 403);
    expectOk(await w.h.req("POST", `/tasks/${s1}/claim`, { as: subRun.as }));
    const r2 = await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: subRun.as, body: { subtasks: [subtask(["src/b"])] } });
    expectOk(r2);
    expect(r2.body.task.subtasks).toHaveLength(2);
  });
});

describe("Subtask flow: T6, T7, T8, T12", () => {
  it("subtasks complete on review whatever the verdict; the parent enters review once and is accepted without its own review", async () => {
    w = await world();
    const { parent, subs } = await split();
    const reviewer = await handOff(subs[0]!.id);
    const r = await w.h.req("POST", `/tasks/${subs[0]!.id}/reviews`, {
      as: reviewer.as,
      body: { verdict: "changes_required", findings: [{ severity: "minor", text: "Naming" }] },
    });
    expectOk(r);
    expect(r.body.task.state).toBe("completed");
    expect(r.body.audit.map((a: { action: string }) => a.action)).toEqual(["review_recorded", "subtask_completed_on_review"]);
    expect(w.h.repo.integrated).toContain(subs[0]!.id);
    expect((await getTask(w, parent.id)).state).toBe("in_progress");

    await complete(subs[1]!.id);
    const p = await getTask(w, parent.id);
    expect(p).toMatchObject({ state: "in_review", enteredReviewBy: "subtasks" });
    expect(p.audit.filter((a) => a.action === "entered_review_all_subtasks_done")).toHaveLength(1);
    expectRejected(await w.h.req("POST", `/tasks/${subs[0]!.id}/accept`, { as: w.A, body: {} }), "invalid_transition", 409);
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/accept`, { as: w.A, body: {} }));
  });

  it("a reviewer adds fix subtasks with findings atomically; the parent stays in progress", async () => {
    w = await world();
    const { parent, subs } = await split([["src/a"]]);
    const reviewer = await handOff(subs[0]!.id);
    const fix = subtask(["src/a"], "Fix", { exclusions: ["No UI"], contracts: ["CONTRACT-001"] });
    const noFindings = await w.h.req("POST", `/tasks/${subs[0]!.id}/reviews`, { as: reviewer.as, body: { verdict: "pass", addSubtasks: [fix] } });
    expectRejected(noFindings, "validation", 422);
    expect((await getTask(w, parent.id)).subtasks).toHaveLength(1);

    const res = await w.h.req("POST", `/tasks/${subs[0]!.id}/reviews`, {
      as: reviewer.as,
      body: { verdict: "changes_required", findings: [{ severity: "major", text: "Bug" }], addSubtasks: [fix] },
    });
    expectOk(res);
    expect(res.body.task.state).toBe("completed");
    const p = await getTask(w, parent.id);
    expect(p.state).toBe("in_progress");
    expect(p.subtasks.map((s) => s.state)).toEqual(["completed", "approved"]);
    expect(p.audit.some((a) => a.action === "entered_review_all_subtasks_done")).toBe(false);
    const added = await getTask(w, p.subtasks[1]!.id);
    expect(added.author).toMatchObject({ kind: "agent", runId: reviewer.runId });
  });

  it("a failed integration completes the subtask and raises the system integration blocker on the parent", async () => {
    w = await world();
    const { parent, subs } = await split();
    w.h.repo.integrationFailures.set(subs[0]!.id, ["src/a/x.ts"]);
    await complete(subs[0]!.id);
    const p = await getTask(w, parent.id);
    expect((await getTask(w, subs[0]!.id)).state).toBe("completed");
    expect(p.blocked).toBe(true);
    expect(p.blockers[0]).toMatchObject({ kind: "integration", addedBy: { kind: "system" }, details: { conflictingFiles: ["src/a/x.ts"] } });
    expect(p.audit.at(-1)).toMatchObject({ action: "blocker_added", actor: { kind: "system" } });

    // The remaining subtask is effectively blocked: agents cannot claim it.
    const s2 = await getTask(w, subs[1]!.id);
    expect(s2.effectivelyBlocked).toBe(true);
    const run = await startRun(w, s2.id);
    expectRejected(await w.h.req("POST", `/tasks/${s2.id}/claim`, { as: run.as }), "blocked", 409);
    // Only a human resolves the integration blocker.
    const blockerId = p.blockers[0]!.id;
    expectRejected(await w.h.req("POST", `/tasks/${s2.id}/blockers/${blockerId}/resolve`, { as: run.as }), "not_found", 404);
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/blockers/${blockerId}/resolve`, { as: w.A }));
    expectOk(await w.h.req("POST", `/tasks/${s2.id}/claim`, { as: run.as }));
  });

  it("an agent run cannot resolve the integration blocker even on its bound parent", async () => {
    w = await world();
    const { parent, subs } = await split([["src/a"], ["src/b"]]);
    w.h.repo.integrationFailures.set(subs[0]!.id, ["f"]);
    await complete(subs[0]!.id);
    const blockerId = (await getTask(w, parent.id)).blockers[0]!.id;
    const run = await startRun(w, parent.id);
    expectRejected(await w.h.req("POST", `/tasks/${parent.id}/blockers/${blockerId}/resolve`, { as: run.as }), "not_permitted", 403);
  });
});

describe("T10 Return of a split parent", () => {
  async function parentInReview() {
    const r = await split([["src/a"]]);
    await complete(r.subs[0]!.id);
    return r;
  }

  it("with new subtasks: the parent goes to in_progress and completed subtasks stay completed", async () => {
    w = await world();
    const { parent } = await parentInReview();
    const res = await w.h.req("POST", `/tasks/${parent.id}/return`, {
      as: w.A,
      body: { reason: "Missing edge case", subtasks: [subtask(["src/a"], "Edge", { exclusions: ["No UI"], contracts: ["CONTRACT-001"] })] },
    });
    expectOk(res);
    expect(res.body.task.state).toBe("in_progress");
    expect(res.body.task.subtasks.map((s: { state: string }) => s.state)).toEqual(["completed", "approved"]);
    expect(res.body.audit.find((a: { action: string }) => a.action === "returned").details.newSubtasks).toHaveLength(1);
  });

  it("without new subtasks: approved; the claimant can add subtasks and release but not hand off", async () => {
    w = await world();
    const { parent } = await parentInReview();
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/return`, { as: w.A, body: { reason: "Redo part" } }));
    expect((await getTask(w, parent.id)).state).toBe("approved");
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/claim`, { as: w.B }));
    expectRejected(await w.h.req("POST", `/tasks/${parent.id}/handoff`, { as: w.B, body: handoffBody() }), "invalid_transition", 409);
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/release`, { as: w.B, body: {} }));
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/claim`, { as: w.B }));
    const res = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, {
      as: w.B,
      body: { subtasks: [subtask(["src/a"], "Redo", { exclusions: ["No UI"], contracts: ["CONTRACT-001"] })] },
    });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "in_progress", claim: null });
  });

  it("a leaf cannot get subtasks as part of a return", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
    expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody() }));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/return`, { as: w.A, body: { reason: "x", subtasks: [subtask(["src"])] } }), "invalid_transition", 409);
  });
});

describe("T15, T16, T12, T14: cancelling", () => {
  it("cancelling a parent cancels its non-done subtasks and ends their claims atomically; completed subtasks stay", async () => {
    w = await world();
    const { parent, subs } = await split([["src/a"], ["src/b"], ["src/c"]]);
    await complete(subs[0]!.id);
    expectOk(await w.h.req("POST", `/tasks/${subs[1]!.id}/claim`, { as: w.B }));
    const res = await w.h.req("POST", `/tasks/${parent.id}/cancel`, { as: w.A, body: { reason: "Dropped" } });
    expectOk(res);
    const p = res.body.task;
    expect(p.subtasks.map((s: { state: string }) => s.state)).toEqual(["completed", "cancelled", "cancelled"]);
    expect(p.subtasks[1].claim).toBeNull();
    const cascade = res.body.audit.filter((a: { action: string }) => a.action === "cancelled_by_parent");
    expect(cascade).toHaveLength(2);
    expect(cascade[0].actor.kind).toBe("system");
    expect(cascade[0].details.parentCancellationAuditId).toBe(res.body.audit[0].id);
  });

  it("the parent falls back to approved when all its subtasks are cancelled (T14), and can then be handed off", async () => {
    w = await world();
    const { parent, subs } = await split();
    for (const s of subs) expectOk(await w.h.req("POST", `/tasks/${s.id}/cancel`, { as: w.A, body: { reason: "x" } }));
    const p = await getTask(w, parent.id);
    expect(p).toMatchObject({ state: "approved", fellBack: true });
    expect(p.audit.at(-1)!.action).toBe("split_abandoned_all_subtasks_cancelled");
    const dq = await w.h.req("GET", `/decision-queue?projectId=${w.projectId}`);
    expect(dq.body.fellBack.map((t: { id: string }) => t.id)).toEqual([parent.id]);
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/claim`, { as: w.A }));
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/handoff`, { as: w.A, body: handoffBody() }));
  });

  it("an agent cancels a never-claimed subtask its run created, which can trigger T12; not another run's or a claimed one", async () => {
    w = await world();
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }));
    const res = await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: run.as, body: { subtasks: [subtask(["src/a"], "A"), subtask(["src/b"], "B"), subtask(["src/c"], "C")] } });
    const [a, b, c] = res.body.task.subtasks.map((s: { id: string }) => s.id);

    const otherRun = await startRun(w, t.id);
    expectRejected(await w.h.req("POST", `/tasks/${a}/cancel`, { as: otherRun.as, body: { reason: "x" } }), "not_permitted", 403);

    expectOk(await w.h.req("POST", `/tasks/${b}/claim`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/tasks/${b}/cancel`, { as: run.as, body: { reason: "x" } }), "not_permitted", 403);
    expectOk(await w.h.req("POST", `/tasks/${b}/release`, { as: w.A, body: {} }));
    expectRejected(await w.h.req("POST", `/tasks/${b}/cancel`, { as: run.as, body: { reason: "x" } }), "not_permitted", 403);

    await complete(a);
    expectOk(await w.h.req("POST", `/tasks/${c}/cancel`, { as: run.as, body: { reason: "Redundant" } }));
    expect((await getTask(w, t.id)).state).toBe("in_progress");
    expectOk(await w.h.req("POST", `/tasks/${b}/cancel`, { as: w.A, body: { reason: "Human cancels" } }));
    const p = await getTask(w, t.id);
    expect(p.state).toBe("in_review");
    expect(await auditActions(w, t.id)).toContain("entered_review_all_subtasks_done");
  });
});

describe("Blocked subtasks and deferred completion (C1)", () => {
  it("a review of a blocked subtask defers T8 until the blocker is resolved; that can trigger T12", async () => {
    w = await world();
    const { parent, subs } = await split([["src/a"]]);
    const reviewer = await handOff(subs[0]!.id);
    const blocker = await w.h.req("POST", `/tasks/${subs[0]!.id}/blockers`, { as: w.A, body: blockerBody });
    expectOk(blocker);
    expectOk(await w.h.req("POST", `/tasks/${subs[0]!.id}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }));
    expect((await getTask(w, subs[0]!.id)).state).toBe("in_review");
    const blockerId = blocker.body.task.blockers[0].id;
    const res = await w.h.req("POST", `/tasks/${subs[0]!.id}/blockers/${blockerId}/resolve`, { as: w.B });
    expectOk(res);
    expect(res.body.task.state).toBe("completed");
    expect((await getTask(w, parent.id)).state).toBe("in_review");
  });

  it("unblocking a parent releases subtasks, but their own blockers stay open", async () => {
    w = await world();
    const { parent, subs } = await split();
    const pb = await w.h.req("POST", `/tasks/${parent.id}/blockers`, { as: w.A, body: blockerBody });
    expectOk(await w.h.req("POST", `/tasks/${subs[0]!.id}/blockers`, { as: w.A, body: blockerBody }));
    let s1 = await getTask(w, subs[0]!.id);
    let s2 = await getTask(w, subs[1]!.id);
    expect([s1.blocked, s1.effectivelyBlocked, s2.blocked, s2.effectivelyBlocked]).toEqual([true, true, false, true]);
    // Human claims are still allowed while effectively blocked.
    expectOk(await w.h.req("POST", `/tasks/${subs[1]!.id}/claim`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/tasks/${subs[1]!.id}/handoff`, { as: w.A, body: handoffBody() }), "blocked", 409);

    const res = await w.h.req("POST", `/tasks/${parent.id}/blockers/${pb.body.task.blockers[0].id}/resolve`, { as: w.A });
    expect(res.body.audit.map((a: { action: string }) => a.action)).toEqual(["blocker_resolved"]);
    s1 = await getTask(w, subs[0]!.id);
    s2 = await getTask(w, subs[1]!.id);
    expect([s1.blocked, s1.effectivelyBlocked, s2.blocked, s2.effectivelyBlocked]).toEqual([true, false, false, false]);
    expectOk(await w.h.req("POST", `/tasks/${subs[1]!.id}/handoff`, { as: w.A, body: handoffBody() }));
  });

  it("agents cannot add subtasks while the parent is blocked; humans can", async () => {
    w = await world();
    const { parent, subs } = await split([["src/a"]]);
    const run = await startRun(w, subs[0]!.id);
    expectOk(await w.h.req("POST", `/tasks/${subs[0]!.id}/claim`, { as: run.as }));
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/blockers`, { as: w.A, body: blockerBody }));
    const body = { subtasks: [subtask(["src/b"], "More", { exclusions: ["No UI"], contracts: ["CONTRACT-001"] })] };
    expectRejected(await w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: run.as, body }), "blocked", 409);
    expectOk(await w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: w.A, body }));
  });
});
