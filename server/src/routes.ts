import { ProjectViewsService } from "./views/project.js";
import { FlagsService } from "./flags/service.js";
import { reevaluateAll } from "./flags/reevaluate.js";
// All request identity is resolved through the CONTRACT-002 actor seam.
import { Router, type Request } from "express";
import { githubTokensResponseSchema, projectListResponseSchema, setupStatusSchema, userListResponseSchema, userSchema, whoAmIResponseSchema } from "@moonbeam/shared";
import type { Database } from "@moonbeam/db";
import { actorView, requireActor, resolveActor } from "./identity/actor.js";
import type { RegistryService } from "./registry.js";

import type { ProjectsService } from "./projects/service.js";
import type { IdentitiesService } from "./identities/service.js";
import type { PollScheduler } from "./poller/scheduler.js";
import type { TokenFile } from "./github/tokens.js";

export interface Services {
  poller: PollScheduler;
  projects: ProjectsService;
  identities: IdentitiesService;
  tokens: TokenFile;
  db: Database;
  clock: () => Date;
  registry: RegistryService;
}

const param = (req: Request, name: string): string => String(req.params[name] ?? "");
const userView = (u: { id: string; displayName: string; email: string; active: boolean; createdAt: Date; updatedAt: Date }) =>
  userSchema.parse({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() });

export function apiRoutes({ db, registry, projects, identities, tokens, poller, clock }: Services): Router {
  const router = Router();
  const flags = new FlagsService({ db, clock });
  const views = new ProjectViewsService({ db, clock });
  const resolve = (req: Request) => resolveActor(db, req.headers);

  // ---- identity ----------------------------------------------------------

  router.get("/whoami", async (req, res) => {
    const actor = await resolve(req);
    res.json(whoAmIResponseSchema.parse({ actor: actor ? actorView(actor) : null }));
  });

  router.get("/setup", async (_req, res) => {
    res.json(setupStatusSchema.parse({ needsSetup: await registry.needsSetup() }));
  });

  router.post("/setup", async (req, res) => {
    const users = await registry.firstRunSetup(req.body);
    res.status(201).json({ users: users.map(userView) });
  });

  router.get("/users", async (req, res) => {
    await resolve(req);
    const users = await registry.listUsers(req.query.includeInactive === "true");
    res.json(userListResponseSchema.parse({ users: users.map(userView) }));
  });

  router.post("/users", async (req, res) => {
    const user = await registry.addUser(requireActor(await resolve(req)), req.body);
    await reevaluateAll(db, clock());
    res.status(201).json(userView(user));
  });

  router.patch("/users/:id", async (req, res) => {
    const user = await registry.editUser(requireActor(await resolve(req)), param(req, "id"), req.body);
    await reevaluateAll(db, clock());
    res.json(userView(user));
  });

  router.post("/users/:id/deactivate", async (req, res) => {
    res.json(userView(await registry.setActive(requireActor(await resolve(req)), param(req, "id"), false)));
  });

  router.post("/users/:id/reactivate", async (req, res) => {
    res.json(userView(await registry.setActive(requireActor(await resolve(req)), param(req, "id"), true)));
  });

  router.get("/github/tokens", async (req, res) => {
    await resolve(req);
    const result = await tokens.labels();
    res.json(githubTokensResponseSchema.parse({ state: result.kind, tokens: result.kind === "ok" ? result.labels : [] }));
  });
  router.get("/projects", async (req, res) => {
    await resolve(req);
    res.json(projectListResponseSchema.parse({ projects: await projects.list() }));
  });
  router.post("/projects", async (req, res) => {
    res.status(201).json(await projects.register(requireActor(await resolve(req)), req.body));
  });
  router.get("/projects/:id", async (req, res) => {
    await resolve(req);
    res.json(await projects.get(param(req, "id")));
  });
  router.post("/projects/:id/refresh", async (req, res) => {
    await resolve(req);
    res.json(await poller.refresh(param(req, "id")));
  });
  router.patch("/projects/:id", async (req, res) => {
    res.json(await projects.update(requireActor(await resolve(req)), param(req, "id"), req.body));
  });
  router.delete("/projects/:id", async (req, res) => {
    await projects.remove(requireActor(await resolve(req)), param(req, "id"));
    res.status(204).end();
  });
  router.put("/projects/:id/lead-developer", async (req, res) => {
    res.json(await projects.setLeadDeveloper(requireActor(await resolve(req)), param(req, "id"), req.body));
  });
  router.get("/identities", async (req, res) => {
    await resolve(req);
    res.json(await identities.list());
  });
  router.post("/users/:id/identities", async (req, res) => {
    res.status(201).json(await identities.add(requireActor(await resolve(req)), param(req, "id"), req.body));
  });
  router.delete("/identities/:id", async (req, res) => {
    await identities.remove(requireActor(await resolve(req)), param(req, "id"));
    res.status(204).end();
  });

  router.get("/projects/:id/flags", async (req, res) => {
    await resolve(req);
    res.json(await flags.list(param(req, "id"), req.query.status));
  });
  router.get("/flags/:id", async (req, res) => {
    await resolve(req);
    res.json(await flags.get(param(req, "id")));
  });
  router.post("/flags/:id/dismiss", async (req, res) => {
    res.json(await flags.dismiss(requireActor(await resolve(req)), param(req, "id"), req.body));
  });
  router.post("/flags/:id/reopen", async (req, res) => {
    res.json(await flags.reopen(requireActor(await resolve(req)), param(req, "id"), req.body));
  });
  router.get("/projects/:id/view", async (req, res) => {
    await resolve(req);
    res.json(await views.view(param(req, "id")));
  });
  router.get("/projects/:id/tasks", async (req, res) => {
    await resolve(req);
    res.json(await views.tasks(param(req, "id")));
  });
  router.get("/projects/:id/tasks/:taskId", async (req, res) => {
    await resolve(req);
    res.json(await views.task(param(req, "id"), param(req, "taskId")));
  });
  router.get("/projects/:id/documents", async (req, res) => {
    await resolve(req);
    res.json(await views.documents(param(req, "id")));
  });
  router.get("/projects/:id/file", async (req, res) => {
    await resolve(req);
    res.json(await views.file(param(req, "id"), req.query.path));
  });
  return router;
}
