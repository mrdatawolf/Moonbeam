import { asc, isNull } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import { dashboardResponseSchema, type DashboardResponse } from "@moonbeam/shared";
import { ProjectViewsService } from "./project.js";

/** Reuse project projections under one read-only MVCC snapshot; no source I/O. */
export class DashboardService {
  constructor(private readonly opts: { db: Database; clock: () => Date }) {}

  async view(): Promise<DashboardResponse> {
    const now = this.opts.clock();
    return this.opts.db.transaction(async (tx) => {
      // ProjectViewsService uses only transaction/select. Nested reads become
      // savepoints on this transaction, retaining its isolation and read-only mode.
      const views = new ProjectViewsService({ db: tx as unknown as Database, clock: () => now });
      const registrations = await tx.select({ id: schema.projects.id }).from(schema.projects)
        .where(isNull(schema.projects.removedAt)).orderBy(asc(schema.projects.name), asc(schema.projects.id));
      const projects: DashboardResponse["projects"] = [];
      const recentAcceptances: DashboardResponse["recentAcceptances"] = [];
      const recentFlags: DashboardResponse["recentFlags"] = [];
      for (const { id } of registrations) {
        const view = await views.view(id);
        const within30Days = (time: string) => Date.parse(time) >= now.getTime() - 30 * 86_400_000 && Date.parse(time) <= now.getTime();
        projects.push({ ...view, proposedCount: view.proposed.length, approvedCount: view.approved.length,
          staleApprovalCount: view.flags.filter((f) => f.rule === "FL-5" && f.status === "open").length,
          completedLast30Days: view.recentlyCompleted.filter((t) => t.acceptance && within30Days(t.acceptance.commit.committedAt)).length });
        const reference = { projectId: id, projectName: view.name };
        recentAcceptances.push(...view.recentlyCompleted.filter((t) => t.acceptance).map((task) => ({ ...reference, task })));
        recentFlags.push(...view.flags.map((flag) => ({ ...reference, flag })));
      }
      recentAcceptances.sort((a, b) => Date.parse(b.task.acceptance!.commit.committedAt) - Date.parse(a.task.acceptance!.commit.committedAt)
        || a.projectId.localeCompare(b.projectId) || a.task.id.localeCompare(b.task.id));
      recentFlags.sort((a, b) => Date.parse(b.flag.firstRaisedAt) - Date.parse(a.flag.firstRaisedAt) || a.flag.id.localeCompare(b.flag.id));
      return dashboardResponseSchema.parse({ projects, recentAcceptances: recentAcceptances.slice(0, 10), recentFlags: recentFlags.slice(0, 10) });
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
}
