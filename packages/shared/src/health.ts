import { z } from "zod";

/**
 * Overall service health. `degraded` means the server is up but a dependency
 * (currently only the database) failed its check.
 */
export const healthStatusSchema = z.enum(["ok", "degraded"]);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

/** Response body of `GET /api/health`, shared by the server and the UI. */
export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  database: z.object({
    ok: z.boolean(),
    error: z.string().optional(),
  }),
  checkedAt: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
