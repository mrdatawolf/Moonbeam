// CONTRACT-001 "Concurrency rules": concurrent actions behave like some
// sequential order; concurrent claims yield exactly one winner.
import { and, eq, isNull } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import { approvedTask, expectOk, getTask, handoffBody, startRun, subtask, world, type World } from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

async function addUsers(n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const res = await w.h.req("POST", "/users", { as: w.A, body: { displayName: `User ${i}`, email: `u${i}@example.com` } });
    ids.push(res.body.id);
  }
  return ids;
}

describe("Concurrency", () => {
  it("many concurrent claims by humans and an agent run produce exactly one claim; the rest get conflict", async () => {
    w = await world();
    const users = await addUsers(12);
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    const results = await Promise.all([
      ...users.map((user) => w.h.req("POST", `/tasks/${t.id}/claim`, { as: { user } })),
      w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }),
    ]);
    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status !== 200);
    expect(winners).toHaveLength(1);
    for (const l of losers) {
      expect(l.status).toBe(409);
      expect(l.body.error.category).toBe("conflict");
      expect(l.body.error.details.claimant).toBeDefined();
    }
    const active = await w.h.db
      .select()
      .from(schema.claims)
      .where(and(eq(schema.claims.taskId, t.id), isNull(schema.claims.endedAt)));
    expect(active).toHaveLength(1);
    const d = await getTask(w, t.id);
    expect(d.audit.filter((a) => a.action === "claimed")).toHaveLength(1);
    expect(d.state).toBe("in_progress");
  });

  it("the database itself refuses a second active claim on a task (partial unique index, I4)", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
    await expect(
      w.h.db.insert(schema.claims).values({ taskId: t.id, claimantKind: "human", userId: w.bob.id, startedAt: new Date() }),
    ).rejects.toThrow();
  });

  it("concurrent claims across many tasks each have exactly one winner", async () => {
    w = await world();
    const users = await addUsers(6);
    const tasks = await Promise.all([0, 1, 2, 3].map((i) => approvedTask(w, { paths: [`p${i}`] })));
    const results = await Promise.all(
      tasks.flatMap((t) => users.map((user) => w.h.req("POST", `/tasks/${t.id}/claim`, { as: { user } }).then((r) => ({ t: t.id, r })))),
    );
    for (const t of tasks) expect(results.filter((x) => x.t === t.id && x.r.status === 200)).toHaveLength(1);
  });

  it("the parent enters review exactly once when its last two subtasks complete concurrently", async () => {
    w = await world();
    const parent = await approvedTask(w, { paths: ["src"] });
    const split = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: w.A, body: { subtasks: [subtask(["src/a"], "A"), subtask(["src/b"], "B")] } });
    const subs: string[] = split.body.task.subtasks.map((s: { id: string }) => s.id);
    const reviewers: Awaited<ReturnType<typeof startRun>>[] = [];
    for (const s of subs) {
      expectOk(await w.h.req("POST", `/tasks/${s}/claim`, { as: w.A }));
      expectOk(await w.h.req("POST", `/tasks/${s}/handoff`, { as: w.A, body: handoffBody() }));
      reviewers.push(await startRun(w, s, "m", "reviewer"));
    }
    const results = await Promise.all(subs.map((s, i) => w.h.req("POST", `/tasks/${s}/reviews`, { as: reviewers[i]!.as, body: { verdict: "pass" } })));
    for (const r of results) expectOk(r);
    const p = await getTask(w, parent.id);
    expect(p.state).toBe("in_review");
    expect(p.audit.filter((a) => a.action === "entered_review_all_subtasks_done")).toHaveLength(1);
  });

  it("adding a subtask racing the last subtask's completion is ordered: either review then rejection, or addition and no review", async () => {
    w = await world();
    const parent = await approvedTask(w, { paths: ["src"] });
    const split = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: w.A, body: { subtasks: [subtask(["src/a"], "A")] } });
    const s = split.body.task.subtasks[0].id;
    expectOk(await w.h.req("POST", `/tasks/${s}/claim`, { as: w.A }));
    expectOk(await w.h.req("POST", `/tasks/${s}/handoff`, { as: w.A, body: handoffBody() }));
    const reviewer = await startRun(w, s, "m", "reviewer");
    const [review, add] = await Promise.all([
      w.h.req("POST", `/tasks/${s}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }),
      w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: w.B, body: { subtasks: [subtask(["src/b"], "B")] } }),
    ]);
    expectOk(review);
    const p = await getTask(w, parent.id);
    if (add.status === 200) {
      expect(p.state).toBe("in_progress");
      expect(p.subtasks).toHaveLength(2);
    } else {
      expect(add.body.error.category).toBe("invalid_transition");
      expect(p.state).toBe("in_review");
      expect(p.subtasks).toHaveLength(1);
    }
  });

  it("accept racing cancel: exactly one wins, the other is rejected and changes nothing", async () => {
    w = await world();
    for (let i = 0; i < 5; i++) {
      const t = await approvedTask(w, { paths: [`r${i}`] });
      expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
      expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody() }));
      const [acc, can] = await Promise.all([
        w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: { waiveReviewReason: "race" } }),
        w.h.req("POST", `/tasks/${t.id}/cancel`, { as: w.B, body: { reason: "race" } }),
      ]);
      expect([acc.status, can.status].filter((s) => s === 200)).toHaveLength(1);
      const loser = acc.status === 200 ? can : acc;
      expect(["invalid_transition", "conflict"]).toContain(loser.body.error.category);
      const d = await getTask(w, t.id);
      expect(d.state).toBe(acc.status === 200 ? "completed" : "cancelled");
      expect(d.audit.filter((a) => a.action === "accepted" || a.action === "cancelled")).toHaveLength(1);
    }
  });
});
