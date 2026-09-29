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

export const TEMPLATE_DB = "moonbeam_template";

/** Real time plus an offset the test can advance. */
export class TestClock {
  offsetMs = 0;
  now = () => new Date(Date.now() + this.offsetMs);
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
  db: Database;
  clock: TestClock;
  req<T = any>(method: string, path: string, opts?: { as?: As; body?: unknown }): Promise<Res<T>>;
  close(): Promise<void>;
}

export async function createHarness(): Promise<Harness> {
  const dbName = `t_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(inject("pgAdminUrl"), { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${dbName} template ${TEMPLATE_DB}`);
  await admin.end();
  const client: DatabaseClient = createDatabaseClient(`${inject("pgBaseUrl")}/${dbName}`);

  const clock = new TestClock();
  const registry = new RegistryService({ db: client.db, clock: clock.now });
  const app = createApp({ checkDatabase: async () => {}, services: { db: client.db, clock: clock.now, registry } });
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    base,
    db: client.db,
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
      await new Promise<void>((r) => server.close(() => r()));
      await client.close();
      const a = postgres(inject("pgAdminUrl"), { max: 1, onnotice: () => {} });
      await a.unsafe(`drop database if exists ${dbName} with (force)`);
      await a.end();
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

export async function world(): Promise<World> {
  const h = await createHarness();
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
