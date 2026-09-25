// HTTP routes. Every action route follows CONTRACT-002's order: resolve the
// actor (`unidentified`), check permission (`authority_violation`,
// `not_permitted`), then the lifecycle rules. Request bodies are parsed only
// in the last step, so an agent attempt at a human-only action is
// `authority_violation` even with an invalid body.
import { Router, type Request, type Response } from "express";
import {
  actionResultSchema,
  agentUserSchema,
  decisionQueueSchema,
  devStartRunResponseSchema,
  projectListResponseSchema,
  projectQueueResponseSchema,
  projectSchema,
  projectsRootResponseSchema,
  runSchema,
  setupStatusSchema,
  taskDetailSchema,
  taskListResponseSchema,
  taskStateSchema,
  userListResponseSchema,
  userSchema,
  whoAmIResponseSchema,
} from "@moonbeam/shared";
import { eq } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import { reject } from "./errors.js";
import { actorView, requireActor, resolveActor, type Actor } from "./identity/actor.js";
import type { ActionOutcome, LifecycleService } from "./lifecycle/service.js";
import type { RegistryService } from "./registry.js";
import { auditRecords, decisionQueue, listTasks, projectQueueView, taskDetail } from "./views.js";

export interface Services {
  lifecycle: LifecycleService;
  registry: RegistryService;
  /** Enables the development/test-only run, credential and pause endpoints. */
  devRoutes: boolean;
}

