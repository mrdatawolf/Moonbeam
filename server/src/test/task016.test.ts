// CONTRACT-005 T17/I23 and actor-specific availability on every task surface.
import { afterEach, describe, expect, it } from "vitest";
import { resolveActor } from "../identity/actor.js";
import { approvedTask, createTask, expectOk, expectRejected, fullEnvelope, getTask, handoffBody, startRun, subtask, world, type World } from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

describe("T17 edit proposed task", () => {
  it("lets another human edit every content field, auditing exact old/new values without lifecycle effects", async () => {
    w = await world();
    const t = await createTask(w);
    const body = { title: "Revised", desiredOutcome: "A better outcome", acceptanceCriteria: ["New criterion"], envelope: fullEnvelope(["docs"], { exclusions: ["Not UI"], constraints: ["Keep data"], contracts: ["CONTRACT-005"] }) };
    body.envelope.inclusions = ["New inclusion"];
    const r = await w.h.req("PATCH", `/tasks/${t.id}`, { as: w.B, body });
    expectOk(r);
    expect(r.body.task).toMatchObject({ title: "Revised", state: "proposed", author: t.author, originTaskId: null, claim: null, queuePosition: null, dependsOn: [] });
    expect(r.body.task.envelope).toMatchObject({ paths: ["docs"], inclusions: [{ key: "I1", text: "New inclusion", derivedFrom: null }] });
    expect(r.body.audit).toHaveLength(1);
    expect(r.body.audit[0]).toMatchObject({ action: "edited", fromState: "proposed", toState: "proposed", actor: { kind: "human", userId: w.bob.id, identityMode: "selected" } });
    const changes = r.body.audit[0].details.changes;
    expect(Object.keys(changes).sort()).toEqual(["title", "desiredOutcome", "acceptanceCriteria", "envelope.inclusions", "envelope.exclusions", "envelope.constraints", "envelope.contracts", "envelope.paths"].sort());
    for (const key of ["title", "desiredOutcome", "acceptanceCriteria"] as const) expect(changes[key]).toEqual({ previous: t[key], new: body[key] });
    for (const key of ["inclusions", "exclusions", "constraints", "contracts", "paths"] as const) expect(changes[`envelope.${key}`]).toEqual({ previous: t.envelope[key], new: r.body.task.envelope[key] });
    expectOk(await w.h.req("PATCH", `/tasks/${t.id}`, { as: w.A, body: { title: "One more edit" } }));
    const edited = await getTask(w, t.id);
    expect(edited.acceptanceCriteria).toEqual(body.acceptanceCriteria);
    expect(edited.envelope).toEqual(r.body.task.envelope);
    expect(edited.audit.filter((a) => a.action === "edited")).toHaveLength(2);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A }));
    expect((await getTask(w, t.id)).title).toBe("One more edit");
  });

  it("allows only the exact authoring run, despite its binding being the origin task", async () => {
    w = await world();
    const origin = await approvedTask(w);
    const author = await startRun(w, origin.id);
    const t = await createTask(w, { as: author.as });
    const other = await startRun(w, t.id); // bound to proposal, same model/role, still not its author
    const read = await w.h.req("GET", `/tasks/${t.id}`, { as: other.as });
    expect(read.body.allowedActions.edit.enabled).toBe(false);
    const before = await getTask(w, t.id);
    expectRejected(await w.h.req("PATCH", `/tasks/${t.id}`, { as: other.as, body: { title: "Wrong run" } }), "not_permitted", 403);
    expect(await getTask(w, t.id)).toEqual(before);
    const r = await w.h.req("PATCH", `/tasks/${t.id}`, { as: author.as, body: { title: "Follow up" } });
    expectOk(r);
    expect(r.body.audit[0].actor).toMatchObject({ kind: "agent", runId: author.runId, model: "claude-opus" });
    expect(r.body.task.originTaskId).toBe(origin.id);
    expect(r.body.task.allowedActions.edit.enabled).toBe(true);
    expectOk(await w.h.req("POST", `/dev/runs/${author.runId}/end`, { as: w.A, body: { status: "finished" } }));
    expectRejected(await w.h.req("PATCH", `/tasks/${t.id}`, { as: author.as, body: { title: "Too late" } }), "unidentified", 401);
  });

  it("revalidates the author credential under the lock and rejects anonymous edits without audit", async () => {
    w = await world();
    const origin = await approvedTask(w);
    const run = await startRun(w, origin.id);
    const t = await createTask(w, { as: run.as });
    const actor = await resolveActor(w.h.db, { authorization: `Bearer ${run.token}` }, w.h.clock.now());
    expectOk(await w.h.req("POST", `/dev/runs/${run.runId}/end`, { as: w.A, body: { status: "stopped" } }));
    const before = await getTask(w, t.id);
    await expect(w.h.lifecycle.editTask(actor!, t.id, { title: "Late" })).rejects.toMatchObject({ category: "unidentified" });
    expectRejected(await w.h.req("PATCH", `/tasks/${t.id}`, { body: { title: "Anon" } }), "unidentified");
    expect(await getTask(w, t.id)).toEqual(before);
  });

  it.each([
    {}, { title: "A task" }, { title: " " }, { desiredOutcome: "" },
    { title: "Valid", state: "approved" }, { authorRunId: "other" },
    { envelope: { paths: ["src/*.ts"] } }, { envelope: { paths: ["/absolute"] } },
    { envelope: { paths: ["../escape"] } },
  ])("rejects invalid/no-op input atomically: %j", async (body) => {
    w = await world();
    const t = await createTask(w);
    const before = await getTask(w, t.id);
    expectRejected(await w.h.req("PATCH", `/tasks/${t.id}`, { as: w.A, body }), "validation", 422);
    expect(await getTask(w, t.id)).toEqual(before);
  });

  it("allows clearing optional content and rejects an equivalent normalized path edit", async () => {
    w = await world();
    const t = await createTask(w);
    expectRejected(await w.h.req("PATCH", `/tasks/${t.id}`, { as: w.A, body: { envelope: fullEnvelope(["src/"]) } }), "validation");
    expectOk(await w.h.req("PATCH", `/tasks/${t.id}`, { as: w.A, body: { envelope: {}, acceptanceCriteria: [] } }));
    const edited = await getTask(w, t.id);
    expect(edited.envelope.paths).toEqual([]);
    expect(edited.acceptanceCriteria).toEqual([]);
  });

  it("rejects edits in every later state and to a subtask, leaving content/audit unchanged", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: [] });
    const rejectEdit = async (id: string) => {
      const before = await getTask(w, id);
      expectRejected(await w.h.req("PATCH", `/tasks/${id}`, { as: w.A, body: { title: "Changed" } }), "invalid_transition", 409);
      expect(await getTask(w, id)).toEqual(before);
    };
    await rejectEdit(t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A })); await rejectEdit(t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody() })); await rejectEdit(t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/accept`, { as: w.A, body: { waiveReviewReason: "Reviewed by human" } })); await rejectEdit(t.id);
    const cancelled = await createTask(w);
    expectOk(await w.h.req("POST", `/tasks/${cancelled.id}/cancel`, { as: w.A, body: { reason: "No longer needed" } })); await rejectEdit(cancelled.id);
    const parent = await approvedTask(w, { paths: [] });
    const split = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, { as: w.A, body: { subtasks: [subtask([])] } });
    expectOk(split); await rejectEdit(split.body.task.subtasks[0].id);
  });

  it.each(["approve", "cancel"])("serializes edit racing %s with no post-transition edit", async (action) => {
    w = await world();
    const t = await createTask(w);
    const [edit, transition] = await Promise.all([
      w.h.req("PATCH", `/tasks/${t.id}`, { as: w.A, body: { title: "Raced edit" } }),
      w.h.req("POST", `/tasks/${t.id}/${action}`, { as: w.B, body: { reason: "Stop" } }),
    ]);
    expectOk(transition);
    const final = await getTask(w, t.id);
    if (edit.status === 200) {
      expect(final.title).toBe("Raced edit");
      const edited = final.audit.find((a) => a.action === "edited")!;
      expect(edited.id).toBeLessThan(final.audit.find((a) => a.action === (action === "approve" ? "approved" : "cancelled"))!.id);
    } else {
      expectRejected(edit, "invalid_transition");
      expect(final.title).toBe(t.title);
      expect(final.audit.some((a) => a.action === "edited")).toBe(false);
    }
  });
});

describe("actor-specific allowed actions", () => {
  it("reports on detail, list, project queue, decision queue, nested tasks and action responses", async () => {
    w = await world();
    const t = await createTask(w);
    for (const as of [undefined, w.A]) {
      const expected = !!as;
      const detail = await w.h.req("GET", `/tasks/${t.id}`, { as });
      const list = await w.h.req("GET", `/projects/${w.projectId}/tasks`, { as });
      const decisions = await w.h.req("GET", "/decision-queue", { as });
      for (const task of [detail.body, list.body.tasks[0], decisions.body.proposed[0]]) {
        expect(task.allowedActions.edit.enabled).toBe(expected);
        if (!expected) expect(task.allowedActions.edit.reason).toBeTruthy();
      }
    }
    const approved = await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A });
    expect(approved.body.task.allowedActions).toMatchObject({ edit: { enabled: false }, claim: { enabled: true } });
    const queue = await w.h.req("GET", `/projects/${w.projectId}`, { as: w.A });
    expect(queue.body.queue[0].task.allowedActions.claim.enabled).toBe(true);
    const split = await w.h.req("POST", `/tasks/${t.id}/subtasks`, { as: w.A, body: { subtasks: [subtask(["src/a"])] } });
    expectOk(split);
    expect(split.body.task.subtasks[0].allowedActions.claim.enabled).toBe(true);
    const child = await w.h.req("GET", `/tasks/${split.body.task.subtasks[0].id}`, { as: w.A });
    expect(child.body.parent.allowedActions.claim.enabled).toBe(false);
  });

  it("reads do not audit forbidden actions; claim ownership and blockers change availability", async () => {
    w = await world();
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
    expectOk(await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: w.A, body: { whatIsNeeded: "Answer", whoCanResolve: "Human", effect: "Wait" } }));
    const before = await getTask(w, t.id);
    const asAgent = await w.h.req("GET", `/tasks/${t.id}`, { as: run.as });
    expect(asAgent.body.allowedActions).toMatchObject({ approve: { enabled: false }, release: { enabled: false }, handoff: { enabled: false }, resolveBlocker: { enabled: false } });
    const asHuman = await w.h.req("GET", `/tasks/${t.id}`, { as: w.A });
    expect(asHuman.body.allowedActions).toMatchObject({ release: { enabled: true }, handoff: { enabled: false }, resolveBlocker: { enabled: true } });
    expect(asHuman.body.blockerActions[before.blockers[0]!.id].enabled).toBe(true);
    expect(asAgent.body.blockerActions[before.blockers[0]!.id].enabled).toBe(false);
    expect((await getTask(w, t.id)).audit).toEqual(before.audit);
  });
});
