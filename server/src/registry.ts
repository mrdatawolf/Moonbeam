// CONTRACT-002 user registry and first-run setup.
import { and, eq, ne, sql } from "drizzle-orm";
import { schema, type Database, type Transaction } from "@moonbeam/db";
import {
  firstRunSetupInputSchema,
  userInputSchema,
  userUpdateSchema,
} from "@moonbeam/shared";
import { writeAudit } from "./audit.js";
import { parseInput, reject } from "./errors.js";
import type { Actor, AnyActor } from "./identity/actor.js";

// Registry changes are serialised by a transaction-scoped advisory lock, so
// checks such as "last active user" and "names unique among active users"
// hold under concurrency.
const REGISTRY_LOCK = 0x6d6f6f6e; // "moon"

type UserRow = typeof schema.users.$inferSelect;

export interface RegistryOptions {
  db: Database;
  clock: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RegistryService {
  constructor(private readonly opts: RegistryOptions) {}

  private get db() {
    return this.opts.db;
  }

  private async lock(tx: Transaction, key: number) {
    await tx.execute(sql`select pg_advisory_xact_lock(${key})`);
  }

  // ---- users -------------------------------------------------------------

  async listUsers(includeInactive: boolean): Promise<UserRow[]> {
    const rows = await this.db.select().from(schema.users);
    return rows
      .filter((u) => includeInactive || u.active)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async needsSetup(): Promise<boolean> {
    const [row] = await this.db.select({ n: sql<number>`count(*)::int` }).from(schema.users);
    return (row?.n ?? 0) === 0;
  }

  private async assertNameFree(tx: Transaction, displayName: string, exceptId?: string) {
    const clash = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(
          eq(schema.users.active, true),
          sql`lower(${schema.users.displayName}) = lower(${displayName})`,
          exceptId ? ne(schema.users.id, exceptId) : undefined,
        ),
      );
    if (clash.length) reject("validation", `An active user is already named "${displayName}".`);
  }

  /** First-run setup: only while the registry has no users at all. */
  async firstRunSetup(body: unknown): Promise<UserRow[]> {
    const input = parseInput(firstRunSetupInputSchema, body);
    const lowered = input.users.map((u) => u.displayName.toLowerCase());
    if (new Set(lowered).size !== lowered.length) reject("validation", "Display names must be unique.");
    const now = this.opts.clock();
    const setup: AnyActor = { kind: "setup" };
    return this.db.transaction(async (tx) => {
      await this.lock(tx, REGISTRY_LOCK);
      const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.users);
      if ((count?.n ?? 0) > 0) reject("invalid_transition", "First-run setup is over: the registry already has users.");
      const created = await tx
        .insert(schema.users)
        .values(input.users.map((u) => ({ ...u, createdAt: now, updatedAt: now })))
        .returning();
      for (const u of created) {
        await writeAudit(tx, setup, { subjectUserId: u.id, action: "user_added", details: { after: { displayName: u.displayName, email: u.email } } }, now);
      }
      return created;
    });
  }

  async addUser(actor: Actor, body: unknown): Promise<UserRow> {
    const input = parseInput(userInputSchema, body);
    const now = this.opts.clock();
    return this.db.transaction(async (tx) => {
      await this.lock(tx, REGISTRY_LOCK);
      await this.assertNameFree(tx, input.displayName);
      const [u] = await tx.insert(schema.users).values({ ...input, createdAt: now, updatedAt: now }).returning();
      await writeAudit(tx, actor, { subjectUserId: u!.id, action: "user_added", details: { after: input } }, now);
      return u!;
    });
  }

  private async mustUser(tx: Transaction, id: string): Promise<UserRow> {
    const [u] = UUID.test(id) ? await tx.select().from(schema.users).where(eq(schema.users.id, id)) : [];
    if (!u) reject("not_found", "The user does not exist.");
    return u!;
  }

  async editUser(actor: Actor, id: string, body: unknown): Promise<UserRow> {
    const input = parseInput(userUpdateSchema, body);
    const now = this.opts.clock();
    return this.db.transaction(async (tx) => {
      await this.lock(tx, REGISTRY_LOCK);
      const before = await this.mustUser(tx, id);
      if (input.displayName !== undefined && before.active) await this.assertNameFree(tx, input.displayName, id);
      const [u] = await tx.update(schema.users).set({ ...input, updatedAt: now }).where(eq(schema.users.id, id)).returning();
      await writeAudit(
        tx,
        actor,
        {
          subjectUserId: id,
          action: "user_edited",
          details: {
            before: { displayName: before.displayName, email: before.email },
            after: { displayName: u!.displayName, email: u!.email },
          },
        },
        now,
      );
      return u!;
    });
  }

  async setActive(actor: Actor, id: string, active: boolean): Promise<UserRow> {
    const now = this.opts.clock();
    return this.db.transaction(async (tx) => {
      await this.lock(tx, REGISTRY_LOCK);
      const before = await this.mustUser(tx, id);
      if (before.active === active) reject("invalid_transition", `The user is already ${active ? "active" : "inactive"}.`);
      if (active) {
        await this.assertNameFree(tx, before.displayName, id);
      } else {
        const [row] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(schema.users)
          .where(eq(schema.users.active, true));
        if ((row?.n ?? 0) <= 1) reject("validation", "The last active user cannot be deactivated.");
      }
      const [u] = await tx.update(schema.users).set({ active, updatedAt: now }).where(eq(schema.users.id, id)).returning();
      await writeAudit(
        tx,
        actor,
        { subjectUserId: id, action: active ? "user_reactivated" : "user_deactivated", details: { before: { active: before.active }, after: { active } } },
        now,
      );
      return u!;
    });
  }

}
