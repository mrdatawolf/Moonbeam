import { and, eq, isNull, asc } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import { buildMatcher, classifyTaskPath, decodeFile, parseName, parseIdList, taskField, v1Problems, SNAPSHOT_VERSION,
  type ProjectSnapshot, type TaskHistory, type TaskFileRecord, type IdentityMatch, type AuthorIdentity, type IdKind } from "@moonbeam/dbc";
import { projectViewResponseSchema, projectTasksResponseSchema, projectTaskResponseSchema,
  projectDocumentsResponseSchema, projectFileResponseSchema, projectFlagSchema, type Attribution } from "@moonbeam/shared";
import { Mirror, mirrorDirectory } from "../github/mirror.js";
import { sourceView } from "../poller/status.js";
import { reject } from "../errors.js";

const day = 86_400_000;
const ruleNames = ["Approval skipped", "Incomplete record", "Unaccounted change", "Out of scope", "Stale approval", "Duplicate task ID", "Unreadable task file", "Unrecognized approver or acceptor", "Task removed", "History rewritten", "Work state on main"];
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** Read-only models: one MVCC snapshot per response, including current identities. */
export class ProjectViewsService {
  constructor(private readonly opts: { db: Database; clock: () => Date; mirror?: (id: string) => Pick<Mirror, "readFile"> }) {}

