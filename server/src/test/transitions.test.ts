// CONTRACT-001 transitions T1-T10, T15: allowed actors, rejected actors,
// failure categories, and the audit records each produces.
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import {
  approvedTask,
  auditActions,
  createTask,
  expectOk,
  expectRejected,
  getTask,
  handoffBody,
  startRun,
  world,
  type World,
} from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

async function claimed(as?: World["A"]) {
  const t = await approvedTask(w);
  expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: as ?? w.A }));
  return t;
}

async function inReview(opts: { model?: string } = {}) {
  const t = await approvedTask(w);
  if (opts.model) {
    const run = await startRun(w, t.id, opts.model);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }));
    expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: run.as, body: handoffBody("c0ffee") }));
    return { t, run };
  }
  expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
  expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody("c0ffee") }));
  return { t, run: undefined };
}

async function reviewed() {
  const { t } = await inReview();
  const reviewer = await startRun(w, t.id, "gpt-5", "reviewer");
  expectOk(await w.h.req("POST", `/tasks/${t.id}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }));
  return t;
}

describe("T1 Create", () => {
  it("a human creates a proposed task, audited with identity mode selected", async () => {
    w = await world();
    const t = await createTask(w);
    expect(t.state).toBe("proposed");
    expect(t.author).toMatchObject({ kind: "human", userId: w.alice.id, displayName: "Alice" });
    expect(t.audit).toHaveLength(1);
    expect(t.audit[0]).toMatchObject({ action: "created", toState: "proposed", actor: { kind: "human", identityMode: "selected" } });
  });

  it("an agent in a run creates a proposal, attributed to the run", async () => {
    w = await world();
    const origin = await approvedTask(w);
    const run = await startRun(w, origin.id);
    const res = await w.h.req("POST", `/projects/${w.projectId}/tasks`, {
      as: run.as,
      body: { title: "Follow-up", desiredOutcome: "More" },
    });
    expectOk(res, 201);
    expect(res.body.task.author).toMatchObject({ kind: "agent", runId: run.runId, model: "claude-opus" });
    expect(res.body.task.originTaskId).toBe(origin.id);
  });

  it("requires a title and desired outcome; rejects bad paths", async () => {
    w = await world();
    expectRejected(await w.h.req("POST", `/projects/${w.projectId}/tasks`, { as: w.A, body: { title: "x" } }), "validation", 422);
    for (const bad of ["src/*.ts", "/abs", "../out"]) {
      const res = await w.h.req("POST", `/projects/${w.projectId}/tasks`, {
        as: w.A,
        body: { title: "x", desiredOutcome: "y", envelope: { inclusions: ["a"], paths: [bad] } },
      });
      expectRejected(res, "validation", 422);
    }
  });

  it("rejects a request without a selected user as unidentified", async () => {
    w = await world();
    const res = await w.h.req("POST", `/projects/${w.projectId}/tasks`, { body: { title: "x", desiredOutcome: "y" } });
    expectRejected(res, "unidentified", 401);
  });
});

describe("T2 Approve", () => {
  it("a human approves; the task joins the queue and the audit lists queue position and dependencies", async () => {
    w = await world();
    const t = await createTask(w);
    const res = await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.B });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "approved", queuePosition: 1, approvedBy: { userId: w.bob.id } });
    expect(res.body.audit[0]).toMatchObject({ action: "approved", details: { queuePosition: 1, pathDependencies: [], changesNoFiles: false } });
  });

  it("an agent attempt is an audited authority violation", async () => {
    w = await world();
    const t = await createTask(w);
    const run = await startRun(w, t.id);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: run.as }), "authority_violation", 403);
    const detail = await getTask(w, t.id);
    expect(detail.state).toBe("proposed");
    expect(detail.audit.at(-1)).toMatchObject({ action: "approve", rejected: true, actor: { kind: "agent", runId: run.runId } });
  });

  it("requires an inclusion and an acceptance criterion; only proposed tasks", async () => {
    w = await world();
    const noScope = await createTask(w, { envelope: { inclusions: [], paths: [] }, criteria: [] });
    const res = await w.h.req("POST", `/tasks/${noScope.id}/approve`, { as: w.A });
    expectRejected(res, "validation", 422);
    expect(res.body.error.details.issues).toHaveLength(2);
    const t = await approvedTask(w);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A }), "invalid_transition", 409);
  });

  it("approves a task without paths as a task that changes no files", async () => {
    w = await world();
    const t = await createTask(w, { paths: [] });
    const res = await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A });
    expect(res.body.audit[0].details.changesNoFiles).toBe(true);
  });
});

describe("T3 Claim", () => {
  it("a human claims; the claim has no lease", async () => {
    w = await world();
    const t = await approvedTask(w);
    const res = await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A });
    expectOk(res);
    expect(res.body.task.state).toBe("in_progress");
    expect(res.body.task.claim).toMatchObject({ claimantKind: "human", userId: w.alice.id, leaseDeadline: null });
  });

  it("an agent run claims its bound task with a lease deadline", async () => {
    w = await world();
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    const res = await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as });
    expectOk(res);
    expect(res.body.task.claim).toMatchObject({ claimantKind: "agent", runId: run.runId });
    expect(Date.parse(res.body.task.claim.leaseDeadline)).toBeGreaterThan(Date.now() + 29 * 60_000);
    expect(res.body.audit[0].details.leaseDeadline).toBe(res.body.task.claim.leaseDeadline);
  });

  it("an agent run cannot claim another task (not_permitted)", async () => {
    w = await world();
    const bound = await approvedTask(w, { paths: ["a"] });
    const other = await approvedTask(w, { paths: ["b"] });
    const run = await startRun(w, bound.id);
    expectRejected(await w.h.req("POST", `/tasks/${other.id}/claim`, { as: run.as }), "not_permitted", 403);
  });

  it("a claimed task rejects further claims with conflict naming the claimant", async () => {
    w = await world();
    const t = await claimed();
    const res = await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.B });
    expectRejected(res, "conflict", 409);
    expect(res.body.error.details.claimant).toEqual({ kind: "human", userId: w.alice.id });
  });

  it("proposed and terminal tasks cannot be claimed (invalid_transition)", async () => {
    w = await world();
    const p = await createTask(w);
    expectRejected(await w.h.req("POST", `/tasks/${p.id}/claim`, { as: w.A }), "invalid_transition", 409);
    const done = await reviewed();
    expectOk(await w.h.req("POST", `/tasks/${done.id}/accept`, { as: w.A, body: {} }));
    expectRejected(await w.h.req("POST", `/tasks/${done.id}/claim`, { as: w.A }), "invalid_transition", 409);
  });
});

describe("T4 Release / break claim", () => {
  it("the claimant releases; the task returns to approved", async () => {
    w = await world();
    const t = await claimed();
    const res = await w.h.req("POST", `/tasks/${t.id}/release`, { as: w.A, body: {} });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "approved", claim: null });
    expect(res.body.audit[0]).toMatchObject({ action: "claim_released", details: { break: false } });
  });

  it("another human breaks the claim with a reason; without one it is validation", async () => {
    w = await world();
    const t = await claimed();
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/release`, { as: w.B, body: {} }), "validation", 422);
    const res = await w.h.req("POST", `/tasks/${t.id}/release`, { as: w.B, body: { reason: "Alice is away" } });
    expectOk(res);
    expect(res.body.audit[0]).toMatchObject({ reason: "Alice is away", details: { break: true, formerClaimant: { userId: w.alice.id } } });
  });

  it("an agent run releases its own claim, but breaking a human's claim is an audited authority violation", async () => {
    w = await world();
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }));
    expectOk(await w.h.req("POST", `/tasks/${t.id}/release`, { as: run.as, body: {} }));
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/release`, { as: run.as, body: { reason: "x" } }), "authority_violation", 403);
    const detail = await getTask(w, t.id);
    expect(detail.claim?.userId).toBe(w.alice.id);
    expect(detail.audit.at(-1)).toMatchObject({ action: "break_claim", rejected: true });
  });

  it("releasing without an active claim is invalid_transition", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/release`, { as: w.A, body: {} }), "invalid_transition", 409);
  });
});

