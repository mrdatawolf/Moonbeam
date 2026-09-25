// Vitest global setup: one isolated embedded Postgres for the whole test run.
// It lives in a temporary MOONBEAM_HOME on a free loopback port, so tests
// never touch the developer's ~/.moonbeam/db. Migrations are applied once to a
// template database; each test clones it (see harness.ts).
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { runMigrations, startDatabase } from "@moonbeam/db";

export const TEMPLATE_DB = "moonbeam_template";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

declare module "vitest" {
  export interface ProvidedContext {
    pgAdminUrl: string;
    pgBaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const home = await mkdtemp(join(tmpdir(), "moonbeam-test-"));
  const port = await freePort();
  // Explicit env: DATABASE_URL is deliberately absent so embedded Postgres is used.
  const connection = await startDatabase({ MOONBEAM_HOME: home, MOONBEAM_EMBEDDED_PG_PORT: String(port) });
  const base = connection.connectionString.replace(/\/[^/]*$/, "");
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${TEMPLATE_DB}`);
  await admin.end();
  await runMigrations(`${base}/${TEMPLATE_DB}`);

  project.provide("pgAdminUrl", `${base}/postgres`);
  project.provide("pgBaseUrl", base);

  return async () => {
    await connection.stop();
    await rm(home, { recursive: true, force: true });
  };
}
