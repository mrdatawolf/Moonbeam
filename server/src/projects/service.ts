import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Database, type Transaction } from "@moonbeam/db";
import { projectRegistrationInputSchema, projectUpdateInputSchema, projectSchema, leadDeveloperInputSchema } from "@moonbeam/shared";
import type { GitHubApi, ApiResult } from "../github/api.js";
import type { TokenFile } from "../github/tokens.js";
import type { Actor } from "../identity/actor.js";
import { parseInput, reject } from "../errors.js";
import { writeAudit } from "../audit.js";
import { REGISTRY_LOCK } from "../registry.js";

type Row = typeof schema.projects.$inferSelect;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const projectView = (row: Row) => projectSchema.parse({
  ...row, githubRepoId: row.githubRepoId.toString(),
  baselineCommittedAt: row.baselineCommittedAt.toISOString(),
  registeredAt: row.registeredAt.toISOString(), removedAt: row.removedAt?.toISOString() ?? null,
});

export class ProjectsService {
  constructor(private readonly opts: { db: Database; clock: () => Date; github: GitHubApi; tokens: TokenFile }) {}

  async list() {
    return (await this.opts.db.select().from(schema.projects).where(isNull(schema.projects.removedAt)))
      .sort((a, b) => a.name.localeCompare(b.name)).map(projectView);
  }
  private async mustProject(db: Database | Transaction, id: string): Promise<Row> {
    const [row] = uuid.test(id) ? await db.select().from(schema.projects)
      .where(and(eq(schema.projects.id, id), isNull(schema.projects.removedAt))) : [];
    if (!row) return reject("not_found", "The project does not exist.");
    return row;
  }
  async get(id: string) { return projectView(await this.mustProject(this.opts.db, id)); }

  private async token(label: string) {
    const result = await this.opts.tokens.lookup(label);
    if (result.kind === "unreadable") return reject("validation", "Token configuration unreadable.");
    if (result.kind === "missing") return reject("validation", "Token not configured: unknown token label or missing configuration.");
    return result.token;
  }

