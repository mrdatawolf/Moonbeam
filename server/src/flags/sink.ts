import { isDeepStrictEqual } from "node:util";
import { eq, sql } from "drizzle-orm";
import { schema, type Transaction } from "@moonbeam/db";
import type { FlagSink, FlagInput } from "../poller/poll.js";
import type { Actor } from "../identity/actor.js";

export type FlagRow = typeof schema.flags.$inferSelect;
export async function lockFlags(tx: Transaction, projectId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`moonbeam:flags:${projectId}`}, 0))`);
}
/** Flags have their own audit writer because the registry writer has no flag/system seam. */
export async function auditFlag(tx: Transaction, before: FlagRow | null, after: FlagRow,
  now: Date, action: string, actor?: Actor, note?: string) {
  await tx.insert(schema.auditRecords).values({
    projectId: after.projectId, flagId: after.id, action,
    fromState: before?.status ?? null, toState: after.status,
    actorKind: actor ? "human" : "system", actorUserId: actor?.userId ?? null,
    identityMode: actor?.identityMode ?? null, systemTrigger: actor ? null : "poller",
    occurredAt: now, recordedAt: now, details: { before, after, ...(note === undefined ? {} : { note }) },
  });
}

export const flagSink: FlagSink = {
  async apply(tx, input: FlagInput) {
    await lockFlags(tx, input.projectId);
    const now = new Date(input.now);
    const rows = await tx.select().from(schema.flags).where(eq(schema.flags.projectId, input.projectId));
    const held = new Set(input.evaluation.flags.map((f) => f.subjectKey));
    const chain = new Set(input.snapshot.chainShas);
    const withdrawn: FlagRow[] = [];
    for (const row of rows) {
      if (row.status === "withdrawn") continue;
      const dropped = input.rewrite && row.kind === "event" && row.commitSha && !chain.has(row.commitSha);
      const cleared = (row.status === "open" || row.status === "dismissed") &&
        (row.kind === "condition" || (row.rule === "FL-8" && input.mode === "full")) && !held.has(row.subjectKey);
      if (!dropped && !cleared) continue;
      const [after] = await tx.update(schema.flags).set({ status: dropped ? "withdrawn" : "resolved", statusChangedAt: now })
        .where(eq(schema.flags.id, row.id)).returning();
      await auditFlag(tx, row, after!, now, dropped ? "flag_withdrawn" : "flag_resolved");
      Object.assign(row, after);
      if (dropped) withdrawn.push(after!);
    }
    const candidates = [...input.evaluation.flags];
    if (input.rewrite) candidates.push(input.rewrite);
    for (const flag of candidates) {
      const evidence = flag.rule === "FL-10" ? { ...flag.evidence, withdrawnFlags: withdrawn } : flag.evidence;
      const matching = rows.filter((r) => r.rule === flag.rule && r.subjectKey === flag.subjectKey);
      const open = matching.find((r) => r.status === "open");
      if (open) {
        if (!isDeepStrictEqual(open.evidence, evidence)) {
          const [after] = await tx.update(schema.flags).set({ evidence }).where(eq(schema.flags.id, open.id)).returning();
          await auditFlag(tx, open, after!, now, "flag_evidence_updated");
          Object.assign(open, after);
        }
        continue;
      }
      const dismissed = matching.filter((r) => r.status === "dismissed")
        .sort((a, b) => b.statusChangedAt.getTime() - a.statusChangedAt.getTime())[0];
      if (dismissed && (flag.rule !== "FL-5" || now.getTime() - dismissed.statusChangedAt.getTime() <= flag.evidence.thresholdDays * 86_400_000)) continue;
      const [after] = await tx.insert(schema.flags).values({ projectId: input.projectId,
        rule: flag.rule, kind: flag.kind, subjectKey: flag.subjectKey, subject: flag.subject,
        commitSha: flag.subjectCommitSha, taskIdText: "taskId" in flag.subject ? flag.subject.taskId : null,
        evidence, firstRaisedAt: now, statusChangedAt: now, status: "open",
      }).returning();
      await auditFlag(tx, null, after!, now, "flag_raised");
      rows.push(after!);
    }
  },
};