  private async read(id: string) {
    if (!uuid.test(id)) return reject("not_found", "The project does not exist.");
    return this.opts.db.transaction(async (tx) => {
      const [project] = await tx.select().from(schema.projects).where(and(eq(schema.projects.id, id), isNull(schema.projects.removedAt)));
      if (!project) return reject("not_found", "The project does not exist.");
      const [stored] = await tx.select().from(schema.projectSnapshots).where(eq(schema.projectSnapshots.projectId, id));
      const [source] = await tx.select().from(schema.projectSources).where(eq(schema.projectSources.projectId, id));
      const members = await tx.select().from(schema.users);
      const identities = await tx.select().from(schema.userIdentities);
      const flags = await tx.select().from(schema.flags).where(eq(schema.flags.projectId, id));
      const audits = await tx.select().from(schema.auditRecords).where(eq(schema.auditRecords.projectId, id)).orderBy(asc(schema.auditRecords.id));
      return { project, stored, source, members, identities, flags, audits };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }

  private async model(id: string) {
    const data = await this.read(id);
    const { project, stored, source, members, identities } = data;
    const now = this.opts.clock().getTime();
    const snapshot = stored?.snapshotVersion === SNAPSHOT_VERSION && stored.snapshot.version === SNAPSHOT_VERSION
      ? stored.snapshot as unknown as ProjectSnapshot : null;
    const head = stored?.headSha ?? source?.lastProcessedHead ?? null;
    const lastPoll = source?.lastSuccessAt?.toISOString() ?? stored?.polledAt.toISOString() ?? null;
    const meta = { projectId: id, headSha: head, lastSuccessfulPollAt: lastPoll,
      notCurrent: source?.status !== "ok" || !snapshot,
      readState: snapshot ? "ready" as const : lastPoll ? "not available until the next poll" as const : "not yet read" as const,
      source: source ? sourceView(source) : null };
    const fullName = source?.redirectedFullName ?? `${project.githubOwner}/${project.githubRepo}`;
    const githubUrl = `https://github.com/${fullName.split("/").map(encodeURIComponent).join("/")}`;
    const base = `/api/projects/${id}`;
    const file = (path: string, sha = head) => ({ path, headSha: sha,
      githubUrl: sha ? `${githubUrl}/blob/${encodeURIComponent(sha)}/${path.split("/").map(encodeURIComponent).join("/")}` : null,
      href: sha === head ? `${base}/file?path=${encodeURIComponent(path)}` : null });
    const matcher = buildMatcher(members.map((m) => ({ userId: m.id, displayName: m.displayName, active: m.active,
      emails: [m.email, ...identities.filter((i) => i.userId === m.id && i.kind === "email").map((i) => i.value)],
      logins: identities.filter((i) => i.userId === m.id && i.kind === "login").map((i) => i.value),
      aliases: identities.filter((i) => i.userId === m.id && i.kind === "alias").map((i) => i.value),
    })));
    const attribution = (match: IdentityMatch<unknown>, recorded: unknown): Attribution => {
      const member = match.kind === "member" ? members.find((m) => m.id === match.userId) : undefined;
      return { kind: match.kind, recorded, userId: member?.id ?? null, displayName: member?.displayName ?? null,
        inactive: member ? !member.active : false, label: member?.displayName ?? "not a board member" };
    };
    const recordedName = (value: string | null) => value === null ? null : attribution(matcher.matchRecordedName(parseName(value).name), value);
    const commit = (index: number | null) => {
      const c = index === null ? undefined : snapshot?.commits[index];
      return c ? { sha: c.sha, subject: c.subject, committedAt: c.committedAt, isMerge: c.isMerge,
        author: c.author, attribution: attribution(matcher.matchAuthor(c.author), c.author), committer: c.committer,
        githubUrl: `${githubUrl}/commit/${c.sha}`, changesComplete: c.changesComplete, label: c.changesComplete ? null : "not fully checked" } : null;
    };
    const related = (value: string | null, kind: IdKind) => {
      const list = parseIdList(value ?? "", kind);
      return (list.kind === "ids" ? list.ids : []).map((refId) => {
        const task = kind === "TASK" ? snapshot?.tasks.find((t) => t.id === refId && t.headFiles.length > 0) : undefined;
        const paths = kind === "TASK" ? task?.headFiles.map((f) => f.path) ?? [] : snapshot?.artifacts.filter((a) => a.classification.kind === (kind === "ADR" ? "adr" : "contract") && "id" in a.classification && a.classification.id === refId).map((a) => a.path) ?? [];
        return { id: refId, kind, found: paths.length > 0, label: paths.length ? null : "not found on main",
          href: paths.length ? kind === "TASK" ? `${base}/tasks/${refId}` : file(paths[0]!).href : null,
          files: paths.map((p) => file(p)), states: task?.currentStates ?? [] };
      });
    };
    const taskFile = (f: TaskFileRecord, sha = head) => {
      const p = f.parsed;
      const value = (name: string) => p ? taskField(p, name)?.value ?? null : null;
      return { file: file(f.path, sha), state: f.classification.kind === "task" ? f.classification.state : "unknown", read: f.read.kind,
        parsed: p, formatLabel: p ? p.isV1 ? "DbC task v1" as const : "not DbC task v1" as const : "could not be read" as const,
        problems: p && f.classification.kind === "task" ? v1Problems(p, f.classification.state, f.classification.id) : [],
        proposedBy: recordedName(value("Proposed by")), approvedBy: recordedName(value("Approved by")),
        proposedDate: value("Proposed date"), approvedDate: value("Approved date"), assignedAgent: value("Assigned agent"),
        relatedContracts: related(value("Related contracts"), "CONTRACT"), relatedAdrs: related(value("Related ADRs"), "ADR"), dependencies: related(value("Dependencies"), "TASK") };
    };
    // Keep stored evidence intact; attach current attribution and source links alongside it.
    const flags = data.flags.sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.firstRaisedAt.getTime() - a.firstRaisedAt.getTime() || a.id.localeCompare(b.id)).map((f) => {
      const attributions: { location: string; attribution: Attribution }[] = [];
      const paths = new Set<string>();
      const visit = (value: unknown, location: string) => {
        if (Array.isArray(value)) { value.forEach((v, i) => visit(v, `${location}.${i}`)); return; }
        if (!value || typeof value !== "object") return;
        for (const [key, v] of Object.entries(value)) {
          const loc = `${location}.${key}`;
          if (key === "author" && v && typeof v === "object" && "email" in v && "name" in v) attributions.push({ location: loc, attribution: attribution(matcher.matchAuthor(v as AuthorIdentity), v) });
          if ((key === "approvedBy" || key === "proposedBy" || key === "recordedName") && typeof v === "string") attributions.push({ location: loc, attribution: recordedName(v)! });
          if ((key === "path" || key === "paths") && typeof v === "string") paths.add(v);
          if ((key === "paths" || key.endsWith("Paths")) && Array.isArray(v)) v.forEach((p) => { if (typeof p === "string") paths.add(p); });
          visit(v, loc);
        }
      };
      visit(f.evidence, "evidence");
      return projectFlagSchema.parse({ ...f, firstRaisedAt: f.firstRaisedAt.toISOString(), statusChangedAt: f.statusChangedAt.toISOString(),
        ruleName: ruleNames[Number(f.rule.slice(3)) - 1], href: `/api/flags/${f.id}`, commitUrl: f.commitSha ? `${githubUrl}/commit/${f.commitSha}` : null,
        files: [...paths].map((p) => file(p, f.commitSha ?? head)), attributions,
        notes: data.audits.filter((a) => a.flagId === f.id && typeof a.details?.note === "string").map((a) => ({ note: a.details!.note, occurredAt: a.occurredAt.toISOString(), actorUserId: a.actorUserId })) });
    });
    const taskView = (t: TaskHistory) => {
      const firstProposed = commit(t.firstProposed), latestApproved = commit(t.latestApproved);
      const acceptanceCommit = commit(t.acceptance?.commitIndex ?? null);
      // Approval after the first acceptance must never change the original duration.
      const priorApproval = t.events.filter((e) => e.kind === "enters" && e.state === "approved" && e.commitIndex < (t.acceptance?.commitIndex ?? -1)).at(-1);
      const approvalCommit = commit(priorApproval?.commitIndex ?? null);
      const asOf = lastPoll ? Date.parse(lastPoll) : now;
      const wait = latestApproved ? asOf - Date.parse(latestApproved.committedAt) : null;
      return { id: t.id, title: t.headFiles.find((f) => f.parsed?.title)?.parsed?.title?.text ?? null, states: t.currentStates,
        files: t.headFiles.map((f) => taskFile(f)), firstProposed, firstApproved: commit(t.firstApproved), firstCompleted: commit(t.firstCompleted), latestApproved,
        proposedAgeMs: firstProposed ? asOf - Date.parse(firstProposed.committedAt) : null, approvedWaitMs: wait,
        staleApproval: t.currentStates.length === 1 && t.currentStates[0] === "approved" && wait !== null && wait > project.staleThresholdDays * day,
        acceptance: acceptanceCommit && t.acceptance ? { commit: acceptanceCommit, kind: t.acceptance.kind,
          label: t.acceptance.kind === "merged" ? "merged" : "direct commit", acceptor: acceptanceCommit.attribution,
          approvalToAcceptanceMs: approvalCommit ? Date.parse(acceptanceCommit.committedAt) - Date.parse(approvalCommit.committedAt) : null } : null };
    };
    const tasks = snapshot?.tasks.map(taskView) ?? [];
    return { ...data, meta, snapshot, now, githubUrl, base, file, recordedName, commit, taskFile, tasks, flags };
  }

  async view(id: string) {
    const m = await this.model(id);
    const { project, snapshot, source, meta } = m;
    const completed = m.tasks.filter((t) => t.states.includes("completed")).sort((a, b) =>
      Date.parse(b.acceptance?.commit.committedAt ?? "1970-01-01") - Date.parse(a.acceptance?.commit.committedAt ?? "1970-01-01") || a.id.localeCompare(b.id));
    const lead = m.members.find((u) => u.id === project.leadDeveloperUserId);
    const notices: string[] = [];
    if (meta.readState !== "ready") notices.push(meta.readState);
    if (source && source.status !== "ok") notices.push(sourceView(source).message);
    if (source?.redirectedFullName) notices.push(`now at ${source.redirectedFullName}; update the registration`);
    if (source?.baselineNeedsReset) notices.push("baseline needs resetting");
    if (source?.tokenWriteScopes) notices.push("token carries write scopes");
    if (snapshot && !snapshot.hasTasksDirectory) notices.push("No DbC task directories found");
    const activity = Array.from({ length: 12 }, (_, i) => {
      const end = m.now - (11 - i) * 7 * day, start = end - 7 * day;
      // Half-open windows (start, end] include now and assign boundaries once.
      const within = (time: string) => Date.parse(time) > start && Date.parse(time) <= end;
      const entries = snapshot?.tasks.flatMap((t) => t.events.filter((e) => e.kind === "enters" && within(snapshot.commits[e.commitIndex]!.committedAt))) ?? [];
      return { start: new Date(start).toISOString(), end: new Date(end).toISOString(),
        proposed: entries.filter((e) => e.kind === "enters" && e.state === "proposed").length,
        approved: entries.filter((e) => e.kind === "enters" && e.state === "approved").length,
        completed: entries.filter((e) => e.kind === "enters" && e.state === "completed").length,
        commits: snapshot?.commits.filter((c) => within(c.committedAt)).length ?? 0,
        flagsRaised: m.flags.filter((f) => within(f.firstRaisedAt)).length };
    });
    const files = snapshot?.taskFiles.filter((f) => f.classification.kind === "task") ?? [];
    return projectViewResponseSchema.parse({ ...meta, name: project.name, githubUrl: m.githubUrl, trackedBranch: project.trackedBranch,
      leadDeveloper: lead ? { userId: lead.id, displayName: lead.displayName, inactive: !lead.active } : null, leadDeveloperLabel: lead?.displayName ?? "No lead developer",
      notices, openFlagCount: m.flags.filter((f) => f.status === "open").length,
      v1FileCount: files.filter((f) => f.parsed?.isV1).length, nonV1FileCount: files.filter((f) => !f.parsed?.isV1).length,
      proposed: m.tasks.filter((t) => t.states.includes("proposed")), approved: m.tasks.filter((t) => t.states.includes("approved")),
      recentlyCompleted: completed.filter((t, i) => i < 10 || (t.acceptance && Date.parse(t.acceptance.commit.committedAt) >= m.now - 30 * day && Date.parse(t.acceptance.commit.committedAt) <= m.now)),
      other: m.tasks.filter((t) => t.states.some((s) => ["in-progress", "review", "removed", "withdrawn"].includes(s))), activity, flags: m.flags, allTasksHref: `${m.base}/tasks` });
  }
  async tasks(id: string) { const m = await this.model(id); return projectTasksResponseSchema.parse({ ...m.meta, tasks: m.tasks }); }
  async task(id: string, taskId: string) {
    const m = await this.model(id);
    const history = m.snapshot?.tasks.find((t) => t.id === taskId);
    if (!history) return reject("not_found", "The task does not exist at this snapshot.", m.meta);
    return projectTaskResponseSchema.parse({ ...m.meta, task: m.tasks.find((t) => t.id === taskId),
      history: history.events.map((e) => ({ kind: e.kind, ...("state" in e ? { state: e.state } : {}), paths: e.paths, commit: m.commit(e.commitIndex) })),
      entries: history.entries.map((e) => ({ state: e.state, commit: m.commit(e.commitIndex), files: e.files.map((f) => m.taskFile(f, m.snapshot!.commits[e.commitIndex]!.sha)) })),
      flags: m.flags.filter((f) => {
        const path = typeof f.subject.path === "string" ? classifyTaskPath(f.subject.path) : null;
        return f.taskIdText === taskId || (path?.kind === "task" && path.id === taskId);
      }) });
  }
  async documents(id: string) {
    const m = await this.model(id);
    const documents = m.snapshot?.artifacts.map((a) => {
      const p = a.parsed && a.parsed.kind !== "unknown" ? a.parsed : null;
      const contract = p?.kind === "contract" ? p : null;
      return { id: "id" in a.classification ? a.classification.id : null, kind: a.classification.kind,
        title: p?.title ?? null, status: a.read.kind !== "text" ? "could not be read" : p?.status ?? "status unknown", read: a.read.kind,
        file: m.file(a.path), supersedes: contract?.supersedes ?? null, approvedBy: contract?.approvedBy ?? null,
        approvedByAttribution: m.recordedName(contract?.approvedBy ?? null), approvedDate: contract?.approvedDate ?? null,
        relatedTasks: contract?.relatedTasks ?? null, date: p?.kind === "adr" ? p.date : null };
    }) ?? [];
    const goals = m.snapshot?.project;
    return projectDocumentsResponseSchema.parse({ ...m.meta,
      goals: goals?.present ? { id: null, kind: "project", title: "Project goals", status: goals.read.kind === "text" ? "available" : "could not be read", read: goals.read.kind,
        file: m.file(goals.path), supersedes: null, approvedBy: null, approvedByAttribution: null, approvedDate: null, relatedTasks: null, date: null } : null,
      goalsMessage: goals?.present ? null : m.snapshot ? "No project definition found" : m.meta.readState,
      contracts: documents.filter((d) => d.kind === "contract"), adrs: documents.filter((d) => d.kind === "adr") });
  }
  async file(id: string, path: unknown) {
    const m = await this.model(id);
    const known = typeof path === "string" && (m.snapshot?.taskFiles.some((f) => f.path === path && f.classification.kind === "task") || m.snapshot?.artifacts.some((a) => a.path === path) || (path === "docs/PROJECT.md" && m.snapshot?.project.present));
    if (!known || typeof path !== "string") return reject("not_found", "The file is not known to this snapshot.", m.meta);
    const result = { ...m.meta, file: m.file(path), text: null as string | null, status: "not available until the next poll" as "ok" | "could not be read" | "not available until the next poll", reason: null as string | null };
    try {
      const mirror = this.opts.mirror?.(id) ?? new Mirror(mirrorDirectory(id));
      const read = await mirror.readFile(m.meta.headSha!, path);
      const decoded = read.kind === "ok" ? decodeFile(read.bytes) : read;
      if (decoded.kind === "text") { result.text = decoded.text; result.status = "ok"; }
      else { result.status = "could not be read"; result.reason = decoded.kind; }
    } catch { result.reason = "mirror unavailable"; }
    return projectFileResponseSchema.parse(result);
  }
}
