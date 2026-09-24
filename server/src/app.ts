import express, { type Express } from "express";
import { healthResponseSchema, type HealthResponse } from "@moonbeam/shared";

export interface AppDependencies {
  /** Resolves when the database answers; rejects otherwise. */
  checkDatabase(): Promise<void>;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    let database: HealthResponse["database"];
    try {
      await deps.checkDatabase();
      database = { ok: true };
    } catch (err) {
      database = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const body = healthResponseSchema.parse({
      status: database.ok ? "ok" : "degraded",
      database,
      checkedAt: new Date().toISOString(),
    });
    res.status(database.ok ? 200 : 503).json(body);
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
