import { stat } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Database, type Project, type ProjectSource, type Transaction } from "@moonbeam/db";
import { buildMatcher, compareSnapshots, deriveSnapshot, evaluateFlags, rewriteFlag, SNAPSHOT_VERSION,
  type FlagEvaluation, type FlagFor, type ProjectSnapshot } from "@moonbeam/dbc";
import type { SourceStatus, SourceView } from "@moonbeam/shared";
import type { GitHubApi, ApiResult } from "../github/api.js";
import { Mirror, mirrorDirectory } from "../github/mirror.js";
import type { TokenFile } from "../github/tokens.js";
import { reject } from "../errors.js";
import { cachedLogins, chainSource } from "./chain-source.js";
import { withProjectLock } from "./lock.js";
import { backoffMs, sourceView } from "./status.js";

export interface FlagInput {
  projectId: string; now: string; mode: "full" | "conditions";
  snapshot: ProjectSnapshot; evaluation: FlagEvaluation; rewrite: FlagFor<"FL-10"> | null;
}
/** Implementations must use this transaction; TASK-035 owns records and audit. */
export interface FlagSink { apply(tx: Transaction, input: FlagInput): Promise<void> }
export const nullFlagSink: FlagSink = { apply: async () => {} };
export interface PollOptions {
  db: Database; github: GitHubApi; tokens: TokenFile; clock: () => Date;
  mirror?: (projectId: string) => Mirror; flags?: FlagSink;
}
class SourceFailure extends Error {
  constructor(readonly status: SourceStatus, readonly resetAt: string | null = null) { super(status); }
}
function unwrap<T>(result: ApiResult<T>, missing: SourceStatus = "not_found"): T {
  if (result.kind === "ok") return result.data;
  const status = result.kind === "unauthorized" ? "token_rejected" : result.kind === "not_found" ? missing
    : result.kind === "rate_limited" ? "rate_limited" : "unreachable";
  throw new SourceFailure(status, result.kind === "rate_limited" ? result.resetAt : null);
}

export class Poller {
  constructor(private readonly options: PollOptions) {}

