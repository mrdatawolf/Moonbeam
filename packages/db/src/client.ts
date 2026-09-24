import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseClient {
  db: Database;
  close(): Promise<void>;
}

/** Open a Drizzle client over the `postgres` driver. */
export function createDatabaseClient(connectionString: string): DatabaseClient {
  const client = postgres(connectionString, { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    db,
    close: () => client.end({ timeout: 5 }),
  };
}

/** Round-trip `select 1` to prove the database is reachable. */
export async function pingDatabase(db: Database): Promise<void> {
  try {
    await db.execute(sql`select 1`);
  } catch (err) {
    // Drizzle wraps driver errors ("Failed query: ..."); surface the driver's reason.
    const cause = err instanceof Error && err.cause instanceof Error ? err.cause : err;
    throw cause instanceof Error ? cause : new Error(String(cause));
  }
}

/** Directory holding the generated SQL migrations (same path from src/ and dist/). */
export const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

/** Apply any pending Drizzle migrations. */
export async function runMigrations(connectionString: string): Promise<void> {
  const client = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end({ timeout: 5 });
  }
}
