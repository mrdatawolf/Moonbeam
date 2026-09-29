import { z } from "zod";
import { projectReadMetaSchema, projectViewResponseSchema, projectFlagSchema, taskViewSchema } from "./project-view.js";

const count = z.number().int().nonnegative();
export const dashboardProjectSchema = projectReadMetaSchema.extend({
  name: z.string(),
  leadDeveloper: projectViewResponseSchema.shape.leadDeveloper,
  leadDeveloperLabel: z.string(),
  proposedCount: count, approvedCount: count, staleApprovalCount: count,
  openFlagCount: count, completedLast30Days: count,
});
const projectReference = z.object({ projectId: z.uuid(), projectName: z.string() });
export const dashboardResponseSchema = z.object({
  projects: z.array(dashboardProjectSchema),
  recentAcceptances: z.array(projectReference.extend({ task: taskViewSchema })),
  recentFlags: z.array(projectReference.extend({ flag: projectFlagSchema })),
});
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
