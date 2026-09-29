import { and, asc, eq } from "drizzle-orm";
import { schema, type Database, type Transaction } from "@moonbeam/db";
import { flagDetailSchema, flagListSchema, flagNoteInputSchema, flagSchema, flagStatusSchema } from "@moonbeam/shared";
import { requireActor, type Actor } from "../identity/actor.js";
import { parseInput, reject } from "../errors.js";
import { auditFlag, lockFlags, type FlagRow } from "./sink.js";

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const view = (row: FlagRow) => flagSchema.parse({ ...row, firstRaisedAt: row.firstRaisedAt.toISOString(), statusChangedAt: row.statusChangedAt.toISOString() });
export class FlagsService {
  constructor(private readonly opts: { db: Database; clock: () => Date }) {}
  private async row(db: Database | Transaction, id: string) {
    const [row] = uuid.test(id) ? await db.select().from(schema.flags).where(eq(schema.flags.id, id)) : [];
    if (!row) return reject("not_found", "The flag does not exist.");
    return row;
  }
  async list(projectId: string, status?: unknown) {
    const filter = status === undefined ? undefined : parseInput(flagStatusSchema, status);
    const [project] = uuid.test(projectId) ? await this.opts.db.select().from(schema.projects).where(eq(schema.projects.id, projectId)) : [];
    if (!project) return reject("not_found", "The project does not exist.");
    const rows = await this.opts.db.select().from(schema.flags).where(and(eq(schema.flags.projectId, projectId), filter ? eq(schema.flags.status, filter) : undefined));
    rows.sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.firstRaisedAt.getTime() - a.firstRaisedAt.getTime() || a.id.localeCompare(b.id));
    return flagListSchema.parse({ flags: rows.map(view) });
  }
  async get(id: string) {
    return this.opts.db.transaction(async (tx) => {
      const row = await this.row(tx, id);
      await lockFlags(tx, row.projectId);
      const current = await this.row(tx, id);
      const history = await tx.select().from(schema.auditRecords).where(eq(schema.auditRecords.flagId, id)).orderBy(asc(schema.auditRecords.id));
      return flagDetailSchema.parse({ ...view(current), history: history.map((a) => ({ ...a,
        occurredAt: a.occurredAt.toISOString(), recordedAt: a.recordedAt.toISOString(), note: a.details?.note ?? null,
      })) });
    });
  }
  async dismiss(actor: Actor | null, id: string, body: unknown) { return this.change(actor, id, body, "dismissed"); }
  async reopen(actor: Actor | null, id: string, body: unknown) { return this.change(actor, id, body, "open"); }
  private async change(selected: Actor | null, id: string, body: unknown, status: "open" | "dismissed") {
    const actor = requireActor(selected);
    const { note } = parseInput(flagNoteInputSchema, body);
    return this.opts.db.transaction(async (tx) => {
      const initial = await this.row(tx, id);
      await lockFlags(tx, initial.projectId);
      const before = await this.row(tx, id);
      if (before.status !== (status === "open" ? "dismissed" : "open")) return reject("invalid_transition", "The flag is not in the required status.");
      if (status === "open") {
        const [other] = await tx.select().from(schema.flags).where(and(eq(schema.flags.projectId, before.projectId), eq(schema.flags.rule, before.rule), eq(schema.flags.subjectKey, before.subjectKey), eq(schema.flags.status, "open")));
        if (other) return reject("conflict", "Another open flag exists for this subject.");
      }
      const now = this.opts.clock();
      const [after] = await tx.update(schema.flags).set({ status, statusChangedAt: now }).where(eq(schema.flags.id, id)).returning();
      await auditFlag(tx, before, after!, now, status === "open" ? "flag_reopened" : "flag_dismissed", actor, note);
      return view(after!);
    });
  }
}
