import express, { type ErrorRequestHandler, type Express } from "express";
import { failureHttpStatus, healthResponseSchema, type ApiError, type HealthResponse } from "@moonbeam/shared";
import { ActionError, INVALID_JSON } from "./errors.js";
import { apiRoutes, type Services } from "./routes.js";

export interface AppDependencies {
  /** Resolves when the database answers; rejects otherwise. */
  checkDatabase(): Promise<void>;
  /** User registry services; without them only `/api/health` is served. */
  services?: Services;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  const json = express.json();
  app.use((req, res, next) => {
    json(req, res, (err?: unknown) => {
      if (err) (req as { body: unknown }).body = INVALID_JSON;
      next();
    });
  });

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

  if (deps.services) app.use("/api", apiRoutes(deps.services));

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    let body: ApiError;
    let status: number;
    if (err instanceof ActionError) {
      status = failureHttpStatus[err.category];
      body = { error: { category: err.category, message: err.message, ...(err.details !== undefined ? { details: err.details } : {}) } };
    } else {
      console.error("[moonbeam] unhandled error:", err);
      res.status(500).json({ error: { message: "Internal server error" } });
      return;
    }
    res.status(status).json(body);
  };
  app.use(onError);

  return app;
}
