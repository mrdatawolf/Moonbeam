import { z } from "zod";

/**
 * Failure categories, named exactly as CONTRACT-001 "Failure behavior" and
 * CONTRACT-002 "Failure behavior" name them. The repository categories are
 * CONTRACT-004's; in TASK-006 only `merge_conflict` and
 * `repository_unavailable` can be raised (through the pluggable repository
 * check), the others are listed for completeness.
 */
export const failureCategorySchema = z.enum([
  "unidentified",
  "not_found",
  "authority_violation",
  "not_permitted",
  "invalid_transition",
  "conflict",
  "blocked",
  "validation",
  "merge_conflict",
  "working_folder_unsafe",
  "repository_unavailable",
  "branch_name_taken",
  "history_rewritten",
]);
export type FailureCategory = z.infer<typeof failureCategorySchema>;

/** HTTP status for each failure category (documented in docs/DEVELOPMENT.md). */
export const failureHttpStatus: Record<FailureCategory, number> = {
  unidentified: 401,
  authority_violation: 403,
  not_permitted: 403,
  not_found: 404,
  invalid_transition: 409,
  conflict: 409,
  blocked: 409,
  merge_conflict: 409,
  working_folder_unsafe: 409,
  branch_name_taken: 409,
  history_rewritten: 409,
  validation: 422,
  repository_unavailable: 503,
};

/** Body of every rejected API request. */
export const apiErrorSchema = z.object({
  error: z.object({
    category: failureCategorySchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
