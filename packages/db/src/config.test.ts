import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMBEDDED_PORT,
  embeddedConnectionString,
  resolveDatabaseConfig,
} from "./config.js";

describe("resolveDatabaseConfig", () => {
  it("uses DATABASE_URL when set", () => {
    const config = resolveDatabaseConfig(
      { DATABASE_URL: "postgres://u:p@db.example:5432/moonbeam" },
      "/home/tester",
    );
    expect(config).toEqual({
      kind: "external",
      connectionString: "postgres://u:p@db.example:5432/moonbeam",
    });
  });

  it("falls back to embedded Postgres under ~/.moonbeam/db", () => {
    const config = resolveDatabaseConfig({}, "/home/tester");
    expect(config).toMatchObject({
      kind: "embedded",
      dataDir: "/home/tester/.moonbeam/db",
      port: DEFAULT_EMBEDDED_PORT,
      database: "moonbeam",
    });
  });

  it("honours MOONBEAM_HOME and MOONBEAM_EMBEDDED_PG_PORT", () => {
    const config = resolveDatabaseConfig(
      { MOONBEAM_HOME: "/srv/moonbeam", MOONBEAM_EMBEDDED_PG_PORT: "55001" },
      "/home/tester",
    );
    expect(config).toMatchObject({ dataDir: "/srv/moonbeam/db", port: 55001 });
  });

  it("treats a blank DATABASE_URL as unset", () => {
    expect(resolveDatabaseConfig({ DATABASE_URL: "  " }, "/h").kind).toBe("embedded");
  });

  it("rejects an invalid port", () => {
    expect(() => resolveDatabaseConfig({ MOONBEAM_EMBEDDED_PG_PORT: "abc" }, "/h")).toThrow(
      /MOONBEAM_EMBEDDED_PG_PORT/,
    );
  });

  it("builds a loopback connection string for embedded Postgres", () => {
    const config = resolveDatabaseConfig({}, "/h");
    if (config.kind !== "embedded") throw new Error("expected embedded");
    expect(embeddedConnectionString(config)).toBe(
      `postgres://moonbeam:moonbeam@127.0.0.1:${DEFAULT_EMBEDDED_PORT}/moonbeam`,
    );
  });
});
