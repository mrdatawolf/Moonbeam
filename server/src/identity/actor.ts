// CONTRACT-002 "Resolve actor". The rest of the server obtains the actor only
// through `resolveActor` (the replacement seam for a future login).
import { and, eq } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import { AUTHORIZATION_HEADER, USER_HEADER, type ActorView } from "@moonbeam/shared";
import { ActionError } from "../errors.js";
import { hashCredential, isWellFormedCredential } from "./credentials.js";

export interface HumanActor {
  kind: "human";
  userId: string;
  displayName: string;
  email: string;
  identityMode: "selected";
}

export interface AgentActor {
  kind: "agent";
  runId: string;
  /** The task the run is bound to. */
  taskId: string;
  projectId: string;
  role: string;
  model: string;
  /** The credential the request presented; re-checked when the action is applied (F2). Never shown. */
  credentialId: string;
}

/** Only ever constructed inside the server (CONTRACT-002 "System actor"). */
export interface SystemActor {
  kind: "system";
  trigger: string;
}

/** First-run setup, recorded as its own actor because no user can be selected yet. */
export interface SetupActor {
  kind: "setup";
}

export type Actor = HumanActor | AgentActor;
export type AnyActor = Actor | SystemActor | SetupActor;

export const systemActor = (trigger: string): SystemActor => ({ kind: "system", trigger });

type Headers = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function header(headers: Headers, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Resolve the actor of a request.
 *
 * - An `Authorization` header means an agent request, whatever else the
 *   request names (R1, R2). If the credential does not resolve to an active
 *   run, the request is `unidentified` and is never re-evaluated as a human
 *   request (R3).
 * - Otherwise `X-Moonbeam-User` names the selected human user; an unknown or
 *   inactive user is `unidentified`.
 * - With neither header the result is `null`: a viewer without a selection
 *   (Board B2). Actions reject that as `unidentified` via `requireActor`.
 */
export async function resolveActor(db: Database, headers: Headers, now: Date): Promise<Actor | null> {
  const auth = header(headers, AUTHORIZATION_HEADER);
  if (auth !== undefined) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(auth);
    const token = match?.[1];
    if (!token || !isWellFormedCredential(token)) {
      throw new ActionError("unidentified", "The agent credential is malformed.");
    }
    const [row] = await db
      .select({ run: schema.agentRuns, credential: schema.runCredentials })
      .from(schema.runCredentials)
      .innerJoin(schema.agentRuns, eq(schema.agentRuns.id, schema.runCredentials.runId))
      .where(eq(schema.runCredentials.tokenHash, hashCredential(token)));
    if (!row) throw new ActionError("unidentified", "The agent credential is not recognised.");
    if (row.run.status !== "active" || row.credential.revokedAt) {
      throw new ActionError("unidentified", "The agent credential belongs to a run that has ended.");
    }
    if (row.credential.expiresAt && row.credential.expiresAt.getTime() <= now.getTime()) {
      throw new ActionError("unidentified", "The agent credential has expired.");
    }
    return {
      kind: "agent",
      runId: row.run.id,
      taskId: row.run.taskId,
      projectId: row.run.projectId,
      role: row.run.role,
      model: row.run.model,
      credentialId: row.credential.id,
    };
  }

  const userId = header(headers, USER_HEADER)?.trim();
  if (userId === undefined || userId === "") return null;
  if (!UUID.test(userId)) throw new ActionError("unidentified", "The selected user does not exist.");
  const [user] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, userId)));
  if (!user) throw new ActionError("unidentified", "The selected user does not exist.");
  if (!user.active) {
    throw new ActionError("unidentified", "The selected user is inactive. Choose who you are again.");
  }
  return {
    kind: "human",
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    identityMode: "selected",
  };
}

/** Every action requires a resolved actor (CONTRACT-002 step 1). */
export function requireActor(actor: Actor | null): Actor {
  if (!actor) {
    throw new ActionError("unidentified", "Choose who you are to take this action.");
  }
  return actor;
}

export function actorView(actor: Actor): ActorView {
  return actor.kind === "human"
    ? {
        kind: "human",
        userId: actor.userId,
        displayName: actor.displayName,
        email: actor.email,
        identityMode: actor.identityMode,
      }
    : {
        kind: "agent",
        runId: actor.runId,
        taskId: actor.taskId,
        projectId: actor.projectId,
        role: actor.role,
        model: actor.model,
      };
}
