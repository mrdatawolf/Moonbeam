import { z } from "zod";

export const sourceStatusSchema = z.enum([
  "never_polled", "ok", "unreachable", "rate_limited", "token_rejected",
  "token_missing", "token_config_unreadable", "not_found", "identity_changed", "branch_missing",
]);
export const sourceViewSchema = z.object({
  projectId: z.uuid(), status: sourceStatusSchema, message: z.string(),
  statusSince: z.iso.datetime(), lastAttemptAt: z.iso.datetime().nullable(),
  lastSuccessAt: z.iso.datetime().nullable(), lastProcessedHead: z.string().nullable(),
  rateLimitedUntil: z.iso.datetime().nullable(), redirectedFullName: z.string().nullable(),
  tokenWriteScopes: z.boolean().nullable(), consecutiveFailures: z.number().int().nonnegative(),
  baselineNeedsReset: z.boolean(),
});
export type SourceStatus = z.infer<typeof sourceStatusSchema>;
export type SourceView = z.infer<typeof sourceViewSchema>;
