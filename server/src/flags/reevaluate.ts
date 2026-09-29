import { and, asc, eq, isNull } from "drizzle-orm";
import { schema, type Database, type Transaction } from "@moonbeam/db";
import { buildMatcher, evaluateFlags, SNAPSHOT_VERSION, type ProjectSnapshot } from "@moonbeam/dbc";
import { flagSink } from "./sink.js";

/** Lock the registration before reading caches: polls hold a share lock on it.
 * This ordering also works inside registration edits, which already own the row. */
export async function reevaluateFlags(tx: Transaction, now: Date, projectId?: string) {
  const projects = await tx.select().from(schema.projects).where(and(isNull(schema.projects.removedAt),
    projectId === undefined ? undefined : eq(schema.projects.id, projectId))).orderBy(asc(schema.projects.id)).for("update");
  const members = await tx.select().from(schema.users);
  const identities = await tx.select().from(schema.userIdentities);
  const matcher = buildMatcher(members.map((m) => ({ userId: m.id, displayName: m.displayName, active: m.active,
    emails: [m.email, ...identities.filter((i) => i.userId === m.id && i.kind === "email").map((i) => i.value)],
    logins: identities.filter((i) => i.userId === m.id && i.kind === "login").map((i) => i.value),
    aliases: identities.filter((i) => i.userId === m.id && i.kind === "alias").map((i) => i.value),
  })));
  for (const project of projects) {
    const [stored] = await tx.select().from(schema.projectSnapshots).where(eq(schema.projectSnapshots.projectId, project.id));
    if (!stored || stored.snapshotVersion !== SNAPSHOT_VERSION || stored.snapshot.version !== SNAPSHOT_VERSION) continue;
    const snapshot = stored.snapshot as unknown as ProjectSnapshot;
    const lead = members.find((m) => m.id === project.leadDeveloperUserId);
    const evaluation = evaluateFlags(snapshot, { baselineSha: project.baselineSha,
      baselineCommittedAt: project.baselineCommittedAt.toISOString(), exemptPaths: project.exemptPaths,
      staleThresholdDays: project.staleThresholdDays, leadDeveloper: lead ? { userId: lead.id, displayName: lead.displayName } : null,
    }, matcher, now.toISOString());
    await flagSink.apply(tx, { projectId: project.id, now: now.toISOString(), mode: "full", snapshot, evaluation, rewrite: null });
    await tx.update(schema.projectSources).set({ baselineNeedsReset: evaluation.baselineNeedsReset }).where(eq(schema.projectSources.projectId, project.id));
  }
}
/** Registry API hook; explicit identity edits use the same function in their transaction. */
export async function reevaluateAll(db: Database, now: Date) {
  await db.transaction((tx) => reevaluateFlags(tx, now));
}
