import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import { world, expectRejected, type World } from "./harness.js";

let w: World;
beforeEach(async () => { w = await world(); });
afterEach(async () => { await w?.h.close(); });
const add = (kind: string, value: string, userId = w.bob.id) => w.h.req("POST", `/users/${userId}/identities`, { as: w.A, body: { kind, value } });

describe("member identities", () => {
  it("lists all members and automatic registry e-mails without a selected user", async () => {
    const r = await w.h.req("GET", "/identities");
    expect(r.status).toBe(200);
    expect(r.body.conflicts).toEqual([]);
    expect(r.body.members).toHaveLength(2);
    expect(r.body.members[0]).toEqual({ userId: w.alice.id, displayName: "Alice", active: true, identities: [{ id: null, userId: w.alice.id, kind: "email", value: "alice@example.test", automatic: true }] });
    expectRejected(await w.h.req("DELETE", "/identities/null", { as: w.A }), "not_found");
    expectRejected(await w.h.req("DELETE", `/identities/${w.alice.id}`, { as: w.A }), "not_found");
    expect((await w.h.req("GET", "/identities")).body).toEqual(r.body);
  });
  it.each([["email", " Extra@Example.test "], ["login", "Extra-Login"], ["alias", " Old Name "]])("adds and removes %s with normalized storage and selected-user before/after audit", async (kind, value) => {
    const r = await add(kind!, value!);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ userId: w.bob.id, kind, value: value!.trim(), automatic: false });
    const [stored] = await w.h.db.select().from(schema.userIdentities);
    expect(stored).toMatchObject({ normalized: value!.trim().toLowerCase(), createdByUserId: w.alice.id });
    expect((await w.h.req("DELETE", `/identities/${r.body.id}`, { as: w.B })).status).toBe(204);
    const audit = (await w.h.db.select().from(schema.auditRecords)).filter((a) => a.action.startsWith("identity_"));
    expect(audit).toHaveLength(2);
    expect(audit.find((a) => a.action === "identity_added")).toMatchObject({ actorUserId: w.alice.id, subjectUserId: w.bob.id, details: { before: null, after: r.body } });
    expect(audit.find((a) => a.action === "identity_removed")).toMatchObject({ actorUserId: w.bob.id, subjectUserId: w.bob.id, details: { before: r.body, after: null } });
    expect(await w.h.db.select().from(schema.userIdentities)).toHaveLength(0);
  });
  it("returns every conflict, including automatic e-mails, display names, and inactive members", async () => {
    await add("email", "ALICE@example.test");
    await add("alias", "alice");
    await add("login", "shared", w.alice.id);
    await add("login", "SHARED");
    await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A });
    const r = await w.h.req("GET", "/identities");
    expect(r.body.conflicts).toHaveLength(3);
    for (const [kind, value] of [["email", "alice@example.test"], ["name", "alice"], ["login", "shared"]]) {
      expect(r.body.conflicts).toContainEqual({ kind, value, members: [
        { userId: w.alice.id, displayName: "Alice", inactive: false },
        { userId: w.bob.id, displayName: "Bob", inactive: true },
      ] });
    }
    expect((await add("alias", "Inactive still matches")).status).toBe(201);
  });
  it("uses current registry e-mail and display name on each read, and conflict removal takes effect", async () => {
    const r = await add("email", "alice@example.test");
    expect((await w.h.req("GET", "/identities")).body.conflicts).toHaveLength(1);
    await w.h.req("PATCH", `/users/${w.alice.id}`, { as: w.A, body: { email: "changed@example.test", displayName: "Changed" } });
    let list = (await w.h.req("GET", "/identities")).body;
    expect(list.conflicts).toHaveLength(0);
    expect(list.members.find((m: any) => m.userId === w.alice.id)).toMatchObject({ displayName: "Changed", identities: [{ value: "changed@example.test", automatic: true }] });
    await w.h.req("DELETE", `/identities/${r.body.id}`, { as: w.A });
    list = (await w.h.req("GET", "/identities")).body;
    expect(list.members.find((m: any) => m.userId === w.bob.id).identities).toHaveLength(1);
  });
  it("serializes duplicate additions and allows shared identities across members", async () => {
    const result = await Promise.all([add("login", "same"), add("login", "SAME")]);
    expect(result.map((r) => r.status).sort()).toEqual([201, 422]);
    expect((await add("login", "same", w.alice.id)).status).toBe(201);
    expect((await w.h.req("GET", "/identities")).body.conflicts).toHaveLength(1);
    expect((await w.h.db.select().from(schema.auditRecords)).filter((a) => a.action === "identity_added")).toHaveLength(2);
  });
  it.each([["email", "bad"], ["login", "bad_login"], ["login", "a".repeat(40)], ["alias", " "], ["alias", "a".repeat(201)], ["other", "value"]])("refuses invalid %s identity", async (kind, value) => {
    expectRejected(await add(kind!, value!), "validation", 422);
    expect(await w.h.db.select().from(schema.userIdentities)).toHaveLength(0);
    expect((await w.h.db.select().from(schema.auditRecords)).filter((a) => a.action.startsWith("identity_"))).toHaveLength(0);
  });
  it("requires a selected active actor and refuses unknown targets", async () => {
    expectRejected(await w.h.req("POST", `/users/${w.bob.id}/identities`, { body: {} }), "unidentified", 401);
    expectRejected(await w.h.req("DELETE", "/identities/bad"), "unidentified", 401);
    expectRejected(await add("alias", "valid", "bad"), "not_found", 404);
    expectRejected(await add("alias", "valid", "00000000-0000-4000-8000-000000000001"), "not_found", 404);
    await w.h.req("POST", `/users/${w.bob.id}/deactivate`, { as: w.A });
    expectRejected(await w.h.req("POST", `/users/${w.alice.id}/identities`, { as: w.B, body: { kind: "alias", value: "x" } }), "unidentified", 401);
  });
});
