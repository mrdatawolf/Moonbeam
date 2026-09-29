import { z } from "zod";

export const identityInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("email"), value: z.string().trim().pipe(z.email()) }),
  z.object({ kind: z.literal("login"), value: z.string().trim().regex(/^[A-Za-z0-9-]{1,39}$/) }),
  z.object({ kind: z.literal("alias"), value: z.string().trim().min(1).max(200) }),
]);
export const memberIdentitySchema = z.object({
  id: z.uuid().nullable(), userId: z.uuid(), kind: z.enum(["email", "login", "alias"]),
  value: z.string(), automatic: z.boolean(),
});
export const identityConflictSchema = z.object({
  kind: z.enum(["email", "login", "name"]), value: z.string(),
  members: z.array(z.object({ userId: z.uuid(), displayName: z.string(), inactive: z.boolean() })),
});
export const identitiesResponseSchema = z.object({
  members: z.array(z.object({
    userId: z.uuid(), displayName: z.string(), active: z.boolean(),
    identities: z.array(memberIdentitySchema),
  })),
  conflicts: z.array(identityConflictSchema),
});
export type IdentityInput = z.infer<typeof identityInputSchema>;
export type MemberIdentity = z.infer<typeof memberIdentitySchema>;
export type IdentitiesResponse = z.infer<typeof identitiesResponseSchema>;
