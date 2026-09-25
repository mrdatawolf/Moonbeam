import { z } from "zod";
import { queueEntrySchema } from "./lifecycle.js";

export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  repoPath: z.string(),
  mainBranch: z.string(),
  registeredAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;

export const projectListResponseSchema = z.object({ projects: z.array(projectSchema) });

export const registerProjectInputSchema = z.object({
  path: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  mainBranch: z.string().trim().min(1).default("main"),
});
export type RegisterProjectInput = z.input<typeof registerProjectInputSchema>;

export const projectsRootInputSchema = z.object({ path: z.string().trim().min(1) });

export const projectsRootResponseSchema = z.object({ projectsRoot: z.string().nullable() });

export const projectQueueResponseSchema = z.object({
  project: projectSchema,
  queue: z.array(queueEntrySchema),
});
