import type { DashboardResponse } from "@moonbeam/shared";
import userEvent from "@testing-library/user-event";
import { screen, within, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { baseRoutes, mockApi, renderAt, projectView, readFlag, flagDetail, PROJECT_ID, HEAD, source, projectReadRoutes } from "../test/fixtures";

describe("application shell", () => {
  it.each([["/", "Dashboard"], ["/projects", "Projects"], ["/missing", "This page doesn't exist."]])("renders %s", async (route, title) => {
    mockApi({ ...baseRoutes, "GET /dashboard": emptyDashboard });
    const { container } = renderAt(<App />, { path: "*", route });
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Projects", "Users"]);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});

const emptyDashboard: DashboardResponse = { projects: [], recentAcceptances: [], recentFlags: [] };
const dashboard: DashboardResponse = {
  projects: [{ ...projectView, proposedCount: 2, approvedCount: 3, staleApprovalCount: 1, completedLast30Days: 4 }],
  recentAcceptances: [{ projectId: PROJECT_ID, projectName: "Moonbeam", task: projectView.recentlyCompleted[0]! }],
  recentFlags: [{ projectId: PROJECT_ID, projectName: "Moonbeam", flag: readFlag }],
};
const routes = { ...projectReadRoutes, "GET /dashboard": dashboard };

describe("dashboard", () => {
  it("shows empty states", async () => {
    mockApi({ ...baseRoutes, "GET /dashboard": emptyDashboard });
    renderAt(<App />, { path: "*" });
    expect(await screen.findByText("No projects registered.")).toBeInTheDocument();
    expect(screen.getByText("No acceptances observed.")).toBeInTheDocument();
    expect(screen.getByText("No flags raised.")).toBeInTheDocument();
  });

  it("shows project facts, acceptance links, inline flag evidence and an accessible page", async () => {
    const calls = mockApi(routes);
    const { container } = renderAt(<App />, { path: "*" });
    const row = await screen.findByRole("article", { name: "Moonbeam" });
    expect(within(row).getByRole("link", { name: "Moonbeam" })).toHaveAttribute("href", `/projects/${PROJECT_ID}`);
    expect(within(row).getByText(HEAD)).toBeInTheDocument();
    expect(within(row).getByText(/Last successful poll/)).toBeInTheDocument();
    for (const [label, count] of [["Proposed", "2"], ["Approved", "3"], ["Stale approvals (open FL-5)", "1"], ["Open flags", "1"], ["Completions in the last 30 days", "4"]]) {
      expect(within(row).getByText(label!).nextElementSibling?.textContent).toBe(count);
    }
    expect(screen.getByRole("link", { name: "TASK-003: Observe work" })).toHaveAttribute("href", `/projects/${PROJECT_ID}/tasks/TASK-003`);
    expect(screen.getByText(/Approval still on main/)).toBeInTheDocument();
    await screen.findByText(/raised: new/);
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    expect(calls.every((c) => c.method === "GET")).toBe(true);
    expect(screen.queryByRole("button", { name: /approve|merge|accept task/i })).not.toBeInTheDocument();
  });

  it("keeps failing and never-polled projects visible beside current projects", async () => {
    const failed = { ...dashboard.projects[0]!, projectId: "77777777-7777-4777-8777-777777777777", name: "Failing", notCurrent: true, source: { ...source, status: "rate_limited" as const, message: "Rate limited", rateLimitedUntil: "2026-09-26T10:00:00.000Z" } };
    const never = { ...dashboard.projects[0]!, projectId: "88888888-8888-4888-8888-888888888888", name: "Never", notCurrent: true, source: null, headSha: null, lastSuccessfulPollAt: null, readState: "not yet read" as const };
    mockApi({ ...routes, "GET /dashboard": { ...emptyDashboard, projects: [...dashboard.projects, failed, never] } });
    renderAt(<App />, { path: "*" });
    expect(await screen.findByRole("article", { name: "Moonbeam" })).toBeInTheDocument();
    const failure = within(screen.getByRole("article", { name: "Failing" }));
    expect(failure.getByText(/Data is not current/)).toBeInTheDocument();
    expect(failure.getByText(/Rate limited until/)).toBeInTheDocument();
    expect(failure.getByText(HEAD)).toBeInTheDocument();
    const unread = within(screen.getByRole("article", { name: "Never" }));
    expect(unread.getByText("Not yet read")).toBeInTheDocument();
    expect(unread.getAllByText("Not yet available")).toHaveLength(3);
    expect(unread.getByText(/No lead developer/)).toBeInTheDocument();
  });

  it("refreshes the dashboard after a viewer refresh", async () => {
    let refreshed = false;
    const calls = mockApi({ ...routes,
      "GET /dashboard": () => ({ json: refreshed ? { ...dashboard, projects: [{ ...dashboard.projects[0], proposedCount: 9 }] } : dashboard }),
      [`POST /projects/${PROJECT_ID}/refresh`]: () => { refreshed = true; return { json: source }; },
    });
    renderAt(<App />, { path: "*" });
    await userEvent.click(await screen.findByRole("button", { name: "Refresh project" }));
    await waitFor(() => expect(screen.getByText("Proposed").nextElementSibling?.textContent).toBe("9"));
    expect(calls.find((c) => c.method === "POST")?.headers["X-Moonbeam-User"]).toBeUndefined();
  });

  it("keeps recent flag order even when the newest flag is dismissed", async () => {
    const dismissed = { ...readFlag, id: "99999999-9999-4999-8999-999999999999", ruleName: "Newest", status: "dismissed" as const };
    mockApi({ ...routes, [`GET /flags/${dismissed.id}`]: { ...flagDetail, ...dismissed }, "GET /dashboard": { ...dashboard, recentFlags: [{ projectId: PROJECT_ID, projectName: "Moonbeam", flag: dismissed }, ...dashboard.recentFlags] } });
    renderAt(<App />, { path: "*" });
    const region = await screen.findByRole("region", { name: "Recently raised flags" });
    expect(within(region).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["FL-5: Newest · dismissed", "FL-5: Stale approval · open"]);
  });

  it("shows loading and API failure states", async () => {
    let release!: (response: Response) => void;
    mockApi(baseRoutes);
    const original = globalThis.fetch;
    globalThis.fetch = (input, init) => String(input) === "/api/dashboard" ? new Promise((resolve) => { release = resolve; }) : original(input, init);
    renderAt(<App />, { path: "*" });
    expect(await screen.findByText("Loading dashboard…")).toBeInTheDocument();
    release(new Response(JSON.stringify({ error: { category: "github_unavailable", message: "Dashboard read failed" } }), { status: 503 }));
    expect(await screen.findByText("Dashboard read failed")).toBeInTheDocument();
  });
});
