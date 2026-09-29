import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { baseRoutes, mockApi, renderAt, user } from "../test/fixtures";

describe("first-run setup", () => {
  it("collects only users and opens the dashboard after setup", async () => {
    let ready = false;
    const calls = mockApi({
      ...baseRoutes,
      "GET /setup": () => ({ json: { needsSetup: !ready } }),
      "POST /setup": () => { ready = true; return { status: 201, json: { users: [user] } }; },
    });
    const { container } = renderAt(<App />, { path: "*" });
    await screen.findByRole("heading", { name: "Set up Moonbeam" });
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
    await userEvent.type(screen.getByLabelText(/Name 1/), "Patrick");
    await userEvent.type(screen.getByLabelText(/E-mail 1/), "p@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ users: [{ displayName: "Patrick", email: "p@example.com" }] });
  });
});

import { waitFor, within } from "@testing-library/react";
import { ProjectsPage } from "./Projects";
import { UserPicker } from "../components/Layout";
import { project, PROJECT_ID, selectUser, USER_ID, otherUser, NOW } from "../test/fixtures";
import { connection } from "../api/connection";

const projectRoutes = { ...baseRoutes, "GET /projects": { projects: [project] }, [`GET /projects/${PROJECT_ID}/view`]: { source: null } };
const renderProjects = () => renderAt(<><UserPicker /><ProjectsPage /></>);
const registerForm = () => screen.getByRole("region", { name: "Register a project" });
async function fillRepository() {
  await userEvent.type(within(registerForm()).getByLabelText(/GitHub owner/), "https://github.com/example/moonbeam.git");
  await userEvent.tab();
}

describe("project registrations", () => {
  it("lists registrations and gates all writes for viewers, with accessible defaults and masked labels", async () => {
    const calls = mockApi(projectRoutes);
    const { container } = renderProjects();
    await screen.findByRole("heading", { name: "Moonbeam" });
    expect(screen.getByText(/example\/moonbeam/)).toBeInTheDocument();
    expect(within(registerForm()).getByLabelText(/Tracked branch/)).toHaveValue("main");
    expect(screen.getByText(/default: head at registration/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /example — ••••1234/ })).toBeInTheDocument();
    for (const name of ["Register project", "Edit registration Moonbeam", "Remove registration Moonbeam", "Save lead developer"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(button);
    }
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });

  it("registers every field from a pasted URL with the selected actor", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...projectRoutes, "POST /projects": () => ({ status: 201, json: project }) });
    renderProjects();
    await screen.findByRole("heading", { name: "Moonbeam" });
    await fillRepository();
    const form = within(registerForm());
    expect(form.getByLabelText("Repository (required)")).toHaveValue("moonbeam");
    await userEvent.type(form.getByLabelText("Project name"), "Custom");
    await userEvent.clear(form.getByLabelText(/Tracked branch/));
    await userEvent.type(form.getByLabelText(/Tracked branch/), "develop");
    await userEvent.selectOptions(form.getByLabelText("Token label"), "example");
    await userEvent.selectOptions(form.getByLabelText("Lead developer"), otherUser.id);
    await userEvent.type(form.getByLabelText("Baseline commit SHA"), "b".repeat(40));
    await userEvent.type(form.getByLabelText("Exempt paths"), "docs/**\nREADME.md");
    await userEvent.clear(form.getByLabelText("Staleness threshold (days)"));
    await userEvent.type(form.getByLabelText("Staleness threshold (days)"), "21");
    await userEvent.click(form.getByRole("button", { name: "Register project" }));
    await screen.findByText("Project registered.");
    const post = calls.find((c) => c.method === "POST");
    expect(post?.headers["x-moonbeam-user"]).toBe(USER_ID);
    expect(post?.body).toEqual({ owner: "example", repo: "moonbeam", name: "Custom", trackedBranch: "develop", tokenLabel: "example", leadDeveloperUserId: otherUser.id, baselineSha: "b".repeat(40), exemptPaths: ["docs/**", "README.md"], staleThresholdDays: 21 });
  });

  it.each(["validation", "github_unavailable", "unidentified"])("keeps entered values after a %s refusal", async (category) => {
    selectUser(USER_ID);
    mockApi({ ...projectRoutes, "POST /projects": () => ({ status: 422, json: { error: { category, message: "Could not register" } } }) });
    renderProjects();
    await screen.findByRole("heading", { name: "Moonbeam" });
    await fillRepository();
    await userEvent.click(screen.getByRole("button", { name: "Register project" }));
    expect(await within(registerForm()).findByRole("alert")).toHaveTextContent(`(${category})`);
    expect(within(registerForm()).getByLabelText(/GitHub owner/)).toHaveValue("example");
    expect(within(registerForm()).getByLabelText("Repository (required)")).toHaveValue("moonbeam");
    if (category === "unidentified") expect(screen.getByRole("button", { name: "Register project" })).toHaveAttribute("aria-disabled", "true");
  });

  it("edits only changed fields and lets branch changes choose a new baseline", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...projectRoutes, [`PATCH /projects/${PROJECT_ID}`]: () => ({ json: { ...project, trackedBranch: "develop" } }) });
    renderProjects();
    await userEvent.click(await screen.findByRole("button", { name: "Edit registration Moonbeam" }));
    const region = within(screen.getByRole("region", { name: "Moonbeam" }));
    await userEvent.clear(region.getByLabelText(/Tracked branch/));
    await userEvent.type(region.getByLabelText(/Tracked branch/), "develop");
    await userEvent.click(region.getByRole("button", { name: "Save registration" }));
    await screen.findByText("Registration saved.");
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ trackedBranch: "develop" });
  });

  it("assigns, changes and clears a lead developer", async () => {
    selectUser(USER_ID);
    let current = project;
    const calls = mockApi({ ...projectRoutes, "GET /projects": () => ({ json: { projects: [current] } }), [`PUT /projects/${PROJECT_ID}/lead-developer`]: (body: unknown) => {
      current = { ...current, leadDeveloperUserId: (body as { userId: string | null }).userId }; return { json: current };
    } });
    renderProjects();
    const select = await screen.findByLabelText("Lead developer for Moonbeam");
    for (const id of [USER_ID, otherUser.id, ""]) {
      await userEvent.selectOptions(select, id);
      await userEvent.click(screen.getByRole("button", { name: "Save lead developer" }));
      await waitFor(() => expect(calls.filter((c) => c.method === "PUT").at(-1)?.body).toEqual({ userId: id || null }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Save lead developer" })).toHaveAttribute("aria-disabled", "true"));
    }
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(3);
  });

  it("confirms removal, keeps data, handles 204 and refreshes the list", async () => {
    selectUser(USER_ID);
    let removed = false;
    const calls = mockApi({ ...projectRoutes, "GET /projects": () => ({ json: { projects: removed ? [] : [project] } }), [`DELETE /projects/${PROJECT_ID}`]: () => { removed = true; return { status: 204, json: undefined }; } });
    renderProjects();
    await userEvent.click(await screen.findByRole("button", { name: "Remove registration Moonbeam" }));
    let dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Moonbeam's data is kept");
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep registration" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Remove registration Moonbeam" }));
    dialog = await screen.findByRole("dialog");
    expect((await axe.run(dialog, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm removal" }));
    await screen.findByText("No projects registered.");
    expect(calls.find((c) => c.method === "DELETE")?.headers["x-moonbeam-user"]).toBe(USER_ID);
  });

  it("shows redirect guidance and disables actions during connection loss", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...projectRoutes, [`GET /projects/${PROJECT_ID}/view`]: { source: { projectId: PROJECT_ID, status: "ok", message: "Current", statusSince: NOW, lastAttemptAt: NOW, lastSuccessAt: NOW, lastProcessedHead: project.baselineSha, rateLimitedUntil: null, redirectedFullName: "new-owner/moonbeam", tokenWriteScopes: false, consecutiveFailures: 0, baselineNeedsReset: false } } });
    renderProjects();
    expect(await screen.findByText(/Now at new-owner\/moonbeam; update the registration/)).toBeInTheDocument();
    connection.set("lost");
    await waitFor(() => expect(screen.getByRole("button", { name: "Register project" })).toHaveAttribute("aria-disabled", "true"));
    await userEvent.click(screen.getByRole("button", { name: "Edit registration Moonbeam" }));
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });
});

