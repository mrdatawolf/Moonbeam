import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import { dashboardResponseSchema } from "@moonbeam/shared";
import { ProjectViewsService } from "../views/project.js";
import { GitFixture } from "./git-fixture.js";
import { fixtureGitHub, world, type World } from "./harness.js";

let w: World, fixture: GitFixture, api: Awaited<ReturnType<typeof fixtureGitHub>>;
const day = 86_400_000;
const path = (id: string, state: string) => `tasks/${state}/${id}-example.md`;
const task = (id: string) => `# ${id}: Example\nFormat: DbC task v1\nProposed by: Alice\nProposed date: 2025-01-01\nApproved by: Alice\nApproved date: 2025-01-02\nRelated contracts: None\nRelated ADRs: None\nDependencies: None\n## Scope\n### Paths\n- None\n`;
async function register(name: string, numericId: number) {
  api.state.id = numericId;
  const r = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: name, name } });
  expect(r.status).toBe(201);
  return r.body.id as string;
}
async function poll(id: string, numericId: number) {
  api.state.id = numericId;
  await fixture.publish();
  expect((await w.h.req("POST", `/projects/${id}/refresh`)).body.status).toBe("ok");
}
async function dashboard() {
  const r = await w.h.req("GET", "/dashboard");
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return dashboardResponseSchema.parse(r.body);
}
beforeEach(async () => {
  fixture = await GitFixture.create();
  await fixture.commit({ "README.md": "root" }); await fixture.publish();
  api = await fixtureGitHub(fixture);
  w = await world({ github: api.github, tokens: { owner: "fixture-token" }, remoteUrl: () => fixture.url });
  w.h.clock.fixedTime = new Date("2025-04-01T12:00:00Z");
});
afterEach(async () => { vi.restoreAllMocks(); await w?.h.close(); await fixture?.dispose(); });

