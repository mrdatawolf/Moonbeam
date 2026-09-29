import { z } from "zod";

/** Failures for identity and user registry actions. */
export const failureCategorySchema = z.enum([
  "unidentified",
  "not_found",
  "invalid_transition",
  "conflict",
  "validation",
]);
export type FailureCategory = z.infer<typeof failureCategorySchema>;

/** HTTP status for each failure category (documented in docs/DEVELOPMENT.md). */
export const failureHttpStatus: Record<FailureCategory, number> = {
  unidentified: 401,
  not_found: 404,
  invalid_transition: 409,
  conflict: 409,
  validation: 422,
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
