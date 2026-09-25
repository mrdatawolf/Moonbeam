// Test harness: a fresh database cloned from the migrated template, the real
// Express app on an ephemeral port, a controllable clock, and a fake
// repository port for the phase-3 checks.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { inject } from "vitest";
import { createDatabaseClient, type Database, type DatabaseClient } from "@moonbeam/db";
import type { TaskDetail, User } from "@moonbeam/shared";
import { createApp } from "../app.js";
import { LifecycleService } from "../lifecycle/service.js";
import { RegistryService } from "../registry.js";
import type { MergeCheck, RepositoryPort } from "../repository.js";

export const TEMPLATE_DB = "moonbeam_template";

/** Real time plus an offset the test can advance. */
export class TestClock {
  offsetMs = 0;
  now = () => new Date(Date.now() + this.offsetMs);
  advance(ms: number) {
    this.offsetMs += ms;
  }
}

/** A repository port whose answers the test sets. */
export class FakeRepository implements RepositoryPort {
  handoffConflicts = new Map<string, string[]>();
  mainConflicts = new Map<string, string[]>();
  changed = new Map<string, string[]>();
  unavailable = false;
  integrationFailures = new Map<string, string[]>();
  integrated: string[] = [];

  async checkMergeable(task: { taskId: string }, target: "integration_target" | "main"): Promise<MergeCheck> {
    const files = (target === "main" ? this.mainConflicts : this.handoffConflicts).get(task.taskId);
    return files ? { mergeable: false, conflictingFiles: files } : { mergeable: true };
  }
  async changedFiles(task: { taskId: string }): Promise<string[]> {
    if (this.unavailable) {
      const { ActionError } = await import("../errors.js");
      throw new ActionError("repository_unavailable", "The project repository cannot be read.");
    }
    return this.changed.get(task.taskId) ?? [];
  }
  async integrateSubtask(task: { taskId: string }) {
    const files = this.integrationFailures.get(task.taskId);
    if (files) return { ok: false as const, conflictingFiles: files };
    this.integrated.push(task.taskId);
    return { ok: true as const };
  }
}

export type As = { user?: string; token?: string } | undefined;

export interface Res<T = any> {
  status: number;
  body: T;
}

export interface Harness {
  base: string;
  db: Database;
  clock: TestClock;
  repo: FakeRepository;
  lifecycle: LifecycleService;
  dirs: { home: string; root: string };
  req<T = any>(method: string, path: string, opts?: { as?: As; body?: unknown }): Promise<Res<T>>;
  close(): Promise<void>;
}

export async function createHarness(opts: { leaseMs?: number } = {}): Promise<Harness> {
  const dbName = `t_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(inject("pgAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${dbName} template ${TEMPLATE_DB}`);
  await admin.end();
  const client: DatabaseClient = createDatabaseClient(`${inject("pgBaseUrl")}/${dbName}`);

  const scratch = mkdtempSync(join(tmpdir(), "moonbeam-h-"));
  const home = join(scratch, "home");
  const root = join(scratch, "projects");
  mkdirSync(home);
  mkdirSync(root);

  const clock = new TestClock();
  const repo = new FakeRepository();
  const lifecycle = new LifecycleService({ db: client.db, clock: clock.now, repository: repo, leaseMs: opts.leaseMs });
  const registry = new RegistryService({ db: client.db, clock: clock.now, installDir: join(scratch, "install"), dataDir: home });
  mkdirSync(join(scratch, "install"));
  const app = createApp({ checkDatabase: async () => {}, services: { lifecycle, registry, devRoutes: true } });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    base,
    db: client.db,
    clock,
    repo,
    lifecycle,
    dirs: { home, root },
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
      await new Promise<void>((r) => server.close(() => r()));
      await client.close();
      const a = postgres(inject("pgAdminUrl"), { max: 1, onnotice: () => {} });
      await a.unsafe(`drop database if exists ${dbName} with (force)`);
      await a.end();
      rmSync(scratch, { recursive: true, force: true });
    },
  };
}

/** Create a git repository (a test fixture; never a project folder of the developer). */
export function gitInit(dir: string): string {
  mkdirSync(dir, { recursive: true });
  execFileSync("git", ["init", "-q", dir]);
  return dir;
}

