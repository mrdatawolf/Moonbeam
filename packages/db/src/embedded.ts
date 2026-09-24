import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import postgres from "postgres";
import { embeddedConnectionString, type DatabaseConfig } from "./config.js";

type EmbeddedConfig = Extract<DatabaseConfig, { kind: "embedded" }>;

export interface EmbeddedPostgresHandle {
  connectionString: string;
  stop(): Promise<void>;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** Remove a postmaster.pid left behind by a crashed process; refuse if it is live. */
function clearStalePidFile(dataDir: string): void {
  const pidFile = join(dataDir, "postmaster.pid");
  if (!existsSync(pidFile)) return;
  const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0]);
  if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid)) {
    throw new Error(
      `Embedded Postgres in ${dataDir} is already running (pid ${pid}). ` +
        "Stop the other Moonbeam server, or set MOONBEAM_HOME or DATABASE_URL.",
    );
  }
  rmSync(pidFile, { force: true });
}

async function ensureDatabaseExists(adminUrl: string, database: string): Promise<void> {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  try {
    const rows = await admin`select 1 from pg_database where datname = ${database}`;
    if (rows.length === 0) {
      await admin.unsafe(`create database "${database.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/**
 * Start a real Postgres process for local development, initialising the
 * cluster on first run. The returned `stop` shuts the process down.
 */
export async function startEmbeddedPostgres(config: EmbeddedConfig): Promise<EmbeddedPostgresHandle> {
  mkdirSync(dirname(config.dataDir), { recursive: true });
  const recentLogs: string[] = [];
  const log = (message: unknown) => {
    recentLogs.push(String(message).trimEnd());
    if (recentLogs.length > 40) recentLogs.shift();
  };

  const pg = new EmbeddedPostgres({
    databaseDir: config.dataDir,
    user: config.user,
    password: config.password,
    port: config.port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: log,
    onError: log,
  });

  try {
    if (!existsSync(join(config.dataDir, "PG_VERSION"))) {
      await pg.initialise();
    }
    clearStalePidFile(config.dataDir);
    await pg.start();
  } catch (err) {
    const detail = recentLogs.length ? `\nRecent Postgres output:\n${recentLogs.join("\n")}` : "";
    throw new Error(
      `Failed to start embedded Postgres (dataDir=${config.dataDir}, port=${config.port}): ${
        err instanceof Error ? err.message : String(err)
      }${detail}`,
      { cause: err },
    );
  }

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await pg.stop();
  };

  try {
    await ensureDatabaseExists(embeddedConnectionString(config, "postgres"), config.database);
  } catch (err) {
    await stop();
    throw err;
  }

  return { connectionString: embeddedConnectionString(config), stop };
}
