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
