import { screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "../App";
import { baseRoutes, mockApi, renderAt } from "../test/fixtures";

describe("application shell", () => {
  it.each([["/", "Dashboard"], ["/projects", "Projects"], ["/missing", "This page doesn't exist."]])("renders %s", async (route, title) => {
    mockApi(baseRoutes);
    const { container } = renderAt(<App />, { path: "*", route });
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Main" })).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Projects", "Users"]);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  });
});
