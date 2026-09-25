// CONTRACT-002 validation requirements 1-9 (10 is by review: routes obtain
// the actor only through resolveActor and permission only through
// checkPermission).
import { afterEach, describe, expect, it } from "vitest";
import {
  approvedTask,
  createHarness,
  createTask,
  expectOk,
  expectRejected,
  getTask,
  gitInit,
  handoffBody,
  startRun,
  world,
  type Harness,
  type World,
} from "./harness.js";
import { join } from "node:path";

let w: World | undefined;
let h: Harness | undefined;
afterEach(async () => {
  await w?.h.close();
  await h?.close();
  w = undefined;
  h = undefined;
});

const GHOST = "00000000-0000-4000-8000-000000000000";

describe("Resolve actor", () => {
  it("who am I: nobody, a human with identity mode selected, or an agent run", async () => {
    w = await world();
    expect((await w.h.req("GET", "/whoami")).body).toEqual({ actor: null });
    expect((await w.h.req("GET", "/whoami", { as: w.A })).body.actor).toMatchObject({ kind: "human", userId: w.alice.id, identityMode: "selected" });
    const t = await approvedTask(w);
    const run = await startRun(w, t.id, "claude-opus", "implementer");
    expect((await w.h.req("GET", "/whoami", { as: run.as })).body.actor).toEqual({
      kind: "agent",
      runId: run.runId,
      taskId: t.id,
      projectId: w.projectId,
      role: "implementer",
      model: "claude-opus",
    });
  });

  it("viewing needs no selection; every action does", async () => {
    w = await world();
    const t = await createTask(w);
    expectOk(await w.h.req("GET", `/tasks/${t.id}`));
    expectOk(await w.h.req("GET", `/projects/${w.projectId}/tasks`));
    expectOk(await w.h.req("GET", `/decision-queue`));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`), "unidentified", 401);
    // Malformed ids are rejected cleanly, never as server errors.
    expectRejected(await w.h.req("GET", `/tasks/${"-".repeat(36)}`), "not_found", 404);
    expectRejected(await w.h.req("GET", `/decision-queue?projectId=nope`), "validation", 422);
    expectRejected(await w.h.req("GET", `/projects/nope`), "not_found", 404);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/blockers/nope/resolve`, { as: w.A }), "not_found", 404);
  });

  it("unknown and inactive users are unidentified, and not audited", async () => {
    w = await world();
    const t = await createTask(w);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: { user: GHOST } }), "unidentified", 401);
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: { user: "not-a-uuid" } }), "unidentified", 401);
    expectOk(await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.B }), "unidentified", 401);
    expect((await getTask(w, t.id)).audit).toHaveLength(1);
  });

  it("no fallback to human: bad agent credentials are unidentified even when naming a valid user", async () => {
    w = await world();
    const t = await createTask(w);
    const cases: string[] = ["garbage", "mbr_short", `mbr_${"A".repeat(43)}`];
    for (const token of cases) {
      expectRejected(await w.h.req("POST", `/tasks/${t.id}/cancel`, { as: { token, user: w.alice.id }, body: { reason: "x" } }), "unidentified", 401);
    }
    const ended = await startRun(w, t.id);
    for (const status of ["finished", "failed", "stopped"] as const) {
      const r = await startRun(w, t.id);
      expectOk(await w.h.req("POST", `/dev/runs/${r.runId}/end`, { as: w.A, body: { status } }));
      expectRejected(await w.h.req("GET", `/whoami`, { as: { token: r.token, user: w.alice.id } }), "unidentified", 401);
    }
    expectOk(await w.h.req("GET", `/whoami`, { as: ended.as }));
    const expiring = await startRun(w, t.id, "m", "implementer", { ttlSeconds: 60 });
    expectOk(await w.h.req("GET", `/whoami`, { as: expiring.as }));
    w.h.clock.advance(61_000);
    expectRejected(await w.h.req("GET", `/whoami`, { as: expiring.as }), "unidentified", 401);
    expect((await getTask(w, t.id)).state).toBe("proposed");
  });

  it("no client input produces a system actor", async () => {
    w = await world();
    const t = await createTask(w);
    const res = await fetch(`${w.h.base}/api/tasks/${t.id}/approve`, {
      method: "POST",
      headers: { "x-moonbeam-actor-kind": "system", "x-moonbeam-system-trigger": "claim_expired" },
    });
    expect(res.status).toBe(401);
    const ok = await fetch(`${w.h.base}/api/projects/${w.projectId}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-moonbeam-user": w.alice.id, "x-moonbeam-actor-kind": "system" },
      body: JSON.stringify({ title: "t", desiredOutcome: "o", actorKind: "system", actor: { kind: "system" } }),
    });
    expect(((await ok.json()) as { audit: { actor: { kind: string } }[] }).audit[0]!.actor.kind).toBe("human");
  });
});

describe("Agent gate (ID1) and order of checks", () => {
  it("every human-only action is authority_violation for an agent, recorded, even naming a human and on a missing task", async () => {
    w = await world();
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    const as = { token: run.token, user: w.alice.id };
    const attempts: [string, string, unknown][] = [
      ["POST", `/tasks/${t.id}/approve`, undefined],
      ["POST", `/tasks/${GHOST}/approve`, undefined],
      ["POST", `/tasks/${t.id}/accept`, { waiveReviewReason: "x" }],
      ["POST", `/tasks/${GHOST}/accept`, { acceptAnyway: true }],
      ["POST", `/tasks/${t.id}/return`, { reason: "x" }],
      ["POST", `/tasks/not-a-task/return`, {}],
      ["POST", `/tasks/${t.id}/move`, { position: 1 }],
      ["POST", `/dev/runs`, { taskId: t.id, role: "r", model: "m" }],
      ["POST", `/setup`, { users: [{ displayName: "X", email: "x@y.z" }] }],
      ["POST", `/users`, { displayName: "Mallory", email: "m@example.com" }],
      ["PATCH", `/users/${w.alice.id}`, { displayName: "Mallory" }],
      ["POST", `/users/${w.bob.id}/deactivate`, undefined],
      ["POST", `/users/${w.bob.id}/reactivate`, undefined],
      ["PUT", `/settings/projects-root`, { path: "/" }],
      ["POST", `/projects`, { path: "/tmp" }],
    ];
    for (const [method, path, body] of attempts) {
      expectRejected(await w.h.req(method, path, { as, body }), "authority_violation", 403);
    }
    // A malformed body does not change the order: identity, permission, then input.
    const raw = await fetch(`${w.h.base}/api/tasks/${t.id}/accept`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${run.token}` },
      body: "{not json",
    });
    expect(raw.status).toBe(403);
    const humanRaw = await fetch(`${w.h.base}/api/tasks/${t.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-moonbeam-user": w.alice.id },
      body: "{not json",
    });
    expect(((await humanRaw.json()) as { error: { category: string } }).error.category).toBe("validation");
    const noUser = await fetch(`${w.h.base}/api/tasks/${t.id}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(noUser.status).toBe(401);
    const dq = await w.h.req("GET", "/decision-queue");
    expect(dq.body.authorityViolations).toHaveLength(attempts.length + 1);
    for (const v of dq.body.authorityViolations) {
      expect(v).toMatchObject({ rejected: true, actor: { kind: "agent", runId: run.runId, userId: null } });
    }
    expect((await w.h.req("GET", "/users")).body.users.map((u: { displayName: string }) => u.displayName)).toEqual(["Alice", "Bob"]);
    expect((await getTask(w, t.id)).state).toBe("approved");
  });

  it("binding: agents are not_permitted on other tasks and projects, for reads and writes; reads in their project are allowed", async () => {
    w = await world();
    const mine = await approvedTask(w, { paths: ["a"] });
    const other = await approvedTask(w, { paths: ["b"] });
    const run = await startRun(w, mine.id);
    expectRejected(await w.h.req("POST", `/tasks/${other.id}/claim`, { as: run.as }), "not_permitted", 403);
    expectRejected(await w.h.req("POST", `/tasks/${other.id}/handoff`, { as: run.as, body: handoffBody() }), "not_permitted", 403);
    expectOk(await w.h.req("GET", `/tasks/${other.id}`, { as: run.as }));

    const repo2 = gitInit(join(w.h.dirs.root, "second"));
    const p2 = await w.h.req("POST", "/projects", { as: w.A, body: { path: repo2 } });
    const foreign = await w.h.req("POST", `/projects/${p2.body.id}/tasks`, { as: w.A, body: { title: "f", desiredOutcome: "o" } });
    const fid = foreign.body.task.id;
    expectRejected(await w.h.req("GET", `/tasks/${fid}`, { as: run.as }), "not_permitted", 403);
    expectRejected(await w.h.req("GET", `/projects/${p2.body.id}`, { as: run.as }), "not_permitted", 403);
    expectRejected(await w.h.req("GET", `/decision-queue?projectId=${p2.body.id}`, { as: run.as }), "not_permitted", 403);
    expectRejected(await w.h.req("POST", `/projects/${p2.body.id}/tasks`, { as: run.as, body: { title: "x", desiredOutcome: "y" } }), "not_permitted", 403);
    expectRejected(await w.h.req("POST", `/tasks/${fid}/cancel`, { as: run.as, body: { reason: "x" } }), "not_permitted", 403);
    expect((await w.h.req("GET", `/projects`, { as: run.as })).body.projects.map((p: { id: string }) => p.id)).toEqual([w.projectId]);
    expect((await w.h.req("GET", `/projects`)).body.projects).toHaveLength(2);
  });

  it("credential values never appear in views or audit records (ID9)", async () => {
    w = await world();
    const t = await approvedTask(w);
    const run = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }));
    await w.h.req("POST", `/tasks/${t.id}/approve`, { as: run.as });
    const bodies = await Promise.all([
      w.h.req("GET", `/tasks/${t.id}`),
      w.h.req("GET", `/decision-queue`),
      w.h.req("GET", `/projects/${w.projectId}`),
      w.h.req("GET", `/whoami`, { as: run.as }),
    ]);
    for (const b of bodies) expect(JSON.stringify(b.body)).not.toContain(run.token);
  });
});

