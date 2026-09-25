// TASK-017: regression tests for the TASK-006 review findings F1-F6 and F7's
// named gaps (return and re-handoff after a deferred T8; an agent action racing
// the end of its run), and the board decision on note N1 (agents never receive
// users' e-mail addresses).
import { realpathSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import { ActionError } from "../errors.js";
import { requireActor, resolveActor } from "../identity/actor.js";
import { PROJECTS_LOCK } from "../registry.js";
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
  subtask,
  world,
  type Harness,
  type Res,
  type World,
} from "./harness.js";

let w: World | undefined;
let h: Harness | undefined;
afterEach(async () => {
  await w?.h.close();
  await h?.close();
  w = undefined;
  h = undefined;
});

const MIN = 60_000;
const blockerBody = { whatIsNeeded: "Decision", whoCanResolve: "Board", effect: "Waits" };

/** Resolve an agent actor the way a request does, at the harness clock's time. */
async function agentActor(harness: Harness, token: string) {
  return requireActor(await resolveActor(harness.db, { authorization: `Bearer ${token}` }, harness.clock.now()));
}

/** The category an action call rejects with, or "ok". */
async function outcome(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "ok";
  } catch (err) {
    if (err instanceof ActionError) return err.category;
    throw err;
  }
}

/** Wait until some connection is waiting for a lock (the request has reached it). */
async function untilSomeoneWaits(harness: Harness): Promise<void> {
  for (let i = 0; i < 500; i++) {
    // Per database: other test files share the Postgres cluster.
    const rows = await harness.db.execute(
      sql`select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'`,
    );
    if ((rows as unknown as { n: number }[])[0]!.n > 0) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error("no request ever waited for the lock");
}

async function pendingCompletion(harness: Harness, taskId: string): Promise<string | null> {
  const [row] = await harness.db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
  return row!.pendingCompletionReviewId;
}

describe("F1: a returned or re-handed-off subtask never completes on a stale deferred review", () => {
  async function deferredReview() {
    w = await world();
    const parent = await approvedTask(w, { paths: ["src"] });
    const split = await w!.h.req("POST", `/tasks/${parent.id}/subtasks`, {
      as: w!.A,
      body: { subtasks: [subtask(["src/a"], "S1"), subtask(["src/b"], "S2")] },
    });
    expectOk(split);
    const s1 = split.body.task.subtasks[0].id as string;
    const impl = await startRun(w!, s1, "model-a");
    expectOk(await w!.h.req("POST", `/tasks/${s1}/claim`, { as: impl.as }));
    expectOk(await w!.h.req("POST", `/tasks/${s1}/handoff`, { as: impl.as, body: handoffBody() }));
    const blocked = await w!.h.req("POST", `/tasks/${parent.id}/blockers`, { as: w!.A, body: blockerBody });
    const parentBlockerId = blocked.body.task.blockers[0].id as string;
    const reviewer = await startRun(w!, s1, "model-b", "reviewer");
    expectOk(await w!.h.req("POST", `/tasks/${s1}/reviews`, { as: reviewer.as, body: { verdict: "pass" } }));
    expect((await getTask(w!, s1)).state).toBe("in_review");
    expect(await pendingCompletion(w!.h, s1)).not.toBeNull();
    return { parent, s1, parentBlockerId };
  }

  it("a return drops the deferred completion; unblocking the parent does not complete the subtask", async () => {
    const { parent, s1, parentBlockerId } = await deferredReview();
    expectOk(await w!.h.req("POST", `/tasks/${s1}/return`, { as: w!.A, body: { reason: "Redo it" } }));
    expect(await pendingCompletion(w!.h, s1)).toBeNull();
    expectOk(await w!.h.req("POST", `/tasks/${parent.id}/blockers/${parentBlockerId}/resolve`, { as: w!.A }));
    expect((await getTask(w!, s1)).state).toBe("approved");
  });

  it("probe P1: after return and re-handoff, resolving a later blocker leaves the subtask in review with no review of its latest handoff", async () => {
    const { parent, s1, parentBlockerId } = await deferredReview();
    expectOk(await w!.h.req("POST", `/tasks/${s1}/return`, { as: w!.A, body: { reason: "Redo it" } }));
    expectOk(await w!.h.req("POST", `/tasks/${parent.id}/blockers/${parentBlockerId}/resolve`, { as: w!.A }));
    expectOk(await w!.h.req("POST", `/tasks/${s1}/claim`, { as: w!.B }));
    expectOk(await w!.h.req("POST", `/tasks/${s1}/handoff`, { as: w!.B, body: handoffBody() }));
    expect(await pendingCompletion(w!.h, s1)).toBeNull();

    const own = await w!.h.req("POST", `/tasks/${s1}/blockers`, { as: w!.A, body: blockerBody });
    const ownId = own.body.task.blockers.find((b: { resolvedAt: string | null }) => !b.resolvedAt).id;
    const resolved = await w!.h.req("POST", `/tasks/${s1}/blockers/${ownId}/resolve`, { as: w!.A });
    expectOk(resolved);
    expect(resolved.body.task.state).toBe("in_review");
    expect(resolved.body.task.audit.map((a: { action: string }) => a.action)).not.toContain("subtask_completed_on_review");

    // A review of the latest handoff completes it, citing that review.
    const reviewer = await startRun(w!, s1, "model-c", "reviewer");
    const review = await w!.h.req("POST", `/tasks/${s1}/reviews`, { as: reviewer.as, body: { verdict: "pass" } });
    expectOk(review);
    const detail = review.body.task;
    expect(detail.state).toBe("completed");
    const latest = detail.handoffs.at(-1).id;
    const cited = detail.audit.find((a: { action: string }) => a.action === "subtask_completed_on_review").details.reviewId;
    expect(detail.reviews.find((r: { id: string }) => r.id === cited).handoffId).toBe(latest);
  });
});

describe("F2: an agent action is evaluated against whether its run is active when it is applied", () => {
  it("probe P2: every agent action resolved before its run ended is unidentified and changes nothing", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, t.id);
    const actor = await agentActor(w.h, run.token);
    expectOk(await w.h.req("POST", `/dev/runs/${run.runId}/end`, { as: w.A, body: { status: "stopped" } }));
    const before = await getTask(w, t.id);
    const L = w.h.lifecycle;
    const attempts: [string, () => Promise<unknown>][] = [
      ["claim", () => L.claim(actor, t.id)],
      ["renew", () => L.renew(actor, t.id)],
      ["release", () => L.release(actor, t.id, {})],
      ["handoff", () => L.handoff(actor, t.id, handoffBody())],
      ["review", () => L.recordReview(actor, t.id, { verdict: "pass" })],
      ["subtasks", () => L.addSubtasks(actor, t.id, { subtasks: [subtask(["x/a"])] })],
      ["blocker", () => L.addBlocker(actor, t.id, blockerBody)],
      ["resolve blocker", () => L.resolveBlocker(actor, t.id, t.id)],
      ["cancel", () => L.cancel(actor, t.id, { reason: "Withdraw" })],
      ["create", () => L.createTask(actor, w!.projectId, { title: "Follow-up", desiredOutcome: "More" })],
    ];
    for (const [name, act] of attempts) expect([name, await outcome(act())]).toEqual([name, "unidentified"]);
    const after = await getTask(w, t.id);
    expect(after.state).toBe("approved");
    expect(after.claim).toBeNull();
    expect(after.audit).toHaveLength(before.audit.length);
    expect((await w.h.req("GET", `/projects/${w.projectId}/tasks`)).body.tasks).toHaveLength(1);
  });

  it("a claim racing the end of its run: the run ends while the claim waits for the project lock", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, t.id);
    let claim: Promise<Res> | undefined;
    await w.h.db.transaction(async (tx) => {
      // Hold the project lock, as a concurrent action would.
      await tx.select().from(schema.projects).where(eq(schema.projects.id, w!.projectId)).for("update");
      claim = w!.h.req("POST", `/tasks/${t.id}/claim`, { as: run.as }); // resolves its actor now
      await untilSomeoneWaits(w!.h);
      const now = w!.h.clock.now();
      await tx.update(schema.agentRuns).set({ status: "stopped", endedAt: now }).where(eq(schema.agentRuns.id, run.runId));
      await tx.update(schema.runCredentials).set({ revokedAt: now }).where(eq(schema.runCredentials.runId, run.runId));
    });
    expectRejected(await claim!, "unidentified", 401);
    const after = await getTask(w, t.id);
    expect(after.state).toBe("approved");
    expect(after.claim).toBeNull();
  });

  it("a credential that expires or is revoked between resolution and application is unidentified", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const short = await startRun(w, t.id, "m", "implementer", { ttlSeconds: 60 });
    const actor = await agentActor(w.h, short.token);
    w.h.clock.advance(2 * MIN);
    expect(await outcome(w.h.lifecycle.claim(actor, t.id))).toBe("unidentified");

    const other = await startRun(w, t.id);
    const actor2 = await agentActor(w.h, other.token);
    await w.h.db.update(schema.runCredentials).set({ revokedAt: w.h.clock.now() }).where(eq(schema.runCredentials.runId, other.runId));
    expect(await outcome(w.h.lifecycle.claim(actor2, t.id))).toBe("unidentified");
    expect((await getTask(w, t.id)).claim).toBeNull();
  });

  it("an agent action applied while its run is active still succeeds, and human actions are unaffected", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, t.id);
    const actor = await agentActor(w.h, run.token);
    expect(await outcome(w.h.lifecycle.claim(actor, t.id))).toBe("ok");
    expectOk(await w.h.req("POST", `/dev/runs/${run.runId}/end`, { as: w.A, body: { status: "finished" } }));
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
  });
});