describe("T6 Hand off", () => {
  it("the claimant hands off; the claim ends and the handoff is recorded", async () => {
    w = await world();
    const t = await claimed();
    const res = await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody("abc") });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "in_review", claim: null, enteredReviewBy: "handoff" });
    expect(res.body.task.handoffs[0]).toMatchObject({ commit: "abc", userId: w.alice.id });
    expect(res.body.audit[0]).toMatchObject({ action: "handed_off", details: { handoffCommit: "abc" } });
  });

  it("only the claimant (not_permitted), only in progress (invalid_transition), with a record (validation)", async () => {
    w = await world();
    const t = await claimed();
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.B, body: handoffBody() }), "not_permitted", 403);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: {} }), "validation", 422);
    const a = await approvedTask(w, { paths: ["other"] });
    expectRejected(await w.h.req("POST", `/tasks/${a.id}/handoff`, { as: w.A, body: handoffBody() }), "invalid_transition", 409);
  });

  it("a branch that does not merge cleanly is rejected with merge_conflict naming the files", async () => {
    w = await world();
    const t = await claimed();
    w.h.repo.handoffConflicts.set(t.id, ["src/a.ts"]);
    const res = await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody() });
    expectRejected(res, "merge_conflict", 409);
    expect(res.body.error.details.conflictingFiles).toEqual(["src/a.ts"]);
    expect((await getTask(w, t.id)).state).toBe("in_progress");
  });

  it("an agent handoff records the run's model", async () => {
    w = await world();
    const { t } = await inReview({ model: "claude-opus" });
    expect((await getTask(w, t.id)).handoffs[0]).toMatchObject({ claimantKind: "agent", model: "claude-opus" });
  });
});

