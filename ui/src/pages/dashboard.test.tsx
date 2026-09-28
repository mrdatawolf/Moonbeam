import { act, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, expect, it, vi } from "vitest";
import type { AuditRecordView } from "@moonbeam/shared";
import { baseRoutes, detail, emptyQueue, humanClaim, humanRef, mockApi, NOW, project, renderAt, summary, TASK_ID, user } from "../test/fixtures";
import { Dashboard } from "./Dashboard";

const second = { ...project, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Second project" };
const event = (id: number, overrides: Partial<AuditRecordView> = {}): AuditRecordView => ({
  id, projectId: project.id, taskId: TASK_ID, parentTaskId: null, subjectUserId: null,
  action: "claimed", fromState: "approved", toState: "in_progress", rejected: false,
  actor: humanRef(user), reason: null, details: null, occurredAt: NOW, recordedAt: NOW, ...overrides,
});
const routes = () => ({ ...baseRoutes, "GET /decision-queue": emptyQueue,
  [`GET /projects/${project.id}/tasks`]: { tasks: [summary({ state: "in_progress", claim: humanClaim(user) })] },
  [`GET /tasks/${TASK_ID}`]: detail({ audit: [event(1)] }),
});
afterEach(() => vi.useRealTimers());

it("shows all four widgets, six state counts per project, and all seven queue groups to a viewer", async () => {
  mockApi({ ...routes(), "GET /projects": { projects: [project, second] },
    [`GET /projects/${second.id}/tasks`]: { tasks: [] },
    "GET /decision-queue": { ...emptyQueue, proposed: [summary()], blocked: [summary({ blocked: true })] },
  });
  const { container } = renderAt(<Dashboard />);
  await screen.findByText("Claimed");
  const counts = within(screen.getByRole("article", { name: project.name }));
  expect(counts.getAllByRole("definition").map((el) => el.textContent)).toEqual(["0", "0", "1", "0", "0", "0"]);
  expect(within(screen.getByRole("article", { name: second.name })).getAllByRole("definition").map((el) => el.textContent)).toEqual(["0", "0", "0", "0", "0", "0"]);
  const decisions = within(screen.getByRole("region", { name: "Decision queue" }));
  expect(decisions.getAllByRole("definition").map((el) => el.textContent)).toEqual(["1", "0", "0", "0", "1", "0", "0"]);
  expect(decisions.getByRole("link", { name: "Open decision queue" })).toHaveAttribute("href", "/decisions");
  expect(within(screen.getByRole("region", { name: "Active claims" })).getByText("Patrick")).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
  expect(screen.queryByText(/costs|run activity|nothing to show/i)).toBeNull();
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
});

it("shows empty states without manufacturing active work", async () => {
  mockApi({ ...routes(), "GET /projects": { projects: [] } });
  renderAt(<Dashboard />);
  expect(await screen.findByText("No projects registered.")).toBeInTheDocument();
  expect(screen.getByText("No active claims.")).toBeInTheDocument();
  expect(screen.getByText("No task events yet.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Register a project" })).toHaveAttribute("href", "/projects");
});

it("sorts and bounds audit events, deduplicates IDs, and shows rejected attempts and reasons", async () => {
  const audit = Array.from({ length: 12 }, (_, i) => event(i + 1, { reason: `Event ${i + 1}` }));
  audit.push(event(13, { rejected: true, action: "approve", reason: "Human-only action" }));
  mockApi({ ...routes(), [`GET /tasks/${TASK_ID}`]: detail({ audit: [...audit, audit[0]!] }) });
  renderAt(<Dashboard />);
  await screen.findByText("Rejected attempt: approve");
  const history = within(screen.getByRole("region", { name: "Recent audit events" }));
  expect(history.getAllByRole("listitem")).toHaveLength(10);
  expect(history.getAllByRole("listitem")[0]).toHaveTextContent("Human-only action");
  expect(history.queryByText("Event 3")).toBeNull();
  expect(history.getAllByRole("link")[0]).toHaveAttribute("href", `/tasks/${TASK_ID}`);
});

