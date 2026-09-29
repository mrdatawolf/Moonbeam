import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import type { FlagInput } from "../poller/poll.js";
import { flagSink } from "../flags/sink.js";
import { FlagsService } from "../flags/service.js";
import { GitFixture } from "./git-fixture.js";
import { fixtureGitHub, world, type World } from "./harness.js";

let w: World;
let fixture: GitFixture;
let api: Awaited<ReturnType<typeof fixtureGitHub>>;
let id: string;
let root: string;
let input: FlagInput;
const day = 86_400_000;
const path = "tasks/approved/TASK-001-fixture.md";
const task = `# TASK-001: Fixture\nFormat: DbC task v1\nProposed by: Alice\nProposed date: 2025-01-01\nApproved by: Alice\nApproved date: 2025-01-01\nRelated contracts: None\nRelated ADRs: None\nDependencies: None\n\n### Paths\n- src/\n`;
const rows = async () => w.h.db.select().from(schema.flags).where(eq(schema.flags.projectId, id));
const one = async (rule: string, status = "open") => {
  const found = (await rows()).find((f) => f.rule === rule && f.status === status);
  expect(found, `${rule} ${status}`).toBeDefined();
  return found!;
};
const refresh = async () => {
  const res = await w.h.req("POST", `/projects/${id}/refresh`);
  expect(res.body.status).toBe("ok");
};
const dismiss = (flagId: string, note = "Reviewed by board") => w.h.req("POST", `/flags/${flagId}/dismiss`, { as: w.A, body: { note } });
const reopen = (flagId: string) => w.h.req("POST", `/flags/${flagId}/reopen`, { as: w.B, body: { note: "Needs another look" } });
const detail = async (flagId: string) => (await w.h.req("GET", `/flags/${flagId}`)).body;

beforeEach(async () => {
  fixture = await GitFixture.create();
  root = await fixture.commit({ "README.md": "root" });
  await fixture.publish();
  api = await fixtureGitHub(fixture);
  w = await world({ github: api.github, tokens: { owner: "fixture-only-token" }, remoteUrl: () => fixture.url,
    flags: { apply: async (tx, value) => { input = value; await flagSink.apply(tx, value); } },
  });
  w.h.clock.fixedTime = new Date("2025-02-01T00:00:00Z");
  const registered = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo" } });
  expect(registered.status).toBe(201);
  id = registered.body.id;
});
afterEach(async () => { await w?.h.close(); await fixture?.dispose(); });

async function approval() {
  const sha = await fixture.commit({ [path]: task });
  await fixture.publish(); await refresh();
  return sha;
}

