import { createDatabaseClient, pingDatabase, runMigrations, startDatabase } from "@moonbeam/db";
import { createApp } from "./app.js";

const host = process.env.MOONBEAM_SERVER_HOST ?? "127.0.0.1";
const port = Number(process.env.MOONBEAM_SERVER_PORT ?? 3100);

const connection = await startDatabase();
console.log(`[moonbeam] database: ${connection.source}`);
await runMigrations(connection.connectionString);
const client = createDatabaseClient(connection.connectionString);

const app = createApp({ checkDatabase: () => pingDatabase(client.db) });
const server = app.listen(port, host, () => {
  console.log(`[moonbeam] server listening on http://${host}:${port}`);
});
server.on("error", async (err) => {
  console.error(`[moonbeam] server failed to listen on ${host}:${port}:`, err.message);
  await shutdown(1);
});

let shuttingDown = false;
async function shutdown(code = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
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
