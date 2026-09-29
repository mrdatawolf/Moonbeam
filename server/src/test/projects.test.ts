import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import { world, expectRejected, type World } from "./harness.js";
import type { GitHubApi } from "../github/api.js";

const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const TOKEN = "fake-host-secret-12345678";
const commitTime = "2026-09-01T12:00:00.000Z";
const ok = <T>(data: T) => ({ kind: "ok" as const, data, etag: null });
function fake() {
  return {
    getRepository: vi.fn<GitHubApi["getRepository"]>().mockResolvedValue(ok({ id: 123, fullName: "Canonical/Repository", redirected: true, writeScopes: null })),
    getRepositoryById: vi.fn<GitHubApi["getRepositoryById"]>().mockResolvedValue(ok({ id: 123, fullName: "Canonical/Repository", redirected: false, writeScopes: null })),
    getBranchHead: vi.fn<GitHubApi["getBranchHead"]>().mockResolvedValue(ok({ sha: SHA })),
    getCommit: vi.fn<GitHubApi["getCommit"]>().mockImplementation(async (_o, _r, sha) => ok({ sha, committerTime: commitTime })),
    listCommitLogins: vi.fn<GitHubApi["listCommitLogins"]>().mockResolvedValue(ok([])),
  };
}
let w: World;
let github: ReturnType<typeof fake>;
beforeEach(async () => { github = fake(); w = await world({ github, tokens: { owner: TOKEN, second: "another-host-secret-abcd" } }); });
afterEach(async () => { await w?.h.close(); });
const register = (body = {}) => w.h.req("POST", "/projects", { as: w.A, body: { owner: "owner", repo: "repo", ...body } });
const audits = () => w.h.db.select().from(schema.auditRecords);