describe("durable flag lifecycle", () => {
  it("persists FG1 records and audits, filters lists, and never changes remote refs", async () => {
    await approval();
    const refs = await fixture.git(["show-ref"], {}, fixture.remote);
    const flag = await one("FL-5");
    expect(flag).toMatchObject({ projectId: id, kind: "condition", subject: { taskId: "TASK-001" }, firstRaisedAt: w.h.clock.now(), status: "open" });
    expect(flag.evidence).toMatchObject({ thresholdDays: 14 });
    expect((await detail(flag.id)).history[0]).toMatchObject({ flagId: flag.id, action: "flag_raised", actorKind: "system", systemTrigger: "poller", fromState: null, toState: "open" });
    expect((await dismiss(flag.id)).status).toBe(200);
    const filtered = await w.h.req("GET", `/projects/${id}/flags?status=dismissed`);
    expect(filtered.body.flags.map((f: { id: string }) => f.id)).toEqual([flag.id]);
    expect((await w.h.req("GET", `/projects/${id}/flags?status=bad`)).status).toBe(422);
    expect((await w.h.req("GET", "/flags/bad")).status).toBe(404);
    expect((await w.h.req("GET", "/projects/bad/flags")).status).toBe(404);
    await refresh();
    expect(await fixture.git(["show-ref"], {}, fixture.remote)).toBe(refs);
  });

  it("requires a selected user and nonempty notes, records both actors, and refuses invalid transitions", async () => {
    await approval(); const f = await one("FL-5");
    for (const action of ["dismiss", "reopen"]) {
      expect((await w.h.req("POST", `/flags/${f.id}/${action}`, { body: { note: "note" } })).status).toBe(401);
      for (const body of [{}, { note: "  \n " }, { note: 1 }]) {
        expect((await w.h.req("POST", `/flags/${f.id}/${action}`, { as: w.A, body })).status).toBe(422);
      }
    }
    expect((await reopen(f.id)).status).toBe(409);
    expect((await dismiss(f.id, "  Accepted risk  ")).status).toBe(200);
    expect((await dismiss(f.id)).status).toBe(409);
    w.h.clock.advance(1);
    expect((await reopen(f.id)).status).toBe(200);
    const history = (await detail(f.id)).history;
    expect(history).toHaveLength(3);
    expect(history[1]).toMatchObject({ actorUserId: w.alice.id, note: "Accepted risk", fromState: "open", toState: "dismissed" });
    expect(history[2]).toMatchObject({ actorUserId: w.bob.id, note: "Needs another look", fromState: "dismissed", toState: "open", occurredAt: w.h.clock.now().toISOString() });
    await expect(new FlagsService({ db: w.h.db, clock: w.h.clock.now }).dismiss(null, f.id, { note: "x" })).rejects.toMatchObject({ category: "unidentified" });
  });

  it("preserves IDs and notes through repeated polls, new service/scheduler instances, and deleted caches", async () => {
    await approval(); const f = await one("FL-8");
    await dismiss(f.id);
    const before = await rows();
    await refresh(); await refresh();
    await w.h.restartServer();
    const restarted = w.h.poller;
    await restarted.refresh(id);
    expect((await new FlagsService({ db: w.h.db, clock: w.h.clock.now }).get(f.id)).history.at(-1)?.note).toBe("Reviewed by board");
    await w.h.db.delete(schema.projectSnapshots).where(eq(schema.projectSnapshots.projectId, id));
    await rm(join(w.h.home, "mirrors", `${id}.git`), { recursive: true, force: true });
    await restarted.refresh(id);
    expect(await rows()).toEqual(before);
    expect((await detail(f.id)).history).toHaveLength(2);
  });

  it("serializes simultaneous reconciliations and rolls back records with their audits", async () => {
    await approval();
    const existing = await rows();
    // A new canonical subject lets both transactions contend on insertion.
    const evaluation = { ...input.evaluation, flags: input.evaluation.flags.filter((f) => f.rule === "FL-5").map((f) => ({ ...f, subjectKey: f.subjectKey + ":concurrency" })) };
    const next = { ...input, evaluation };
    await Promise.all([1, 2].map(() => w.h.db.transaction((tx) => flagSink.apply(tx, next))));
    const raised = (await rows()).filter((f) => f.subjectKey.endsWith(":concurrency"));
    expect(raised).toHaveLength(1);
    expect((await detail(raised[0]!.id)).history).toHaveLength(1);
    const count = (await rows()).length;
    const audits = await w.h.db.select().from(schema.auditRecords);
    await expect(w.h.db.transaction(async (tx) => {
      await flagSink.apply(tx, { ...input, evaluation: { ...evaluation, flags: [] } });
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(await rows()).toHaveLength(count);
    expect(await w.h.db.select().from(schema.auditRecords)).toEqual(audits);
    expect(existing.length).toBeGreaterThan(0);
  });

  it("resolves dismissed conditions and raises a new record on recurrence", async () => {
    await approval(); const stale = await one("FL-5"); await dismiss(stale.id);
    await fixture.commit({ [path]: null, "tasks/completed/TASK-001-fixture.md": task });
    await fixture.publish(); await refresh();
    expect((await detail(stale.id)).status).toBe("resolved");
    expect((await detail(stale.id)).history.at(-1)).toMatchObject({ action: "flag_resolved", fromState: "dismissed", toState: "resolved" });
    await fixture.commit({ [path]: task, "tasks/completed/TASK-001-fixture.md": null });
    await fixture.publish(); await refresh();
    expect((await one("FL-5")).id).not.toBe(stale.id);
    expect((await detail(stale.id)).history[1].note).toBe("Reviewed by board");
  });

  it("re-raises FL-5 strictly after one threshold from dismissal and prevents conflicting reopen", async () => {
    await approval(); const stale = await one("FL-5");
    w.h.clock.advance(3 * day); await dismiss(stale.id);
    w.h.clock.advance(14 * day); await refresh();
    expect((await rows()).filter((f) => f.rule === "FL-5")).toHaveLength(1);
    w.h.clock.advance(1); await refresh();
    const next = await one("FL-5"); expect(next.id).not.toBe(stale.id);
    expect((await reopen(stale.id)).status).toBe(409);
    await refresh();
    expect((await rows()).filter((f) => f.rule === "FL-5")).toHaveLength(2);
    expect((await detail(stale.id)).status).toBe("dismissed");
    await dismiss(next.id); w.h.clock.advance(1); await refresh();
    expect((await rows()).filter((f) => f.rule === "FL-5")).toHaveLength(2);
  });

  it("withdraws dismissed/open events after rewrite, retains notes, and lists them in FL-10", async () => {
    const sha = await approval();
    await fixture.commit({ "src/a.ts": "work" }); await fixture.publish(); await refresh();
    const event = await one("FL-8"); await dismiss(event.id);
    const work = await one("FL-3");
    await fixture.reset(root); await fixture.commit({ "new.txt": "rewritten" }); await fixture.publish(); await refresh();
    expect((await detail(event.id)).status).toBe("withdrawn");
    expect((await detail(work.id)).status).toBe("withdrawn");
    const rewrite = await one("FL-10");
    expect(rewrite.evidence).toMatchObject({ previousHead: work.commitSha, droppedCommitCount: 2 });
    expect((rewrite.evidence.withdrawnFlags as { id: string }[]).map((f) => f.id)).toEqual(expect.arrayContaining([event.id, work.id]));
    expect((await detail(event.id)).history[1].note).toBe("Reviewed by board");
    await fixture.reset(sha); await fixture.publish(); await refresh();
    expect((await one("FL-8")).id).not.toBe(event.id);
    expect((await detail(event.id)).status).toBe("withdrawn");
  });

  it("retains event flags when registration excludes their commits or work", async () => {
    await fixture.commit({ "src/a.ts": "work" }); await fixture.publish(); await refresh();
    const event = await one("FL-3");
    const before = api.requests.length;
    expect((await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { exemptPaths: ["src/"] } })).status).toBe(200);
    expect(api.requests).toHaveLength(before);
    expect((await detail(event.id)).status).toBe("open");
    await dismiss(event.id);
    expect((await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { exemptPaths: [] } })).status).toBe(200);
    expect((await detail(event.id)).status).toBe("dismissed");
  });

  it("resolves FL-8 immediately from stored snapshots when email is added, and re-raises on removal", async () => {
    await approval(); const event = await one("FL-8");
    await refresh(); // conditions-only must not accidentally resolve FL-8
    expect((await detail(event.id)).status).toBe("open");
    await dismiss(event.id);
    const before = api.requests.length;
    const added = await w.h.req("POST", `/users/${w.alice.id}/identities`, { as: w.A, body: { kind: "email", value: "author@example.test" } });
    expect(added.status).toBe(201);
    expect(api.requests).toHaveLength(before);
    expect((await detail(event.id)).status).toBe("resolved");
    expect((await w.h.req("DELETE", `/identities/${added.body.id}`, { as: w.A })).status).toBe(204);
    expect((await one("FL-8")).id).not.toBe(event.id);
    expect(api.requests).toHaveLength(before);
  });

  it("re-evaluates automatic registry email/name changes and every registered project", async () => {
    await approval(); const first = await one("FL-8");
    api.state.id = 456;
    const second = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo", baselineSha: root } });
    expect(second.status).toBe(201);
    expect((await w.h.req("POST", `/projects/${second.body.id}/refresh`)).body.status).toBe("ok");
    const before = api.requests.length;
    expect((await w.h.req("PATCH", `/users/${w.alice.id}`, { as: w.A, body: { email: "author@example.test" } })).status).toBe(200);
    expect((await detail(first.id)).status).toBe("resolved");
    const flags = (await w.h.req("GET", `/projects/${second.body.id}/flags`)).body.flags;
    expect(flags.find((f: { rule: string }) => f.rule === "FL-8").status).toBe("resolved");
    expect(api.requests).toHaveLength(before);
  });

  it("re-evaluates threshold and baseline changes and audits evidence refreshes", async () => {
    await approval(); const stale = await one("FL-5");
    const before = api.requests.length;
    expect((await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { staleThresholdDays: 100 } })).status).toBe(200);
    expect((await detail(stale.id)).status).toBe("resolved");
    expect(api.requests).toHaveLength(before);
    expect((await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { staleThresholdDays: 1 } })).status).toBe(200);
    const next = await one("FL-5");
    expect(next.id).not.toBe(stale.id);
    w.h.clock.advance(day); await refresh();
    expect((await detail(next.id)).history.at(-1).action).toBe("flag_evidence_updated");
    expect((await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { baselineSha: await fixture.head() } })).status).toBe(200);
    expect((await one("FL-5")).id).toBe(next.id);
    const linked = await w.h.db.execute(sql`select count(*)::int as count from audit_records where action like 'flag_%' and flag_id is null`);
    expect(linked[0]?.count).toBe(0);
  });

  it("serializes simultaneous dismissals and reopens", async () => {
    await approval(); const flag = await one("FL-8");
    expect((await Promise.all([dismiss(flag.id), dismiss(flag.id)])).map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await Promise.all([reopen(flag.id), reopen(flag.id)])).map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await detail(flag.id)).history).toHaveLength(3);
  });

  it("re-evaluates the committed snapshot after a concurrent poll finishes", async () => {
    await approval(); const flag = await one("FL-8");
    await fixture.commit({ "src/new.ts": "work" }); await fixture.publish();
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { entered = resolve; });
    const released = new Promise<void>((resolve) => { release = resolve; });
    api.state.beforeRequest = async () => { entered(); await released; };
    const poll = refresh();
    await waiting;
    const identity = w.h.req("POST", `/users/${w.alice.id}/identities`, { as: w.A, body: { kind: "email", value: "author@example.test" } });
    release();
    await poll;
    expect((await identity).status).toBe(201);
    expect((await detail(flag.id)).status).toBe("resolved");
    expect((await one("FL-3")).commitSha).toBe(await fixture.head());
  });

  it("raises previously excluded events when the baseline moves back, without duplicate open subjects", async () => {
    await approval();
    const head = await fixture.head();
    await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { baselineSha: head } });
    expect((await one("FL-8", "resolved")).status).toBe("resolved");
    await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { baselineSha: root } });
    expect((await one("FL-8")).status).toBe("open");
    await refresh();
    const open = (await rows()).filter((f) => f.status === "open");
    expect(new Set(open.map((f) => f.subjectKey)).size).toBe(open.length);
  });

});