  /** Scheduler supplies the in-process mutex; the database lock covers other instances. */
  async poll(projectId: string, manual = false): Promise<SourceView> {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(projectId)) return reject("not_found", "The project does not exist.");
    const { db, clock } = this.options;
    const result = await withProjectLock(db, projectId, async (tx) => {
      const [project] = await tx.select().from(schema.projects).where(and(eq(schema.projects.id, projectId), isNull(schema.projects.removedAt))).for("share");
      if (!project) return reject("not_found", "The project does not exist.");
      await tx.insert(schema.projectSources).values({ projectId, statusSince: project.registeredAt }).onConflictDoNothing();
      const [source] = await tx.select().from(schema.projectSources).where(eq(schema.projectSources.projectId, projectId));
      if (!source) throw new Error("Project source missing");
      const now = clock();
      if (source.rateLimitedUntil && source.rateLimitedUntil > now) return sourceView(source);
      if (!manual && source.status === "unreachable" && source.lastAttemptAt &&
        now.getTime() < source.lastAttemptAt.getTime() + backoffMs(source.consecutiveFailures)) return sourceView(source);
      let result: SourceView;
      try {
        // Savepoint ensures failed sinks/reads cannot leave partial cache/status writes.
        result = await tx.transaction((inner) => this.read(inner, project, source, now));
      } catch (error) {
        const failure = error instanceof SourceFailure ? error : new SourceFailure("unreachable");
        const until = failure.status === "rate_limited" ? new Date(failure.resetAt ?? now.getTime() + 300_000) : null;
        const [failed] = await tx.update(schema.projectSources).set({
          status: failure.status, statusSince: source.status === failure.status ? source.statusSince : now,
          lastAttemptAt: now, rateLimitedUntil: until,
          consecutiveFailures: failure.status === "unreachable" ? (source.status === "unreachable" ? source.consecutiveFailures : 0) + 1 : 0,
        }).where(eq(schema.projectSources.projectId, projectId)).returning();
        result = sourceView(failed!);
      }
      return result;
    }, async (tx) => {
      // Join the active transaction in another instance, then read its result.
      // This waiting connection never takes a session lock or starts another poll.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`moonbeam:poll:${projectId}`}, 0))`);
      return this.current(tx, projectId);
    });
    if (result.status === "ok" && result.lastProcessedHead) await this.pinProcessed(projectId, result.lastProcessedHead);
    return result;
  }

  /** Post-commit cache maintenance. Recheck the cursor under the same lock so a
   * delayed pin can never overwrite a newer poll's ref in another instance. */
  private async pinProcessed(projectId: string, head: string): Promise<void> {
    await withProjectLock(this.options.db, projectId, async (tx) => {
      const [source] = await tx.select().from(schema.projectSources).where(eq(schema.projectSources.projectId, projectId));
      if (source?.lastProcessedHead !== head) return;
      const mirror = this.options.mirror?.(projectId) ?? new Mirror(mirrorDirectory(projectId));
      await mirror.pin(head);
    }, async () => {}).catch(() => {
      // The derived result already committed. Retry this cache maintenance on
      // the next unchanged poll; never discard a successful snapshot for it.
      console.warn("[moonbeam] mirror pin failed; retrying on the next poll");
    });
  }

  private async current(tx: Transaction, id: string): Promise<SourceView> {
    const [row] = await tx.select().from(schema.projectSources).innerJoin(schema.projects,
      eq(schema.projects.id, schema.projectSources.projectId)).where(and(eq(schema.projects.id, id), isNull(schema.projects.removedAt)));
    if (row) return sourceView(row.project_sources);
    const [project] = await tx.select().from(schema.projects).where(and(eq(schema.projects.id, id), isNull(schema.projects.removedAt)));
    if (!project) return reject("not_found", "The project does not exist.");
    return sourceView({ projectId: id, status: "never_polled", statusSince: project.registeredAt,
      lastAttemptAt: null, lastSuccessAt: null, lastProcessedHead: null, rateLimitedUntil: null,
      redirectedFullName: null, tokenWriteScopes: null, consecutiveFailures: 0, baselineNeedsReset: false, repoEtag: null });
  }

  private async read(tx: Transaction, project: Project, source: ProjectSource, now: Date): Promise<SourceView> {
    const { github, tokens } = this.options;
    const credential = await tokens.lookup(project.tokenLabel);
    if (credential.kind !== "ok") throw new SourceFailure(credential.kind === "missing" ? "token_missing" : "token_config_unreadable");
    const token = credential.token;
    const registeredName = `${project.githubOwner}/${project.githubRepo}`;
    const repoResult = await github.getRepositoryById(Number(project.githubRepoId), registeredName, token, source.repoEtag ?? undefined);
    // ADR-010 resolves by ID. If it vanished, metadata at the registered name
    // distinguishes a replacement repository; never read that repository's contents.
    if (repoResult.kind === "not_found") {
      const named = await github.getRepository(project.githubOwner, project.githubRepo, token);
      if (named.kind === "ok" && BigInt(named.data.id) !== project.githubRepoId) throw new SourceFailure("identity_changed");
      if (named.kind !== "ok" && named.kind !== "not_found") unwrap(named);
      throw new SourceFailure("not_found");
    }
    let fullName = source.redirectedFullName ?? registeredName;
    let writeScopes = source.tokenWriteScopes;
    let repoEtag = source.repoEtag;
    if (repoResult.kind === "not_modified") {
      if (!source.repoEtag) throw new SourceFailure("unreachable");
      repoEtag = repoResult.etag ?? repoEtag;
    } else {
      const repo = unwrap(repoResult);
      if (BigInt(repo.id) !== project.githubRepoId) throw new SourceFailure("identity_changed");
      fullName = repo.fullName;
      writeScopes = repo.writeScopes === null ? null : repo.writeScopes.length > 0;
      repoEtag = repoResult.kind === "ok" ? repoResult.etag : null;
    }
    const [owner, name] = fullName.split("/") as [string, string];
    const { sha: head } = unwrap(await github.getBranchHead(owner, name, project.trackedBranch, token), "branch_missing");
    const [stored] = await tx.select().from(schema.projectSnapshots).where(eq(schema.projectSnapshots.projectId, project.id));
    const compatible = stored?.snapshotVersion === SNAPSHOT_VERSION && stored.snapshot.version === SNAPSHOT_VERSION;
    const unchanged = compatible && source.lastProcessedHead === head && stored.headSha === head;
    const mirror = this.options.mirror?.(project.id) ?? new Mirror(mirrorDirectory(project.id));
    let mirrorMissing = false;
    try { await stat(join(mirror.directory, "HEAD")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; mirrorMissing = true; }
    let snapshot: ProjectSnapshot;
    let rewritten = false;
    if (unchanged && !mirrorMissing) snapshot = stored.snapshot as unknown as ProjectSnapshot;
    else {
      await mirror.ensure();
      const fetched = await mirror.fetch(mirror.remoteUrl(owner, name), project.trackedBranch, token);
      if (fetched.kind !== "ok") throw new SourceFailure(fetched.kind);
      // The branch can move between REST and fetch. Retry later instead of combining heads.
      if (fetched.head !== head) throw new SourceFailure("unreachable");
      const logins = await cachedLogins(tx, project.id);
      const known = new Set(logins.keys());
      if (!known.has(head)) {
        const additions = unwrap(await github.listCommitLogins(owner, name, head, known, token), "unreachable");
        for (const entry of additions) {
          logins.set(entry.sha, entry.login);
          await tx.insert(schema.commitLogins).values({ projectId: project.id, ...entry }).onConflictDoNothing();
        }
      }
      // REST pagination can encounter an already-known side-parent commit before
      // an unknown first-parent commit. Fill every chain miss explicitly.
      for (const commit of await mirror.readChain(head)) {
        if (logins.has(commit.sha)) continue;
        const additions = unwrap(await github.listCommitLogins(owner, name, commit.sha, new Set(logins.keys()), token), "unreachable");
        for (const entry of additions) {
          logins.set(entry.sha, entry.login);
          await tx.insert(schema.commitLogins).values({ projectId: project.id, ...entry }).onConflictDoNothing();
        }
      }
      const adapted = await chainSource(mirror, head, logins);
      snapshot = await deriveSnapshot(adapted.chain, adapted.readFile);
      if (compatible && source.lastProcessedHead && source.lastProcessedHead !== head) {
        // After cache deletion old objects may no longer exist. The persisted
        // first-parent chain is sufficient evidence when that head left the chain.
        try { rewritten = !await mirror.isAncestor(source.lastProcessedHead, head); }
        catch (error) {
          if (!mirrorMissing || snapshot.chainShas.includes(source.lastProcessedHead)) throw error;
          rewritten = true; // The old head is absent from the newly fetched graph.
        }
      }
    }
    const members = await tx.select().from(schema.users);
    const identities = await tx.select().from(schema.userIdentities);
    const matcher = buildMatcher(members.map((member) => ({ userId: member.id, displayName: member.displayName, active: member.active,
      emails: [member.email, ...identities.filter((i) => i.userId === member.id && i.kind === "email").map((i) => i.value)],
      logins: identities.filter((i) => i.userId === member.id && i.kind === "login").map((i) => i.value),
      aliases: identities.filter((i) => i.userId === member.id && i.kind === "alias").map((i) => i.value),
    })));
    const lead = members.find((m) => m.id === project.leadDeveloperUserId);
    // Baseline at head skips all event-rule evaluation on unchanged polls.
    const evaluation = evaluateFlags(snapshot, {
      baselineSha: unchanged ? head : project.baselineSha, baselineCommittedAt: project.baselineCommittedAt.toISOString(),
      exemptPaths: project.exemptPaths, staleThresholdDays: project.staleThresholdDays,
      leadDeveloper: lead ? { userId: lead.id, displayName: lead.displayName } : null,
    }, matcher, now.toISOString());
    evaluation.baselineNeedsReset = !snapshot.chainShas.includes(project.baselineSha);
    const rewrite = rewritten ? rewriteFlag(source.lastProcessedHead!, head, now.toISOString(),
      compareSnapshots(stored!.snapshot as unknown as ProjectSnapshot, snapshot)) : null;
    const values = { projectId: project.id, headSha: head, polledAt: now, snapshotVersion: SNAPSHOT_VERSION,
      snapshot: snapshot as unknown as Record<string, unknown> };
    await tx.insert(schema.projectSnapshots).values(values).onConflictDoUpdate({ target: schema.projectSnapshots.projectId, set: values });
    const [updated] = await tx.update(schema.projectSources).set({
      status: "ok", statusSince: source.status === "ok" ? source.statusSince : now,
      lastAttemptAt: now, lastSuccessAt: now, lastProcessedHead: head, rateLimitedUntil: null,
      consecutiveFailures: 0, baselineNeedsReset: evaluation.baselineNeedsReset,
      redirectedFullName: fullName === registeredName ? null : fullName, tokenWriteScopes: writeScopes, repoEtag,
    }).where(eq(schema.projectSources.projectId, project.id)).returning();
    await (this.options.flags ?? nullFlagSink).apply(tx, { projectId: project.id, now: now.toISOString(),
      mode: unchanged ? "conditions" : "full", snapshot, evaluation, rewrite });
    return sourceView(updated!);
  }
}
