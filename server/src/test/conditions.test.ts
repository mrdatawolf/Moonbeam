// CONTRACT-005 C1, C2 (data only), claim expiry (T5), lease suspension and renewal.
import { afterEach, describe, expect, it } from "vitest";
import { approvedTask, expectOk, expectRejected, getTask, handoffBody, startRun, world, type World } from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

const MIN = 60_000;
const blockerBody = { whatIsNeeded: "Credentials", whoCanResolve: "Patrick", effect: "Cannot run tests" };

async function agentClaim(model = "m") {
  const t = await approvedTask(w);
  const run = await startRun(w, t.id, model);
  const res = await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as });
  expectOk(res);
  return { t, run, deadline: Date.parse(res.body.task.claim.leaseDeadline) };
}

describe("T5 Claim ends automatically", () => {
  it("an agent-run lease expires at its deadline; the record carries the deadline as effective time", async () => {
    w = await world();
    const { t, deadline } = await agentClaim();
    w.h.clock.advance(29 * MIN);
    expect((await getTask(w, t.id)).state).toBe("in_progress");
    w.h.clock.advance(2 * MIN);
    const d = await getTask(w, t.id);
    expect(d).toMatchObject({ state: "approved", claim: null });
    const rec = d.audit.at(-1)!;
    expect(rec).toMatchObject({ action: "claim_expired", actor: { kind: "system", systemTrigger: "claim_expired" }, toState: "approved" });
    expect(Date.parse(rec.occurredAt)).toBe(deadline);
  });

  it("an action after the deadline sees the claim as expired (handoff racing expiry)", async () => {
    w = await world();
    const { t, run } = await agentClaim();
    w.h.clock.advance(31 * MIN);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: run.as, body: handoffBody() }), "invalid_transition", 409);
    expect((await getTask(w, t.id)).audit.map((a) => a.action)).toContain("claim_expired");
  });

  it("renewal extends the lease and is not audited", async () => {
    w = await world();
    const { t, run, deadline } = await agentClaim();
    const before = (await getTask(w, t.id)).audit.length;
    w.h.clock.advance(20 * MIN);
    const res = await w.h.req("POST", `/tasks/${t.id}/renew`, { as: run.as });
    expectOk(res);
    expect(Date.parse(res.body.task.claim.leaseDeadline)).toBeGreaterThan(deadline + 19 * MIN);
    expect(res.body.audit).toEqual([]);
    expect((await getTask(w, t.id)).audit.length).toBe(before);
    w.h.clock.advance(20 * MIN);
    expect((await getTask(w, t.id)).state).toBe("in_progress");
  });

  it("human claims never expire", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
    w.h.clock.advance(365 * 24 * 60 * MIN);
    await w.h.lifecycle.sweepExpiredClaims();
    expect((await getTask(w, t.id)).claim?.userId).toBe(w.alice.id);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/renew`, { as: w.A }), "invalid_transition", 409);
  });

  it("a run that ends without handoff ends its claim, and its credential stops working", async () => {
    w = await world();
    const { t, run } = await agentClaim();
    const res = await w.h.req("POST", `/dev/runs/${run.runId}/end`, { as: w.A, body: { status: "failed" } });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "approved", claim: null });
    expect(res.body.audit[0]).toMatchObject({ action: "claim_ended_run_finished", details: { runOutcome: "failed" } });
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }), "unidentified", 401);
  });
});

describe("C1 Blocked", () => {
  it("blocking and unblocking never change the state; the agent-run lease is suspended while blocked", async () => {
    w = await world();
    const { t, run, deadline } = await agentClaim();
    w.h.clock.advance(10 * MIN);
    const added = await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: run.as, body: blockerBody });
    expectOk(added);
    expect(added.body.task).toMatchObject({ state: "in_progress", blocked: true });
    expect(added.body.task.claim).toMatchObject({ leaseSuspended: true, leaseDeadline: null });
    expect(added.body.task.blockers[0].addedBy).toMatchObject({ kind: "agent", runId: run.runId });
    w.h.clock.advance(60 * MIN);
    expect((await getTask(w, t.id)).state).toBe("in_progress");
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: run.as, body: handoffBody() }), "blocked", 409);

    // The run that added the blocker may resolve it; the lease resumes with its remaining 20 minutes.
    const resolved = await w.h.req("POST", `/tasks/${t.id}/blockers/${added.body.task.blockers[0].id}/resolve`, { as: run.as });
    expectOk(resolved);
    expect(resolved.body.task.state).toBe("in_progress");
    const newDeadline = Date.parse(resolved.body.task.claim.leaseDeadline);
    expect(newDeadline - w.h.clock.now().getTime()).toBeGreaterThan(19 * MIN);
    expect(newDeadline - w.h.clock.now().getTime()).toBeLessThanOrEqual(20 * MIN + 1000);
    expect(newDeadline).toBeGreaterThan(deadline);
  });

  it("agents add blockers only to their bound task as claimant or reviewer; humans to any task", async () => {
    w = await world();
    const a = await approvedTask(w, { paths: ["a"] });
    const b = await approvedTask(w, { paths: ["b"] });
    const run = await startRun(w, a.id);
    expectRejected(await w.h.req("POST", `/tasks/${a.id}/blockers`, { as: run.as, body: blockerBody }), "not_permitted", 403);
    expectRejected(await w.h.req("POST", `/tasks/${b.id}/blockers`, { as: run.as, body: blockerBody }), "not_permitted", 403);
    const res = await w.h.req("POST", `/tasks/${b.id}/blockers`, { as: w.A, body: blockerBody });
    expectOk(res);
    expect(res.body.audit[0]).toMatchObject({ action: "blocker_added", fromState: "approved", toState: "approved" });
    expectRejected(await w.h.req("POST", `/tasks/${b.id}/blockers`, { as: w.A, body: { whatIsNeeded: "x" } }), "validation", 422);
  });

  it("an agent cannot claim a blocked task; a human can", async () => {
    w = await world();
    const t = await approvedTask(w);
    const b = await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: w.A, body: blockerBody });
    const run = await startRun(w, t.id);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }), "blocked", 409);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.B }));
    // Only a human or the adding run resolves a blocker.
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/blockers/${b.body.task.blockers[0].id}/resolve`, { as: run.as }), "not_permitted", 403);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/blockers/${b.body.task.blockers[0].id}/resolve`, { as: w.B }));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/blockers/${b.body.task.blockers[0].id}/resolve`, { as: w.B }), "invalid_transition", 409);
  });

  it("cancelling closes open blockers as moot", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: w.A, body: blockerBody }));
    const res = await w.h.req("POST", `/tasks/${t.id}/cancel`, { as: w.A, body: { reason: "x" } });
    expect(res.body.task.blockers[0]).toMatchObject({ resolution: "moot" });
    expect(res.body.task.blocked).toBe(false);
  });
});

