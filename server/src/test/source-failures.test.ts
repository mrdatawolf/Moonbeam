import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import type { FlagInput } from "../poller/poll.js";
import { withProjectLock } from "../poller/lock.js";
import { backoffMs } from "../poller/status.js";
import { GitFixture } from "./git-fixture.js";
import { fixtureGitHub, world, type World } from "./harness.js";

let w: World;
let fixture: GitFixture;
let api: Awaited<ReturnType<typeof fixtureGitHub>>;
let id: string;
let failSink: boolean;
let inputs: FlagInput[];
const refresh = () => w.h.req("POST", `/projects/${id}/refresh`);
const snapshot = async () => (await w.h.db.select().from(schema.projectSnapshots).where(eq(schema.projectSnapshots.projectId, id)))[0]!;
const source = async () => (await w.h.db.select().from(schema.projectSources).where(eq(schema.projectSources.projectId, id)))[0]!;
beforeEach(async () => {
  failSink = false; inputs = [];
  fixture = await GitFixture.create();
  await fixture.commit({ "README.md": "root" }); await fixture.publish();
  api = await fixtureGitHub(fixture);
  w = await world({ github: api.github, tokens: { owner: "original-fixture-token" }, remoteUrl: () => fixture.url,
    flags: { apply: async (tx, input) => {
      if (failSink) {
        // A sink writes within the supplied transaction, then fails.
        await tx.insert(schema.auditRecords).values({ action: "fixture_rollback", actorKind: "system", occurredAt: w.h.clock.now() });
        throw new Error("private failure original-fixture-token");
      }
      inputs.push(input);
    } },
  });
  w.h.clock.fixedTime = new Date("2026-09-29T12:00:00Z");
  const registered = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo" } });
  expect(registered.status).toBe(201); id = registered.body.id;
  expect((await refresh()).body.status).toBe("ok");
});
afterEach(async () => { await w?.h.close(); await fixture?.dispose(); vi.restoreAllMocks(); });

