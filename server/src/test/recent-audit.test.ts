import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema } from "@moonbeam/db";
import { recentAuditResponseSchema } from "@moonbeam/shared";
import { writeAudit } from "../audit.js";
import { createTask, expectOk, expectRejected, gitInit, startRun, world, type World } from "./harness.js";

let w: World | undefined;
afterEach(async () => { await w?.h.close(); w = undefined; });

it("returns an empty feed without registry events and refuses invalid limits", async () => {
  w = await world();
  const before = await w.h.db.select().from(schema.auditRecords);
  const empty = await w.h.req("GET", "/audit/recent");
  expectOk(empty);
  expect(empty.body).toEqual({ events: [] });
  for (const query of ["0", "-1", "51", "1.5", "abc", "", "Infinity", "1&limit=2", "1e1"]) {
    expectRejected(await w.h.req("GET", `/audit/recent?limit=${query}`), "validation");
  }
  expect(await w.h.db.select().from(schema.auditRecords)).toEqual(before);
});

it("bounds results and orders by effective time then descending id, not insertion time", async () => {
  w = await world();
  const t = await createTask(w);
  const now = new Date("2099-01-01T12:00:00Z");
  const ids: number[] = [];
  for (let i = 0; i < 55; i++) {
    ids.push(await writeAudit(w.h.db, { kind: "system", trigger: "test" },
      { projectId: w.projectId, taskId: t.id, action: "test", occurredAt: now }, now));
  }
  // Recorded last, but effective earlier (as with a late-recorded expiry).
  const late = await writeAudit(w.h.db, { kind: "system", trigger: "claim_expired" },
    { projectId: w.projectId, taskId: t.id, action: "claim_expired", occurredAt: new Date("2099-01-01T11:00:00Z") },
    new Date("2099-01-01T13:00:00Z"));
  for (const [query, count] of [["", 10], ["?limit=1", 1], ["?limit=50", 50]] as const) {
    const res = await w.h.req("GET", `/audit/recent${query}`);
    expectOk(res);
    const { events } = recentAuditResponseSchema.parse(res.body);
    expect(events.map((e) => e.id)).toEqual([...ids].reverse().slice(0, count));
    expect(events.some((e) => e.id === late)).toBe(false);
    expect(events[0]).toMatchObject({ task: { number: t.number, title: t.title }, project: { id: w.projectId, name: "demo" } });
  }
});

it("scopes agents before limiting, resolves current user names without e-mail, and leaves human/viewer scope global", async () => {
  w = await world();
  const t = await createTask(w);
  const sibling = await createTask(w, { title: "Another task in the same project" });
  const run = await startRun(w, t.id);
  expectRejected(await w.h.req("POST", `/tasks/${t.id}/approve`, { as: run.as }), "authority_violation");
  await w.h.db.update(schema.users).set({ displayName: "Renamed Alice", active: false }).where(eq(schema.users.id, w.alice.id));
  const other = await w.h.req("POST", "/projects", {
    as: w.B, body: { path: gitInit(join(w.h.dirs.root, "other")) },
  });
  expectOk(other, 201);
  const otherTask = await createTask({ ...w, projectId: other.body.id, A: w.B });
  for (const as of [undefined, w.B]) {
    const res = await w.h.req("GET", "/audit/recent", { as });
    expectOk(res);
    expect(new Set(res.body.events.map((e: { projectId: string }) => e.projectId))).toEqual(new Set([w.projectId, other.body.id]));
  }
  const res = await w.h.req("GET", "/audit/recent?limit=50", { as: { token: run.token, user: w.bob.id } });
  expectOk(res);
  const { events } = recentAuditResponseSchema.parse(res.body);
  expect(events.some((e) => e.taskId === sibling.id)).toBe(true);
  expect(events.every((e) => e.projectId === w!.projectId && e.taskId !== otherTask.id)).toBe(true);
  expect(events.find((e) => e.action === "created")?.actor).toMatchObject({ displayName: "Renamed Alice", userActive: false });
  expect(events.find((e) => e.rejected)?.actor).toMatchObject({ kind: "agent", runId: run.runId, model: "claude-opus" });
  expect(JSON.stringify(res.body)).not.toMatch(/email|alice@example.test|bob@example.test|credential/i);
  const bounded = await w.h.req("GET", "/audit/recent?limit=1", { as: run.as });
  expectOk(bounded);
  expect(bounded.body.events).toHaveLength(1);
  expect(bounded.body.events[0].projectId).toBe(w.projectId);
  expectRejected(await w.h.req("GET", "/audit/recent", { as: { token: "invalid", user: w.bob.id } }), "unidentified");
});