describe("T7 Record review", () => {
  it("a reviewer run records a review of human-claimed work, never flagged", async () => {
    w = await world();
    const { t } = await inReview();
    const reviewer = await startRun(w, t.id, "claude-opus", "reviewer");
    const res = await w.h.req("POST", `/tasks/${t.id}/reviews`, {
      as: reviewer.as,
      body: { verdict: "changes_required", findings: [{ severity: "major", text: "Missing test" }] },
    });
    expectOk(res);
    expect(res.body.task.state).toBe("in_review");
    expect(res.body.task.reviews[0]).toMatchObject({ verdict: "changes_required", sameModel: false });
    expect(res.body.audit[0]).toMatchObject({ action: "review_recorded", actor: { kind: "agent", model: "claude-opus" } });
  });

  it("flags a same-model review (same identifier, different quantization) and not a different model", async () => {
    w = await world();
    const { t } = await inReview({ model: "deepseek-coder-v2-lite" });
    const same = await startRun(w, t.id, "deepseek-coder-v2-lite", "reviewer", { quantization: "Q8" });
    const r1 = await w.h.req("POST", `/tasks/${t.id}/reviews`, { as: same.as, body: { verdict: "pass" } });
    expect(r1.body.task.reviews[0].sameModel).toBe(true);
    expect(r1.body.audit[0].details.sameModel).toBe(true);
    const other = await startRun(w, t.id, "claude-opus", "reviewer");
    const r2 = await w.h.req("POST", `/tasks/${t.id}/reviews`, { as: other.as, body: { verdict: "pass" } });
    expect(r2.body.task.reviews[1].sameModel).toBe(false);
  });

  it("the implementing run cannot review its own handoff; humans cannot record reviews", async () => {
    w = await world();
    const { t, run } = await inReview({ model: "m" });
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/reviews`, { as: run!.as, body: { verdict: "pass" } }), "not_permitted", 403);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/reviews`, { as: w.A, body: { verdict: "pass" } }), "not_permitted", 403);
  });

  it("a task not in review cannot be reviewed", async () => {
    w = await world();
    const t = await approvedTask(w);
    const reviewer = await startRun(w, t.id, "m", "reviewer");
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }), "invalid_transition", 409);
  });
});

