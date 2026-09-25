import { z } from "zod";

/**
 * Request headers that carry identity (CONTRACT-002). A request with an
 * `Authorization: Bearer <run credential>` header is an agent request (R1, R2);
 * otherwise `X-Moonbeam-User: <user id>` names the selected human user. No
 * header can make a request a system request.
 */
export const USER_HEADER = "x-moonbeam-user";
export const AUTHORIZATION_HEADER = "authorization";

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

/**
 * A user record as a request with an agent credential receives it: everything
 * but the e-mail address (board decision on TASK-006 note N1, 2026-09-25).
 * Humans and viewers receive `userSchema`.
 */
export const agentUserSchema = userSchema.omit({ email: true });
export type AgentUser = z.infer<typeof agentUserSchema>;

/**
 * `GET /api/users`. Humans and viewers get full user records; an agent gets
 * records without e-mail addresses.
 */
export const userListResponseSchema = z.object({ users: z.array(z.union([userSchema, agentUserSchema])) });
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
  /** Optional: the projects root may be chosen during first-run setup (ADR-006). */
  projectsRoot: z.string().trim().min(1).optional(),
});
export type FirstRunSetupInput = z.infer<typeof firstRunSetupInputSchema>;

export const setupStatusSchema = z.object({
  needsSetup: z.boolean(),
  projectsRoot: z.string().nullable(),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;

export const humanActorSchema = z.object({
  kind: z.literal("human"),
  userId: z.uuid(),
  displayName: z.string(),
  email: z.string(),
  identityMode: identityModeSchema,
});
export const agentActorSchema = z.object({
  kind: z.literal("agent"),
  runId: z.uuid(),
  taskId: z.uuid(),
  projectId: z.uuid(),
  role: z.string(),
  model: z.string(),
});
export const actorSchema = z.discriminatedUnion("kind", [humanActorSchema, agentActorSchema]);
export type ActorView = z.infer<typeof actorSchema>;

export const whoAmIResponseSchema = z.object({ actor: actorSchema.nullable() });
export type WhoAmIResponse = z.infer<typeof whoAmIResponseSchema>;

export const runStatusSchema = z.enum(["active", "finished", "failed", "stopped"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

/** Development/test only: start a run bound to a task and mint its credential. */
export const devStartRunInputSchema = z.object({
  taskId: z.uuid(),
  role: z.string().trim().min(1),
  model: z.string().trim().min(1),
  quantization: z.string().trim().min(1).optional(),
  /** Optional credential lifetime in seconds; without it the credential lives as long as the run. */
  ttlSeconds: z.number().int().positive().optional(),
});
export type DevStartRunInput = z.infer<typeof devStartRunInputSchema>;

export const runSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  taskId: z.uuid(),
  role: z.string(),
  model: z.string(),
  quantization: z.string().nullable(),
  status: runStatusSchema,
  startedByUserId: z.uuid(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});
export type Run = z.infer<typeof runSchema>;

export const devStartRunResponseSchema = z.object({
  run: runSchema,
  /** The credential value. Returned only here, never again (CONTRACT-002 ID9). */
  credential: z.string(),
});
export type DevStartRunResponse = z.infer<typeof devStartRunResponseSchema>;

export const devEndRunInputSchema = z.object({
  status: z.enum(["finished", "failed", "stopped"]),
});
export type DevEndRunInput = z.infer<typeof devEndRunInputSchema>;

export const devOpenPauseInputSchema = z.object({ question: z.string().trim().min(1) });
