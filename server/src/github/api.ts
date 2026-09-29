import { z } from "zod";

export type ApiFailure =
  | { kind: "not_modified"; etag: string | null }
  | { kind: "not_found" }
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; resetAt: string | null }
  | { kind: "unreachable" };
export type ApiResult<T> = { kind: "ok"; data: T; etag: string | null } | ApiFailure;
export interface Repository {
  id: number;
  fullName: string;
  redirected: boolean;
  writeScopes: string[] | null;
}
export interface Commit { sha: string; committerTime: string }
export interface CommitLogin { sha: string; login: string | null }
export interface GitHubApi {
  getRepository(owner: string, repo: string, token: string, etag?: string): Promise<ApiResult<Repository>>;
  getRepositoryById(id: number, registeredFullName: string, token: string, etag?: string): Promise<ApiResult<Repository>>;
  getBranchHead(owner: string, repo: string, branch: string, token: string, etag?: string): Promise<ApiResult<{ sha: string }>>;
  getCommit(owner: string, repo: string, sha: string, token: string): Promise<ApiResult<Commit>>;
  listCommitLogins(owner: string, repo: string, head: string, knownShas: ReadonlySet<string>, token: string): Promise<ApiResult<CommitLogin[]>>;
}
const shaSchema = z.string().regex(/^[a-f0-9]{40,64}$/i);
const repositorySchema = z.object({ id: z.number().int().positive(), full_name: z.string().regex(/^[^/\s]+\/[^/\s]+$/) });
const commitSchema = z.object({ sha: shaSchema, commit: z.object({ committer: z.object({ date: z.iso.datetime({ offset: true }) }) }) });
const loginsSchema = z.array(z.object({ sha: shaSchema, author: z.object({ login: z.string() }).nullable() }));
const segment = encodeURIComponent;
const repoPath = (owner: string, repo: string) => `/repos/${segment(owner)}/${segment(repo)}`;

export class RestGitHubApi implements GitHubApi {
  private readonly base: string;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  constructor(options: { baseUrl?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number; now?: () => number } = {}) {
    this.base = (options.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.now = options.now ?? Date.now;
  }

  private async get<T>(path: string, token: string, parse: (body: unknown, headers: Headers) => T, etag?: string): Promise<ApiResult<T>> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<ApiFailure>((resolve) => {
      timer = setTimeout(() => { controller.abort(); resolve({ kind: "unreachable" }); }, this.timeoutMs);
    });
    const request = async (): Promise<ApiResult<T>> => {
      try {
        let url = new URL(this.base + path);
        const origin = url.origin;
        if (url.username || url.password || !["https:", "http:"].includes(url.protocol)) return { kind: "unreachable" };
        const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
        if (etag) headers["If-None-Match"] = etag;
        for (let redirects = 0; redirects <= 5; redirects++) {
          const response = await this.fetcher(url, { method: "GET", headers, signal: controller.signal, redirect: "manual" });
          const h = response.headers;
          if ([301, 302, 307, 308].includes(response.status)) {
            const location = h.get("location");
            await response.body?.cancel();
            if (!location) return { kind: "unreachable" };
            const next = new URL(location, url);
            if (next.origin !== origin || next.username || next.password) return { kind: "unreachable" };
            url = next;
            continue;
          }
          if (response.status !== 200) {
            await response.body?.cancel();
            if (response.status === 304) return { kind: "not_modified", etag: h.get("etag")?.includes(token) ? null : h.get("etag") };
            if (response.status === 401) return { kind: "unauthorized" };
            if (response.status === 404) return { kind: "not_found" };
            if (response.status === 429 || (response.status === 403 && (h.has("x-ratelimit-reset") || h.has("retry-after")))) {
              const reset = h.get("x-ratelimit-reset");
              const retry = h.get("retry-after");
              const milliseconds = reset !== null ? Number(reset) * 1000 : retry !== null && /^\d+(\.\d+)?$/.test(retry) ? this.now() + Number(retry) * 1000 : Date.parse(retry ?? "");
              const date = new Date(milliseconds);
              return { kind: "rate_limited", resetAt: Number.isFinite(date.getTime()) ? date.toISOString() : null };
            }
            if (response.status === 403) return { kind: "unauthorized" };
            return { kind: "unreachable" };
          }
          const data = parse(await response.json(), h);
          // Do not surface reflected credentials from a failed/malicious upstream.
          if (token && JSON.stringify(data).includes(token)) return { kind: "unreachable" };
          const responseEtag = h.get("etag");
          return { kind: "ok", data, etag: responseEtag?.includes(token) ? null : responseEtag };
        }
        return { kind: "unreachable" };
      } catch {
        // Fetch, JSON, and validation errors can contain headers or response bodies.
        return { kind: "unreachable" };
      }
    };
    try { return await Promise.race([request(), timeout]); }
    finally { clearTimeout(timer); }
  }

  private repository(path: string, registeredName: string, token: string, etag?: string): Promise<ApiResult<Repository>> {
    return this.get(path, token, (body, headers) => {
      const value = repositorySchema.parse(body);
      const scopes = headers.get("x-oauth-scopes");
      return { id: value.id, fullName: value.full_name, redirected: value.full_name !== registeredName,
        writeScopes: scopes === null ? null : scopes.split(",").map((s) => s.trim()).filter((s) => s === "repo" || s === "public_repo" || s.startsWith("write:")) };
    }, etag);
  }
  getRepository(owner: string, repo: string, token: string, etag?: string): Promise<ApiResult<Repository>> {
    return this.repository(repoPath(owner, repo), `${owner}/${repo}`, token, etag);
  }
  async getRepositoryById(id: number, registeredFullName: string, token: string, etag?: string): Promise<ApiResult<Repository>> {
    if (!Number.isSafeInteger(id) || id <= 0) return { kind: "unreachable" };
    const result = await this.repository(`/repositories/${id}`, registeredFullName, token, etag);
    return result.kind === "ok" && result.data.id !== id ? { kind: "not_found" } : result;
  }
  getBranchHead(owner: string, repo: string, branch: string, token: string, etag?: string): Promise<ApiResult<{ sha: string }>> {
    return this.get(`${repoPath(owner, repo)}/branches/${segment(branch)}`, token, (body) => z.object({ commit: z.object({ sha: shaSchema }) }).parse(body).commit, etag);
  }
  getCommit(owner: string, repo: string, sha: string, token: string): Promise<ApiResult<Commit>> {
    return this.get(`${repoPath(owner, repo)}/commits/${segment(sha)}`, token, (body) => {
      const value = commitSchema.parse(body);
      return { sha: value.sha, committerTime: value.commit.committer.date };
    });
  }
  async listCommitLogins(owner: string, repo: string, head: string, knownShas: ReadonlySet<string>, token: string): Promise<ApiResult<CommitLogin[]>> {
    const data: CommitLogin[] = [];
    if (knownShas.has(head)) return { kind: "ok", data, etag: null };
    for (let page = 1; ; page++) {
      const result = await this.get(`${repoPath(owner, repo)}/commits?sha=${segment(head)}&per_page=100&page=${page}`, token, (body) => loginsSchema.parse(body));
      if (result.kind !== "ok") return result;
      for (const commit of result.data) {
        if (knownShas.has(commit.sha)) return { kind: "ok", data, etag: null };
        data.push({ sha: commit.sha, login: commit.author?.login ?? null });
      }
      if (result.data.length < 100) return { kind: "ok", data, etag: null };
    }
  }
}
