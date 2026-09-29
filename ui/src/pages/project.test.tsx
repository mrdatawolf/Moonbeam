import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { Markdown } from "../components/Markdown";
import { projectReadRoutes, projectView, PROJECT_ID, renderAt, mockApi, maliciousMarkdown, taskDetail, documentView, fileView, source, readFlag, flagDetail, selectUser, USER_ID, HEAD, NOW } from "../test/fixtures";
const root = `/projects/${PROJECT_ID}`;
const renderPage = (suffix = "") => renderAt(<App />, { path: "*", route: root + suffix });
async function accessible(container: HTMLElement) {
  expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
}
describe("project reads", () => {
  it("links from registration to all overview sections and the full completed list", async () => {
    mockApi(projectReadRoutes);
    const { container } = renderAt(<App />, { path: "*", route: "/projects" });
    await userEvent.click(await screen.findByRole("link", { name: "Moonbeam" }));
    await screen.findByRole("heading", { name: "Proposed tasks" });
    for (const name of ["Source status", "Approved tasks", "Recently completed", "Other states on main", "Activity over the last 12 weeks", "Flags"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    expect(screen.getByText(/0 DbC task v1 files/)).toBeInTheDocument();
    expect(screen.getAllByText(/not a board member/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not DbC task v1/).length).toBeGreaterThan(1);
    expect(screen.getByRole("table").querySelectorAll("tbody tr")).toHaveLength(12);
    expect(screen.getByText(/Approval still on main/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Commit ${HEAD} on GitHub` })).toHaveAttribute("target", "_blank");
    await accessible(container);
    await userEvent.click(screen.getByRole("link", { name: "All completed tasks" }));
    await screen.findByRole("heading", { name: "Completed on main" });
    expect(screen.getByRole("link", { name: "TASK-003: Observe work" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Source status" })).toHaveTextContent(HEAD);
  });
  it("shows full parsed fields, problems, historical entries, links, authors and safe rendered task content", async () => {
    mockApi(projectReadRoutes); const { container } = renderPage("/tasks/TASK-001");
    await screen.findByRole("heading", { name: "Repository content" });
    expect(screen.getAllByText("Preserved unknown value")).toHaveLength(2);
    expect(screen.getAllByText(/missing.*Approved by/)).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "leaves proposed" })).toBeInTheDocument();
    expect(screen.getAllByText(/Committer: Committer/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("TASK-099 (not found on main)").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "CONTRACT-001" })[0]).toHaveAttribute("href", `${root}/documents/file?path=docs%2Fcontracts%2FCONTRACT-001-example.md`);
    expect(container.querySelector("script,iframe,img,[onerror]")).toBeNull();
    await accessible(container);
    await userEvent.click(screen.getAllByRole("link", { name: "CONTRACT-001" })[0]!);
    await screen.findByRole("heading", { name: "Reading contract" });
  });
  it("lists missing goals and unreadable artifacts with all metadata, and opens documents", async () => {
    mockApi(projectReadRoutes); const { container } = renderPage("/documents");
    await screen.findByText("No project definition found");
    expect(screen.getByText(/Status: status unknown/)).toBeInTheDocument();
    expect(screen.getByText("Supersedes: CONTRACT-000")).toBeInTheDocument();
    expect(screen.getByText("Related tasks: TASK-001")).toBeInTheDocument();
    expect(screen.getByText("Date: 2026-09-01")).toBeInTheDocument();
    await accessible(container);
    await userEvent.click(screen.getByRole("link", { name: "CONTRACT-001: Reading contract" }));
    await screen.findByRole("heading", { name: "Repository content" });
    await accessible(container);
  });
  it("renders goals, reports unreadable files, and does not mix file heads", async () => {
    mockApi({ ...projectReadRoutes, [`GET ${root}/documents`]: { ...documentView, goals: { ...documentView.contracts[0], kind: "project", id: null, title: "Goals" } }, [`GET ${root}/file`]: { ...fileView, headSha: "c".repeat(40) } });
    renderPage("/documents");
    await screen.findByText(/The source head changed/);
    expect(screen.queryByRole("heading", { name: "Repository content" })).not.toBeInTheDocument();
  });
  it("keeps last known data visible on source failure and refreshes as a viewer", async () => {
    let refreshed = false;
    const calls = mockApi({ ...projectReadRoutes, [`GET ${root}/view`]: () => ({ json: refreshed ? { ...projectView, name: "Refreshed project" } : { ...projectView, notCurrent: true, source: { ...source, status: "rate_limited", rateLimitedUntil: NOW, message: "Rate limited" } } }), [`POST ${root}/refresh`]: () => { refreshed = true; return { json: source }; } });
    renderPage(); await screen.findByText(/Data is not current/);
    expect(screen.getByRole("region", { name: "Source status" })).toHaveTextContent(HEAD);
    expect(screen.getByRole("link", { name: "TASK-001: Observe work" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Refresh project" }));
    await screen.findByRole("heading", { name: "Refreshed project" });
    expect(calls.find((c) => c.method === "POST")?.headers["x-moonbeam-user"]).toBeUndefined();
  });
  it("shows never-read state, missing task and file errors", async () => {
    mockApi({ ...projectReadRoutes, [`GET ${root}/view`]: { ...projectView, headSha: null, lastSuccessfulPollAt: null, notCurrent: true, readState: "not yet read", source: null, proposed: [], approved: [], recentlyCompleted: [], other: [], flags: [] } });
    renderPage(); await screen.findByText(/Last successful poll: Never/); expect(screen.getByRole("region", { name: "Source status" })).toHaveTextContent("Head commit: Not yet read");
  });
  it("reports missing tasks", async () => { mockApi(projectReadRoutes); renderPage("/tasks/TASK-404"); expect(await screen.findByText("Task not found.")).toBeInTheDocument(); });
  it("reports unreadable cached file text", async () => { mockApi({ ...projectReadRoutes, [`GET ${root}/file`]: { ...fileView, status: "could not be read", text: null, reason: "Invalid UTF-8" } }); renderPage("/tasks/TASK-001"); expect(await screen.findByText("could not be read: Invalid UTF-8")).toBeInTheDocument(); });
});
describe("repository markdown safety", () => {
  it("omits active HTML, handlers, unsafe protocols and embeds while rendering GFM", () => {
    const { container } = renderAt(<Markdown text={maliciousMarkdown + '\n\n[encoded](jav&#x61;script:alert(1))\n\n[relative](../README.md)'} githubUrl={`https://github.com/example/moonbeam/blob/${HEAD}/docs/PROJECT.md`} />);
    expect(container.querySelector("script,iframe,img,object,embed,form,[onerror],[onclick]")).toBeNull();
    expect(container.querySelector('a[href^="javascript:"],a[href^="data:"]')).toBeNull();
    expect(screen.queryByRole("link", { name: "unsafe" })).toBeNull();
    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "relative" })).toHaveAttribute("href", `https://github.com/example/moonbeam/blob/${HEAD}/README.md`);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect((window as unknown as Record<string, unknown>).repositoryExecuted).toBeUndefined();
  });
});
describe("Moonbeam flag notes", () => {
  it("gates viewer actions and exposes dismissed, resolved and withdrawn evidence", async () => {
    const flags = [readFlag, ...(["dismissed", "resolved", "withdrawn"] as const).map((status,i) => ({ ...readFlag, id: `${i + 7}6666666-6666-4666-8666-666666666666`, status }))];
    const calls = mockApi({ ...projectReadRoutes, [`GET ${root}/view`]: { ...projectView, flags } }); renderPage();
    await screen.findByRole("button", { name: "Dismiss flag" });
    expect(screen.getByRole("button", { name: "Dismiss flag" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Reopen flag" })).toHaveAttribute("aria-disabled", "true");
    for (const s of ["dismissed", "resolved", "withdrawn"]) expect(screen.getByRole("heading", { name: `FL-5: Stale approval · ${s}` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss flag" })); expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
  it("requires notes, preserves refused text, dismisses and reopens with selected actor and history", async () => {
    selectUser(USER_ID); let status = readFlag.status; let refuse = true; const history = [...flagDetail.history];
    const calls = mockApi({ ...projectReadRoutes, [`GET ${root}/view`]: () => ({ json: { ...projectView, flags: [{ ...readFlag, status }] } }), [`GET /flags/${readFlag.id}`]: () => ({ json: { ...flagDetail, status, history } }), [`POST /flags/${readFlag.id}/dismiss`]: (body: unknown) => {
      if (refuse) { refuse = false; return { status: 409, json: { error: { category: "conflict", message: "Try again" } } }; }
      status = "dismissed"; history.push({ ...history[0]!, id: 2, action: "dismissed", fromState: "open", toState: status, actorKind: "human", actorUserId: USER_ID, note: (body as { note: string }).note }); return { json: { ...readFlag, status } };
    }, [`POST /flags/${readFlag.id}/reopen`]: () => { status = "open"; return { json: { ...readFlag, status } }; } });
    const { container } = renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Dismiss flag" }));
    const dialog = screen.getByRole("dialog"); expect(within(dialog).getByRole("button", { name: "Save note in Moonbeam" })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Note/), "Reviewed evidence"); await accessible(container);
    await userEvent.click(within(dialog).getByRole("button", { name: "Save note in Moonbeam" })); await screen.findByText("Try again"); expect(screen.getByLabelText(/Note/)).toHaveValue("Reviewed evidence");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save note in Moonbeam" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(/dismissed: open → dismissed/)).toHaveTextContent("Patrick");
    await userEvent.click(screen.getByRole("button", { name: "Reopen flag" }));
    expect(screen.getByRole("button", { name: "Save note in Moonbeam" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Note/), "Reconsider evidence");
    await userEvent.click(screen.getByRole("button", { name: "Save note in Moonbeam" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const posts = calls.filter((c) => c.method === "POST"); expect(posts).toHaveLength(3); expect(posts[2]?.body).toEqual({ note: "Reconsider evidence" }); expect(posts[2]?.headers["x-moonbeam-user"]).toBe(USER_ID);
  });
});

describe("project refresh and evidence edge cases", () => {
  it("refreshes document metadata and text together without a selected user", async () => {
    let refreshed = false;
    mockApi({ ...projectReadRoutes,
      [`GET ${root}/documents`]: () => ({ json: { ...documentView, headSha: refreshed ? "c".repeat(40) : HEAD } }),
      [`GET ${root}/file`]: () => ({ json: { ...fileView, headSha: refreshed ? "c".repeat(40) : HEAD, text: refreshed ? "# Updated document" : "# Earlier document" } }),
      [`POST ${root}/refresh`]: () => { refreshed = true; return { json: source }; },
    });
    renderPage("/documents/file?path=docs%2Fcontracts%2FCONTRACT-001-example.md");
    await screen.findByRole("heading", { name: "Earlier document" });
    await userEvent.click(screen.getByRole("button", { name: "Refresh project" }));
    await screen.findByRole("heading", { name: "Updated document" });
    expect(screen.queryByRole("heading", { name: "Earlier document" })).toBeNull();
  });
  it("keeps the snapshot after a refresh refusal", async () => {
    mockApi({ ...projectReadRoutes, [`POST ${root}/refresh`]: () => ({ status: 503, json: { error: { category: "conflict", message: "Refresh unavailable" } } }) });
    renderPage(); await screen.findByRole("heading", { name: "Moonbeam" });
    await userEvent.click(screen.getByRole("button", { name: "Refresh project" }));
    await screen.findByText("Refresh unavailable");
    expect(screen.getByRole("link", { name: "TASK-001: Observe work" })).toBeInTheDocument();
  });
  it("links nested evidence commits and labels pre-v1 evidence", async () => {
    const old = "d".repeat(40);
    mockApi({ ...projectReadRoutes, [`GET ${root}/view`]: { ...projectView, flags: [{ ...readFlag, rule: "FL-7", evidence: { reason: "not_v1", previousHead: old, fields: [{ name: "Approved by", value: "Robot" }] } }] } });
    renderPage();
    expect(await screen.findByRole("link", { name: `Commit ${old} on GitHub` })).toHaveAttribute("href", `https://github.com/example/moonbeam/commit/${old}`);
    expect(within(screen.getByRole("region", { name: "Flags" })).getByText("not DbC task v1")).toBeInTheDocument();
  });
  it("revokes note submission when the selected user is cleared", async () => {
    selectUser(USER_ID); const calls = mockApi(projectReadRoutes); renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "Dismiss flag" }));
    await userEvent.type(screen.getByLabelText(/Note/), "Pending note");
    // Selection can change in another browser tab while the dialog is open.
    const { act } = await import("@testing-library/react");
    const { chooseSelectedUserId } = await import("../lib/selection");
    act(() => chooseSelectedUserId(null));
    expect(screen.getByRole("button", { name: "Save note in Moonbeam" })).toBeDisabled();
    expect(screen.getByLabelText(/Note/)).toHaveValue("Pending note");
    expect(calls.every((c) => c.method === "GET")).toBe(true);
  });
});
