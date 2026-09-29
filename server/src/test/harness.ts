// Fresh database, real HTTP app, and controllable clock for registry tests.
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { inject } from "vitest";
import { createDatabaseClient, type Database, type DatabaseClient } from "@moonbeam/db";
import type { User } from "@moonbeam/shared";
import { createApp } from "../app.js";
import { RegistryService } from "../registry.js";

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectsService } from "../projects/service.js";
import { IdentitiesService } from "../identities/service.js";
import { TokenFile } from "../github/tokens.js";
import type { GitHubApi } from "../github/api.js";

/** Unexpected GitHub requests fail locally; the harness can never reach GitHub. */
const noGitHub: GitHubApi = {
  getRepository: async () => ({ kind: "unreachable" }),
  getRepositoryById: async () => ({ kind: "unreachable" }),
  getBranchHead: async () => ({ kind: "unreachable" }),
  getCommit: async () => ({ kind: "unreachable" }),
  listCommitLogins: async () => ({ kind: "unreachable" }),
};
import { Mirror } from "../github/mirror.js";
import { Poller, type FlagSink } from "../poller/poll.js";
import { PollScheduler } from "../poller/scheduler.js";
export interface HarnessOptions {
  github?: GitHubApi; tokens?: Record<string, string>;
  remoteUrl?: (owner: string, repo: string) => string;
  mirror?: (directory: string) => Mirror;
  flags?: FlagSink; intervalMs?: number;
}

export const TEMPLATE_DB = "moonbeam_template";

/** Real time plus an offset the test can advance. */
export class TestClock {
  offsetMs = 0;
  fixedTime: Date | undefined;
  now = () => new Date((this.fixedTime?.getTime() ?? Date.now()) + this.offsetMs);
  advance(ms: number) {
    this.offsetMs += ms;
  }
}

export type As = { user?: string; token?: string } | undefined;

export interface Res<T = any> {
  status: number;
  body: T;
}

