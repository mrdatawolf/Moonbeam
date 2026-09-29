// CONTRACT-002 "Resolve actor". The rest of the server obtains the actor only
// through `resolveActor` (the replacement seam for a future login).
import { eq } from "drizzle-orm";
import { schema, type Database } from "@moonbeam/db";
import { USER_HEADER, type ActorView } from "@moonbeam/shared";
import { ActionError } from "../errors.js";

export interface HumanActor {
  kind: "human";
  userId: string;
  displayName: string;
  email: string;
  identityMode: "selected";
}

/** First-run setup, recorded as its own actor because no user can be selected yet. */
export interface SetupActor {
  kind: "setup";
}

export type Actor = HumanActor;
export type AnyActor = Actor | SetupActor;


type Headers = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function header(headers: Headers, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Resolve the selected human; Authorization is ignored. No selection means a viewer. */
export async function resolveActor(db: Database, headers: Headers): Promise<Actor | null> {
  const userId = header(headers, USER_HEADER)?.trim();
  if (userId === undefined || userId === "") return null;
  if (!UUID.test(userId)) throw new ActionError("unidentified", "The selected user does not exist.");
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId));
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
  return { ...actor };
}
