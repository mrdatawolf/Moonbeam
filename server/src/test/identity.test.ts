// CONTRACT-002 kept behavior: setup, users, attribution, and request identity.
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import { createHarness, expectOk, expectRejected, world, type Harness, type World } from "./harness.js";

let w: World | undefined;
let h: Harness | undefined;
afterEach(async () => {
  await w?.h.close();
  await h?.close();
  w = undefined;
  h = undefined;
});
const GHOST = "00000000-0000-4000-8000-000000000000";

describe("User registry", () => {
  it("first-run setup is offered only while the registry is empty and is recorded as setup", async () => {
    h = await createHarness();
    expect((await h.req("GET", "/setup")).body).toEqual({ needsSetup: true });
    expectRejected(await h.req("POST", "/setup", { body: { users: [] } }), "validation", 422);
    expectRejected(
      await h.req("POST", "/setup", { body: { users: [{ displayName: "A", email: "a@example.com" }, { displayName: " a ", email: "b@example.com" }] } }),
      "validation",
      422,
    );
    expectRejected(await h.req("POST", "/setup", { body: { users: [{ displayName: "A", email: "nope" }] } }), "validation", 422);
    const res = await h.req("POST", "/setup", { body: { users: [{ displayName: " Patrick ", email: "p@example.com" }] } });
    expectOk(res, 201);
    expect(res.body.users[0].displayName).toBe("Patrick");
    expect((await h.req("GET", "/setup")).body.needsSetup).toBe(false);
    expectRejected(await h.req("POST", "/setup", { body: { users: [{ displayName: "B", email: "b@example.com" }] } }), "invalid_transition", 409);
  });

  it("add, edit, deactivate and reactivate; names unique among active users; never deleted", async () => {
    w = await world();
    const add = await w.h.req("POST", "/users", { as: w.A, body: { displayName: "Carol", email: "carol@example.com" } });
    expectOk(add, 201);
    const carol = add.body.id;
    expectRejected(await w.h.req("POST", "/users", { as: w.A, body: { displayName: "  CAROL ", email: "c2@example.com" } }), "validation", 422);
    expectRejected(await w.h.req("POST", "/users", { as: w.A, body: { displayName: "Dan" } }), "validation", 422);
    expectRejected(await w.h.req("PATCH", `/users/${carol}`, { as: w.A, body: { displayName: "bob" } }), "validation", 422);
    expectRejected(await w.h.req("PATCH", `/users/${GHOST}`, { as: w.A, body: { displayName: "Z" } }), "not_found", 404);
    expectOk(await w.h.req("POST", `/users/${carol}/deactivate`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/users/${carol}/deactivate`, { as: w.A }), "invalid_transition", 409);
    expect((await w.h.req("GET", "/users")).body.users).toHaveLength(2);
    expect((await w.h.req("GET", "/users?includeInactive=true")).body.users).toHaveLength(3);
    // An inactive user's name is free again; reactivating then clashes.
    expectOk(await w.h.req("POST", "/users", { as: w.A, body: { displayName: "carol", email: "c3@example.com" } }), 201);
    expectRejected(await w.h.req("POST", `/users/${carol}/reactivate`, { as: w.A }), "validation", 422);
    expect((await w.h.req("DELETE", `/users/${carol}`, { as: w.A })).status).toBe(404);
  });

  it("the last active user cannot be deactivated", async () => {
    w = await world();
    expectOk(await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/users/${w.alice.id}/deactivate`, { as: w.A }), "validation", 422);
  });

});