it("reports failed project and queue reads without presenting missing data as zero", async () => {
  const failure = () => ({ status: 503, json: { error: { category: "repository_unavailable", message: "Unavailable" } } });
  mockApi({ ...routes(), "GET /projects": failure, "GET /decision-queue": failure });
  renderAt(<Dashboard />);
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(4));
  expect(screen.queryByText("No active claims.")).toBeNull();
  expect(screen.queryByText("No task events yet.")).toBeNull();
});

it("keeps available claims visible when a task history read fails", async () => {
  mockApi({ ...routes(), [`GET /tasks/${TASK_ID}`]: () => ({ status: 503, json: { error: { category: "repository_unavailable", message: "Unavailable" } } }) });
  renderAt(<Dashboard />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Task history could not be refreshed");
  expect(within(screen.getByRole("region", { name: "Active claims" })).getByText("Patrick")).toBeInTheDocument();
  expect(screen.queryByText("No task events yet.")).toBeNull();
});

it("polls projects, states, claims, queue and audit without reload", async () => {
  vi.useFakeTimers();
  const api = routes();
  const calls = mockApi(api);
  renderAt(<Dashboard />);
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(screen.getByText("Claimed")).toBeInTheDocument();
  api[`GET /projects/${project.id}/tasks`] = { tasks: [summary({ state: "in_review", claim: null })] };
  api[`GET /tasks/${TASK_ID}`] = detail({ state: "in_review", audit: [event(2, { action: "handed_off" })] });
  api["GET /decision-queue"] = { ...emptyQueue, inReview: [summary({ state: "in_review" })] };
  await act(async () => { await vi.advanceTimersByTimeAsync(10_100); });
  vi.useRealTimers();
  expect(await screen.findByText("Handed off")).toBeInTheDocument();
  expect(screen.getByText("No active claims.")).toBeInTheDocument();
  expect(within(screen.getByRole("article", { name: project.name })).getAllByRole("definition").map((el) => el.textContent)).toEqual(["0", "0", "0", "1", "0", "0"]);
  expect(within(screen.getByRole("region", { name: "Decision queue" })).getAllByRole("definition")[1]).toHaveTextContent("1");
  expect(calls.filter((c) => c.path === "/projects").length).toBeGreaterThan(1);
});

it("shows agent leases and conditions, and does not mistake split parents for claims", async () => {
  const claimed = summary({ state: "in_progress", paused: true, blocked: true,
    claim: { ...humanClaim(user), claimantKind: "agent", userId: null, displayName: null, runId: second.id, model: "test-model", leaseDeadline: "2026-09-25T10:30:00.000Z", leaseSuspended: true } });
  mockApi({ ...routes(), [`GET /projects/${project.id}/tasks`]: { tasks: [claimed, summary({ id: second.id, title: "Split parent", state: "in_progress", isSplitParent: true })] },
    [`GET /tasks/${second.id}`]: detail({ id: second.id }),
  });
  renderAt(<Dashboard />);
  const claims = within(screen.getByRole("region", { name: "Active claims" }));
  expect(await claims.findByText("agent run (test-model)")).toBeInTheDocument();
  expect(claims.getByText(/lease suspended/)).toBeInTheDocument();
  expect(claims.getByText("Paused")).toBeInTheDocument();
  expect(claims.getByText("Blocked")).toBeInTheDocument();
  expect(claims.queryByText("Split parent")).toBeNull();
});

it("keeps successful project counts when a different project's tasks cannot load", async () => {
  mockApi({ ...routes(), "GET /projects": { projects: [project, second] },
    [`GET /projects/${second.id}/tasks`]: () => ({ status: 503, json: { error: { category: "repository_unavailable", message: "Unavailable" } } }),
  });
  renderAt(<Dashboard />);
  await screen.findByText("Claimed");
  const failed = within(screen.getByRole("article", { name: second.name }));
  expect(failed.getByRole("alert")).toHaveTextContent("Tasks for Second project");
  expect(failed.queryAllByRole("definition")).toHaveLength(0);
  expect(within(screen.getByRole("article", { name: project.name })).getAllByRole("definition")).toHaveLength(6);
});
