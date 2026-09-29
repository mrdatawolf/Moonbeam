import { describe, expect, it, vi } from "vitest";
import { RestGitHubApi } from "./api.js";

const token = "test-private-token";
const sha = "a".repeat(40);
const response = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(status === 304 ? null : JSON.stringify(body), { status, headers });
function stub(...responses: (Response | Error)[]) {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    expect(init?.method).toBe("GET");
    expect(url.origin).toBe("https://stub.test");
    expect(url.href).not.toContain(token);
    expect(init?.body).toBeUndefined();
    calls.push({ url, init: init! });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("Unexpected request");
    return next;
  };
  return { calls, api: new RestGitHubApi({ fetch: fetcher, baseUrl: "https://stub.test", now: () => Date.UTC(2025, 0, 1) }) };
}
describe("GET-only GitHub API", () => {
  it("returns ID, canonical name, redirect, scopes and ETag", async () => {
    const { api, calls } = stub(response({ id: 42, full_name: "new/name" }, 200, { etag: '"v1"', "x-oauth-scopes": "read:user, repo, public_repo, write:org, repo:status" }));
    expect(await api.getRepository("old", "name", token, '"v0"')).toEqual({ kind: "ok", data: { id: 42, fullName: "new/name", redirected: true, writeScopes: ["repo", "public_repo", "write:org"] }, etag: '"v1"' });
    expect(calls[0]?.url.pathname).toBe("/repos/old/name");
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${token}`, "If-None-Match": '"v0"' });
  });
  it("resolves recorded identity by numeric ID and rejects a mismatched ID", async () => {
    const { api, calls } = stub(response({ id: 42, full_name: "moved/name" }), response({ id: 999, full_name: "old/name" }));
    expect(await api.getRepositoryById(42, "old/name", token)).toMatchObject({ kind: "ok", data: { id: 42, redirected: true, writeScopes: null } });
    expect(calls[0]?.url.pathname).toBe("/repositories/42");
    expect(await api.getRepositoryById(42, "old/name", token)).toEqual({ kind: "not_found" });
  });
  it("distinguishes absent scopes from reported read-only scopes", async () => {
    const { api } = stub(response({ id: 42, full_name: "o/r" }, 200, { "x-oauth-scopes": "read:user" }));
    expect(await api.getRepository("o", "r", token)).toMatchObject({ data: { writeScopes: [], redirected: false } });
  });
  it("reads encoded branch names and commit times", async () => {
    const { api, calls } = stub(response({ commit: { sha } }), response({ sha, commit: { committer: { date: "2025-01-01T00:00:00Z" } } }));
    expect(await api.getBranchHead("o", "r", "feature/name", token)).toMatchObject({ kind: "ok", data: { sha } });
    expect(calls[0]?.url.pathname).toBe("/repos/o/r/branches/feature%2Fname");
    expect(await api.getCommit("o", "r", sha, token)).toMatchObject({ kind: "ok", data: { sha, committerTime: "2025-01-01T00:00:00Z" } });
  });
  it.each([[401, "unauthorized"], [403, "unauthorized"], [404, "not_found"], [500, "unreachable"], [503, "unreachable"]] as const)("maps HTTP %s to %s without returning its body", async (status, kind) => {
    const { api } = stub(response({ secret: token }, status));
    expect(await api.getBranchHead("o", "r", "missing", token)).toEqual({ kind });
  });
  it("handles conditional 304", async () => {
    const { api } = stub(response(null, 304, { etag: '"same"' }));
    expect(await api.getRepository("o", "r", token, '"same"')).toEqual({ kind: "not_modified", etag: '"same"' });
  });
  it.each([
    [403, { "x-ratelimit-reset": "1735689660" }, "2025-01-01T00:01:00.000Z"],
    [429, { "retry-after": "120" }, "2025-01-01T00:02:00.000Z"],
    [403, { "retry-after": "Wed, 01 Jan 2025 00:03:00 GMT" }, "2025-01-01T00:03:00.000Z"],
    [429, {}, null],
  ] as const)("maps rate limiting with reset/retry headers (%s, %j)", async (status, headers, resetAt) => {
    const { api } = stub(response({}, status, headers));
    expect(await api.getRepository("o", "r", token)).toEqual({ kind: "rate_limited", resetAt });
  });
  it("contains network errors, malformed JSON, and invalid payloads", async () => {
    const { api } = stub(new Error(token), new Response(token), response({ id: "bad", full_name: token }));
    for (let i = 0; i < 3; i++) expect(await api.getRepository("o", "r", token)).toEqual({ kind: "unreachable" });
  });
  it("times out even while waiting for the body, and aborts the request", async () => {
    let signal: AbortSignal | null | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      signal = init?.signal;
      return { status: 200, headers: new Headers(), json: () => new Promise(() => {}) } as Response;
    };
    const api = new RestGitHubApi({ fetch: fetcher, timeoutMs: 5 });
    expect(await api.getRepository("o", "r", token)).toEqual({ kind: "unreachable" });
    expect(signal?.aborted).toBe(true);
  });
  it("follows same-origin redirects but never forwards credentials across origins", async () => {
    const { api, calls } = stub(response(null, 301, { location: "/repositories/42" }), response({ id: 42, full_name: "new/r" }), response(null, 302, { location: "https://elsewhere.test/steal" }));
    expect(await api.getRepository("o", "r", token)).toMatchObject({ kind: "ok", data: { redirected: true } });
    expect(await api.getRepository("o", "r", token)).toEqual({ kind: "unreachable" });
    expect(calls).toHaveLength(3);
    expect(calls[1]?.url.pathname).toBe("/repositories/42");
  });
  it("paginates logins, stops at a known SHA, and keeps unlinked authors null", async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ sha: i.toString(16).padStart(40, "0"), author: i === 0 ? null : { login: `user${i}` } }));
    const { api, calls } = stub(response(entries), response([{ sha, author: null }, { sha: "b".repeat(40), author: { login: "known" } }, { sha: "c".repeat(40), author: null }]));
    const result = await api.listCommitLogins("o", "r", "main", new Set(["b".repeat(40)]), token);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("Expected logins");
    expect(result.data).toHaveLength(101);
    expect(result.data[0]?.login).toBeNull();
    expect(result.data.at(-1)).toEqual({ sha, login: null });
    expect(calls.map((c) => c.url.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(calls.every((c) => c.url.searchParams.get("sha") === "main" && c.url.searchParams.get("per_page") === "100")).toBe(true);
  });
  it("does no requests for a known head, ends at a short page, and propagates page failures", async () => {
    const { api, calls } = stub(response([{ sha, author: null }]), response({}, 401));
    expect(await api.listCommitLogins("o", "r", sha, new Set([sha]), token)).toMatchObject({ kind: "ok", data: [] });
    expect(calls).toHaveLength(0);
    expect(await api.listCommitLogins("o", "r", sha, new Set(), token)).toMatchObject({ kind: "ok", data: [{ sha, login: null }] });
    expect(await api.listCommitLogins("o", "r", sha, new Set(), token)).toEqual({ kind: "unauthorized" });
  });
  it("scrubs reflected secrets from successful payloads and headers", async () => {
    const { api } = stub(response({ id: 42, full_name: `owner/${token}` }), response({ id: 42, full_name: "o/r" }, 200, { etag: token }), response(null, 304, { etag: token }));
    expect(await api.getRepository("o", "r", token)).toEqual({ kind: "unreachable" });
    expect(await api.getRepository("o", "r", token)).toMatchObject({ kind: "ok", etag: null });
    expect(await api.getRepository("o", "r", token)).toEqual({ kind: "not_modified", etag: null });
  });
  it("contains synchronous fetch throws", async () => {
    const fetcher = vi.fn(() => { throw new Error(token); });
    expect(await new RestGitHubApi({ fetch: fetcher }).getRepository("o", "r", token)).toEqual({ kind: "unreachable" });
  });
});