describe("source failures", () => {
  it.each([
    ["network unreachable", "unreachable"], ["timeout", "unreachable"], ["500", "unreachable"],
    ["401", "token_rejected"], ["404", "not_found"], ["branch missing", "branch_missing"],
    ["logins unavailable", "unreachable"],
  ])("%s keeps the previous snapshot, head and successful poll time (%s)", async (failure, expected) => {
    const before = await snapshot();
    const previous = await source();
    if (failure === "network unreachable") api.state.unreachable = true;
    else if (failure === "timeout") api.state.timeout = true;
    else if (failure === "branch missing") api.state.branchMissing = true;
    else if (failure === "logins unavailable") {
      await fixture.commit({ "new.txt": "next" }); await fixture.publish(); api.state.loginFailure = true;
    } else api.state.status = Number(failure);
    w.h.clock.advance(1000);
    const first = await refresh();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ status: expected, statusSince: w.h.clock.now().toISOString(),
      lastProcessedHead: previous.lastProcessedHead, lastSuccessAt: previous.lastSuccessAt!.toISOString() });
    expect(await snapshot()).toEqual(before);
    w.h.clock.advance(1000);
    const repeat = await refresh();
    expect(repeat.body.statusSince).toBe(first.body.statusSince);
    expect(inputs).toHaveLength(1);
    if (failure === "404") expect(first.body.message).toContain("not found or not accessible");
  });

  it("waits until the reported reset even for manual refresh and across schedulers", async () => {
    const before = await snapshot();
    api.state.status = 429;
    api.state.resetAt = new Date(w.h.clock.now().getTime() + 60_000).toISOString();
    const limited = await refresh();
    expect(limited.body).toMatchObject({ status: "rate_limited", rateLimitedUntil: api.state.resetAt,
      message: `rate limited until ${api.state.resetAt}` });
    const requests = api.requests.length;
    api.state.status = 200;
    const second = w.h.newScheduler();
    await second.pollAll();
    await refresh();
    w.h.clock.advance(59_999);
    await second.refresh(id);
    expect(api.requests).toHaveLength(requests);
    expect(await snapshot()).toEqual(before);
    w.h.clock.advance(1);
    expect((await refresh()).body.status).toBe("ok");
    expect(api.requests.length).toBeGreaterThan(requests);
  });

  it("backs off unreachable attempts 5, 10, 20, then 30 minutes, preserving recovery", async () => {
    api.state.unreachable = true;
    for (const [index, minutes] of [5, 10, 20, 30, 30].entries()) {
      await w.h.poller.pollAll();
      expect((await source()).consecutiveFailures).toBe(index + 1);
      const count = api.requests.length;
      w.h.clock.advance(minutes * 60_000 - 1);
      await w.h.poller.pollAll();
      expect(api.requests).toHaveLength(count);
      w.h.clock.advance(1);
    }
    expect(backoffMs(1_000_000)).toBe(1_800_000);
    api.state.unreachable = false;
    await w.h.poller.pollAll();
    expect(await source()).toMatchObject({ status: "ok", consecutiveFailures: 0 });
  });

  it("uses a replaced token on the next poll and exposes neither token in source or audit", async () => {
    api.state.status = 401;
    expect((await refresh()).body.status).toBe("token_rejected");
    await writeFile(w.h.tokensFile, JSON.stringify({ tokens: { owner: "replacement-fixture-token" } }), { mode: 0o600 });
    api.state.status = 200;
    expect((await refresh()).body.status).toBe("ok");
    expect(api.requests.at(-1)?.token).toBe("Bearer replacement-fixture-token");
    const exposed = JSON.stringify([await source(), await w.h.db.select().from(schema.auditRecords)]);
    expect(exposed).not.toContain("replacement-fixture-token");
    expect(exposed).not.toContain("original-fixture-token");
  });

  it("distinguishes missing and unreadable configuration without requests or flags", async () => {
    const before = await snapshot();
    const count = api.requests.length;
    await rm(w.h.tokensFile);
    expect((await refresh()).body.status).toBe("token_missing");
    await writeFile(w.h.tokensFile, "invalid json", { mode: 0o600 });
    expect((await refresh()).body.status).toBe("token_config_unreadable");
    await writeFile(w.h.tokensFile, JSON.stringify({ tokens: {} }), { mode: 0o600 });
    expect((await refresh()).body.status).toBe("token_missing");
    expect(api.requests).toHaveLength(count);
    expect(await snapshot()).toEqual(before);
    expect(inputs).toHaveLength(1);
  });

  it("follows a same-ID rename without changing registration and refuses a replacement ID", async () => {
    api.state.fullName = "moved/new-name";
    expect((await refresh()).body).toMatchObject({ status: "ok", redirectedFullName: "moved/new-name" });
    expect(api.requests.at(-1)?.path).toBe("/repos/moved/new-name/branches/main");
    expect((await w.h.req("GET", `/projects/${id}`)).body).toMatchObject({ githubOwner: "owner", githubRepo: "repo" });
    const before = await snapshot();
    api.state.id = 456;
    const requests = api.requests.length;
    expect((await refresh()).body.status).toBe("identity_changed");
    expect(api.requests.slice(requests).map((r) => r.path)).toEqual(["/repositories/123", "/repos/owner/repo"]);
    expect(await snapshot()).toEqual(before);
  });

  it("a failed sink rolls back the snapshot, source success, login cache and its own audit write", async () => {
    const before = await snapshot();
    const old = await source();
    const logins = await w.h.db.select().from(schema.commitLogins);
    await fixture.commit({ "new.txt": "new" }); await fixture.publish();
    failSink = true;
    expect((await refresh()).body.status).toBe("unreachable");
    expect(await snapshot()).toEqual(before);
    expect((await source()).lastSuccessAt).toEqual(old.lastSuccessAt);
    expect(await w.h.db.select().from(schema.commitLogins)).toEqual(logins);
    expect(await w.h.db.select().from(schema.auditRecords).where(eq(schema.auditRecords.action, "fixture_rollback"))).toEqual([]);
    failSink = false;
    expect((await refresh()).body.status).toBe("ok");
  });

  it("isolates a project's unexpected failure while another project continues polling", async () => {
    api.state.id = 456; api.state.fullName = "owner/second";
    const second = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "second" } });
    expect(second.status).toBe(201);
    const original = api.github.getRepositoryById.bind(api.github);
    vi.spyOn(api.github, "getRepositoryById").mockImplementation(async (...args) => {
      if (args[0] === 123) throw new Error("unexpected transport failure");
      return original(...args);
    });
    await w.h.poller.pollAll();
    expect((await source()).status).toBe("unreachable");
    const [healthy] = await w.h.db.select().from(schema.projectSources).where(eq(schema.projectSources.projectId, second.body.id));
    expect(healthy?.status).toBe("ok");
    expect((await w.h.db.select().from(schema.projectSnapshots))).toHaveLength(2);
  });

  it("detects a rewrite even after mirror deletion and preserves pinned old objects otherwise", async () => {
    const root = await fixture.head();
    await fixture.commit({ "old.txt": "old" }); await fixture.publish(); await refresh();
    const old = await snapshot();
    await fixture.reset(root);
    await fixture.commit({ "new.txt": "new" }); await fixture.publish();
    await rm(join(w.h.home, "mirrors"), { recursive: true });
    expect((await refresh()).body.status).toBe("ok");
    expect(inputs.at(-1)?.rewrite?.evidence.previousHead).toBe(old.headSha);
    expect(inputs.at(-1)?.rewrite?.evidence.droppedCommitCount).toBe(1);
  });

  it("releases session locks even when PostgreSQL aborts a statement", async () => {
    await expect(withProjectLock(w.h.db, id, async (tx) => {
      await tx.execute(sql`select 1 / 0`);
    }, async () => { throw new Error("unexpected busy lock"); })).rejects.toThrow();
    const locks = await w.h.db.execute(sql`select * from pg_locks where locktype = 'advisory' and database = (select oid from pg_database where datname = current_database())`);
    expect(locks).toHaveLength(0);
    expect((await refresh()).body.status).toBe("ok");
  });

  it("stop waits for an active poll and leaves no interval polling after shutdown", async () => {
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const started = new Promise<void>((r) => { entered = r; });
    const original = api.github.getRepositoryById.bind(api.github);
    vi.spyOn(api.github, "getRepositoryById").mockImplementation(async (...args) => { entered(); await gate; return original(...args); });
    const polling = w.h.poller.start();
    await started;
    let stopped = false;
    const stopping = w.h.poller.stop().then(() => { stopped = true; });
    try { await Promise.resolve(); expect(stopped).toBe(false); }
    finally { release(); }
    await polling; await stopping;
    const count = api.requests.length;
    await w.h.poller.pollAll();
    expect(api.requests).toHaveLength(count);
    await expect(w.h.poller.refresh(id)).rejects.toThrow("stopped");
    // No session-level lock leaked to a pooled connection.
    const locks = await w.h.db.execute(sql`select * from pg_locks where locktype = 'advisory' and database = (select oid from pg_database where datname = current_database())`);
    expect(locks).toHaveLength(0);
  });
});
