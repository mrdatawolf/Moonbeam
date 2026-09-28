// CONTRACT-002 user registry and first-run setup; ADR-006 / CONTRACT-004 B13
// projects root and project registration (registration and discovery; no relink).
import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { basename, isAbsolute, relative, sep } from "node:path";
import { promisify } from "node:util";
import { and, eq, ne, sql } from "drizzle-orm";
import { schema, type Database, type Transaction } from "@moonbeam/db";
import {
  firstRunSetupInputSchema,
  projectsRootInputSchema,
  registerProjectInputSchema,
  userInputSchema,
  userUpdateSchema,
} from "@moonbeam/shared";
import { writeAudit } from "./audit.js";
import { ActionError, AuthorityViolation, parseInput, reject } from "./errors.js";
import type { Actor, AnyActor } from "./identity/actor.js";
import { checkPermission, type ActionName } from "./identity/permission.js";

import { discoverRepositories } from "./discovery.js";

const run = promisify(execFile);

// Registry changes are serialised by a transaction-scoped advisory lock, so
// checks such as "last active user" and "names unique among active users"
// hold under concurrency.
const REGISTRY_LOCK = 0x6d6f6f6e; // "moon"
/** Serialises projects-root changes and project registration (exported for tests). */
export const PROJECTS_LOCK = 0x6265616d; // "beam"

type UserRow = typeof schema.users.$inferSelect;