describe("C2 Paused (data only)", () => {
  it("a pause blocks handoff and suspends the lease; release closes it as superseded", async () => {
    w = await world();
    const { t, run } = await agentClaim();
    const p = await w.h.req("POST", `/dev/runs/${run.runId}/pauses`, { as: w.A, body: { question: "Which API?" } });
    expectOk(p);
    expect(p.body.task).toMatchObject({ paused: true, state: "in_progress", claim: { leaseSuspended: true } });
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: run.as, body: handoffBody() }), "blocked", 409);
    w.h.clock.advance(120 * MIN);
    expect((await getTask(w, t.id)).state).toBe("in_progress");
    const rel = await w.h.req("POST", `/tasks/${t.id}/release`, { as: run.as, body: {} });
    expectOk(rel);
    expect(rel.body.task.pauses[0]).toMatchObject({ closeReason: "superseded" });
    expect(rel.body.task.paused).toBe(false);
  });

  it("answering the pause resumes the lease and allows handoff", async () => {
    w = await world();
    const { t, run } = await agentClaim();
    const p = await w.h.req("POST", `/dev/runs/${run.runId}/pauses`, { as: w.A, body: { question: "?" } });
    const closed = await w.h.req("POST", `/dev/pauses/${p.body.task.pauses[0].id}/close`, { as: w.A });
    expectOk(closed);
    expect(closed.body.task.claim.leaseSuspended).toBe(false);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: run.as, body: handoffBody() }));
  });
});