describe("registration edge cases", () => {
  it("sends defaults without inventing a baseline or token value", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...baseRoutes, "POST /projects": () => ({ status: 201, json: project }) });
    renderProjects();
    await screen.findByText("No projects registered.");
    await fillRepository();
    await userEvent.click(screen.getByRole("button", { name: "Register project" }));
    await screen.findByText("Project registered.");
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({ owner: "example", repo: "moonbeam", trackedBranch: "main", exemptPaths: [], staleThresholdDays: 14, leadDeveloperUserId: null });
  });

  it("keeps all edited registration fields after a refusal and retries them", async () => {
    selectUser(USER_ID);
    let refused = true;
    const calls = mockApi({ ...projectRoutes, [`PATCH /projects/${PROJECT_ID}`]: () => refused ? { status: 409, json: { error: { category: "conflict", message: "Registration changed" } } } : { json: project } });
    renderProjects();
    await userEvent.click(await screen.findByRole("button", { name: "Edit registration Moonbeam" }));
    const form = within(screen.getByRole("region", { name: "Moonbeam" }));
    for (const [label, value] of [["GitHub owner or repository URL (required)", "new-owner"], ["Repository (required)", "new-repo"], ["Project name", "Renamed"], ["Baseline commit SHA", "c".repeat(40)], ["Exempt paths", "docs/**"], ["Staleness threshold (days)", "7"]]) {
      await userEvent.clear(form.getByLabelText(label!));
      await userEvent.type(form.getByLabelText(label!), value!);
    }
    await userEvent.click(form.getByRole("button", { name: "Save registration" }));
    expect(await form.findByRole("alert")).toHaveTextContent("(conflict)");
    expect(form.getByLabelText("Project name")).toHaveValue("Renamed");
    refused = false;
    await userEvent.click(form.getByRole("button", { name: "Save registration" }));
    await screen.findByText("Registration saved.");
    expect(calls.filter((c) => c.method === "PATCH").map((c) => c.body)).toEqual(Array(2).fill({ owner: "new-owner", repo: "new-repo", name: "Renamed", baselineSha: "c".repeat(40), exemptPaths: ["docs/**"], staleThresholdDays: 7 }));
  });

  it("keeps lead selection and removal confirmation after server refusals", async () => {
    selectUser(USER_ID);
    mockApi({ ...projectRoutes,
      [`PUT /projects/${PROJECT_ID}/lead-developer`]: () => ({ status: 422, json: { error: { category: "validation", message: "Member is inactive" } } }),
      [`DELETE /projects/${PROJECT_ID}`]: () => ({ status: 409, json: { error: { category: "conflict", message: "Try again" } } }),
    });
    renderProjects();
    const lead = await screen.findByLabelText("Lead developer for Moonbeam");
    await userEvent.selectOptions(lead, otherUser.id);
    await userEvent.click(screen.getByRole("button", { name: "Save lead developer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("(validation)");
    expect(lead).toHaveValue(otherUser.id);
    await userEvent.click(screen.getByRole("button", { name: "Remove registration Moonbeam" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirm removal" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("(conflict)");
    expect(screen.getByRole("heading", { name: "Moonbeam" })).toBeInTheDocument();
  });

  it("explains unavailable token configuration and rejects invalid local fields without requests", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...baseRoutes, "GET /github/tokens": { state: "missing", tokens: [] } });
    renderProjects();
    await screen.findByText(/Token configuration is missing/);
    await fillRepository();
    await userEvent.type(screen.getByLabelText("Baseline commit SHA"), "not-a-sha");
    await userEvent.click(screen.getByRole("button", { name: "Register project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("(validation)");
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });
});