describe("cross-project dashboard", () => {
  it("is a viewer read with empty lists and no writes or GitHub calls", async () => {
    const audits = await w.h.db.select().from(schema.auditRecords);
    expect(await dashboard()).toEqual({ projects: [], recentAcceptances: [], recentFlags: [] });
    expect(api.requests).toEqual([]);
    expect(await w.h.db.select().from(schema.auditRecords)).toEqual(audits);
  });

  it("keeps never-polled and failing projects alongside healthy projects, with last-known data", async () => {
    const healthy = await register("Healthy", 1);
    const failing = await register("Failing", 2);
    const never = await register("Never", 3);
    await fixture.commit({ [path("TASK-001", "proposed")]: task("TASK-001"), [path("TASK-002", "approved")]: task("TASK-002") }, { time: "2025-03-01T12:00:00Z" });
    await poll(healthy, 1); await poll(failing, 2);
    await w.h.req("PUT", `/projects/${healthy}/lead-developer`, { as: w.A, body: { userId: w.bob.id } });
    await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A });
    const before = await dashboard();
    api.state.unreachable = true; w.h.clock.advance(day);
    await w.h.req("POST", `/projects/${failing}/refresh`);
    const requests = api.requests.length;
    const audits = await w.h.db.select().from(schema.auditRecords);
    const data = await dashboard();
    expect(data.projects.map((p) => p.name)).toEqual(["Failing", "Healthy", "Never"]);
    expect(data.projects.find((p) => p.projectId === healthy)).toMatchObject({ proposedCount: 1, approvedCount: 1, staleApprovalCount: 1, notCurrent: false, leadDeveloper: { displayName: "Bob", inactive: true } });
    expect(data.projects.find((p) => p.projectId === failing)).toMatchObject({ headSha: before.projects[0]!.headSha, lastSuccessfulPollAt: before.projects[0]!.lastSuccessfulPollAt, proposedCount: 1, approvedCount: 1, notCurrent: true, source: { status: "unreachable" } });
    expect(data.projects.find((p) => p.projectId === never)).toMatchObject({ headSha: null, lastSuccessfulPollAt: null, source: null, readState: "not yet read", notCurrent: true, leadDeveloperLabel: "No lead developer" });
    expect(api.requests).toHaveLength(requests);
    expect(await w.h.db.select().from(schema.auditRecords)).toEqual(audits);
    expect(await w.h.db.select().from(schema.projectSources).where(eq(schema.projectSources.projectId, never))).toEqual([]);
  });

  it("counts only open FL-5 records and retains dismissed flags in recent raises", async () => {
    const id = await register("One", 1);
    await fixture.commit({ [path("TASK-001", "approved")]: task("TASK-001") }, { time: "2025-03-01T00:00:00Z" }); await poll(id, 1);
    const before = await dashboard();
    const flag = before.recentFlags.find((f) => f.flag.rule === "FL-5")!.flag;
    expect(before.projects[0]!.staleApprovalCount).toBe(1);
    expect((await w.h.req("POST", `/flags/${flag.id}/dismiss`, { as: w.A, body: { note: "Reviewed" } })).status).toBe(200);
    const after = await dashboard();
    expect(after.projects[0]!.staleApprovalCount).toBe(0);
    expect(after.projects[0]!.approvedCount).toBe(1);
    expect(after.projects[0]!.openFlagCount).toBe(before.projects[0]!.openFlagCount - 1);
    expect(after.recentFlags.find((f) => f.flag.id === flag.id)!.flag).toMatchObject({ status: "dismissed", firstRaisedAt: flag.firstRaisedAt });
  });

  it("selects ten globally, uses inclusive 30-day boundaries, and excludes archived projects", async () => {
    const a = await register("A", 1), b = await register("B", 2);
    const now = w.h.clock.now().getTime();
    for (let n = 1; n <= 14; n++) {
      const id = `TASK-${String(n).padStart(3, "0")}`;
      const ago = n === 1 ? 30 * day + 1000 : n === 2 ? 30 * day : n === 14 ? -day : (14 - n) * day;
      await fixture.commit({ [path(id, "completed")]: task(id) }, { time: new Date(now - ago).toISOString() });
    }
    await poll(a, 1); w.h.clock.advance(1); await poll(b, 2);
    const data = await dashboard();
    expect(data.projects.map((p) => p.completedLast30Days)).toEqual([11, 11]); // boundary has aged by 1ms
    expect(data.recentAcceptances).toHaveLength(10);
    expect(data.recentAcceptances.slice(0, 2).map((a) => a.task.id)).toEqual(["TASK-014", "TASK-014"]);
    expect(new Set(data.recentAcceptances.map((a) => a.projectId))).toEqual(new Set([a, b]));
    expect(data.recentFlags).toHaveLength(10);
    expect(data.recentFlags.every((f) => f.projectId === b)).toBe(true);
    w.h.clock.advance(-1);
    expect((await dashboard()).projects.map((p) => p.completedLast30Days)).toEqual([12, 12]);
    await w.h.req("DELETE", `/projects/${b}`, { as: w.A });
    const archived = await dashboard();
    expect(archived.projects.map((p) => p.projectId)).toEqual([a]);
    expect(archived.recentFlags.every((f) => f.projectId === a)).toBe(true);
    expect(archived.recentAcceptances.every((t) => t.projectId === a)).toBe(true);
  });

  it("keeps all rows on one database snapshot during a concurrent registration change", async () => {
    await register("A", 1);
    const b = await register("B", 2);
    let release!: () => void, arrived!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const reached = new Promise<void>((resolve) => { arrived = resolve; });
    const original = ProjectViewsService.prototype.view;
    let first = true;
    vi.spyOn(ProjectViewsService.prototype, "view").mockImplementation(async function (this: ProjectViewsService, id: string) {
      const result = await original.call(this, id);
      if (first) { first = false; arrived(); await held; }
      return result;
    });
    const reading = dashboard();
    try {
      await reached;
      await w.h.db.update(schema.projects).set({ name: "Changed" }).where(eq(schema.projects.id, b));
    } finally { release(); }
    expect((await reading).projects.map((p) => p.name)).toEqual(["A", "B"]);
    expect((await dashboard()).projects.map((p) => p.name)).toEqual(["A", "Changed"]);
  });

  it("labels incompatible snapshots without hiding other registrations", async () => {
    const a = await register("A", 1), b = await register("B", 2);
    await poll(a, 1); await poll(b, 2);
    await w.h.db.update(schema.projectSnapshots).set({ snapshotVersion: 0 }).where(eq(schema.projectSnapshots.projectId, a));
    const data = await dashboard();
    expect(data.projects[0]).toMatchObject({ readState: "not available until the next poll", notCurrent: true, proposedCount: 0 });
    expect(data.projects[1]).toMatchObject({ readState: "ready", notCurrent: false });
  });
});