const param = (req: Request, name: string): string => String(req.params[name] ?? "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const userView = (u: { id: string; displayName: string; email: string; active: boolean; createdAt: Date; updatedAt: Date }) =>
  userSchema.parse({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() });

/** A user record for the requesting actor: agents never receive e-mail addresses (TASK-017 N1). */
const userViewFor = (actor: Actor | null, u: Parameters<typeof userView>[0]) =>
  actor?.kind === "agent" ? agentUserSchema.parse(userView(u)) : userView(u);

const projectView = (p: { id: string; name: string; repoPath: string; mainBranch: string; registeredAt: Date }) =>
  projectSchema.parse({ id: p.id, name: p.name, repoPath: p.repoPath, mainBranch: p.mainBranch, registeredAt: p.registeredAt.toISOString() });

export function apiRoutes(services: Services): Router {
  const { lifecycle, registry } = services;
  const db = lifecycle.db;
  const router = Router();

  const resolve = (req: Request) => resolveActor(db, req.headers, lifecycle.clock());

  /** Wrap a lifecycle action: resolve actor, run, respond with the task and its new audit records. */
  const action =
    (fn: (actor: Actor, req: Request) => Promise<ActionOutcome>, status = 200) =>
    async (req: Request, res: Response) => {
      const actor = requireActor(await resolve(req));
      const outcome = await fn(actor, req);
      const task = await taskDetail(db, outcome.taskId);
      res.status(status).json(actionResultSchema.parse({ task, audit: await auditRecords(db, outcome.auditIds) }));
    };

  /** Reads: viewers need no selection (Board B2); agents read only their own project (Board A8). */
  const readProject = async (actor: Actor | null, projectId: string) => {
    if (actor?.kind === "agent" && actor.projectId !== projectId) reject("not_permitted", "An agent reads only its own project.");
  };

  // ---- identity ----------------------------------------------------------

  router.get("/whoami", async (req, res) => {
    const actor = await resolve(req);
    res.json(whoAmIResponseSchema.parse({ actor: actor ? actorView(actor) : null }));
  });

  router.get("/setup", async (_req, res) => {
    res.json(setupStatusSchema.parse({ needsSetup: await registry.needsSetup(), projectsRoot: await registry.projectsRoot() }));
  });

  router.post("/setup", async (req, res) => {
    const users = await registry.firstRunSetup(await resolve(req), req.body);
    res.status(201).json({ users: users.map(userView) });
  });

  router.get("/users", async (req, res) => {
    const actor = await resolve(req); // an invalid credential is still `unidentified` (R3)
    const users = await registry.listUsers(req.query.includeInactive === "true");
    res.json(userListResponseSchema.parse({ users: users.map((u) => userViewFor(actor, u)) }));
  });

  router.post("/users", async (req, res) => {
    res.status(201).json(userView(await registry.addUser(requireActor(await resolve(req)), req.body)));
  });

  router.patch("/users/:id", async (req, res) => {
    res.json(userView(await registry.editUser(requireActor(await resolve(req)), param(req, "id"), req.body)));
  });

  router.post("/users/:id/deactivate", async (req, res) => {
    res.json(userView(await registry.setActive(requireActor(await resolve(req)), param(req, "id"), false)));
  });

  router.post("/users/:id/reactivate", async (req, res) => {
    res.json(userView(await registry.setActive(requireActor(await resolve(req)), param(req, "id"), true)));
  });

  // ---- projects root and projects ----------------------------------------

  router.get("/settings/projects-root", async (req, res) => {
    await resolve(req);
    res.json(projectsRootResponseSchema.parse({ projectsRoot: await registry.projectsRoot() }));
  });

  router.put("/settings/projects-root", async (req, res) => {
    const root = await registry.setProjectsRoot(requireActor(await resolve(req)), req.body);
    res.json(projectsRootResponseSchema.parse({ projectsRoot: root }));
  });

  router.get("/projects", async (req, res) => {
    const projects = await registry.listProjects(await resolve(req));
    res.json(projectListResponseSchema.parse({ projects: projects.map(projectView) }));
  });

  router.post("/projects", async (req, res) => {
    res.status(201).json(projectView(await registry.registerProject(requireActor(await resolve(req)), req.body)));
  });

  /** A project with its queue in order (CONTRACT-001 "Interfaces"). */
  router.get("/projects/:id", async (req, res) => {
    const project = await registry.getProject(await resolve(req), param(req, "id"));
    await lifecycle.sweepExpiredClaims();
    res.json(projectQueueResponseSchema.parse({ project: projectView(project), queue: await projectQueueView(db, project.id) }));
  });

  router.get("/projects/:id/tasks", async (req, res) => {
    const project = await registry.getProject(await resolve(req), param(req, "id"));
    const raw = typeof req.query.state === "string" ? req.query.state.split(",").filter(Boolean) : null;
    const states = raw ? raw.map((s) => taskStateSchema.safeParse(s)) : null;
    if (states?.some((s) => !s.success)) reject("validation", "Unknown task state in `state`.");
    await lifecycle.sweepExpiredClaims();
    const tasks = await listTasks(db, project.id, states ? states.map((s) => s.data!) : null);
    res.json(taskListResponseSchema.parse({ tasks }));
  });

  router.post("/projects/:id/tasks", action((actor, req) => lifecycle.createTask(actor, param(req, "id"), req.body), 201));

  // ---- tasks ---------------------------------------------------------------

  router.get("/tasks/:id", async (req, res) => {
    const actor = await resolve(req);
    await lifecycle.sweepExpiredClaims();
    const id = param(req, "id");
    const detail = UUID.test(id) ? await taskDetail(db, id) : null;
    if (!detail) {
      if (actor?.kind === "agent") reject("not_permitted", "An agent reads only its own project.");
      reject("not_found", "The task does not exist.");
    }
    await readProject(actor, detail!.projectId);
    res.json(taskDetailSchema.parse(detail));
  });

  router.post("/tasks/:id/approve", action((a, req) => lifecycle.approve(a, param(req, "id"))));
  router.post("/tasks/:id/claim", action((a, req) => lifecycle.claim(a, param(req, "id"))));
  router.post("/tasks/:id/release", action((a, req) => lifecycle.release(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/renew", action((a, req) => lifecycle.renew(a, param(req, "id"))));
  router.post("/tasks/:id/handoff", action((a, req) => lifecycle.handoff(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/reviews", action((a, req) => lifecycle.recordReview(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/accept", action((a, req) => lifecycle.accept(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/return", action((a, req) => lifecycle.returnTask(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/subtasks", action((a, req) => lifecycle.addSubtasks(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/cancel", action((a, req) => lifecycle.cancel(a, param(req, "id"), req.body)));
  router.post("/tasks/:id/blockers", action((a, req) => lifecycle.addBlocker(a, param(req, "id"), req.body)));
  router.post(
    "/tasks/:id/blockers/:blockerId/resolve",
    action((a, req) => lifecycle.resolveBlocker(a, param(req, "id"), param(req, "blockerId"))),
  );
  router.post("/tasks/:id/move", action((a, req) => lifecycle.move(a, param(req, "id"), req.body)));

  // ---- decision queue ----------------------------------------------------

  router.get("/decision-queue", async (req, res) => {
    const actor = await resolve(req);
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    if (projectId !== undefined && !UUID.test(projectId)) reject("validation", "`projectId` must be a project id.");
    if (projectId) await readProject(actor, projectId);
    await lifecycle.sweepExpiredClaims();
    const scope = projectId ? [projectId] : actor?.kind === "agent" ? [actor.projectId] : "all";
    res.json(decisionQueueSchema.parse(await decisionQueue(db, scope)));
  });

  // ---- development and test only ---------------------------------------------

  if (services.devRoutes) {
    router.post("/dev/runs", async (req, res) => {
      const actor = requireActor(await resolve(req));
      const { runId, credential } = await lifecycle.devStartRun(actor, req.body);
      const [run] = await db.select().from(schema.agentRuns).where(eq(schema.agentRuns.id, runId));
      res.status(201).json(
        devStartRunResponseSchema.parse({
          run: runSchema.parse({
            ...run,
            startedAt: run!.startedAt.toISOString(),
            endedAt: run!.endedAt?.toISOString() ?? null,
          }),
          credential,
        }),
      );
    });
    router.post("/dev/runs/:id/end", action((a, req) => lifecycle.devEndRun(a, param(req, "id"), req.body)));
    router.post("/dev/runs/:id/pauses", action((a, req) => lifecycle.devOpenPause(a, param(req, "id"), req.body)));
    router.post("/dev/pauses/:id/close", action((a, req) => lifecycle.devClosePause(a, param(req, "id"))));
  }

  return router;
}