describe("T9 Accept", () => {
  it("a human accepts a reviewed task; nothing merges, the accepted commit is recorded", async () => {
    w = await world();
    const t = await reviewed();
    const res = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: { warningsConfirmed: true } });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "completed", acceptedCommit: "c0ffee", acceptedBy: { userId: w.alice.id }, workOnMain: false });
    expect(res.body.audit[0]).toMatchObject({
      action: "accepted",
      actor: { identityMode: "selected" },
      details: { warningsConfirmed: true, integrationStatus: "not_merged", override: null, reviewWaived: false },
    });
    // Acceptance keeps the task in the queue until its work is on main.
    expect(res.body.task.queuePosition).toBe(1);
  });

  it("an agent attempt (including a waiver) is an audited authority violation", async () => {
    w = await world();
    const { t } = await inReview();
    const run = await startRun(w, t.id, "m", "reviewer");
    const res = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: run.as, body: { waiveReviewReason: "trust me" } });
    expectRejected(res, "authority_violation", 403);
    expect((await getTask(w, t.id)).state).toBe("in_review");
    expect(await auditActions(w, t.id)).toContain("accept");
  });

  it("without a review the accept needs a waiver with a reason", async () => {
    w = await world();
    const { t } = await inReview();
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: {} }), "validation", 422);
    const res = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: { waiveReviewReason: "Trivial change" } });
    expectOk(res);
    expect(res.body.task.reviewWaiverReason).toBe("Trivial change");
    expect(res.body.audit[0]).toMatchObject({ reason: "Trivial change", details: { reviewWaived: true } });
  });

  it("out-of-scope changed files need a written reason", async () => {
    w = await world();
    const t = await reviewed();
    w.h.repo.changed.set(t.id, ["src/a.ts", "README.md"]);
    const res = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: {} });
    expectRejected(res, "validation", 422);
    expect(res.body.error.details.outOfScopeFiles).toEqual(["README.md"]);
    const ok = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: { outOfScopeReason: "Docs fix" } });
    expectOk(ok);
    expect(ok.body.audit[0].details).toMatchObject({ outOfScopeFiles: ["README.md"], outOfScopeReason: "Docs fix" });
  });

  it("a known conflict refuses the accept; accept anyway succeeds and records the override", async () => {
    w = await world();
    const t = await reviewed();
    w.h.repo.mainConflicts.set(t.id, ["src/x.ts"]);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: {} }), "merge_conflict", 409);
    expect((await getTask(w, t.id)).state).toBe("in_review");
    const res = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: { acceptAnyway: true, acceptAnywayReason: "Will fix on merge" } });
    expectOk(res);
    expect(res.body.audit[0].details.override).toMatchObject({
      kind: "accept_anyway",
      who: { userId: w.alice.id },
      bypassed: { knownConflict: { conflictingFiles: ["src/x.ts"] } },
      reason: "Will fix on merge",
    });
  });

  it("an unreadable repository rejects with repository_unavailable", async () => {
    w = await world();
    const t = await reviewed();
    w.h.repo.unavailable = true;
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: {} }), "repository_unavailable", 503);
  });

  it("a blocked task cannot be accepted; a task not in review cannot be accepted", async () => {
    w = await world();
    const t = await reviewed();
    expectOk(await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: w.A, body: { whatIsNeeded: "a", whoCanResolve: "b", effect: "c" } }));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: {} }), "blocked", 409);
    const a = await approvedTask(w, { paths: ["z"] });
    expectRejected(await w.h.req("POST", `/tasks/${a.id}/accept`, { as: w.A, body: {} }), "invalid_transition", 409);
  });
});

