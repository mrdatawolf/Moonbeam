import { and, eq, sql } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import { findConflicts } from "@moonbeam/dbc";
import { identitiesResponseSchema, identityInputSchema, memberIdentitySchema } from "@moonbeam/shared";
import { parseInput, reject } from "../errors.js";
import { writeAudit } from "../audit.js";
import type { Actor } from "../identity/actor.js";
import { REGISTRY_LOCK } from "../registry.js";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const view = (row: typeof schema.userIdentities.$inferSelect) => memberIdentitySchema.parse({ ...row, automatic: false });
export class IdentitiesService {
  constructor(private readonly opts: { db: Database; clock: () => Date }) {}

  async list() {
    // One statement gives automatic and stored identities a consistent snapshot.
    const rows = await this.opts.db.select().from(schema.users)
      .leftJoin(schema.userIdentities, eq(schema.users.id, schema.userIdentities.userId));
    const grouped = new Map<string, { userId: string; displayName: string; active: boolean; identities: ReturnType<typeof view>[] }>();
    for (const { users: user, user_identities: identity } of rows) {
      let member = grouped.get(user.id);
      if (!member) {
        member = { userId: user.id, displayName: user.displayName, active: user.active,
          identities: [{ id: null, userId: user.id, kind: "email", value: user.email, automatic: true }] };
        grouped.set(user.id, member);
      }
      if (identity) member.identities.push(view(identity));
    }
    const members = [...grouped.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
    const conflicts = findConflicts(members.map((m) => ({ ...m,
      emails: m.identities.filter((i) => i.kind === "email").map((i) => i.value),
      logins: m.identities.filter((i) => i.kind === "login").map((i) => i.value),
      aliases: m.identities.filter((i) => i.kind === "alias").map((i) => i.value),
    })));
    return identitiesResponseSchema.parse({ members, conflicts });
  }

  async add(actor: Actor, userId: string, body: unknown) {
    const input = parseInput(identityInputSchema, body);
    const normalized = input.value.toLowerCase();
    return this.opts.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRY_LOCK})`);
      const [user] = uuid.test(userId) ? await tx.select().from(schema.users).where(eq(schema.users.id, userId)) : [];
      if (!user) return reject("not_found", "The user does not exist.");
      const [duplicate] = await tx.select().from(schema.userIdentities).where(and(
        eq(schema.userIdentities.userId, userId), eq(schema.userIdentities.kind, input.kind),
        eq(schema.userIdentities.normalized, normalized),
      ));
      if (duplicate) reject("validation", "This member already has that identity.");
      const now = this.opts.clock();
      const [row] = await tx.insert(schema.userIdentities).values({
        userId, ...input, normalized, createdAt: now, createdByUserId: actor.userId,
      }).returning();
      const after = view(row!);
      await writeAudit(tx, actor, { subjectUserId: userId, action: "identity_added", details: { before: null, after } }, now);
      return after;
    });
  }
  async remove(actor: Actor, id: string) {
    return this.opts.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRY_LOCK})`);
      const [before] = uuid.test(id) ? await tx.select().from(schema.userIdentities).where(eq(schema.userIdentities.id, id)) : [];
      if (!before) return reject("not_found", "The stored identity does not exist. Automatic e-mail identities cannot be removed here.");
      await tx.delete(schema.userIdentities).where(eq(schema.userIdentities.id, id));
      await writeAudit(tx, actor, { subjectUserId: before.userId, action: "identity_removed", details: { before: view(before), after: null } }, this.opts.clock());
    });
  }
}
