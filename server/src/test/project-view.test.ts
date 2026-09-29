import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import { projectViewResponseSchema, projectTaskResponseSchema, projectDocumentsResponseSchema, projectFileResponseSchema } from "@moonbeam/shared";
import { flagSink } from "../flags/sink.js";
import { GitFixture } from "./git-fixture.js";
import { fixtureGitHub, world, type World } from "./harness.js";

let w: World, fixture: GitFixture, api: Awaited<ReturnType<typeof fixtureGitHub>>, id: string;
let beforePublish: () => Promise<void>;
const day = 86_400_000;
const taskPath = (id: string, state: string) => `tasks/${state}/${id}-fixture.md`;
const task = (id = "TASK-001", extra = "") => `# ${id}: Fixture\nFormat: DbC task v1\nProposed by: Alice (agent note)\nProposed date: 2025-01-01\nApproved by: Alice\nApproved date: 2025-01-02\nAssigned agent: implementer (model)\nRelated contracts: CONTRACT-001 CONTRACT-999\nRelated ADRs: ADR-001 ADR-999\nDependencies: TASK-002 TASK-999\n${extra}\n## Scope\n### Paths\n- None\n`;
const get = async (suffix: string) => {
  const r = await w.h.req("GET", `/projects/${id}/${suffix}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
async function poll() { await fixture.publish(); expect((await w.h.req("POST", `/projects/${id}/refresh`)).body.status).toBe("ok"); }
async function move(id: string, from: string, to: string, time: string) {
  return fixture.commit({ [taskPath(id, from)]: null, [taskPath(id, to)]: task(id) }, { time });
}
beforeEach(async () => {
  beforePublish = async () => {};
  fixture = await GitFixture.create();
  await fixture.commit({ "README.md": "root" }); await fixture.publish();
  api = await fixtureGitHub(fixture);
  w = await world({ github: api.github, tokens: { owner: "fixture-token" }, remoteUrl: () => fixture.url, flags: { apply: async (tx, input) => { await flagSink.apply(tx, input); await beforePublish(); } } });
  vi.stubEnv("MOONBEAM_HOME", w.h.home);
  w.h.clock.fixedTime = new Date("2025-04-01T12:00:00Z");
  const r = await w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo" } });
  expect(r.status).toBe(201); id = r.body.id;
});
afterEach(async () => { vi.unstubAllEnvs(); await w?.h.close(); await fixture?.dispose(); });

describe("per-project read API", () => {
  it("reports not yet read before a poll without inserting source data", async () => {
    const before = await w.h.db.select().from(schema.auditRecords);
    const v = await get("view");
    expect(projectViewResponseSchema.safeParse(v).success).toBe(true);
    expect(v).toMatchObject({ readState: "not yet read", headSha: null, lastSuccessfulPollAt: null, notCurrent: true, leadDeveloperLabel: "No lead developer", proposed: [] });
    expect((await get("documents")).goalsMessage).toBe("not yet read");
    expect((await get("tasks")).tasks).toEqual([]);
    expect(await w.h.db.select().from(schema.projectSources)).toEqual([]);
    expect(await w.h.db.select().from(schema.auditRecords)).toEqual(before);
  });

  it("provides D1-D3, dependency states, format labels and source notices", async () => {
    const sha = await fixture.commit({ [taskPath("TASK-001", "approved")]: task(),
      [taskPath("TASK-002", "proposed")]: task("TASK-002").replace("Format: DbC task v1\n", ""),
      "docs/contracts/CONTRACT-001-contract.md": "# CONTRACT-001: Contract\nStatus: Approved\n",
      "docs/decisions/ADR-001-choice.md": "# ADR-001: Choice\nStatus: Approved\n" }, { time: "2025-03-01T12:00:00Z" });
    await w.h.req("PUT", `/projects/${id}/lead-developer`, { as: w.A, body: { userId: w.bob.id } });
    api.state.fullName = "renamed/repo"; await poll();
    const v = await get("view");
    expect(v).toMatchObject({ headSha: sha, name: "owner/repo", githubUrl: "https://github.com/renamed/repo", trackedBranch: "main", notCurrent: false, v1FileCount: 1, nonV1FileCount: 1, leadDeveloper: { userId: w.bob.id } });
    expect(v.notices).toEqual(expect.arrayContaining(["now at renamed/repo; update the registration", "token carries write scopes"]));
    expect(v.approved[0]).toMatchObject({ latestApproved: { sha }, staleApproval: true, approvedWaitMs: 31 * day });
    expect(v.approved[0].files[0]).toMatchObject({ assignedAgent: "implementer (model)", approvedBy: { userId: w.alice.id }, approvedDate: "2025-01-02" });
    expect(v.approved[0].files[0].dependencies).toMatchObject([{ id: "TASK-002", found: true, states: ["proposed"] }, { id: "TASK-999", found: false, label: "not found on main" }]);
    expect(v.approved[0].files[0].relatedContracts.map((r: { found: boolean }) => r.found)).toEqual([true, false]);
    expect(v.approved[0].files[0].relatedAdrs.map((r: { found: boolean }) => r.found)).toEqual([true, false]);
    expect(v.proposed[0]).toMatchObject({ firstProposed: { sha }, proposedAgeMs: 31 * day, files: [{ formatLabel: "not DbC task v1", proposedBy: { recorded: "Alice (agent note)" } }] });
    expect((await get("tasks/TASK-002")).flags.some((f: { rule: string }) => f.rule === "FL-7")).toBe(true);
    expect(v.openFlagCount).toBe(v.flags.filter((f: { status: string }) => f.status === "open").length);
  });

  it("returns all history, parse problems, unknown fields, duplicates and historical file labels", async () => {
    await fixture.commit({ [taskPath("TASK-001", "proposed")]: task().replace("Format: DbC task v1\n", "") });
    const approved = await move("TASK-001", "proposed", "approved", "2025-02-01T00:00:00Z");
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task("TASK-001", "Approved date: duplicate\nCustom: preserved").replace("Approved date: 2025-01-02", "Approved date: invalid") });
    await poll();
    const d = await get("tasks/TASK-001");
    expect(projectTaskResponseSchema.safeParse(d).success).toBe(true);
    expect(d.history.map((e: { kind: string }) => e.kind)).toEqual(["enters", "leaves", "enters"]);
    expect(d.history[2].commit).toMatchObject({ sha: approved, isMerge: false, author: { email: "author@example.test" }, committer: { name: "Fixture Author" }, attribution: { label: "not a board member" } });
    expect(d.task.files[0].parsed.header.fields).toContainEqual(expect.objectContaining({ name: "Custom", value: "preserved" }));
    expect(d.task.files[0].problems).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "invalid_date" }), expect.objectContaining({ kind: "duplicate_field" })]));
    expect(d.entries[0].files[0].file.headSha).toBe(approved);
    expect(d.flags.some((f: { rule: string }) => f.rule === "FL-2")).toBe(true);
  });

  it("uses the last approval before first acceptance, exposes merged and direct acceptance", async () => {
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task() }, { time: "2025-02-01T00:00:00Z" });
    await move("TASK-001", "approved", "proposed", "2025-02-02T00:00:00Z");
    await move("TASK-001", "proposed", "approved", "2025-02-03T00:00:00Z");
    await fixture.branch("work"); await move("TASK-001", "approved", "completed", "2025-02-04T00:00:00Z");
    await fixture.checkout("main"); const accepted = await fixture.merge("work", { time: "2025-02-05T00:00:00Z" });
    await move("TASK-001", "completed", "approved", "2025-02-06T00:00:00Z");
    await move("TASK-001", "approved", "completed", "2025-02-07T00:00:00Z");
    await fixture.commit({ [taskPath("TASK-002", "completed")]: task("TASK-002") }, { time: "2025-02-08T00:00:00Z" }); await poll();
    const list = (await get("tasks")).tasks;
    expect(list[0].acceptance).toMatchObject({ kind: "merged", commit: { sha: accepted }, approvalToAcceptanceMs: 2 * day, acceptor: { label: "not a board member" } });
    expect(list[1].acceptance).toMatchObject({ kind: "direct", label: "direct commit", approvalToAcceptanceMs: null });
    expect(list[0].latestApproved.committedAt).toBe("2025-02-06T00:00:00Z");
  });

  it("applies both completed selection rules and exposes the full list", async () => {
    for (let n = 1; n <= 12; n++) {
      const tid = `TASK-${String(n).padStart(3, "0")}`;
      await fixture.commit({ [taskPath(tid, "completed")]: task(tid) }, { time: `2025-01-${String(n).padStart(2, "0")}T00:00:00Z` });
    }
    await poll();
    expect((await get("view")).recentlyCompleted.map((t: { id: string }) => t.id)).toEqual(Array.from({ length: 10 }, (_, i) => `TASK-${String(12 - i).padStart(3, "0")}`));
    expect((await get("tasks")).tasks).toHaveLength(12);
    for (let n = 13; n <= 24; n++) {
      const tid = `TASK-${String(n).padStart(3, "0")}`;
      await fixture.commit({ [taskPath(tid, "completed")]: task(tid) }, { time: `2025-03-${String(n).padStart(2, "0")}T00:00:00Z` });
    }
    await poll(); expect((await get("view")).recentlyCompleted).toHaveLength(12);
    expect((await get("tasks")).tasks).toHaveLength(24);
  });

  it("marks intermediate, removed and withdrawn states and excludes removed link targets", async () => {
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task(), [taskPath("TASK-002", "proposed")]: task("TASK-002"), [taskPath("TASK-003", "approved")]: task("TASK-003") });
    await fixture.commit({ [taskPath("TASK-002", "proposed")]: null, [taskPath("TASK-003", "approved")]: null,
      [taskPath("TASK-004", "in-progress")]: task("TASK-004"), [taskPath("TASK-005", "review")]: task("TASK-005") }); await poll();
    const v = await get("view");
    expect(v.other.map((t: { states: string[] }) => t.states)).toEqual([["withdrawn"], ["removed"], ["in-progress"], ["review"]]);
    expect(v.approved[0].files[0].dependencies[0]).toMatchObject({ found: false, label: "not found on main" });
    expect((await get("tasks/TASK-002")).history.at(-1).kind).toBe("removed");
  });

  it("uses twelve rolling windows and counts boundary entries, commits and raises once", async () => {
    const now = w.h.clock.now().getTime();
    for (const [n, ago] of [[1, 84], [2, 77], [3, 7], [4, 0], [5, -1]] as const) {
      const tid = `TASK-00${n}`;
      await fixture.commit({ [taskPath(tid, "proposed")]: task(tid) }, { time: new Date(now - ago * day).toISOString() });
    }
    await poll(); const v = await get("view");
    expect(v.activity).toHaveLength(12);
    expect(v.activity[0]).toMatchObject({ proposed: 1, commits: 1 });
    expect(v.activity[10]).toMatchObject({ proposed: 1, commits: 1 });
    expect(v.activity[11]).toMatchObject({ proposed: 1, commits: 1, end: w.h.clock.now().toISOString(), flagsRaised: v.flags.length });
    expect(v.activity.reduce((s: number, b: { proposed: number }) => s + b.proposed, 0)).toBe(3);
    w.h.clock.advance(1000); expect((await get("view")).activity[11].end).toBe(w.h.clock.now().toISOString());
  });

  it("maps authors and names at read time, preserving inactive and ambiguous identities", async () => {
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task().replace("Approved by: Alice", "Approved by: Captain (note)") }); await poll();
    const before = (await get("tasks/TASK-001")).task;
    expect(before.latestApproved.attribution.label).toBe("not a board member");
    expect(before.files[0].approvedBy.label).toBe("not a board member");
    const requests = api.requests.length;
    for (const [kind, value] of [["email", "author@example.test"], ["alias", "Captain"]]) {
      expect((await w.h.req("POST", `/users/${w.bob.id}/identities`, { as: w.A, body: { kind, value } })).status).toBe(201);
    }
    await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A });
    const after = (await get("tasks/TASK-001")).task;
    expect(after.latestApproved.attribution).toMatchObject({ userId: w.bob.id, inactive: true });
    expect(after.files[0].approvedBy).toMatchObject({ userId: w.bob.id, inactive: true, recorded: "Captain (note)" });
    expect(api.requests).toHaveLength(requests);
    await w.h.req("POST", `/users/${w.alice.id}/identities`, { as: w.A, body: { kind: "email", value: "author@example.test" } });
    expect((await get("tasks/TASK-001")).task.latestApproved.attribution).toMatchObject({ kind: "ambiguous", label: "not a board member" });
  });

  it("lists document metadata and marks unreadable artifacts without flags", async () => {
    await fixture.commit({ "docs/contracts/CONTRACT-001-good.md": "# CONTRACT-001: Good\nStatus: Approved\nSupersedes: CONTRACT-000\nApproved by: Alice\nApproved date: 2025-01-01\nRelated tasks: TASK-001\n",
      "docs/contracts/CONTRACT-002-bad.md": Buffer.from([255]), "docs/decisions/ADR-001-good.md": "# ADR-001: Choice\nStatus: Approved\nDate: 2025-01-01\n",
      "docs/decisions/ADR-002-bad.md": "No heading", "docs/PROJECT.md": Buffer.alloc(1_048_577, 65) }); await poll();
    const d = await get("documents"); expect(projectDocumentsResponseSchema.safeParse(d).success).toBe(true);
    expect(d.contracts[0]).toMatchObject({ title: "Good", status: "Approved", supersedes: "CONTRACT-000", approvedByAttribution: { userId: w.alice.id }, relatedTasks: "TASK-001" });
    expect(d.contracts[1].status).toBe("could not be read"); expect(d.adrs[1].status).toBe("status unknown");
    expect(d.adrs[0].date).toBe("2025-01-01"); expect(d.goals.status).toBe("could not be read");
    expect((await get("file?path=docs%2FPROJECT.md"))).toMatchObject({ status: "could not be read", reason: "too_large" });
    expect((await get("view")).flags.some((f: { rule: string }) => f.rule === "FL-7")).toBe(false);
    await fixture.commit({ "docs/PROJECT.md": null }); await poll();
    expect((await get("documents")).goalsMessage).toBe("No project definition found");
  });

  it("serves raw JSON only from the snapshot head and rejects every other path", async () => {
    const raw = "# Goals\n<script>alert('raw')</script>";
    const sha = await fixture.commit({ "docs/PROJECT.md": raw, [taskPath("TASK-001", "proposed")]: task(), "tasks/README.md": "ignored", "secret.md": "secret" }); await poll();
    const refs = await fixture.git(["show-ref"], {}, fixture.remote);
    const audits = await w.h.db.select().from(schema.auditRecords);
    const source = await w.h.db.select().from(schema.projectSources);
    const requests = api.requests.length;
    await fixture.commit({ "docs/PROJECT.md": "unpushed change" });
    const f = await get("file?path=docs%2FPROJECT.md"); expect(projectFileResponseSchema.safeParse(f).success).toBe(true);
    expect(f).toMatchObject({ text: raw, status: "ok", headSha: sha, file: { githubUrl: `https://github.com/owner/repo/blob/${sha}/docs/PROJECT.md` } });
    const response = await fetch(`${w.h.base}/api/projects/${id}/file?path=docs%2FPROJECT.md`);
    expect(response.headers.get("content-type")).toContain("application/json");
    for (const path of ["secret.md", "tasks/README.md", "../docs/PROJECT.md", "/docs/PROJECT.md", "docs/./PROJECT.md", "docs/PROJECT.md\0", ".git/config", "docs%2FPROJECT.md"]) {
      expect((await w.h.req("GET", `/projects/${id}/file?path=${encodeURIComponent(path)}`)).body.error.category).toBe("not_found");
    }
    expect((await w.h.req("GET", `/projects/${id}/file`)).status).toBe(404);
    expect((await w.h.req("GET", `/projects/${id}/file?path=a&path=b`)).status).toBe(404);
    expect(await w.h.db.select().from(schema.auditRecords)).toEqual(audits);
    expect(await w.h.db.select().from(schema.projectSources)).toEqual(source);
    expect(api.requests).toHaveLength(requests); expect(await fixture.git(["show-ref"], {}, fixture.remote)).toBe(refs);
  });

  it("preserves last-known data across failures and missing mirrors", async () => {
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task() }); await poll();
    const v = await get("view");
    w.h.clock.advance(day); api.state.unreachable = true;
    await w.h.req("POST", `/projects/${id}/refresh`);
    for (const suffix of ["view", "tasks", "tasks/TASK-001", "documents", `file?path=${encodeURIComponent(taskPath("TASK-001", "approved"))}`]) {
      expect(await get(suffix)).toMatchObject({ headSha: v.headSha, lastSuccessfulPollAt: v.lastSuccessfulPollAt, notCurrent: true, source: { status: "unreachable" } });
    }
    expect((await get("view")).approved).toEqual(v.approved);
    await rm(join(w.h.home, "mirrors", `${id}.git`), { recursive: true, force: true });
    expect(await get(`file?path=${encodeURIComponent(taskPath("TASK-001", "approved"))}`)).toMatchObject({ text: null, status: "not available until the next poll", headSha: v.headSha });
    expect((await get("view")).approved).toEqual(v.approved);
  });

  it("shows open flags first, all notes and evidence, with current attribution", async () => {
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task() }); await poll();
    const initial = await get("view"); const flag = initial.flags.find((f: { rule: string }) => f.rule === "FL-5");
    await w.h.req("POST", `/flags/${flag.id}/dismiss`, { as: w.A, body: { note: "Board reviewed" } });
    const v = await get("view");
    expect(v.flags.at(-1)).toMatchObject({ id: flag.id, status: "dismissed", ruleName: "Stale approval", notes: [{ note: "Board reviewed", actorUserId: w.alice.id }] });
    expect(v.flags[0].status).toBe("open"); expect(v.flags.at(-1).evidence).toEqual(flag.evidence);
    expect(v.flags.find((f: { rule: string }) => f.rule === "FL-8").attributions.length).toBeGreaterThan(0);
  });

  it("handles empty projects, incompatible snapshots, unknown and archived IDs", async () => {
    await poll(); expect((await get("view")).notices).toContain("No DbC task directories found");
    expect((await w.h.req("GET", "/projects/bad/view")).status).toBe(404);
    expect((await w.h.req("GET", `/projects/${id}/tasks/TASK-999`)).body.error.details.headSha).toBeTruthy();
    await w.h.db.update(schema.projectSnapshots).set({ snapshotVersion: 0 }).where(eq(schema.projectSnapshots.projectId, id));
    expect((await get("view"))).toMatchObject({ readState: "not available until the next poll", notCurrent: true, proposed: [] });
    await w.h.req("DELETE", `/projects/${id}`, { as: w.A });
    expect((await w.h.req("GET", `/projects/${id}/view`)).status).toBe(404);
  });
  it("never mixes old history with a poll's uncommitted source and flags", async () => {
    await fixture.commit({ [taskPath("TASK-001", "proposed")]: task() }); await poll();
    const old = await get("view");
    const sha = await move("TASK-001", "proposed", "approved", "2025-03-01T00:00:00Z");
    await fixture.publish(); w.h.clock.advance(day);
    let release!: () => void, arrived!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    const reached = new Promise<void>((r) => { arrived = r; });
    beforePublish = async () => { arrived(); await held; };
    const polling = w.h.req("POST", `/projects/${id}/refresh`);
    try {
      await reached;
      const during = await get("view");
      expect(during.headSha).toBe(old.headSha);
      expect(during.lastSuccessfulPollAt).toBe(old.lastSuccessfulPollAt);
      expect(during.proposed).toEqual(old.proposed);
      expect(during.flags).toEqual(old.flags);
    } finally { release(); await polling; }
    const after = await get("view");
    expect(after.headSha).toBe(sha); expect(after.proposed).toEqual([]);
    expect(after.approved).toHaveLength(1); expect(after.flags.some((f: { rule: string }) => f.rule === "FL-5")).toBe(true);
  });

  it("uses strict FL-5 thresholds and the latest approved entry", async () => {
    const now = w.h.clock.now().getTime();
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task() }, { time: new Date(now - 14 * day).toISOString() }); await poll();
    expect((await get("view")).approved[0]).toMatchObject({ staleApproval: false, approvedWaitMs: 14 * day });
    w.h.clock.advance(1); await poll();
    expect((await get("view")).approved[0].staleApproval).toBe(true);
    await move("TASK-001", "approved", "proposed", "2025-04-01T10:00:00Z");
    await move("TASK-001", "proposed", "approved", "2025-04-01T11:00:00Z"); await poll();
    expect((await get("view")).approved[0]).toMatchObject({ staleApproval: false, approvedWaitMs: 3_600_001 });
  });

  it("includes the exact 30-day boundary beyond the minimum ten", async () => {
    const now = w.h.clock.now().getTime();
    for (let n = 1; n <= 12; n++) {
      const tid = `TASK-${String(n).padStart(3, "0")}`;
      await fixture.commit({ [taskPath(tid, "completed")]: task(tid) }, { time: new Date(now - (n === 1 ? 30 * day + 1000 : n === 2 ? 30 * day : n * day)).toISOString() });
    }
    await poll(); const recent = (await get("view")).recentlyCompleted;
    expect(recent).toHaveLength(11); expect(recent.at(-1).id).toBe("TASK-002");
    expect(recent.some((t: { id: string }) => t.id === "TASK-001")).toBe(false);
  });

  it("keeps duplicate and unreadable task files visible without choosing one state", async () => {
    await fixture.commit({ [taskPath("TASK-001", "approved")]: task(),
      [taskPath("TASK-001", "review")]: task().replace("Format: DbC task v1\n", ""),
      [taskPath("TASK-002", "proposed")]: Buffer.from([255]) }); await poll();
    const d = await get("tasks/TASK-001");
    expect(d.task.states).toEqual(["approved", "review"]); expect(d.task.files).toHaveLength(2);
    expect(d.task.staleApproval).toBe(false);
    const unreadable = await get("tasks/TASK-002");
    expect(unreadable.task.files[0]).toMatchObject({ parsed: null, read: "not_utf8", formatLabel: "could not be read" });
    expect(unreadable.flags.some((f: { rule: string }) => f.rule === "FL-7")).toBe(true);
    expect(await get(`file?path=${encodeURIComponent(taskPath("TASK-002", "proposed"))}`)).toMatchObject({ status: "could not be read", reason: "not_utf8" });
  });

});
