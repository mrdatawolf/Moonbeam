// CLI: apply pending migrations (`pnpm db:migrate`).
import { runMigrations } from "./client.js";
import { startDatabase } from "./database.js";

const connection = await startDatabase();
console.log(`Migrating database (${connection.source})`);
try {
  await runMigrations(connection.connectionString);
  console.log("Migrations complete");
} finally {
  await connection.stop();
}