describe("request identity", () => {
  it("resolves only the selected human and ignores Authorization", async () => {
    w = await world();
    expect((await w.h.req("GET", "/whoami")).body).toEqual({ actor: null });
    for (const token of ["anything", "invalid"]) {
      expect((await w.h.req("GET", "/whoami", { as: { token } })).body).toEqual({ actor: null });
      expectOk(await w.h.req("GET", "/users", { as: { token } }));
      expectOk(await w.h.req("GET", "/setup", { as: { token } }));
      expectRejected(await w.h.req("POST", "/users", { as: { token }, body: {} }), "unidentified", 401);
      expect((await w.h.req("GET", "/whoami", { as: { token, user: w.alice.id } })).body.actor).toEqual({
        kind: "human", userId: w.alice.id, displayName: "Alice", email: "alice@example.test", identityMode: "selected",
      });
    }
    const res = await fetch(`${w.h.base}/api/whoami`, { headers: { "x-moonbeam-actor-kind": "system" } });
    expect(await res.json()).toEqual({ actor: null });
  });

  it("requires a selected user for every user mutation", async () => {
    w = await world();
    for (const [method, path] of [["POST", "/users"], ["PATCH", `/users/${w.bob.id}`], ["POST", `/users/${w.bob.id}/deactivate`], ["POST", `/users/${w.bob.id}/reactivate`]]) {
      expectRejected(await w.h.req(method!, path!, { body: {} }), "unidentified", 401);
    }
  });

  it("rejects unknown and inactive selections without writing audit records", async () => {
    w = await world();
    expectOk(await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A }));
    const before = await w.h.db.select().from(schema.auditRecords);
    for (const user of [GHOST, "not-a-uuid", w.bob.id]) {
      expectRejected(await w.h.req("GET", "/whoami", { as: { user } }), "unidentified", 401);
      expectRejected(await w.h.req("GET", "/users", { as: { user } }), "unidentified", 401);
      expectRejected(await w.h.req("POST", "/users", { as: { user }, body: {} }), "unidentified", 401);
    }
    expect(await w.h.db.select().from(schema.auditRecords)).toEqual(before);
  });

  it("checks identity before malformed JSON and validates human input", async () => {
    w = await world();
    for (const selected of [false, true]) {
      const response = await fetch(`${w.h.base}/api/users`, {
        method: "POST", headers: { "content-type": "application/json", ...(selected ? { "x-moonbeam-user": w.alice.id } : {}) }, body: "{",
      });
      expect(response.status).toBe(selected ? 422 : 401);
    }
  });
});

describe("registry audit", () => {
  it("records setup and every successful change with actor, time, and before/after values", async () => {
    w = await world();
    const setup = await w.h.db.select().from(schema.auditRecords).orderBy(schema.auditRecords.id);
    expect(setup).toHaveLength(2);
    expect(setup.map((r) => [r.action, r.actorKind, r.systemTrigger])).toEqual([
      ["user_added", "setup", "first_run_setup"], ["user_added", "setup", "first_run_setup"],
    ]);
    const added = await w.h.req("POST", "/users", { as: w.A, body: { displayName: "Carol", email: "c@example.test" } });
    expectOk(added, 201);
    const id = added.body.id;
    expectOk(await w.h.req("PATCH", `/users/${id}`, { as: w.A, body: { displayName: "Caroline", email: "new@example.test" } }));
    expectOk(await w.h.req("POST", `/users/${id}/deactivate`, { as: w.A }));
    expectOk(await w.h.req("POST", `/users/${id}/reactivate`, { as: w.A }));
    expectRejected(await w.h.req("POST", `/users/${id}/reactivate`, { as: w.A }), "invalid_transition", 409);
    const records = (await w.h.db.select().from(schema.auditRecords).orderBy(schema.auditRecords.id)).slice(2);
    expect(records.map((r) => r.action)).toEqual(["user_added", "user_edited", "user_deactivated", "user_reactivated"]);
    for (const record of records) {
      expect(record).toMatchObject({ actorKind: "human", actorUserId: w.alice.id, identityMode: "selected", subjectUserId: id, rejected: false });
      expect(record.occurredAt).toBeInstanceOf(Date);
      expect(record.recordedAt).toEqual(record.occurredAt);
    }
    expect(records.map((r) => r.details)).toEqual([
      { after: { displayName: "Carol", email: "c@example.test" } },
      { before: { displayName: "Carol", email: "c@example.test" }, after: { displayName: "Caroline", email: "new@example.test" } },
      { before: { active: true }, after: { active: false } },
      { before: { active: false }, after: { active: true } },
    ]);
  });
});


describe("remaining API surface", () => {
  it("returns 404 for removed and unknown routes with registry services installed", async () => {
    w = await world();
    for (const path of ["/projects", "/tasks", "/audit/recent", "/settings", "/unknown", "/users/unknown/extra"]) {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        expect((await w.h.req(method, path, { as: w.A })).status).toBe(404);
      }
    }
    expectOk(await w.h.req("GET", "/health"));
  });
});