export interface RegistryOptions {
  db: Database;
  clock: () => Date;
  /** Moonbeam's install directory (the workspace root). */
  installDir: string;
  /** Moonbeam's data directory (`MOONBEAM_HOME`). */
  dataDir: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `inner` equals `outer` or lies inside it (both real paths). */
function isWithin(inner: string, outer: string): boolean {
  const rel = relative(outer, inner);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

async function realDirectory(path: string): Promise<string | null> {
  try {
    const real = await realpath(path);
    return (await stat(real)).isDirectory() ? real : null;
  } catch {
    return null;
  }
}

export class RegistryService {
  constructor(private readonly opts: RegistryOptions) {}

  private get db() {
    return this.opts.db;
  }

  private async guard(actor: Actor | null, action: ActionName, target: AuthorityViolation["target"]) {
    if (!actor) return;
    const decision = checkPermission(actor, action, { userRecord: action.endsWith("_user") });
    if (decision.allow) return;
    if (decision.category === "authority_violation") {
      const err = new AuthorityViolation(action, decision.reason, target);
      await writeAudit(
        this.db,
        actor,
        {
          projectId: target.projectId ?? null,
          subjectUserId: target.subjectUserId && UUID.test(target.subjectUserId) ? target.subjectUserId : null,
          action,
          rejected: true,
          reason: err.message,
          details: { requestedTarget: target.requested ?? {} },
        },
        this.opts.clock(),
      );
      throw err;
    }
    throw new ActionError(decision.category, decision.reason);
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
  async firstRunSetup(actor: Actor | null, body: unknown): Promise<UserRow[]> {
    await this.guard(actor, "first_run_setup", { requested: { firstRunSetup: true } });
    const input = parseInput(firstRunSetupInputSchema, body);
    const lowered = input.users.map((u) => u.displayName.toLowerCase());
    if (new Set(lowered).size !== lowered.length) reject("validation", "Display names must be unique.");
    const root = input.projectsRoot ? await this.checkProjectsRoot(input.projectsRoot) : null;
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
      if (root) await this.writeProjectsRoot(tx, setup, root, now);
      return created;
    });
  }

  async addUser(actor: Actor, body: unknown): Promise<UserRow> {
    await this.guard(actor, "add_user", { requested: { addUser: true } });
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
    await this.guard(actor, "edit_user", { subjectUserId: id, requested: { userId: id } });
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
    const action = active ? "reactivate_user" : "deactivate_user";
    await this.guard(actor, action, { subjectUserId: id, requested: { userId: id } });
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

  // ---- projects root -----------------------------------------------------

  async projectsRoot(): Promise<string | null> {
    const [row] = await this.db.select().from(schema.settings).where(eq(schema.settings.id, 1));
    return row?.projectsRoot ?? null;
  }

  /**
   * ADR-006 decision 1 / CONTRACT-004 B13: the root must be an existing
   * directory, and neither be nor lie inside Moonbeam's install or data
   * directory, judged by real location after resolving symbolic links.
   */
  private async checkProjectsRoot(path: string): Promise<string> {
    if (!isAbsolute(path)) reject("validation", "The projects root must be an absolute path.");
    const real = await realDirectory(path);
    if (!real) reject("validation", `"${path}" is not an existing directory.`);
    for (const [label, dir] of [
      ["install", this.opts.installDir],
      ["data", this.opts.dataDir],
    ] as const) {
      const realDir = (await realDirectory(dir)) ?? dir;
      if (isWithin(real!, realDir)) {
        reject("validation", `The projects root may not be, or be inside, Moonbeam's ${label} directory (${realDir}).`);
      }
    }
    return real!;
  }

  private async writeProjectsRoot(tx: Transaction, actor: AnyActor, root: string, now: Date) {
    const [before] = await tx.select().from(schema.settings).where(eq(schema.settings.id, 1));
    await tx
      .insert(schema.settings)
      .values({ id: 1, projectsRoot: root, updatedAt: now })
      .onConflictDoUpdate({ target: schema.settings.id, set: { projectsRoot: root, updatedAt: now } });
    await writeAudit(tx, actor, { action: "projects_root_set", details: { before: before?.projectsRoot ?? null, after: root } }, now);
  }

  async setProjectsRoot(actor: Actor, body: unknown): Promise<string> {
    await this.guard(actor, "set_projects_root", { requested: { setProjectsRoot: true } });
    const input = parseInput(projectsRootInputSchema, body);
    const root = await this.checkProjectsRoot(input.path);
    const now = this.opts.clock();
    return this.db.transaction(async (tx) => {
      await this.lock(tx, PROJECTS_LOCK);
      // CONTRACT-004 Q25, board decision (a): refuse while any registered
      // project would fall outside the new root.
      const outside = (await tx.select().from(schema.projects)).filter((p) => !isWithin(p.repoPath, root));
      if (outside.length) {
        reject("validation", "Registered projects would fall outside the new projects root.", {
          projects: outside.map((p) => ({ id: p.id, repoPath: p.repoPath })),
        });
      }
      await this.writeProjectsRoot(tx, actor, root, now);
      return root;
    });
  }

  // ---- projects ----------------------------------------------------------

  async discoverProjects(actor: Actor | null) {
    if (actor?.kind === "agent") reject("not_permitted", "Agents cannot discover repositories outside their project.");
    const root = await this.projectsRoot();
    const projects = await this.db.select({ repoPath: schema.projects.repoPath }).from(schema.projects);
    return discoverRepositories(root, projects.map((p) => p.repoPath));
  }

  async listProjects(actor: Actor | null) {
    const rows = await this.db.select().from(schema.projects);
    // CONTRACT-002 (Board A8): an agent reads only its own project.
    return rows
      .filter((p) => actor?.kind !== "agent" || p.id === actor.projectId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProject(actor: Actor | null, id: string) {
    const [p] = UUID.test(id) ? await this.db.select().from(schema.projects).where(eq(schema.projects.id, id)) : [];
    if (actor?.kind === "agent" && id !== actor.projectId) reject("not_permitted", "An agent reads only its own project.");
    if (!p) reject("not_found", "The project does not exist.");
    return p!;
  }

  /**
   * Register an existing git repository under the projects root (ADR-006
   * decision 2). Only reads the repository; changes nothing in the folder.
   */
  async registerProject(actor: Actor, body: unknown) {
    await this.guard(actor, "register_project", { requested: { registerProject: (body as { path?: unknown } | null)?.path ?? null } });
    const input = parseInput(registerProjectInputSchema, body);
    const root = await this.projectsRoot();
    if (!root) reject("validation", "Set the projects root before registering projects.");
    if (!isAbsolute(input.path)) reject("validation", "The project path must be absolute.");
    const real = await realDirectory(input.path);
    if (!real) reject("validation", `"${input.path}" is not an existing directory.`);
    if (!isWithin(real!, root!) || real === root) {
      reject("validation", `"${input.path}" is not inside the projects root (${root}).`);
    }
    let top: string;
    try {
      const { stdout } = await run("git", ["-C", real!, "rev-parse", "--show-toplevel"], { timeout: 10_000 });
      top = await realpath(stdout.trim());
    } catch {
      reject("validation", `"${input.path}" is not a git repository.`);
    }
    if (top! !== real) reject("validation", `"${input.path}" is inside a git repository but is not its top-level folder (${top!}).`);

    const now = this.opts.clock();
    return this.db.transaction(async (tx) => {
      await this.lock(tx, PROJECTS_LOCK);
      // The root may have changed since the checks above. Read and check it
      // again under the lock that root changes also take, so a project is
      // never registered outside the current root (ADR-006; CONTRACT-004
      // Q25 decision a; TASK-017 F6).
      const [settings] = await tx.select().from(schema.settings).where(eq(schema.settings.id, 1));
      const current = settings?.projectsRoot ?? null;
      if (!current) reject("validation", "Set the projects root before registering projects.");
      if (!isWithin(real!, current!) || real === current) {
        reject("validation", `"${input.path}" is not inside the projects root (${current}).`);
      }
      const [dupe] = await tx.select().from(schema.projects).where(eq(schema.projects.repoPath, real!));
      if (dupe) reject("validation", `This repository is already registered as "${dupe.name}".`);
      const [p] = await tx
        .insert(schema.projects)
        .values({
          name: input.name ?? basename(real!),
          repoPath: real!,
          mainBranch: input.mainBranch,
          registeredAt: now,
          registeredByUserId: actor.kind === "human" ? actor.userId : null,
        })
        .returning();
      await writeAudit(tx, actor, { projectId: p!.id, action: "project_registered", details: { repoPath: real, mainBranch: input.mainBranch } }, now);
      return p!;
    });
  }
}