describe("F3: ending a run that held no claim resumes the leases its pauses suspended", () => {
  it("probe P3: run B pauses run A's task and ends; A's lease resumes and later expires", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const a = await startRun(w, t.id);
    const b = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: a.as }));
    const paused = await w.h.req("POST", `/dev/runs/${b.runId}/pauses`, { as: w.A, body: { question: "?" } });
    expect(paused.body.task.claim.leaseSuspended).toBe(true);
    const ended = await w.h.req("POST", `/dev/runs/${b.runId}/end`, { as: w.A, body: { status: "finished" } });
    expectOk(ended);
    expect(ended.body.task).toMatchObject({ paused: false, state: "in_progress", claim: { runId: a.runId, leaseSuspended: false } });
    expect(ended.body.task.claim.leaseDeadline).not.toBeNull();
    w.h.clock.advance(120 * MIN);
    const later = await getTask(w, t.id);
    expect(later.state).toBe("approved");
    expect(later.claim).toBeNull();
  });
});

describe("F4: a D1 move to the task's current position is rejected and not audited", () => {
  it("probe P4: queue and sibling no-op moves are invalid_transition; a real move still works", async () => {
    w = await world();
    const first = await approvedTask(w, { paths: ["a"] });
    const second = await approvedTask(w, { paths: ["b"] });
    const before = (await getTask(w, first.id)).audit.length;
    expectRejected(await w.h.req("POST", `/tasks/${first.id}/move`, { as: w.A, body: { position: 1 } }), "invalid_transition", 409);
    expect((await getTask(w, first.id)).audit).toHaveLength(before);
    expectOk(await w.h.req("POST", `/tasks/${second.id}/move`, { as: w.A, body: { position: 1 } }));

    const parent = await approvedTask(w, { paths: ["c"] });
    const split = await w.h.req("POST", `/tasks/${parent.id}/subtasks`, {
      as: w.A,
      body: { subtasks: [subtask(["c/1"], "S1"), subtask(["c/2"], "S2")] },
    });
    const s2 = split.body.task.subtasks[1].id;
    expectRejected(await w.h.req("POST", `/tasks/${s2}/move`, { as: w.A, body: { position: 2 } }), "invalid_transition", 409);
    expectOk(await w.h.req("POST", `/tasks/${s2}/move`, { as: w.A, body: { position: 1 } }));
  });
});

