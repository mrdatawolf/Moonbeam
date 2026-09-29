// HTTP client for the Moonbeam API (docs/DEVELOPMENT.md "Endpoints").
// Every request carries the user selected in this browser as
// `X-Moonbeam-User` (CONTRACT-002 "Human user selection"); reads work without
// one. Responses are validated with the shared zod schemas; rejections become
// `ApiRequestError` with the failure category the server named.
import {
  apiErrorSchema,
  healthResponseSchema,
  USER_HEADER,
  type FailureCategory,
  type HealthResponse,
} from "@moonbeam/shared";
import type { z } from "zod";
import { invalidateSelection, readSelectedUserId } from "../lib/selection";
import { connection } from "./connection";

/** `connection` is not a server category: the request never reached Moonbeam. */
export type ErrorCategory = FailureCategory | "connection" | "unexpected";

export class ApiRequestError extends Error {
  constructor(
    readonly category: ErrorCategory,
    message: string,
    readonly status: number | null,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function request<S extends z.ZodType>(method: Method, path: string, schema: S, body?: unknown): Promise<z.infer<S>> {
  const headers: Record<string, string> = { accept: "application/json" };
  const userId = readSelectedUserId();
  if (userId) headers[USER_HEADER] = userId;
  if (body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    connection.set("lost");
    throw new ApiRequestError("connection", "Connection lost. Retrying.", null);
  }
  const json: unknown = await res.json().catch(() => undefined);
  // The proxy answers 502/504 when the server is down: treat as connection loss.
  if ((res.status === 502 || res.status === 504) && json === undefined) {
    connection.set("lost");
    throw new ApiRequestError("connection", "Connection lost. Retrying.", res.status);
  }
  connection.set("ok");

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    if (parsed.success) {
      const { category, message, details } = parsed.data.error;
      // The selected user can't act any more (deactivated elsewhere, CONTRACT-002):
      // clear the selection and ask again. Viewing needs no selection, so a read
      // is retried once as a viewer instead of failing the page.
      if (category === "unidentified" && userId && readSelectedUserId() === userId) {
        invalidateSelection();
        if (method === "GET") return request(method, path, schema, body);
      }
      throw new ApiRequestError(category, message, res.status, details);
    }
    throw new ApiRequestError("unexpected", `Unexpected response from Moonbeam (HTTP ${res.status}).`, res.status);
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiRequestError("unexpected", `Moonbeam sent a response this screen does not understand (HTTP ${res.status}).`, res.status);
  }
  return parsed.data;
}

/**
 * Server health. A 503 still carries a valid (degraded) body, so parse any
 * response that validates against the shared schema.
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
