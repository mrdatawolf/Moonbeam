// CONTRACT-005 "Project queue and path dependencies" and D1.
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import {
  approvedTask,
  createTask,
  expectOk,
  expectRejected,
  getTask,
  handoffBody,
  startRun,
  subtask,
  world,
  type World,
} from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

/** Phase 3 sets this through M1/M2; tests simulate "work on main". */
async function markOnMain(taskId: string) {
  await w.h.db.update(schema.tasks).set({ workOnMain: true, queuePosition: null }).where(eq(schema.tasks.id, taskId));
}

async function acceptLeaf(id: string) {
  expectOk(await w.h.req("POST", `/tasks/${id}/claim`, { as: w.A }));
  expectOk(await w.h.req("POST", `/tasks/${id}/handoff`, { as: w.A, body: handoffBody() }));
  expectOk(await w.h.req("POST", `/tasks/${id}/accept`, { as: w.A, body: { waiveReviewReason: "test" } }));
}

describe("Queue and path dependencies", () => {
  it("approval appends to the queue; overlapping earlier tasks become dependencies", async () => {
    w = await world();
    const a = await approvedTask(w, { paths: ["src"] });
    const b = await approvedTask(w, { paths: ["docs"] });
    const c = await approvedTask(w, { paths: ["src/x.ts", "docs/y.md"] });
    const none = await approvedTask(w, { paths: [] });
    expect([a, b, c, none].map((t) => t.queuePosition)).toEqual([1, 2, 3, 4]);
    const cd = await getTask(w, c.id);
    expect(cd.dependsOn.map((d) => [d.kind, d.taskId, d.finished])).toEqual([
      ["queue", a.id, false],
      ["queue", b.id, false],
    ]);
    expect((await getTask(w, a.id)).dependedOnBy.map((d) => d.taskId)).toEqual([c.id]);
    expect((await getTask(w, none.id)).dependsOn).toEqual([]);
    const res = await w.h.req("POST", `/tasks/${c.id}/claim`, { as: w.A });
    expectRejected(res, "blocked", 409);
    expect(res.body.error.details.unfinishedDependencies.map((d: { taskId: string }) => d.taskId)).toEqual([a.id, b.id]);
  });

  it("cancelling the earlier task finishes the dependency; accepting alone does not, being on main does", async () => {
    w = await world();
    const a = await approvedTask(w, { paths: ["src"] });
    const b = await approvedTask(w, { paths: ["docs"] });
    const c = await approvedTask(w, { paths: ["src", "docs"] });
    expectOk(await w.h.req("POST", `/tasks/${b.id}/cancel`, { as: w.A, body: { reason: "x" } }));
    await acceptLeaf(a.id);
    expectRejected(await w.h.req("POST", `/tasks/${c.id}/claim`, { as: w.A }), "blocked", 409);
    const queue = await w.h.req("GET", `/projects/${w.projectId}`);
    expect(queue.body.queue.map((e: { task: { id: string; state: string } }) => [e.task.id, e.task.state])).toEqual([
      [a.id, "completed"],
      [c.id, "approved"],
    ]);
    const dq = await w.h.req("GET", `/decision-queue`);
    expect(dq.body.acceptedNotMerged.map((t: { id: string }) => t.id)).toEqual([a.id]);
    await markOnMain(a.id);
    expectOk(await w.h.req("POST", `/tasks/${c.id}/claim`, { as: w.A }));
  });

  it("subtasks inherit the parent's dependencies and wait for earlier overlapping siblings", async () => {
    w = await world();
    const first = await approvedTask(w, { paths: ["src/a"] });
    const parent = await approvedTask(w, { paths: ["src"] });
    const res = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, {
      as: w.A,
      body: { subtasks: [subtask(["src/a"], "S1"), subtask(["src/a/b.ts"], "S2"), subtask(["src/c"], "S3")] },
    });
    expectOk(res);
    const [s1, s2, s3] = res.body.task.subtasks.map((s: { id: string }) => s.id);
    // Inherited dependency on `first` (the parent may be split while it waits).
    for (const s of [s1, s3]) expectRejected(await w.h.req("POST", `/tasks/${s}/claim`, { as: w.A }), "blocked", 409);
    expect((await getTask(w, s3)).dependsOn.map((d) => d.kind)).toEqual(["inherited"]);
    expectOk(await w.h.req("POST", `/tasks/${first.id}/cancel`, { as: w.A, body: { reason: "x" } }));
    expectOk(await w.h.req("POST", `/tasks/${s3}/claim`, { as: w.A }));
    // Sibling dependency: S2 waits for S1.
    const blocked = await w.h.req("POST", `/tasks/${s2}/claim`, { as: w.A });
    expectRejected(blocked, "blocked", 409);
    expect(blocked.body.error.details.unfinishedDependencies[0]).toMatchObject({ kind: "sibling", taskId: s1 });
    expectOk(await w.h.req("POST", `/tasks/${s1}/claim`, { as: w.B }));
    expectOk(await w.h.req("POST", `/tasks/${s1}/handoff`, { as: w.B, body: handoffBody() }));
    const reviewer = await startRun(w, s1, "m", "reviewer");
    expectOk(await w.h.req("POST", `/tasks/${s1}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }));
    expectOk(await w.h.req("POST", `/tasks/${s2}/claim`, { as: w.A }));
  });
});

describe("D1 Move in queue", () => {
  it("a human moves a task; dependencies follow and changes are audited on every affected task", async () => {
    w = await world();
    const a = await approvedTask(w, { paths: ["src"] });
    const b = await approvedTask(w, { paths: ["src"] });
    const c = await approvedTask(w, { paths: ["docs"] });
    const res = await w.h.req("POST", `/tasks/${b.id}/move`, { as: w.A, body: { position: 1 } });
    expectOk(res);
    expect(res.body.audit.map((r: { action: string; taskId: string }) => [r.action, r.taskId])).toEqual([
      ["queue_reordered", b.id],
      ["path_dependencies_changed", a.id],
    ]);
    expect(res.body.audit[0].details).toMatchObject({ scope: "queue", fromPosition: 2, toPosition: 1 });
    const ad = await getTask(w, a.id);
    expect(ad.queuePosition).toBe(2);
    expect(ad.dependsOn.map((d) => d.taskId)).toEqual([b.id]);
    expect((await getTask(w, c.id)).queuePosition).toBe(3);
    expectOk(await w.h.req("POST", `/tasks/${b.id}/claim`, { as: w.A }));
  });

  it("an agent attempt is an audited authority violation, even for a task that does not exist", async () => {
    w = await world();
    const a = await approvedTask(w);
    const run = await startRun(w, a.id);
    expectRejected(await w.h.req("POST", `/tasks/${a.id}/move`, { as: run.as, body: { position: 1 } }), "authority_violation", 403);
    const ghost = "00000000-0000-4000-8000-000000000000";
    expectRejected(await w.h.req("POST", `/tasks/${ghost}/move`, { as: run.as, body: {} }), "authority_violation", 403);
    const dq = await w.h.req("GET", `/decision-queue`);
    expect(dq.body.authorityViolations.map((v: { action: string; details: { requestedTarget: { taskId: string } } }) => [v.action, v.details.requestedTarget.taskId])).toEqual([
      ["move", ghost],
      ["move", a.id],
    ]);
  });

  it("rejects a move that gives a started task a new unfinished dependency, either way round", async () => {
    w = await world();
    const a = await approvedTask(w, { paths: ["src"] });
    const b = await approvedTask(w, { paths: ["src/x"] });
    expectOk(await w.h.req("POST", `/tasks/${a.id}/claim`, { as: w.A }));
    const back = await w.h.req("POST", `/tasks/${a.id}/move`, { as: w.A, body: { position: 2 } });
    expectRejected(back, "invalid_transition", 409);
    expect(back.body.error.details.startedTasks[0].taskId).toBe(a.id);
    expectRejected(await w.h.req("POST", `/tasks/${b.id}/move`, { as: w.A, body: { position: 1 } }), "invalid_transition", 409);
    expect((await getTask(w, a.id)).queuePosition).toBe(1);
  });

  it("moves a subtask among its siblings; position must exist; proposed tasks are not in the queue", async () => {
    w = await world();
    const parent = await approvedTask(w, { paths: ["src"] });
    const res = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: w.A, body: { subtasks: [subtask(["src"], "S1"), subtask(["src"], "S2")] } });
    const [s1, s2] = res.body.task.subtasks.map((s: { id: string }) => s.id);
    const mv = await w.h.req("POST", `/tasks/${s2}/move`, { as: w.A, body: { position: 1 } });
    expectOk(mv);
    expect(mv.body.audit[0].details.scope).toBe("siblings");
    expect((await getTask(w, s1)).dependsOn.map((d) => [d.kind, d.taskId])).toEqual([["sibling", s2]]);
    expectRejected(await w.h.req("POST", `/tasks/${s2}/move`, { as: w.A, body: { position: 5 } }), "validation", 422);
    const p = await createTask(w);
    expectRejected(await w.h.req("POST", `/tasks/${p.id}/move`, { as: w.A, body: { position: 1 } }), "invalid_transition", 409);
  });
});
