// All request identity is resolved through the CONTRACT-002 actor seam.
import { Router, type Request } from "express";
import { setupStatusSchema, userListResponseSchema, userSchema, whoAmIResponseSchema } from "@moonbeam/shared";
import type { Database } from "@moonbeam/db";
import { actorView, requireActor, resolveActor } from "./identity/actor.js";
import type { RegistryService } from "./registry.js";

export interface Services {
  db: Database;
  clock: () => Date;
  registry: RegistryService;
}

const param = (req: Request, name: string): string => String(req.params[name] ?? "");
const userView = (u: { id: string; displayName: string; email: string; active: boolean; createdAt: Date; updatedAt: Date }) =>
  userSchema.parse({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() });

export function apiRoutes({ db, registry }: Services): Router {
  const router = Router();
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

  return router;
}
