import { z } from "zod";
import { sourceViewSchema } from "./source.js";
import { flagSchema } from "./flags.js";

const text = z.string().nullable();
const count = z.number().int().nonnegative();
export const attributionSchema = z.object({
  kind: z.enum(["member", "unmatched", "ambiguous"]), recorded: z.unknown(),
  userId: text, displayName: text, inactive: z.boolean(), label: z.string(),
});
export const fileReferenceSchema = z.object({ path: z.string(), headSha: text, githubUrl: text, href: text });
export const relatedReferenceSchema = z.object({
  id: z.string(), kind: z.enum(["TASK", "CONTRACT", "ADR"]), found: z.boolean(),
  label: text, href: text, files: z.array(fileReferenceSchema), states: z.array(z.string()),
});
export const commitViewSchema = z.object({
  sha: z.string(), subject: z.string(), committedAt: z.string(), isMerge: z.boolean(),
  author: z.object({ name: z.string(), email: z.string(), login: text }), attribution: attributionSchema,
  committer: z.object({ name: z.string(), email: z.string() }), githubUrl: z.string(),
  changesComplete: z.boolean(), label: text,
});
export const parsedTaskSchema = z.object({
  title: z.object({ id: z.string(), text: z.string(), line: z.number() }).nullable(),
  header: z.object({ fields: z.array(z.object({ name: z.string(), key: z.string(), value: z.string(), line: z.number() })), duplicates: z.array(z.string()), unattached: z.array(z.string()) }),
  rawHeaderLines: z.array(z.string()), format: text, isV1: z.boolean(),
  paths: z.discriminatedUnion("kind", [z.object({ kind: z.literal("absent") }), z.object({ kind: z.literal("empty") }), z.object({ kind: z.literal("none") }), z.object({ kind: z.literal("patterns"), patterns: z.array(z.string()) })]),
});
export const taskFileViewSchema = z.object({
  file: fileReferenceSchema, state: z.string(), read: z.string(), parsed: parsedTaskSchema.nullable(),
  formatLabel: z.enum(["DbC task v1", "not DbC task v1", "could not be read"]),
  problems: z.array(z.object({ kind: z.string(), field: z.string().optional(), value: z.string().optional(), titleId: z.string().optional(), fileId: z.string().optional() })),
  proposedBy: attributionSchema.nullable(), approvedBy: attributionSchema.nullable(),
  proposedDate: text, approvedDate: text, assignedAgent: text,
  relatedContracts: z.array(relatedReferenceSchema), relatedAdrs: z.array(relatedReferenceSchema), dependencies: z.array(relatedReferenceSchema),
});
export const projectFlagSchema = flagSchema.extend({
  ruleName: z.string(), href: z.string(), commitUrl: text,
  files: z.array(fileReferenceSchema),
  notes: z.array(z.object({ note: z.string(), occurredAt: z.string(), actorUserId: text })),
  attributions: z.array(z.object({ location: z.string(), attribution: attributionSchema })),
});
export const taskViewSchema = z.object({
  id: z.string(), title: text, states: z.array(z.string()), files: z.array(taskFileViewSchema),
  firstProposed: commitViewSchema.nullable(), firstApproved: commitViewSchema.nullable(), firstCompleted: commitViewSchema.nullable(), latestApproved: commitViewSchema.nullable(),
  proposedAgeMs: z.number().nullable(), approvedWaitMs: z.number().nullable(), staleApproval: z.boolean(),
  acceptance: z.object({ commit: commitViewSchema, kind: z.enum(["merged", "direct"]), label: z.string(), acceptor: attributionSchema, approvalToAcceptanceMs: z.number().nullable() }).nullable(),
});
export const documentViewSchema = z.object({
  id: text, kind: z.enum(["contract", "adr", "project"]), title: text, status: z.string(), read: z.string(),
  file: fileReferenceSchema, supersedes: text, approvedBy: text, approvedByAttribution: attributionSchema.nullable(), approvedDate: text, relatedTasks: text, date: text,
});
export const projectReadMetaSchema = z.object({
  projectId: z.uuid(), headSha: text, lastSuccessfulPollAt: text, notCurrent: z.boolean(),
  readState: z.enum(["ready", "not yet read", "not available until the next poll"]), source: sourceViewSchema.nullable(),
});
export const weeklyActivitySchema = z.object({ start: z.string(), end: z.string(), proposed: count, approved: count, completed: count, commits: count, flagsRaised: count });
export const projectViewResponseSchema = projectReadMetaSchema.extend({
  name: z.string(), githubUrl: z.string(), trackedBranch: z.string(),
  leadDeveloper: z.object({ userId: z.string(), displayName: z.string(), inactive: z.boolean() }).nullable(), leadDeveloperLabel: z.string(),
  notices: z.array(z.string()), openFlagCount: count, v1FileCount: count, nonV1FileCount: count,
  proposed: z.array(taskViewSchema), approved: z.array(taskViewSchema), recentlyCompleted: z.array(taskViewSchema),
  other: z.array(taskViewSchema), activity: z.array(weeklyActivitySchema), flags: z.array(projectFlagSchema), allTasksHref: z.string(),
});
export const projectTasksResponseSchema = projectReadMetaSchema.extend({ tasks: z.array(taskViewSchema) });
export const projectTaskResponseSchema = projectReadMetaSchema.extend({
  task: taskViewSchema, history: z.array(z.object({ kind: z.enum(["enters", "leaves", "removed"]), state: z.string().optional(), paths: z.array(z.string()), commit: commitViewSchema })),
  entries: z.array(z.object({ state: z.enum(["approved", "completed"]), commit: commitViewSchema, files: z.array(taskFileViewSchema) })), flags: z.array(projectFlagSchema),
});
export const projectDocumentsResponseSchema = projectReadMetaSchema.extend({ goals: documentViewSchema.nullable(), goalsMessage: text, contracts: z.array(documentViewSchema), adrs: z.array(documentViewSchema) });
export const projectFileResponseSchema = projectReadMetaSchema.extend({ file: fileReferenceSchema, text, status: z.enum(["ok", "could not be read", "not available until the next poll"]), reason: text });
export type ProjectViewResponse = z.infer<typeof projectViewResponseSchema>;
export type ProjectTasksResponse = z.infer<typeof projectTasksResponseSchema>;
export type ProjectTaskResponse = z.infer<typeof projectTaskResponseSchema>;
export type ProjectDocumentsResponse = z.infer<typeof projectDocumentsResponseSchema>;
export type ProjectFileResponse = z.infer<typeof projectFileResponseSchema>;
export type TaskReadView = z.infer<typeof taskViewSchema>;
export type Attribution = z.infer<typeof attributionSchema>;