  // Never propagate an upstream exception or its message into logging/responses.
  private async read<T>(request: () => Promise<ApiResult<T>>, missing: string): Promise<T> {
    let result: ApiResult<T>;
    try { result = await request(); }
    catch { return reject("github_unavailable", "GitHub is unavailable."); }
    switch (result.kind) {
      case "ok": return result.data;
      case "not_found": return reject("validation", missing);
      case "unauthorized": return reject("validation", "Token rejected by GitHub.");
      case "rate_limited": return reject("github_unavailable", "GitHub is rate limited. Retry later.");
      default: return reject("github_unavailable", "GitHub is unavailable.");
    }
  }
  private async repository(owner: string, repo: string, token: string) {
    return this.read(() => this.opts.github.getRepository(owner, repo, token), "Repository not found or not accessible.");
  }
  private async baseline(owner: string, repo: string, branch: string, token: string, sha?: string) {
    const head = await this.read(() => this.opts.github.getBranchHead(owner, repo, branch, token), "Tracked branch does not exist.");
    const commit = await this.read(() => this.opts.github.getCommit(owner, repo, sha ?? head.sha, token), "Baseline commit not found or not accessible.");
    return { baselineSha: commit.sha, baselineCommittedAt: new Date(commit.committerTime) };
  }
  private async activeLead(tx: Transaction, userId: string | null) {
    if (userId === null) return;
    const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId));
    if (!user?.active) reject("validation", "The lead developer must be an active user.");
  }
  private async audit(tx: Transaction, actor: Actor, action: string, before: Row | null, after: Row) {
    await writeAudit(tx, actor, {
      projectId: after.id, action, details: { before: before ? projectView(before) : null, after: projectView(after) },
    }, this.opts.clock());
  }

  async register(actor: Actor, body: unknown) {
    const input = parseInput(projectRegistrationInputSchema, body);
    const tokenLabel = input.tokenLabel ?? input.owner;
    const token = await this.token(tokenLabel);
    const repository = await this.repository(input.owner, input.repo, token);
    const [githubOwner, githubRepo] = repository.fullName.split("/") as [string, string];
    const baseline = await this.baseline(githubOwner, githubRepo, input.trackedBranch, token, input.baselineSha);
    return this.opts.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRY_LOCK})`);
      const [duplicate] = await tx.select().from(schema.projects).where(and(
        eq(schema.projects.githubRepoId, BigInt(repository.id)), isNull(schema.projects.removedAt),
      ));
      if (duplicate) reject("validation", "The repository is already registered.");
      await this.activeLead(tx, input.leadDeveloperUserId ?? null);
      const [row] = await tx.insert(schema.projects).values({
        name: input.name ?? repository.fullName, githubOwner, githubRepo, githubRepoId: BigInt(repository.id),
        trackedBranch: input.trackedBranch, tokenLabel, ...baseline,
        leadDeveloperUserId: input.leadDeveloperUserId ?? null, exemptPaths: input.exemptPaths,
        staleThresholdDays: input.staleThresholdDays, registeredAt: this.opts.clock(), registeredByUserId: actor.userId,
      }).returning();
      await this.audit(tx, actor, "project_registered", null, row!);
      return projectView(row!);
    });
  }

  async update(actor: Actor, id: string, body: unknown) {
    const input = parseInput(projectUpdateInputSchema, body);
    return this.opts.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRY_LOCK})`);
      const before = await this.mustProject(tx, id);
      const { owner, repo, baselineSha, ...local } = input;
      const changes: Partial<typeof schema.projects.$inferInsert> = { ...local };
      const branchChanged = input.trackedBranch !== undefined && input.trackedBranch !== before.trackedBranch;
      const nameChanged = owner !== undefined || repo !== undefined;
      if (nameChanged || input.tokenLabel !== undefined || input.trackedBranch !== undefined || baselineSha !== undefined) {
        const token = await this.token(input.tokenLabel ?? before.tokenLabel);
        // An explicit rename is checked by name; all other remote reads start with the recorded ID.
        const repository = nameChanged
          ? await this.repository(owner ?? before.githubOwner, repo ?? before.githubRepo, token)
          : await this.read(() => this.opts.github.getRepositoryById(Number(before.githubRepoId),
            `${before.githubOwner}/${before.githubRepo}`, token), "Repository not found or not accessible.");
        if (BigInt(repository.id) !== before.githubRepoId) reject("validation", "repository identity differs");
        const [canonicalOwner, canonicalRepo] = repository.fullName.split("/") as [string, string];
        if (nameChanged) Object.assign(changes, { githubOwner: canonicalOwner, githubRepo: canonicalRepo });
        const baseline = await this.baseline(canonicalOwner, canonicalRepo,
          input.trackedBranch ?? before.trackedBranch, token,
          baselineSha ?? (branchChanged ? undefined : before.baselineSha));
        if (branchChanged || baselineSha !== undefined) Object.assign(changes, baseline);
      }
      const [after] = await tx.update(schema.projects).set(changes).where(eq(schema.projects.id, id)).returning();
      if (branchChanged) {
        // TASK-023 gap 3: a deliberate branch switch is a fresh read, not a force push.
        // Retain the old snapshot (S7), but discard old polling cursors/conditional headers.
        await tx.update(schema.projectSources).set({
          status: "never_polled", statusSince: this.opts.clock(), lastProcessedHead: null,
          repoEtag: null, baselineNeedsReset: false, rateLimitedUntil: null, consecutiveFailures: 0,
        }).where(eq(schema.projectSources.projectId, id));
      }
      await this.audit(tx, actor, "project_updated", before, after!);
      return projectView(after!);
    });
  }

  async setLeadDeveloper(actor: Actor, id: string, body: unknown) {
    const { userId } = parseInput(leadDeveloperInputSchema, body);
    return this.opts.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRY_LOCK})`);
      const before = await this.mustProject(tx, id);
      await this.activeLead(tx, userId);
      const [after] = await tx.update(schema.projects).set({ leadDeveloperUserId: userId }).where(eq(schema.projects.id, id)).returning();
      await this.audit(tx, actor, "project_lead_developer_changed", before, after!);
      return projectView(after!);
    });
  }
  async remove(actor: Actor, id: string) {
    return this.opts.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${REGISTRY_LOCK})`);
      const before = await this.mustProject(tx, id);
      const [after] = await tx.update(schema.projects).set({ removedAt: this.opts.clock() }).where(eq(schema.projects.id, id)).returning();
      await this.audit(tx, actor, "project_removed", before, after!);
    });
  }
}
