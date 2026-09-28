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

/**
 * An agent attempted a human-only action. The attempt is recorded in the audit
 * trail after the action's transaction has rolled back (CONTRACT-005 "Audit
 * record": rejected authority violations are recorded).
 */
export class AuthorityViolation extends ActionError {
  constructor(
    readonly action: string,
    message: string,
    readonly target: { projectId?: string | null; taskId?: string | null; subjectUserId?: string | null; requested?: Record<string, unknown> },
  ) {
    super("authority_violation", message);
    this.name = "AuthorityViolation";
  }
}

export const reject = (category: FailureCategory, message: string, details?: unknown): never => {
  throw new ActionError(category, message, details);
};

/**
 * Stands in for a request body that was not valid JSON. The failure is
 * reported by `parseInput`, i.e. in the lifecycle step, so identity and
 * permission are still checked first (CONTRACT-002 order).
 */
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
