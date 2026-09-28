import { expect, it } from "vitest";
import { recentAuditResponseSchema } from "./index.js";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const event = {
  id: 1, projectId: id, taskId: id, parentTaskId: null, subjectUserId: null,
  action: "created", fromState: null, toState: "proposed", rejected: false,
  actor: { kind: "system", userId: null, displayName: null, userActive: null,
    identityMode: null, runId: null, role: null, model: null, systemTrigger: "test" },
  reason: null, details: null, occurredAt: "2026-09-28T10:00:00.000Z", recordedAt: "2026-09-28T10:00:00.000Z",
  task: { number: 1, title: "Task" }, project: { id, name: "Project" },
};

it("accepts empty and bounded task-event feeds with audit fields and display context", () => {
  expect(recentAuditResponseSchema.parse({ events: [] }).events).toEqual([]);
  expect(recentAuditResponseSchema.parse({ events: [event] }).events[0]).toEqual(event);
  expect(recentAuditResponseSchema.safeParse({ events: Array(50).fill(event) }).success).toBe(true);
  expect(recentAuditResponseSchema.safeParse({ events: Array(51).fill(event) }).success).toBe(false);
});

it("requires task/project context and validates the reused audit shape", () => {
  for (const override of [{ task: undefined }, { project: undefined }, { taskId: null },
    { projectId: null }, { occurredAt: "yesterday" }, { actor: {} }, { task: { number: 0, title: "Task" } }]) {
    expect(recentAuditResponseSchema.safeParse({ events: [{ ...event, ...override }] }).success).toBe(false);
  }
  const parsed = recentAuditResponseSchema.parse({ events: [{ ...event, actor: { ...event.actor, email: "private@example.test" } }] });
  expect(parsed.events[0]!.actor).not.toHaveProperty("email");
});
