import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabaseClient, pingDatabase, runMigrations, startDatabase } from "@moonbeam/db";
import { createApp } from "./app.js";
import { LifecycleService } from "./lifecycle/service.js";
import { RegistryService } from "./registry.js";
import { stubRepository } from "./repository.js";

const host = process.env.MOONBEAM_SERVER_HOST ?? "127.0.0.1";
const port = Number(process.env.MOONBEAM_SERVER_PORT ?? 3100);
const devRoutes = process.env.MOONBEAM_DEV_ROUTES === "1";
// Same resolution as the embedded database's data directory (packages/db config).
const dataDir = process.env.MOONBEAM_HOME?.trim() || join(homedir(), ".moonbeam");
// server/src/index.ts and server/dist/index.js both sit two levels below the workspace root.
const installDir = fileURLToPath(new URL("../..", import.meta.url));

const connection = await startDatabase();
console.log(`[moonbeam] database: ${connection.source}`);
await runMigrations(connection.connectionString);
const client = createDatabaseClient(connection.connectionString);

const clock = () => new Date();
const lifecycle = new LifecycleService({ db: client.db, clock, repository: stubRepository });
const registry = new RegistryService({ db: client.db, clock, installDir, dataDir });

const app = createApp({
  checkDatabase: () => pingDatabase(client.db),
  services: { lifecycle, registry, devRoutes },
});
const server = app.listen(port, host, () => {
  console.log(`[moonbeam] server listening on http://${host}:${port}${devRoutes ? " (dev routes enabled)" : ""}`);
});
server.on("error", async (err) => {
  console.error(`[moonbeam] server failed to listen on ${host}:${port}:`, err.message);
  await shutdown(1);
});

// Agent-run leases expire at their deadline (CONTRACT-001 T5). Actions and
// reads also expire due leases before they look at a claim; this sweep writes
// the `claim_expired` records for tasks nobody is looking at.
const sweep = setInterval(() => {
  lifecycle.sweepExpiredClaims().catch((err: unknown) => console.error("[moonbeam] lease sweep failed:", err));
}, 15_000);

let shuttingDown = false;
async function shutdown(code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(sweep);
  server.close();
  await client.close().catch(() => {});
  await connection.stop().catch((err: unknown) => {
    console.error("[moonbeam] failed to stop database:", err);
  });
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(0));
}