describe("project registrations", () => {
  it("stores S1 defaults and canonical repository facts, exposes decimal ID, and audits selected actor", async () => {
    const response = await register();
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Canonical/Repository", githubOwner: "Canonical", githubRepo: "Repository", githubRepoId: "123", tokenLabel: "owner", trackedBranch: "main", baselineSha: SHA, baselineCommittedAt: commitTime, exemptPaths: [], staleThresholdDays: 14, leadDeveloperUserId: null, registeredByUserId: w.alice.id, removedAt: null });
    expect(github.getBranchHead).toHaveBeenCalledWith("Canonical", "Repository", "main", TOKEN);
    expect((await w.h.req("GET", "/projects")).body.projects).toEqual([response.body]);
    expect((await w.h.req("GET", `/projects/${response.body.id}`)).body).toEqual(response.body);
    const log = (await audits()).find((a) => a.action === "project_registered")!;
    expect(log).toMatchObject({ actorUserId: w.alice.id, identityMode: "selected", projectId: response.body.id, details: { before: null, after: response.body } });
    expect(JSON.stringify(await audits())).not.toContain(TOKEN);
  });
  it("accepts all explicit fields and checks the supplied baseline", async () => {
    const r = await register({ name: "Display", trackedBranch: "release", tokenLabel: "SECOND", leadDeveloperUserId: w.bob.id, baselineSha: OTHER, exemptPaths: ["README.md", "docs/"], staleThresholdDays: 7 });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: "Display", trackedBranch: "release", tokenLabel: "SECOND", leadDeveloperUserId: w.bob.id, baselineSha: OTHER, exemptPaths: ["README.md", "docs/"], staleThresholdDays: 7 });
    expect(github.getCommit).toHaveBeenCalledWith("Canonical", "Repository", OTHER, "another-host-secret-abcd");
  });
  it("rejects duplicate IDs, including concurrent registration through different names", async () => {
    const result = await Promise.all([register(), register({ repo: "alias" })]);
    expect(result.map((r) => r.status).sort()).toEqual([201, 422]);
    expect((await w.h.db.select().from(schema.projects))).toHaveLength(1);
    expect((await audits()).filter((a) => a.projectId)).toHaveLength(1);
  });
  it("changes local fields without GitHub and audits complete before/after", async () => {
    const { body: before } = await register();
    github.getRepositoryById.mockResolvedValue({ kind: "unreachable" });
    const r = await w.h.req("PATCH", `/projects/${before.id}`, { as: w.B, body: { name: "Changed", exemptPaths: ["a/**"], staleThresholdDays: 30 } });
    expect(r.status).toBe(200);
    expect(github.getRepositoryById).not.toHaveBeenCalled();
    expect((await audits()).find((a) => a.action === "project_updated")).toMatchObject({ actorUserId: w.bob.id, details: { before, after: r.body } });
  });
  it("resolves remote edits by numeric ID without silently renaming; resets branch baseline and cursor", async () => {
    const { body: p } = await register();
    await w.h.db.insert(schema.projectSources).values({ projectId: p.id, status: "ok", statusSince: new Date(), lastProcessedHead: SHA, repoEtag: "old" });
    await w.h.db.insert(schema.projectSnapshots).values({ projectId: p.id, headSha: SHA, polledAt: new Date(), snapshotVersion: 1, snapshot: { kept: true } });
    github.getRepositoryById.mockResolvedValue(ok({ id: 123, fullName: "Moved/New", redirected: true, writeScopes: null }));
    github.getBranchHead.mockResolvedValue(ok({ sha: OTHER }));
    const r = await w.h.req("PATCH", `/projects/${p.id}`, { as: w.A, body: { trackedBranch: "release" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ trackedBranch: "release", baselineSha: OTHER, githubOwner: "Canonical", githubRepo: "Repository" });
    expect(github.getRepositoryById).toHaveBeenCalledWith(123, "Canonical/Repository", TOKEN);
    expect(github.getBranchHead).toHaveBeenLastCalledWith("Moved", "New", "release", TOKEN);
    expect((await w.h.db.select().from(schema.projectSources))[0]).toMatchObject({ lastProcessedHead: null, repoEtag: null, status: "never_polled" });
    expect((await w.h.db.select().from(schema.projectSnapshots))[0]?.snapshot).toEqual({ kept: true });
  });
  it("supports an explicit baseline with a branch change and preserves it on a same-branch update", async () => {
    const { body: p } = await register();
    let r = await w.h.req("PATCH", `/projects/${p.id}`, { as: w.A, body: { trackedBranch: "next", baselineSha: OTHER } });
    expect(r.body.baselineSha).toBe(OTHER);
    r = await w.h.req("PATCH", `/projects/${p.id}`, { as: w.A, body: { trackedBranch: "next", tokenLabel: "second" } });
    expect(r.body.baselineSha).toBe(OTHER);
  });
  it("permits an explicit same-ID rename, refuses a different ID atomically", async () => {
    const { body: p } = await register();
    github.getRepository.mockResolvedValue(ok({ id: 456, fullName: "Other/Repo", redirected: false, writeScopes: null }));
    let r = await w.h.req("PATCH", `/projects/${p.id}`, { as: w.A, body: { owner: "Other", repo: "Repo", name: "Wrong" } });
    expectRejected(r, "validation", 422);
    expect(r.body.error.message).toBe("repository identity differs");
    expect((await w.h.req("GET", `/projects/${p.id}`)).body).toEqual(p);
    github.getRepository.mockResolvedValue(ok({ id: 123, fullName: "Other/Repo", redirected: false, writeScopes: null }));
    r = await w.h.req("PATCH", `/projects/${p.id}`, { as: w.A, body: { owner: "Other", repo: "Repo" } });
    expect(r.body).toMatchObject({ githubOwner: "Other", githubRepo: "Repo", baselineSha: SHA });
    expect((await audits()).filter((a) => a.action === "project_updated")).toHaveLength(1);
  });
  it("assigns and clears lead developer with audit, refuses unknown/inactive users", async () => {
    const { body: p } = await register();
    for (const userId of [w.bob.id, null]) {
      const r = await w.h.req("PUT", `/projects/${p.id}/lead-developer`, { as: w.A, body: { userId } });
      expect(r.body.leadDeveloperUserId).toBe(userId);
    }
    await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A });
    for (const userId of [w.bob.id, "00000000-0000-4000-8000-000000000001"]) {
      expectRejected(await w.h.req("PUT", `/projects/${p.id}/lead-developer`, { as: w.A, body: { userId } }), "validation");
      expectRejected(await register({ leadDeveloperUserId: userId, repo: "other" }), "validation");
    }
    expect((await audits()).filter((a) => a.action === "project_lead_developer_changed")).toHaveLength(2);
  });
  it("soft-removes, retains data and audit, and permits re-registration", async () => {
    const { body: p } = await register();
    await w.h.db.insert(schema.projectSnapshots).values({ projectId: p.id, headSha: SHA, polledAt: new Date(), snapshotVersion: 1, snapshot: {} });
    expect((await w.h.req("DELETE", `/projects/${p.id}`, { as: w.B })).status).toBe(204);
    expect((await w.h.req("GET", "/projects")).body.projects).toEqual([]);
    expectRejected(await w.h.req("GET", `/projects/${p.id}`), "not_found");
    expect((await w.h.db.select().from(schema.projects).where(eq(schema.projects.id, p.id)))[0]?.removedAt).toBeInstanceOf(Date);
    expect(await w.h.db.select().from(schema.projectSnapshots)).toHaveLength(1);
    expect((await register()).status).toBe(201);
    expect((await audits()).find((a) => a.action === "project_removed")).toMatchObject({ actorUserId: w.bob.id, details: { before: p, after: { id: p.id, removedAt: expect.any(String) } } });
  });
  it("requires a selected active user for every action, before parsing body or accessing GitHub", async () => {
    for (const [method, path] of [["POST", "/projects"], ["PATCH", "/projects/bad"], ["DELETE", "/projects/bad"], ["PUT", "/projects/bad/lead-developer"]]) {
      expectRejected(await w.h.req(method!, path!, { body: {} }), "unidentified", 401);
    }
    expect(github.getRepository).not.toHaveBeenCalled();
    expectRejected(await w.h.req("GET", "/projects/bad"), "not_found", 404);
  });
  it.each([
    ["not_found", "validation", 422, "Repository not found or not accessible."],
    ["unauthorized", "validation", 422, "Token rejected"],
    ["unreachable", "github_unavailable", 503, "unavailable"],
    ["rate_limited", "github_unavailable", 503, "rate limited"],
  ] as const)("maps %s failures and stores nothing", async (kind, category, status, message) => {
    github.getRepository.mockResolvedValue(kind === "rate_limited" ? { kind, resetAt: null } : { kind });
    const r = await register();
    expectRejected(r, category, status);
    expect(r.body.error.message).toContain(message);
    expect(await w.h.db.select().from(schema.projects)).toHaveLength(0);
    expect((await audits()).filter((a) => a.projectId)).toHaveLength(0);
  });
  it("refuses missing branch/baseline and catches exceptions without leaking token into logs or errors", async () => {
    github.getBranchHead.mockResolvedValueOnce({ kind: "not_found" });
    expectRejected(await register(), "validation");
    github.getCommit.mockResolvedValueOnce({ kind: "not_found" });
    expectRejected(await register({ baselineSha: OTHER }), "validation");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      github.getRepository.mockRejectedValueOnce(new Error(TOKEN));
      const r = await register();
      expectRejected(r, "github_unavailable");
      expect(JSON.stringify(r.body)).not.toContain(TOKEN);
      expect(log).not.toHaveBeenCalled();
      expect(await w.h.db.select().from(schema.projects)).toHaveLength(0);
    } finally { log.mockRestore(); }
  });
  it("failed remote update rolls back all fields and audit", async () => {
    const { body: p } = await register();
    github.getBranchHead.mockResolvedValue({ kind: "not_found" });
    expectRejected(await w.h.req("PATCH", `/projects/${p.id}`, { as: w.A, body: { name: "No", trackedBranch: "missing" } }), "validation");
    expect((await w.h.req("GET", `/projects/${p.id}`)).body).toEqual(p);
    expect((await audits()).filter((a) => a.action === "project_updated")).toHaveLength(0);
  });
  it("lists only masked tokens, re-reads changes, and reports missing/unreadable configuration", async () => {
    let r = await w.h.req("GET", "/github/tokens");
    expect(r.body).toEqual({ state: "ok", tokens: [{ label: "owner", masked: "••••5678" }, { label: "second", masked: "••••abcd" }] });
    expect(JSON.stringify(r.body)).not.toContain(TOKEN);
    expectRejected(await register({ tokenLabel: "absent" }), "validation");
    await writeFile(w.h.tokensFile, JSON.stringify({ tokens: { OWNER: "replacement-secret-9876" } }));
    expect((await register()).status).toBe(201);
    expect(github.getRepository).toHaveBeenLastCalledWith("owner", "repo", "replacement-secret-9876");
    await writeFile(w.h.tokensFile, "broken");
    expect((await w.h.req("GET", "/github/tokens")).body).toEqual({ state: "unreadable", tokens: [] });
    expectRejected(await register(), "validation");
    await rm(w.h.tokensFile);
    expect((await w.h.req("GET", "/github/tokens")).body).toEqual({ state: "missing", tokens: [] });
    expectRejected(await register(), "validation");
  });
  it.each([{ owner: "" }, { repo: "a/b" }, { staleThresholdDays: 0 }, { staleThresholdDays: 1.5 }, { baselineSha: "bad" }, { exemptPaths: [""] }, { trackedBranch: " " }])("validates input %j before GitHub", async (body) => {
    expectRejected(await register(body), "validation");
    expect(github.getRepository).not.toHaveBeenCalled();
  });
});