export interface Harness {
  base: string;
  home: string;
  tokensFile: string;
  db: Database;
  poller: PollScheduler;
  newScheduler(): PollScheduler;
  clock: TestClock;
  req<T = any>(method: string, path: string, opts?: { as?: As; body?: unknown }): Promise<Res<T>>;
  close(): Promise<void>;
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const dbName = `t_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(inject("pgAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${dbName} template ${TEMPLATE_DB}`);
  await admin.end();
  const client: DatabaseClient = createDatabaseClient(`${inject("pgBaseUrl")}/${dbName}`);

  const clock = new TestClock();
  const registry = new RegistryService({ db: client.db, clock: clock.now });
  const home = await mkdtemp(join(tmpdir(), "moonbeam-api-"));
  const tokens = new TokenFile({ env: { MOONBEAM_HOME: home, MOONBEAM_GITHUB_TOKENS_FILE: join(home, "github-tokens.json") } });
  await writeFile(tokens.path, JSON.stringify({ tokens: options.tokens ?? {} }), { mode: 0o600 });
  const projects = new ProjectsService({ db: client.db, clock: clock.now, github: options.github ?? noGitHub, tokens });
  const identities = new IdentitiesService({ db: client.db, clock: clock.now });
  const schedulers: PollScheduler[] = [];
  const newScheduler = () => {
    const scheduler = new PollScheduler({ db: client.db, intervalMs: options.intervalMs,
      poller: new Poller({ db: client.db, clock: clock.now, tokens, github: options.github ?? noGitHub,
        flags: options.flags, mirror: (id) => {
          const directory = join(home, "mirrors", `${id}.git`);
          return options.mirror?.(directory) ?? new Mirror(directory, {
            remoteUrl: options.remoteUrl ?? (() => { throw new Error("No fixture remote configured"); }),
          });
        } }),
    });
    schedulers.push(scheduler);
    return scheduler;
  };
  const poller = newScheduler();
  const app = createApp({ checkDatabase: async () => {}, services: { db: client.db, clock: clock.now, registry, projects, identities, tokens, poller } });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    base,
    home,
    tokensFile: tokens.path,
    db: client.db,
    poller,
    newScheduler,
    clock,
    async req(method, path, { as, body } = {}) {
      const headers: Record<string, string> = {};
      if (body !== undefined) headers["content-type"] = "application/json";
      if (as?.user) headers["x-moonbeam-user"] = as.user;
      if (as?.token) headers.authorization = `Bearer ${as.token}`;
      const res = await fetch(`${base}/api${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    },
    async close() {
      await Promise.all(schedulers.map((scheduler) => scheduler.stop()));
      await new Promise<void>((r) => server.close(() => r()));
      await client.close();
      const a = postgres(inject("pgAdminUrl"), { max: 1, onnotice: () => {} });
      await a.unsafe(`drop database if exists ${dbName} with (force)`);
      await a.end();
      await rm(home, { recursive: true, force: true });
    },
  };
}

export interface World {
  h: Harness;
  alice: User;
  bob: User;
  A: As;
  B: As;
}

export async function world(options: HarnessOptions = {}): Promise<World> {
  const h = await createHarness(options);
  const setup = await h.req("POST", "/setup", {
    body: {
      users: [
        { displayName: "Alice", email: "alice@example.test" },
        { displayName: "Bob", email: "bob@example.test" },
      ],
    },
  });
  if (setup.status !== 201) throw new Error(`setup failed: ${JSON.stringify(setup.body)}`);
  const [alice, bob] = setup.body.users as User[];
  return { h, alice: alice!, bob: bob!, A: { user: alice!.id }, B: { user: bob!.id } };
}

/** Assert a rejection's status and category. */
export function expectRejected(res: Res, category: string, status?: number): void {
  const ok = res.body?.error?.category === category && (status === undefined || res.status === status);
  if (!ok) throw new Error(`expected ${category}${status ? ` (${status})` : ""}, got ${res.status} ${JSON.stringify(res.body)}`);
}

export function expectOk(res: Res, status = 200): void {
  if (res.status !== status) throw new Error(`expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`);
}

/** Real REST decoding over a local double, with a real temporary git history. */
export async function fixtureGitHub(fixture: import("./git-fixture.js").GitFixture) {
  const { RestGitHubApi } = await import("../github/api.js");
  const requests: { path: string; method: string; token: string | null; etag: string | null }[] = [];
  const state = {
    id: 123, fullName: "owner/repo", status: 200, conditional: false,
    branchMissing: false, loginFailure: false, timeout: false, unreachable: false,
    resetAt: "2030-01-01T00:00:00.000Z", scopes: "repo", etag: '"repository-v1"',
    beforeRequest: async (_path: string): Promise<void> => {},
  };
  const github = new RestGitHubApi({ timeoutMs: 3000, fetch: async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const headers = new Headers(init?.headers);
    requests.push({ path: path + url.search, method: init?.method ?? "GET", token: headers.get("authorization"), etag: headers.get("if-none-match") });
    await state.beforeRequest(path);
    if (state.unreachable) throw new Error("fixture offline");
    if (state.timeout) return new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new Error("aborted"));
      else init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    if (state.status !== 200) return new Response(null, { status: state.status,
      headers: state.status === 429 ? { "x-ratelimit-reset": String(Date.parse(state.resetAt) / 1000) } : {} });
    if (/\/branches\//.test(path)) {
      if (state.branchMissing) return new Response(null, { status: 404 });
      const branch = decodeURIComponent(path.split("/branches/")[1]!);
      const sha = await fixture.git(["rev-parse", `refs/heads/${branch}`], {}, fixture.remote);
      return Response.json({ commit: { sha } });
    }
    if (path.endsWith("/commits")) {
      if (state.loginFailure) return new Response(null, { status: 500 });
      const shas = (await fixture.git(["rev-list", url.searchParams.get("sha")!], {}, fixture.remote)).split("\n");
      const page = Number(url.searchParams.get("page") ?? 1);
      return Response.json(shas.slice((page - 1) * 100, page * 100).map((sha) => ({ sha, author: { login: "fixture-author" } })));
    }
    if (path.includes("/commits/")) {
      const sha = path.split("/commits/")[1]!;
      const date = await fixture.git(["show", "-s", "--format=%cI", sha], {}, fixture.remote);
      return Response.json({ sha, commit: { committer: { date } } });
    }
    if (state.conditional && headers.get("if-none-match") === state.etag) return new Response(null, { status: 304, headers: { etag: state.etag } });
    return Response.json({ id: state.id, full_name: state.fullName }, { headers: { etag: state.etag, "x-oauth-scopes": state.scopes } });
  } });
  return { github, state, requests };
}
