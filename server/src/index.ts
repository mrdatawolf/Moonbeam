import { createDatabaseClient, pingDatabase, runMigrations, startDatabase } from "@moonbeam/db";
import { createApp } from "./app.js";
import { RegistryService } from "./registry.js";

import { ProjectsService } from "./projects/service.js";
import { IdentitiesService } from "./identities/service.js";
import { RestGitHubApi } from "./github/api.js";
import { TokenFile } from "./github/tokens.js";

import { Poller } from "./poller/poll.js";
import { PollScheduler, pollIntervalMs } from "./poller/scheduler.js";

const host = process.env.MOONBEAM_SERVER_HOST ?? "127.0.0.1";
const port = Number(process.env.MOONBEAM_SERVER_PORT ?? 3100);

const intervalMs = pollIntervalMs();
const connection = await startDatabase();
console.log(`[moonbeam] database: ${connection.source}`);
await runMigrations(connection.connectionString);
const client = createDatabaseClient(connection.connectionString);

const clock = () => new Date();
const registry = new RegistryService({ db: client.db, clock });

const tokens = new TokenFile();
const github = new RestGitHubApi();
const projects = new ProjectsService({ db: client.db, clock, tokens, github });
const poller = new PollScheduler({ db: client.db, intervalMs, poller: new Poller({ db: client.db, clock, tokens, github }) });
const identities = new IdentitiesService({ db: client.db, clock });

const app = createApp({
  checkDatabase: () => pingDatabase(client.db),
  services: { db: client.db, clock, registry, projects, identities, tokens, poller },
});
const server = app.listen(port, host, () => {
  console.log(`[moonbeam] server listening on http://${host}:${port}`);
});
server.on("error", async (err) => {
  console.error(`[moonbeam] server failed to listen on ${host}:${port}:`, err.message);
  await shutdown(1);
});

void poller.start().catch(() => console.error("[moonbeam] startup polling failed"));

let shuttingDown = false;
async function shutdown(code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close();
  await poller.stop();
  await client.close().catch(() => {});
  await connection.stop().catch((err: unknown) => {
    console.error("[moonbeam] failed to stop database:", err);
  });
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown(0));
}
