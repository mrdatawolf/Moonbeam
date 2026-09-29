import { sql } from "drizzle-orm";
import type { Database, Transaction } from "@moonbeam/db";

/** Keep a single pooled connection for the session lock, including error cleanup. */
export function withProjectLock<T>(db: Database, projectId: string,
  acquired: (tx: Transaction) => Promise<T>, busy: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const key = sql`hashtextextended(${`moonbeam:poll:${projectId}`}, 0)`;
    const [lock] = await tx.execute<{ locked: boolean }>(sql`select pg_try_advisory_lock(${key}) as locked`);
    if (!lock?.locked) return busy(tx);
    try {
      // Roll back SQL errors to this savepoint before unlocking the session:
      // PostgreSQL otherwise rejects unlock in an aborted transaction.
      return await tx.transaction(async (guard) => {
        // Retain exclusion through COMMIT after the session unlock in finally.
        await guard.execute(sql`select pg_advisory_xact_lock(${key})`);
        return acquired(guard);
      });
    } finally { await tx.execute(sql`select pg_advisory_unlock(${key})`); }
  });
}
