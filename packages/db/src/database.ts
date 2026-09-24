import { resolveDatabaseConfig } from "./config.js";
import { startEmbeddedPostgres } from "./embedded.js";

export interface DatabaseConnection {
  /** Where the database came from, for logs. */
  source: "DATABASE_URL" | "embedded";
  connectionString: string;
  /** Stops embedded Postgres if this process started it; no-op otherwise. */
  stop(): Promise<void>;
}

/** Resolve the database: `DATABASE_URL` if set, otherwise embedded Postgres. */
export async function startDatabase(env: NodeJS.ProcessEnv = process.env): Promise<DatabaseConnection> {
  const config = resolveDatabaseConfig(env);
  if (config.kind === "external") {
    return {
      source: "DATABASE_URL",
      connectionString: config.connectionString,
      stop: async () => {},
    };
  }
  const embedded = await startEmbeddedPostgres(config);
  return { source: "embedded", ...embedded };
}
