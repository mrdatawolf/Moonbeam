import { healthResponseSchema, type HealthResponse } from "@moonbeam/shared";

/**
 * Fetch server health. A 503 still carries a valid (degraded) body, so parse
 * any response that validates against the shared schema.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch("/api/health");
  const body: unknown = await res.json().catch(() => undefined);
  const parsed = healthResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`Unexpected health response (HTTP ${res.status})`);
  }
  return parsed.data;
}
