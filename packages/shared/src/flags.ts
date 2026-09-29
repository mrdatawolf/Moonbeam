import { z } from "zod";

export const flagStatusSchema = z.enum(["open", "dismissed", "resolved", "withdrawn"]);
export const flagSchema = z.object({
  id: z.uuid(), projectId: z.uuid(), rule: z.enum(["FL-1", "FL-2", "FL-3", "FL-4", "FL-5", "FL-6", "FL-7", "FL-8", "FL-9", "FL-10", "FL-11"]),
  kind: z.enum(["event", "condition"]), subjectKey: z.string(), subject: z.record(z.string(), z.unknown()),
  commitSha: z.string().nullable(), taskIdText: z.string().nullable(), status: flagStatusSchema,
  firstRaisedAt: z.iso.datetime(), statusChangedAt: z.iso.datetime(), evidence: z.record(z.string(), z.unknown()),
});
export const flagNoteInputSchema = z.object({ note: z.string().trim().min(1) });
export const flagAuditSchema = z.object({
  id: z.number().int(), flagId: z.uuid(), action: z.string(), fromState: flagStatusSchema.nullable(), toState: flagStatusSchema,
  actorKind: z.enum(["human", "system"]), actorUserId: z.uuid().nullable(), systemTrigger: z.string().nullable(),
  occurredAt: z.iso.datetime(), recordedAt: z.iso.datetime(), note: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
});
export const flagDetailSchema = flagSchema.extend({ history: z.array(flagAuditSchema) });
export const flagListSchema = z.object({ flags: z.array(flagSchema) });
export type FlagView = z.infer<typeof flagSchema>;
export type FlagDetail = z.infer<typeof flagDetailSchema>;
export type FlagStatus = z.infer<typeof flagStatusSchema>;
