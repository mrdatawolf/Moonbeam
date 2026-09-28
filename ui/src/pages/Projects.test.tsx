import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ProjectsPage } from "./Projects";
import { baseRoutes, mockApi, project, renderAt, selectUser, USER_ID } from "../test/fixtures";

const repositories = ["one", "two", "three"].map((name) => ({ path: `/srv/projects/${name}`, relativePath: name, suggestedName: name, suggestedMainBranch: "main" }));
function setup(fail = false) {
  const registered = new Set<string>();
  const calls = mockApi({ ...baseRoutes,
    "GET /settings/projects-root": { projectsRoot: "/srv/projects" },
    "GET /projects/discover": () => ({ json: { repositories: repositories.filter((r) => !registered.has(r.path)), truncated: true } }),
    "POST /projects": (body: unknown) => {
      const input = body as { path: string; name: string; mainBranch: string };
      if (fail && input.path.endsWith("two")) return { status: 422, json: { error: { category: "validation", message: "Repository is no longer available." } } };
      registered.add(input.path);
      return { json: { ...project, name: input.name, repoPath: input.path, mainBranch: input.mainBranch } };
    },
  });
  renderAt(<ProjectsPage />);
  return calls;
}
it("selects individual rows, edits values, registers only selections with identity, and refreshes", async () => {
  selectUser(USER_ID); const calls = setup();
  await userEvent.click(await screen.findByRole("checkbox", { name: "one" }));
  await userEvent.click(screen.getByRole("checkbox", { name: "three" }));
  await userEvent.clear(screen.getByLabelText("Name for one")); await userEvent.type(screen.getByLabelText("Name for one"), "First");
  await userEvent.clear(screen.getByLabelText("Main branch for one")); await userEvent.type(screen.getByLabelText("Main branch for one"), "trunk");
  await userEvent.click(screen.getByRole("button", { name: "Register selected as Patrick" }));
  await screen.findByText(/Registered First/); await screen.findByText(/Registered three/);
  const posts = calls.filter((c) => c.method === "POST");
  expect(posts).toHaveLength(2);
  expect(posts[0]?.body).toEqual({ path: "/srv/projects/one", name: "First", mainBranch: "trunk" });
  expect(posts.every((c) => c.headers["x-moonbeam-user"] === USER_ID)).toBe(true);
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: "one" })).toBeNull());
  expect(screen.getByRole("checkbox", { name: "two" })).not.toBeChecked();
  expect(calls.filter((c) => c.path === "/projects/discover").length).toBeGreaterThan(1);
});
it("selects all and preserves per-repository partial failure while other registrations succeed", async () => {
  selectUser(USER_ID); const calls = setup(true);
  await userEvent.click(await screen.findByRole("checkbox", { name: "Select all" }));
  expect(screen.getByRole("checkbox", { name: "two" })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Register selected as Patrick" }));
  await screen.findByText(/Registered one/); await screen.findByText(/Registered three/);
  expect(await screen.findByRole("alert")).toHaveTextContent("Repository is no longer available.");
  expect(calls.filter((c) => c.method === "POST")).toHaveLength(3);
  await waitFor(() => expect(screen.getByRole("button", { name: "Search again" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Search again" }));
  expect(screen.getByRole("checkbox", { name: "two" })).toBeChecked();
});
it("lets viewers search but requires a user to register, shows truncation and keeps manual entry behind Add by path", async () => {
  selectUser(null); const calls = setup();
  await userEvent.click(await screen.findByRole("checkbox", { name: "Select all" }));
  expect(screen.getByRole("button", { name: "Register selected" })).toBeDisabled();
  expect(screen.getByText(/Search incomplete/)).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: /Repository folder/ })).not.toBeVisible();
  await userEvent.click(screen.getByText("Add by path"));
  expect(screen.getByRole("textbox", { name: /Repository folder/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Search again" }));
  expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
});
