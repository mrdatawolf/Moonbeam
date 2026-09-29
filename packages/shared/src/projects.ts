import { z } from "zod";

const text = z.string().trim().min(1).max(200);
const segment = text.regex(/^[A-Za-z0-9_.-]+$/);
const sha = z.string().regex(/^[a-f0-9]{40,64}$/i);
const fields = {
  owner: segment,
  repo: segment,
  name: text,
  trackedBranch: z.string().trim().min(1).max(1024),
  tokenLabel: text,
  baselineSha: sha,
  exemptPaths: z.array(z.string().trim().min(1)),
  staleThresholdDays: z.number().int().positive().max(2147483647),
};
export const projectRegistrationInputSchema = z.object({
  ...fields,
  name: fields.name.optional(),
  trackedBranch: fields.trackedBranch.default("main"),
  tokenLabel: fields.tokenLabel.optional(),
  baselineSha: sha.optional(),
  exemptPaths: fields.exemptPaths.default([]),
  staleThresholdDays: fields.staleThresholdDays.default(14),
  leadDeveloperUserId: z.uuid().nullable().optional(),
});
export const projectUpdateInputSchema = z.object(fields).partial().refine(
  (v) => Object.keys(v).length > 0, "Give a registration field to change",
);
export const leadDeveloperInputSchema = z.object({ userId: z.uuid().nullable() });
export const projectSchema = z.object({
  id: z.uuid(), name: z.string(), githubOwner: z.string(), githubRepo: z.string(),
  // Decimal string preserves the database bigint without JSON precision loss.
  githubRepoId: z.string().regex(/^[1-9][0-9]*$/),
  trackedBranch: z.string(), tokenLabel: z.string(),
  leadDeveloperUserId: z.uuid().nullable(), baselineSha: sha,
  baselineCommittedAt: z.iso.datetime(), exemptPaths: z.array(z.string()),
  staleThresholdDays: z.number().int().positive(), registeredAt: z.iso.datetime(),
  registeredByUserId: z.uuid(), removedAt: z.iso.datetime().nullable(),
});
export const projectListResponseSchema = z.object({ projects: z.array(projectSchema) });
export const githubTokensResponseSchema = z.object({
  state: z.enum(["ok", "missing", "unreadable"]),
  tokens: z.array(z.object({ label: z.string(), masked: z.string() })),
});
export type ProjectView = z.infer<typeof projectSchema>;
export type ProjectRegistrationInput = z.input<typeof projectRegistrationInputSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateInputSchema>;
