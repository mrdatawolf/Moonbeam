import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import { SNAPSHOT_VERSION } from "@moonbeam/dbc";
import { GitRunner } from "../github/git.js";
import { Mirror } from "../github/mirror.js";
import { pollIntervalMs } from "../poller/scheduler.js";
import type { FlagInput } from "../poller/poll.js";
import { GitFixture } from "./git-fixture.js";
import { fixtureGitHub, world, type World } from "./harness.js";

let w: World;
let fixture: GitFixture;
let api: Awaited<ReturnType<typeof fixtureGitHub>>;
let id: string;
let inputs: FlagInput[];
let commands: string[];
const task = (name = "Fixture") => `# TASK-001: ${name}\nFormat: DbC task v1\nProposed by: Alice\nProposed date: 2025-01-01\nApproved by: Alice\nApproved date: 2025-01-01\nRelated contracts: None\nRelated ADRs: None\nDependencies: None\n\n### Paths\n- src/\n`;
const snapshot = async () => (await w.h.db.select().from(schema.projectSnapshots).where(eq(schema.projectSnapshots.projectId, id)))[0]!;
const refresh = () => w.h.req("POST", `/projects/${id}/refresh`);

beforeEach(async () => {
  inputs = []; commands = [];
  fixture = await GitFixture.create();
  await fixture.commit({ "README.md": "root" });
  await fixture.publish();
  api = await fixtureGitHub(fixture);
  w = await world({ github: api.github, tokens: { owner: "fixture-token-private" },
    mirror: (directory) => {
      const git = new GitRunner();
      const run = git.run.bind(git);
      vi.spyOn(git, "run").mockImplementation((cwd, command, args, auth) => {
        commands.push(command);
        return run(cwd, command, args, auth);
      });
      return new Mirror(directory, { git, remoteUrl: () => fixture.url });
    }, flags: { apply: async (_tx, input) => { inputs.push(input); } },
  });
  // Fixed evaluation time makes evidence equality meaningful.
  w.h.clock.fixedTime = new Date("2026-09-29T12:00:00Z");
  const registered = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo" } });
  expect(registered.status).toBe(201);
  id = registered.body.id;
});
afterEach(async () => { await w?.h.close(); await fixture?.dispose(); vi.restoreAllMocks(); });