describe("T10 Return", () => {
  it("a returned leaf goes to approved, unclaimed, with the return notes", async () => {
    w = await world();
    const { t } = await inReview();
    const res = await w.h.req("POST", `/tasks/${t.id}/return`, { as: w.B, body: { reason: "Needs tests" } });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "approved", claim: null, returnNotes: "Needs tests" });
    expect(res.body.audit[0]).toMatchObject({ action: "returned", reason: "Needs tests" });
  });

  it("requires a reason, a task in review, and a human", async () => {
    w = await world();
    const { t } = await inReview();
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/return`, { as: w.A, body: {} }), "validation", 422);
    const run = await startRun(w, t.id, "m", "reviewer");
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/return`, { as: run.as, body: { reason: "x" } }), "authority_violation", 403);
    const p = await createTask(w);
    expectRejected(await w.h.req("POST", `/tasks/${p.id}/return`, { as: w.A, body: { reason: "x" } }), "invalid_transition", 409);
  });
});

describe("T15 Cancel", () => {
  it("a human cancels with a reason; the claim ends and the task leaves the queue", async () => {
    w = await world();
    const t = await claimed();
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/cancel`, { as: w.A, body: {} }), "validation", 422);
    const res = await w.h.req("POST", `/tasks/${t.id}/cancel`, { as: w.A, body: { reason: "Not needed" } });
    expectOk(res);
    expect(res.body.task).toMatchObject({ state: "cancelled", claim: null, queuePosition: null });
    expect(res.body.audit[0]).toMatchObject({ action: "cancelled", reason: "Not needed", fromState: "in_progress" });
  });

  it("an agent withdraws a proposal its run authored, but not other tasks", async () => {
    w = await world();
    const origin = await approvedTask(w);
    const run = await startRun(w, origin.id);
    const created = await w.h.req("POST", `/projects/${w.projectId}/tasks`, { as: run.as, body: { title: "p", desiredOutcome: "o" } });
    const own = created.body.task.id;
    expectOk(await w.h.req("POST", `/tasks/${own}/cancel`, { as: run.as, body: { reason: "Withdrawn" } }));
    expectRejected(await w.h.req("POST", `/tasks/${origin.id}/cancel`, { as: run.as, body: { reason: "x" } }), "authority_violation", 403);
    expect(await auditActions(w, origin.id)).toContain("cancel_beyond_agent_allowance");
  });

  it("terminal tasks cannot be cancelled or reopened (T13 removed)", async () => {
    w = await world();
    const t = await createTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/cancel`, { as: w.A, body: { reason: "x" } }));
    for (const [path, body] of [
      ["cancel", { reason: "again" }],
      ["approve", undefined],
      ["claim", undefined],
      ["return", { reason: "reopen" }],
    ] as const) {
      expectRejected(await w.h.req("POST", `/tasks/${t.id}/${path}`, { as: w.A, body }), "invalid_transition", 409);
    }
    expect((await w.h.req("POST", `/tasks/${t.id}/reopen`, { as: w.A })).status).toBe(404);
  });
});

describe("Audit trail", () => {
  it("each task's state equals the to-state of its latest state-changing record (I15)", async () => {
    w = await world();
    const t = await reviewed();
    expectOk(await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: {} }));
    const detail = await getTask(w, t.id);
    const changes = detail.audit.filter((a) => !a.rejected && a.fromState !== a.toState);
    expect(changes.at(-1)!.toState).toBe(detail.state);
    expect(detail.audit.map((a) => a.action)).toEqual([
      "created",
      "approved",
      "claimed",
      "handed_off",
      "run_started",
      "review_recorded",
      "accepted",
    ]);
    for (const a of detail.audit.filter((x) => x.actor.kind === "human")) expect(a.actor.identityMode).toBe("selected");
  });

  it("audit records are append-only in the database", async () => {
    w = await world();
    await createTask(w);
    await expect(w.h.db.update(schema.auditRecords).set({ action: "tampered" }).where(eq(schema.auditRecords.action, "created"))).rejects.toThrow();
    await expect(w.h.db.delete(schema.auditRecords)).rejects.toThrow();
  });

  it("non-authority rejections produce no audit record (A12)", async () => {
    w = await world();
    const t = await claimed();
    const before = (await getTask(w, t.id)).audit.length;
    await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.B });
    await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.B, body: handoffBody() });
    await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A });
    expect((await getTask(w, t.id)).audit.length).toBe(before);
  });
});
