import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_EMBEDDED_PORT = 54330;
export const DEFAULT_DATABASE_NAME = "moonbeam";

export type DatabaseConfig =
  | { kind: "external"; connectionString: string }
  | {
      kind: "embedded";
      dataDir: string;
      port: number;
      user: string;
      password: string;
      database: string;
    };

/**
 * Decide where the database lives.
 *
 * - `DATABASE_URL` set: use that Postgres server as-is.
 * - Otherwise: run an embedded Postgres (a real Postgres process) with its data
 *   under `$MOONBEAM_HOME/db` (default `~/.moonbeam/db`) on
 *   `MOONBEAM_EMBEDDED_PG_PORT` (default 54330).
 */
export function resolveDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): DatabaseConfig {
  const url = env.DATABASE_URL?.trim();
  if (url) {
    return { kind: "external", connectionString: url };
  }

  const moonbeamHome = env.MOONBEAM_HOME?.trim() || join(home, ".moonbeam");
  const rawPort = env.MOONBEAM_EMBEDDED_PG_PORT?.trim();
  const port = rawPort ? Number(rawPort) : DEFAULT_EMBEDDED_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`MOONBEAM_EMBEDDED_PG_PORT must be a TCP port, got "${rawPort}"`);
  }

  return {
    kind: "embedded",
    dataDir: join(moonbeamHome, "db"),
    port,
    user: "moonbeam",
    password: "moonbeam",
    database: DEFAULT_DATABASE_NAME,
  };
}

export function embeddedConnectionString(
  config: Extract<DatabaseConfig, { kind: "embedded" }>,
  database: string = config.database,
): string {
  const user = encodeURIComponent(config.user);
  const password = encodeURIComponent(config.password);
  return `postgres://${user}:${password}@127.0.0.1:${config.port}/${database}`;
}