describe("polling and snapshots", () => {
  it("uses GETs and allowlisted git only, reads the tracked branch, caches logins and pins the head", async () => {
    await fixture.branch("other");
    await fixture.commit({ "other.txt": "not on main" });
    await fixture.publish("other");
    await fixture.checkout("main");
    const before = await fixture.git(["show-ref"], {}, fixture.remote);
    const result = await refresh();
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: "ok", tokenWriteScopes: true, baselineNeedsReset: false });
    expect(api.requests.every((r) => r.method === "GET")).toBe(true);
    expect(commands).toContain("fetch");
    expect(commands.every((c) => ["init", "rev-parse", "fetch", "log", "cat-file", "merge-base", "update-ref"].includes(c))).toBe(true);
    const directory = join(w.h.home, "mirrors", `${id}.git`);
    const refs = await fixture.git(["show-ref"], {}, directory);
    expect(refs).toContain("refs/moonbeam/last-processed");
    expect(refs).not.toMatch(/refs\/heads|refs\/tags|other/);
    expect(await fixture.git(["show-ref"], {}, fixture.remote)).toBe(before);
    expect((await snapshot()).snapshotVersion).toBe(SNAPSHOT_VERSION);
    expect((await w.h.db.select().from(schema.commitLogins))[0]?.login).toBe("fixture-author");
    expect(JSON.stringify(result.body)).not.toContain("fixture-token-private");
  });

  it("reuses the snapshot and only evaluates conditions when the head is unchanged", async () => {
    await fixture.commit({ "tasks/approved/TASK-001-fixture.md": task() }); await fixture.publish();
    await refresh();
    const first = await snapshot();
    api.state.conditional = true;
    const beforeRequests = api.requests.length;
    commands.length = 0;
    const result = await refresh();
    expect(result.body.status).toBe("ok");
    expect(api.requests.slice(beforeRequests)).toHaveLength(2);
    expect(api.requests[beforeRequests]?.etag).toBe(api.state.etag);
    expect(commands).not.toContain("fetch");
    expect(commands).not.toContain("log");
    expect(inputs.at(-1)?.mode).toBe("conditions");
    expect(inputs.at(-1)?.evaluation.flags.every((f) => f.kind === "condition")).toBe(true);
    expect(inputs.at(-1)?.evaluation.flags.some((f) => f.rule === "FL-5")).toBe(true);
    expect((await snapshot()).snapshot).toEqual(first.snapshot);
  });

  it("joins concurrent viewer refreshes and serializes a second scheduler through PostgreSQL", async () => {
    await refresh();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const started = new Promise<void>((r) => { entered = r; });
    const original = api.github.getRepositoryById.bind(api.github);
    let calls = 0;
    vi.spyOn(api.github, "getRepositoryById").mockImplementation(async (...args) => {
      calls++; entered(); await gate; return original(...args);
    });
    const a = w.h.poller.refresh(id);
    await started;
    const b = w.h.poller.refresh(id);
    expect(b).toBe(a);
    const second = w.h.newScheduler();
    let joined = false;
    const crossInstance = second.refresh(id).then((status) => { joined = true; return status; });
    try {
      await vi.waitFor(async () => {
        const waiting = await w.h.db.execute(sql`select * from pg_locks where locktype = 'advisory' and granted = false`);
        expect(waiting.length).toBeGreaterThan(0);
      });
      expect(joined).toBe(false);
      expect(calls).toBe(1);
    } finally { release(); }
    await expect(a).resolves.toMatchObject({ status: "ok" });
    await expect(crossInstance).resolves.toMatchObject({ status: "ok" });
    await b;
  });

  it("exposes the whole previous result while the new snapshot/status transaction is uncommitted", async () => {
    await refresh();
    const before = await snapshot();
    const head = await fixture.commit({ "tasks/approved/TASK-001-fixture.md": task() }); await fixture.publish();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const started = new Promise<void>((r) => { entered = r; });
    // A database trigger delays the snapshot update inside the poll transaction.
    await w.h.db.execute(sql`create function delay_snapshot() returns trigger language plpgsql as $$ begin perform pg_advisory_xact_lock(340034); return NEW; end $$`);
    await w.h.db.execute(sql`create trigger delay_snapshot before update on project_snapshots for each row execute function delay_snapshot()`);
    const holding = w.h.db.transaction(async (tx) => { await tx.execute(sql`select pg_advisory_xact_lock(340034)`); entered(); await gate; });
    await started;
    const polling = refresh();
    try {
      await vi.waitFor(async () => {
        const rows = await w.h.db.execute(sql`select * from pg_locks where locktype = 'advisory' and granted = false`);
        expect(rows.length).toBeGreaterThan(0);
      });
      const [visible] = await w.h.db.select().from(schema.projectSnapshots).innerJoin(schema.projectSources, eq(schema.projectSources.projectId, schema.projectSnapshots.projectId));
      expect(visible?.project_snapshots).toEqual(before);
      expect(visible?.project_sources.lastProcessedHead).toBe(before.headSha);
    } finally { release(); await holding; }
    expect((await polling).body.lastProcessedHead).toBe(head);
    expect((await snapshot()).headSha).toBe(head);
  });

  it("reports FL-10 evidence on reset, no flag on fast-forward, and baseline reset when it leaves", async () => {
    const root = await fixture.head();
    const baseline = await fixture.commit({ "tasks/approved/TASK-001-fixture.md": task() }); await fixture.publish();
    await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { baselineSha: baseline } });
    await refresh();
    await fixture.commit({ "src/work.ts": "work" }); await fixture.publish();
    await refresh();
    expect(inputs.at(-1)?.rewrite).toBeNull();
    const previous = (await snapshot()).headSha;
    await fixture.reset(root);
    const head = await fixture.commit({ "replacement.txt": "reset" }); await fixture.publish();
    const result = await refresh();
    expect(result.body).toMatchObject({ status: "ok", baselineNeedsReset: true });
    expect(inputs.at(-1)?.rewrite).toMatchObject({ rule: "FL-10", evidence: { previousHead: previous, newHead: head, droppedCommitCount: 2, changedTaskIds: ["TASK-001"] } });
    expect((await snapshot()).snapshot.chainShas).toEqual([root, head]);
  });

  it("recreates a deleted mirror on startup and rebuilds old snapshot versions without FL-10", async () => {
    await refresh();
    const before = await snapshot();
    await rm(join(w.h.home, "mirrors"), { recursive: true });
    const restart = w.h.newScheduler();
    await restart.start(); await restart.stop();
    expect((await snapshot()).snapshot).toEqual(before.snapshot);
    expect(inputs.at(-1)?.rewrite).toBeNull();
    await w.h.db.update(schema.projectSnapshots).set({ snapshotVersion: 1, snapshot: { version: 1 } });
    await refresh();
    expect((await snapshot()).snapshot).toEqual(before.snapshot);
    expect(inputs.at(-1)?.mode).toBe("full");
    expect(inputs.at(-1)?.rewrite).toBeNull();
    expect((await w.h.req("GET", `/projects/${id}`)).status).toBe(200);
    expect((await w.h.db.select().from(schema.auditRecords)).length).toBeGreaterThan(0);
  });

  it("rebuilds after a tracked-branch change without FL-10", async () => {
    await refresh();
    await fixture.branch("release");
    const next = await fixture.commit({ "release.txt": "release" }); await fixture.publish("release");
    const update = await w.h.req("PATCH", `/projects/${id}`, { as: w.A, body: { trackedBranch: "release" } });
    expect(update.status).toBe(200);
    expect((await refresh()).body.lastProcessedHead).toBe(next);
    expect(inputs.at(-1)?.rewrite).toBeNull();
  });

  it("five incremental polls and a fresh registration yield identical snapshots and flag evidence", async () => {
    const baseline = await fixture.head();
    const changes: Record<string, string | null>[] = [
      { "tasks/proposed/TASK-001-fixture.md": task() },
      { "tasks/proposed/TASK-001-fixture.md": null, "tasks/approved/TASK-001-fixture.md": task() },
      { "src/work.ts": "work" },
      { "tasks/approved/TASK-001-fixture.md": null, "tasks/completed/TASK-001-fixture.md": task(), "src/work.ts": "complete" },
      { "tasks/completed/TASK-001-fixture.md": task("Amended") },
    ];
    for (const files of changes) { await fixture.commit(files); await fixture.publish(); expect((await refresh()).body.status).toBe("ok"); }
    const incremental = await snapshot();
    const expected = inputs.at(-1)!;
    await w.h.req("DELETE", `/projects/${id}`, { as: w.A });
    const next = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo", baselineSha: baseline } });
    id = next.body.id;
    expect((await refresh()).body.status).toBe("ok");
    expect((await snapshot()).snapshot).toEqual(incremental.snapshot);
    expect(inputs.at(-1)?.evaluation.flags).toEqual(expected.evaluation.flags);
  });

  it("tolerates invalid UTF-8, oversized and older tasks while retaining valid files", async () => {
    await fixture.commit({ "tasks/approved/TASK-001-fixture.md": task(),
      "tasks/proposed/TASK-002-invalid.md": Buffer.from([255]),
      "tasks/proposed/TASK-003-large.md": Buffer.alloc(1_048_577, 97),
      "tasks/proposed/TASK-004-old.md": "# TASK-004: Old\n", "tasks/weird/note.md": "stray" });
    await fixture.publish();
    expect((await refresh()).body.status).toBe("ok");
    const reasons = inputs.at(-1)!.evaluation.flags.filter((f) => f.rule === "FL-7").map((f) => f.evidence.reason);
    expect(reasons).toEqual(expect.arrayContaining(["not_utf8", "too_large", "not_v1"]));
    expect(inputs.at(-1)?.snapshot.tasks).toHaveLength(4);
  });

  it("defaults to 300 seconds, accepts a configured interval and rejects invalid timers", () => {
    expect(pollIntervalMs({})).toBe(300_000);
    expect(pollIntervalMs({ MOONBEAM_POLL_INTERVAL_SECONDS: "12" })).toBe(12_000);
    for (const value of ["0", "-1", "oops", "Infinity", "999999999"]) expect(() => pollIntervalMs({ MOONBEAM_POLL_INTERVAL_SECONDS: value })).toThrow();
  });

  it("does not refresh removed or unknown projects", async () => {
    expect((await w.h.req("POST", "/projects/not-a-uuid/refresh")).status).toBe(404);
    await w.h.req("DELETE", `/projects/${id}`, { as: w.A });
    expect((await refresh()).status).toBe(404);
  });
});