export interface World {
  h: Harness;
  alice: User;
  bob: User;
  A: As;
  B: As;
  projectId: string;
}

/** First-run setup (two users), projects root, and one registered project. */
export async function world(opts: { leaseMs?: number } = {}): Promise<World> {
  const h = await createHarness(opts);
  const setup = await h.req("POST", "/setup", {
    body: {
      users: [
        { displayName: "Alice", email: "alice@example.test" },
        { displayName: "Bob", email: "bob@example.test" },
      ],
      projectsRoot: h.dirs.root,
    },
  });
  if (setup.status !== 201) throw new Error(`setup failed: ${JSON.stringify(setup.body)}`);
  const [alice, bob] = setup.body.users as User[];
  const repo = gitInit(join(h.dirs.root, "demo"));
  const project = await h.req("POST", "/projects", { as: { user: alice!.id }, body: { path: repo } });
  if (project.status !== 201) throw new Error(`register failed: ${JSON.stringify(project.body)}`);
  return { h, alice: alice!, bob: bob!, A: { user: alice!.id }, B: { user: bob!.id }, projectId: project.body.id };
}

export const fullEnvelope = (paths: string[] = ["src"], extra: Partial<Record<"exclusions" | "constraints" | "contracts", string[]>> = {}) => ({
  inclusions: ["Do the thing"],
  exclusions: extra.exclusions ?? [],
  constraints: extra.constraints ?? [],
  contracts: extra.contracts ?? [],
  paths,
});

export async function createTask(w: World, opts: { as?: As; paths?: string[]; title?: string; envelope?: object; criteria?: string[] } = {}): Promise<TaskDetail> {
  const res = await w.h.req("POST", `/projects/${w.projectId}/tasks`, {
    as: opts.as ?? w.A,
    body: {
      title: opts.title ?? "A task",
      desiredOutcome: "Something is better",
      acceptanceCriteria: opts.criteria ?? ["It works"],
      envelope: opts.envelope ?? fullEnvelope(opts.paths ?? ["src"]),
    },
  });
  if (res.status !== 201) throw new Error(`create failed: ${JSON.stringify(res.body)}`);
  return res.body.task;
}

export async function approvedTask(w: World, opts: Parameters<typeof createTask>[1] = {}): Promise<TaskDetail> {
  const t = await createTask(w, opts);
  const res = await w.h.req("POST", `/tasks/${t.id}/approve`, { as: w.A });
  if (res.status !== 200) throw new Error(`approve failed: ${JSON.stringify(res.body)}`);
  return res.body.task;
}

/** Start a run bound to a task (development endpoint) and return its credential. */
export async function startRun(w: World, taskId: string, model = "claude-opus", role = "implementer", extra: object = {}): Promise<{ token: string; runId: string; as: As }> {
  const res = await w.h.req("POST", "/dev/runs", { as: w.A, body: { taskId, role, model, ...extra } });
  if (res.status !== 201) throw new Error(`start run failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.credential, runId: res.body.run.id, as: { token: res.body.credential } };
}

export const handoffBody = (commit?: string) => ({
  record: { changes: "Changed things", validation: "Tests pass", deviations: "None", risks: "None" },
  ...(commit ? { commit } : {}),
});

export const subtask = (paths: string[], title = "Sub", extra: object = {}) => ({
  title,
  desiredOutcome: "Part of the work",
  acceptanceCriteria: ["Part works"],
  envelope: { inclusions: [{ text: "Part of the thing", derivedFrom: "I1" }], paths, ...extra },
});

export async function getTask(w: World, id: string): Promise<TaskDetail> {
  const res = await w.h.req("GET", `/tasks/${id}`);
  return res.body;
}

export async function auditActions(w: World, id: string): Promise<string[]> {
  return (await getTask(w, id)).audit.map((a) => a.action);
}

/** Assert a rejection's status and category. */
export function expectRejected(res: Res, category: string, status?: number): void {
  const ok = res.body?.error?.category === category && (status === undefined || res.status === status);
  if (!ok) throw new Error(`expected ${category}${status ? ` (${status})` : ""}, got ${res.status} ${JSON.stringify(res.body)}`);
}

export function expectOk(res: Res, status = 200): void {
  if (res.status !== status) throw new Error(`expected ${status}, got ${res.status} ${JSON.stringify(res.body)}`);
}
