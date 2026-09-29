import { schema, type Database, type Transaction } from "@moonbeam/db";
import type { AnyActor } from "./identity/actor.js";

type Executor = Database | Transaction;

export interface AuditEntry {
  projectId?: string | null;
  taskId?: string | null;
  parentTaskId?: string | null;
  subjectUserId?: string | null;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  rejected?: boolean;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  /** Effective time; defaults to `now`. */
  occurredAt?: Date;
}

/** Actor columns of an audit record (CONTRACT-005 "Audit record"; CONTRACT-002 identity mode). */
function actorColumns(actor: AnyActor) {
  switch (actor.kind) {
    case "human":
      return { actorKind: "human" as const, actorUserId: actor.userId, identityMode: actor.identityMode };
    case "setup":
      return { actorKind: "setup" as const, systemTrigger: "first_run_setup" };
  }
}

/** Append one audit record and return its id. Records are never updated. */
export async function writeAudit(db: Executor, actor: AnyActor, entry: AuditEntry, now: Date): Promise<number> {
  const [row] = await db
    .insert(schema.auditRecords)
    .values({
      projectId: entry.projectId ?? null,
      taskId: entry.taskId ?? null,
      parentTaskId: entry.parentTaskId ?? null,
      subjectUserId: entry.subjectUserId ?? null,
      action: entry.action,
      fromState: entry.fromState ?? null,
      toState: entry.toState ?? null,
      rejected: entry.rejected ?? false,
      reason: entry.reason ?? null,
      details: entry.details ?? null,
      occurredAt: entry.occurredAt ?? now,
      recordedAt: now,
      ...actorColumns(actor),
    })
    .returning({ id: schema.auditRecords.id });
  return row!.id;
}
