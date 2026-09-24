import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { healthResponseSchema } from "@moonbeam/shared";
import { createApp, type AppDependencies } from "./app.js";

let server: Server | undefined;

async function listen(deps: AppDependencies): Promise<string> {
  const app = createApp(deps);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const base = await listen({ checkDatabase: async () => {} });
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe("ok");
    expect(body.database).toEqual({ ok: true });
  });

  it("reports degraded with 503 when the database check fails", async () => {
    const base = await listen({
      checkDatabase: async () => {
        throw new Error("connection refused");
      },
    });
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(503);
    const body = healthResponseSchema.parse(await res.json());
    expect(body.status).toBe("degraded");
    expect(body.database).toEqual({ ok: false, error: "connection refused" });
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const base = await listen({ checkDatabase: async () => {} });
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