describe("User registry", () => {
  it("first-run setup is offered only while the registry is empty and is recorded as setup", async () => {
    h = await createHarness();
    expect((await h.req("GET", "/setup")).body).toEqual({ needsSetup: true, projectsRoot: null });
    expectRejected(await h.req("POST", "/setup", { body: { users: [] } }), "validation", 422);
    expectRejected(
      await h.req("POST", "/setup", { body: { users: [{ displayName: "A", email: "a@example.com" }, { displayName: " a ", email: "b@example.com" }] } }),
      "validation",
      422,
    );
    expectRejected(await h.req("POST", "/setup", { body: { users: [{ displayName: "A", email: "nope" }] } }), "validation", 422);
    const res = await h.req("POST", "/setup", { body: { users: [{ displayName: " Patrick ", email: "p@example.com" }] } });
    expectOk(res, 201);
    expect(res.body.users[0].displayName).toBe("Patrick");
    expect((await h.req("GET", "/setup")).body.needsSetup).toBe(false);
    expectRejected(await h.req("POST", "/setup", { body: { users: [{ displayName: "B", email: "b@example.com" }] } }), "invalid_transition", 409);
  });

  it("add, edit, deactivate and reactivate; names unique among active users; never deleted", async () => {
    w = await world();
    const add = await w.h.req("POST", "/users", { as: w.A, body: { displayName: "Carol", email: "carol@example.com" } });
    expectOk(add, 201);
    const carol = add.body.id;
    expectRejected(await w.h.req("POST", "/users", { as: w.A, body: { displayName: "  CAROL ", email: "c2@example.com" } }), "validation", 422);
    expectRejected(await w.h.req("POST", "/users", { as: w.A, body: { displayName: "Dan" } }), "validation", 422);
    expectRejected(await w.h.req("PATCH", `/users/${carol}`, { as: w.A, body: { displayName: "bob" } }), "validation", 422);
    expectRejected(await w.h.req("PATCH", `/users/${GHOST}`, { as: w.A, body: { displayName: "Z" } }), "not_found", 404);
    expectOk(await w.h.req("POST", `/users/${carol}/deactivate`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/users/${carol}/deactivate`, { as: w.A }), "invalid_transition", 409);
    expect((await w.h.req("GET", "/users")).body.users).toHaveLength(2);
    expect((await w.h.req("GET", "/users?includeInactive=true")).body.users).toHaveLength(3);
    // An inactive user's name is free again; reactivating then clashes.
    expectOk(await w.h.req("POST", "/users", { as: w.A, body: { displayName: "carol", email: "c3@example.com" } }), 201);
    expectRejected(await w.h.req("POST", `/users/${carol}/reactivate`, { as: w.A }), "validation", 422);
    expect((await w.h.req("DELETE", `/users/${carol}`, { as: w.A })).status).toBe(404);
  });

  it("the last active user cannot be deactivated", async () => {
    w = await world();
    expectOk(await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/users/${w.alice.id}/deactivate`, { as: w.A }), "validation", 422);
  });

  it("past records show a renamed user's current name; a deactivated claimant's claim can be broken", async () => {
    w = await world();
    const t = await approvedTask(w);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.B }));
    expectOk(await w.h.req("PATCH", `/users/${w.bob.id}`, { as: w.A, body: { displayName: "Robert" } }));
    const d = await getTask(w, t.id);
    expect(d.audit.find((a) => a.action === "claimed")!.actor.displayName).toBe("Robert");
    expect(d.claim?.displayName).toBe("Robert");
    expectOk(await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A }));
    expect((await getTask(w, t.id)).claim).toMatchObject({ userActive: false });
    expectOk(await w.h.req("POST", `/tasks/${t.id}/release`, { as: w.A, body: { reason: "Robert left" } }));
  });
});
