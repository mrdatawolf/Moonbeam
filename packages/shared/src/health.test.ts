import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "./health.js";

describe("healthResponseSchema", () => {
  it("accepts a healthy response", () => {
    const parsed = healthResponseSchema.parse({
      status: "ok",
      database: { ok: true },
      checkedAt: "2026-09-24T12:00:00.000Z",
    });
    expect(parsed.status).toBe("ok");
  });

  it("accepts a degraded response with a database error", () => {
    const result = healthResponseSchema.safeParse({
      status: "degraded",
      database: { ok: false, error: "connection refused" },
      checkedAt: "2026-09-24T12:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = healthResponseSchema.safeParse({
      status: "fine",
      database: { ok: true },
      checkedAt: "2026-09-24T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-ISO timestamp", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      database: { ok: true },
      checkedAt: "yesterday",
    });
    expect(result.success).toBe(false);
  });
});