describe("F5: an agent repeating its own withdrawal gets invalid_transition", () => {
  it("probe P5: the repeat is invalid_transition and records no authority violation", async () => {
    w = await world();
    const origin = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, origin.id);
    const prop = await w.h.req("POST", `/projects/${w.projectId}/tasks`, { as: run.as, body: { title: "p", desiredOutcome: "o" } });
    const pid = prop.body.task.id;
    expectOk(await w.h.req("POST", `/tasks/${pid}/cancel`, { as: run.as, body: { reason: "r" } }));
    expectRejected(await w.h.req("POST", `/tasks/${pid}/cancel`, { as: run.as, body: { reason: "r" } }), "invalid_transition", 409);
    expect((await w.h.req("GET", "/decision-queue")).body.authorityViolations).toHaveLength(0);
  });

  it("cancelling its proposal after a human approved it is still an audited authority violation, even once cancelled", async () => {
    w = await world();
    const origin = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, origin.id);
    const prop = await w.h.req("POST", `/projects/${w.projectId}/tasks`, {
      as: run.as,
      body: { title: "p", desiredOutcome: "o", acceptanceCriteria: ["c"], envelope: { inclusions: ["i"], exclusions: [], constraints: [], contracts: [], paths: ["y"] } },
    });
    const pid = prop.body.task.id;
    expectOk(await w.h.req("POST", `/tasks/${pid}/approve`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/tasks/${pid}/cancel`, { as: run.as, body: { reason: "r" } }), "authority_violation", 403);
    expectOk(await w.h.req("POST", `/tasks/${pid}/cancel`, { as: w.A, body: { reason: "r" } }));
    expectRejected(await w.h.req("POST", `/tasks/${pid}/cancel`, { as: run.as, body: { reason: "r" } }), "authority_violation", 403);
    expect((await w.h.req("GET", "/decision-queue")).body.authorityViolations).toHaveLength(2);
  });
});

describe("F6: changing the projects root cannot race with project registration", () => {
  it("a registration that waits while the root changes is checked against the new root", async () => {
    h = await createHarness();
    const setup = await h.req("POST", "/setup", {
      body: { users: [{ displayName: "Alice", email: "alice@example.test" }], projectsRoot: h.dirs.root },
    });
    expectOk(setup, 201);
    const as = { user: setup.body.users[0].id as string };
    const repo = gitInit(join(h.dirs.root, "late"));
    const elsewhere = join(h.dirs.home, "..", "elsewhere");
    mkdirSync(elsewhere);
    const newRoot = realpathSync(elsewhere);

    let register: Promise<Res> | undefined;
    await h.db.transaction(async (tx) => {
      // Hold the lock a root change takes, then change the root under it.
      await tx.execute(sql`select pg_advisory_xact_lock(${PROJECTS_LOCK})`);
      register = h!.req("POST", "/projects", { as, body: { path: repo } }); // passes its early checks
      await untilSomeoneWaits(h!);
      await tx.update(schema.settings).set({ projectsRoot: newRoot }).where(eq(schema.settings.id, 1));
    });
    expectRejected(await register!, "validation", 422);
    expect((await h.req("GET", "/projects")).body.projects).toHaveLength(0);
  });
});

describe("N1: requests with an agent credential never receive users' e-mail addresses", () => {
  it("probe P8: the user list omits e-mail addresses for agents only", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, t.id);
    expectOk(await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A }));

    for (const query of ["", "?includeInactive=true"]) {
      const agent = await w.h.req("GET", `/users${query}`, { as: { ...run.as, user: w.alice.id } });
      expectOk(agent);
      for (const u of agent.body.users) {
        expect(u).not.toHaveProperty("email");
        expect(Object.keys(u).sort()).toEqual(["active", "createdAt", "displayName", "id", "updatedAt"]);
      }
      expect(agent.body.users.map((u: { displayName: string }) => u.displayName)).toContain("Alice");
      // Humans and viewers are unchanged.
      for (const as of [w.A, undefined]) {
        const res = await w.h.req("GET", `/users${query}`, { as });
        expect(res.body.users.find((u: { id: string }) => u.id === w!.alice.id).email).toBe("alice@example.test");
      }
    }
    const inactive = await w.h.req("GET", "/users?includeInactive=true", { as: run.as });
    expect(inactive.body.users.find((u: { id: string }) => u.id === w!.bob.id)).toMatchObject({ displayName: "Bob", active: false });
  });

  it("who am I shows a human their e-mail address, and an agent none", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    const run = await startRun(w, t.id);
    expect((await w.h.req("GET", "/whoami", { as: w.A })).body.actor.email).toBe("alice@example.test");
    const agent = (await w.h.req("GET", "/whoami", { as: { ...run.as, user: w.alice.id } })).body.actor;
    expect(agent).not.toHaveProperty("email");
    expect(agent).not.toHaveProperty("credentialId");
    expect((await w.h.req("GET", "/whoami")).body.actor).toBeNull();
    expect(agent.kind).toBe("agent");
    expect(JSON.stringify(agent)).not.toMatch(/@example\.test/);
  });

  it("no response to an agent carries an e-mail address, including records of human actions", async () => {
    w = await world();
    const t = await approvedTask(w, { paths: ["x"] });
    expectOk(await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: w.B, body: blockerBody }));
    expectOk(await w.h.req("PATCH", `/users/${w.bob.id}`, { as: w.A, body: { email: "robert@example.test" } }));
    const run = await startRun(w, t.id);
    const bodies: unknown[] = [];
    for (const path of [
      "/whoami",
      "/users",
      "/users?includeInactive=true",
      "/setup",
      "/projects",
      `/projects/${w.projectId}`,
      `/projects/${w.projectId}/tasks`,
      `/tasks/${t.id}`,
      "/decision-queue",
      `/decision-queue?projectId=${w.projectId}`,
    ]) {
      const res = await w.h.req("GET", path, { as: run.as });
      expectOk(res);
      bodies.push(res.body);
    }
    // Rejected attempts at user management answer without the user record.
    bodies.push((await w.h.req("PATCH", `/users/${w.bob.id}`, { as: run.as, body: { displayName: "B" } })).body);
    bodies.push((await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: run.as })).body);
    // An action response.
    const created = await w.h.req("POST", `/projects/${w.projectId}/tasks`, { as: run.as, body: { title: "p", desiredOutcome: "o" } });
    expectOk(created, 201);
    bodies.push(created.body);
    for (const body of bodies) expect(JSON.stringify(body)).not.toMatch(/@example\.test/);
  });
});

// Each cell gets a separate task built through the API. The in-progress
// claimant is Alice; the agent is an independent bound reviewer. Relationship,
// split, condition and system-transition variants remain in the focused suites.
describe("F7: leaf state × action × actor matrix", () => {
  const states = ["proposed", "approved", "in_progress", "in_review", "completed", "cancelled"] as const;
  const actors = ["human", "agent", "viewer"] as const;
  const actions = ["approve", "claim", "release", "handoff", "reviews", "accept", "return", "cancel"] as const;
  const invalid = "invalid_transition";
  const human = {
    proposed: ["ok", invalid, invalid, invalid, "not_permitted", invalid, invalid, "ok"],
    approved: [invalid, "ok", invalid, invalid, "not_permitted", invalid, invalid, "ok"],
    in_progress: [invalid, "conflict", "ok", "ok", "not_permitted", invalid, invalid, "ok"],
    in_review: [invalid, invalid, invalid, invalid, "not_permitted", "ok", "ok", "ok"],
    completed: [invalid, invalid, invalid, invalid, "not_permitted", invalid, invalid, invalid],
    cancelled: [invalid, invalid, invalid, invalid, "not_permitted", invalid, invalid, invalid],
  };
  const agent = {
    proposed: ["authority_violation", invalid, invalid, invalid, invalid, "authority_violation", "authority_violation", "authority_violation"],
    approved: ["authority_violation", "ok", invalid, invalid, invalid, "authority_violation", "authority_violation", "authority_violation"],
    in_progress: ["authority_violation", "conflict", "authority_violation", "not_permitted", invalid, "authority_violation", "authority_violation", "authority_violation"],
    in_review: ["authority_violation", invalid, invalid, invalid, "ok", "authority_violation", "authority_violation", "authority_violation"],
    completed: ["authority_violation", invalid, invalid, invalid, invalid, "authority_violation", "authority_violation", "authority_violation"],
    cancelled: ["authority_violation", invalid, invalid, invalid, invalid, "authority_violation", "authority_violation", "authority_violation"],
  };
  const bodies: Record<typeof actions[number], unknown> = {
    approve: {}, claim: {}, release: { reason: "Release" }, handoff: handoffBody(),
    reviews: { verdict: "pass" }, accept: { waiveReviewReason: "Matrix fixture" },
    return: { reason: "Rework" }, cancel: { reason: "Stop" },
  };
  it.each(states.flatMap((state) => actors.map((actor) => ({ state, actor }))))(
    "$state / $actor: eight actions", async ({ state, actor }) => {
      w = await world();
      for (const [index, action] of actions.entries()) {
        const t = await createTask(w, { paths: [`cell-${index}`] });
        const run = await startRun(w, t.id, "review-model", "reviewer");
        if (state !== "proposed" && state !== "cancelled") {
          expectOk(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A }));
        }
        if (["in_progress", "in_review", "completed"].includes(state)) {
          expectOk(await w.h.req("POST", `/tasks/${t.id}/claim`, { as: w.A }));
        }
        if (["in_review", "completed"].includes(state)) {
          expectOk(await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: w.A, body: handoffBody() }));
        }
        if (state === "completed" || state === "cancelled") {
          const terminalAction = state === "completed" ? "accept" : "cancel";
          expectOk(await w.h.req("POST", `/tasks/${t.id}/${terminalAction}`, { as: w.A, body: bodies[terminalAction] }));
        }
        const before = await getTask(w, t.id);
        const res = await w.h.req("POST", `/tasks/${t.id}/${action}`, {
          as: actor === "human" ? w.A : actor === "agent" ? run.as : undefined,
          body: bodies[action],
        });
        const expected = actor === "viewer" ? "unidentified" : (actor === "human" ? human : agent)[state][index];
        expect([action, res.body.error?.category ?? "ok"]).toEqual([action, expected]);
        const after = await getTask(w, t.id);
        if (expected !== "ok") {
          expect(after.state).toBe(before.state);
          expect(after.claim).toEqual(before.claim);
          expect(after.audit).toHaveLength(before.audit.length + (expected === "authority_violation" ? 1 : 0));
        }
      }
    },
  );
});
