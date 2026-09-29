import type { FailureCategory } from "@moonbeam/shared";
import type { z } from "zod";

/** A rejected action. Rejections change nothing (CONTRACT-005 "Failure behavior"). */
export class ActionError extends Error {
  constructor(
    readonly category: FailureCategory,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export const reject = (category: FailureCategory, message: string, details?: unknown): never => {
  throw new ActionError(category, message, details);
};

/** Invalid JSON is reported after request identity has been resolved. */
export const INVALID_JSON = Symbol("invalid JSON body");

/** Parse action input; any failure is `validation`, listing each failing rule. */
export function parseInput<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  if (body === INVALID_JSON) throw new ActionError("validation", "The request body is not valid JSON.");
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new ActionError(
      "validation",
      issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; "),
      { issues },
    );
  }
  return result.data;
}
