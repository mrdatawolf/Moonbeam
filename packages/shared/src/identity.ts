import { z } from "zod";

/** Selected human identity (CONTRACT-002). */
export const USER_HEADER = "x-moonbeam-user";

export const identityModeSchema = z.enum(["selected"]);

export const userSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  email: z.string(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const userListResponseSchema = z.object({ users: z.array(userSchema) });
export type UserListResponse = z.infer<typeof userListResponseSchema>;

const displayName = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(200);
const email = z.string().trim().pipe(z.email("A valid e-mail address is required"));

export const userInputSchema = z.object({ displayName, email });
export type UserInput = z.infer<typeof userInputSchema>;

export const userUpdateSchema = z
  .object({ displayName: displayName.optional(), email: email.optional() })
  .refine((v) => v.displayName !== undefined || v.email !== undefined, {
    message: "Give a display name or an e-mail address to change",
  });
export type UserUpdate = z.infer<typeof userUpdateSchema>;

export const firstRunSetupInputSchema = z.object({
  users: z.array(userInputSchema).min(1, "At least one user is required"),
});
export type FirstRunSetupInput = z.infer<typeof firstRunSetupInputSchema>;

export const setupStatusSchema = z.object({
  needsSetup: z.boolean(),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;

export const humanActorSchema = z.object({
  kind: z.literal("human"),
  userId: z.uuid(),
  displayName: z.string(),
  email: z.string(),
  identityMode: identityModeSchema,
});
export const actorSchema = humanActorSchema;
export type ActorView = z.infer<typeof actorSchema>;

export const whoAmIResponseSchema = z.object({ actor: actorSchema.nullable() });
export type WhoAmIResponse = z.infer<typeof whoAmIResponseSchema>;
