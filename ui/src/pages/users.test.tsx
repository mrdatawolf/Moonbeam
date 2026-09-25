// User management (CONTRACT-002 "User registry", "UX expectations",
// validation item 6): add, edit, deactivate, reactivate; inactive users listed
// separately with e-mail addresses; every change needs a selected user.
import type { User } from "@moonbeam/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { UserPicker } from "../components/Layout";
import { SELECTION_KEY } from "../lib/selection";
import { baseRoutes, mockApi, NOW, otherUser, renderAt, selectUser, user, USER_ID } from "../test/fixtures";
import { UsersPage } from "./Users";

const INACTIVE_ID = "88888888-8888-4888-8888-888888888888";
const formerUser: User = { id: INACTIVE_ID, displayName: "Alex", email: "alex@example.com", active: false, createdAt: NOW, updatedAt: NOW };

// "GET /users" answers both the picker (active only) and the management list
// (with inactive): the picker and the current-user check filter on `active`.
const renderUsers = () =>
  renderAt(
    <>
      <UserPicker />
      <UsersPage />
    </>,
    { path: "/users", route: "/users" },
  );

const list = (name: RegExp) => screen.findByRole("region", { name });

describe("user management", () => {
  it("lists active and inactive users separately, by name, with e-mail addresses", async () => {
    mockApi({ ...baseRoutes, "GET /users": { users: [user, formerUser, otherUser] } });
    const { container } = renderUsers();
    const active = await list(/^Active users/);
    const names = within(active)
      .getAllByRole("listitem")
      .map((li) => li.querySelector("p")?.textContent);
    expect(names).toEqual(["Dana", "Patrick"]);
    expect(within(active).getByText("d@example.com")).toBeInTheDocument();
    const inactive = await list(/^Inactive users/);
    expect(within(inactive).getByText("Alex")).toBeInTheDocument();
    expect(within(inactive).getByText("alex@example.com")).toBeInTheDocument();
    expect(within(inactive).getByText("Inactive")).toBeInTheDocument();
    // Inactive users are hidden from the select.
    expect(within(screen.getByLabelText("Acting as")).queryByRole("option", { name: "Alex" })).toBeNull();

    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  });

  it("offers an Add a user link next to the user select", async () => {
    mockApi(baseRoutes);
    renderAt(<UserPicker />);
    expect(await screen.findByRole("link", { name: "Add a user" })).toHaveAttribute("href", "/users#add-user");
  });

  it("needs a selected user to add someone, and says how a newcomer does it", async () => {
    const calls = mockApi({ ...baseRoutes, "GET /users": { users: [user, otherUser, formerUser] } });
    renderUsers();
    const add = await screen.findByRole("button", { name: "Add user" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription(/New here\? Choose any existing user in "Acting as", add yourself below, then switch to yourself/);
    await userEvent.type(screen.getByLabelText(/Display name/), "Sam");
    await userEvent.type(screen.getByLabelText(/E-mail address/), "sam@example.com");
    await userEvent.click(add);
    for (const name of ["Edit Dana", "Deactivate Dana", "Reactivate Alex"]) {
      const action = screen.getByRole("button", { name });
      expect(action).toHaveAttribute("aria-disabled", "true");
      await userEvent.click(action);
    }
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
    expect(screen.getByRole("button", { name: "Edit Dana" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Edit Dana" })).toHaveAccessibleDescription(/Choose who you are to take this action/);
  });

  it("adds a user as the selected user and offers, but does not make, the switch to them", async () => {
    selectUser(USER_ID);
    const sam: User = { id: "99999999-9999-4999-8999-999999999999", displayName: "Sam", email: "sam@example.com", active: true, createdAt: NOW, updatedAt: NOW };
    let users = [user, otherUser];
    const calls = mockApi({
      ...baseRoutes,
      "GET /users": () => ({ json: { users } }),
      "POST /users": () => {
        users = [...users, sam];
        return { status: 201, json: sam };
      },
    });
    renderUsers();
    const add = await screen.findByRole("button", { name: "Add user as Patrick" });
    await userEvent.type(screen.getByLabelText(/Display name/), "  Sam ");
    await userEvent.type(screen.getByLabelText(/E-mail address/), "sam@example.com");
    await userEvent.click(add);
    const status = await screen.findByText(/Added Sam\./);
    expect(status.closest("[role=status]")).toHaveFocus();
    const post = calls.find((c) => c.method === "POST");
    expect(post?.body).toEqual({ displayName: "Sam", email: "sam@example.com" });
    expect(post?.headers["x-moonbeam-user"]).toBe(USER_ID);
    expect(localStorage.getItem(SELECTION_KEY)).toBe(USER_ID);
    await userEvent.click(screen.getByRole("button", { name: "Switch to Sam" }));
    expect(localStorage.getItem(SELECTION_KEY)).toBe(sam.id);
    await waitFor(() => expect(screen.getByLabelText("Acting as")).toHaveValue(sam.id));
  });

  it("checks for a unique active name and a valid e-mail address before sending", async () => {
    selectUser(USER_ID);
    const calls = mockApi(baseRoutes);
    renderUsers();
    const add = await screen.findByRole("button", { name: "Add user as Patrick" });
    await userEvent.type(screen.getByLabelText(/Display name/), " dana ");
    await userEvent.type(screen.getByLabelText(/E-mail address/), "not-an-address");
    await userEvent.click(add);
    const name = screen.getByLabelText(/Display name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription(/An active user is already named "Dana"/);
    expect(name).toHaveFocus();
    expect(screen.getByLabelText(/E-mail address/)).toHaveAccessibleDescription(/Enter a valid e-mail address/);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows the server's validation refusal and keeps what was typed", async () => {
    selectUser(USER_ID);
    mockApi({
      ...baseRoutes,
      "POST /users": () => ({ status: 422, json: { error: { category: "validation", message: 'An active user is already named "Sam".' } } }),
    });
    renderUsers();
    const add = await screen.findByRole("button", { name: "Add user as Patrick" });
    await userEvent.type(screen.getByLabelText(/Display name/), "Sam");
    await userEvent.type(screen.getByLabelText(/E-mail address/), "sam@example.com");
    await userEvent.click(add);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Missing or invalid input");
    expect(alert).toHaveTextContent("(validation)");
    expect(alert).toHaveTextContent('An active user is already named "Sam".');
    expect(screen.getByLabelText(/Display name/)).toHaveValue("Sam");
  });

  it("won't deactivate the last active user", async () => {
    selectUser(USER_ID);
    mockApi({ ...baseRoutes, "GET /users": { users: [user, formerUser] } });
    renderUsers();
    const deactivate = await screen.findByRole("button", { name: "Deactivate Patrick" });
    await waitFor(() => expect(deactivate).toHaveAttribute("aria-disabled", "true"));
    expect(deactivate).toHaveAccessibleDescription(/The last active user can't be deactivated/);
  });

  it("deactivating yourself asks you to choose again and never switches user", async () => {
    selectUser(USER_ID);
    let users = [user, otherUser];
    const calls = mockApi({
      ...baseRoutes,
      "GET /users": () => ({ json: { users } }),
      [`POST /users/${USER_ID}/deactivate`]: () => {
        users = [{ ...user, active: false }, otherUser];
        return { json: users[0] };
      },
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: "Deactivate Patrick" }));
    const dialog = await screen.findByRole("dialog", { name: "Deactivate Patrick?" });
    expect(within(dialog).getByText(/This is you/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Deactivate as Patrick" }));
    expect(await screen.findByText(/That was you, so choose who you are/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.path).toBe(`/users/${USER_ID}/deactivate`);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("no longer active"));
    expect(screen.getByLabelText("Acting as")).toHaveValue("");
    expect(localStorage.getItem(SELECTION_KEY)).toBeNull();
    expect(within(await list(/^Inactive users/)).getByText("Patrick")).toBeInTheDocument();
  });

  it("asks for a rename before reactivating someone whose name is taken, and edits send only what changed", async () => {
    selectUser(USER_ID);
    const clashing = { ...formerUser, displayName: "dana" };
    const calls = mockApi({
      ...baseRoutes,
      "GET /users": { users: [user, otherUser, clashing] },
      [`PATCH /users/${INACTIVE_ID}`]: (body: unknown) => ({ json: { ...clashing, ...(body as object) } }),
    });
    renderUsers();
    const reactivate = await screen.findByRole("button", { name: "Reactivate dana" });
    await waitFor(() => expect(reactivate).toHaveAttribute("aria-disabled", "true"));
    expect(reactivate).toHaveAccessibleDescription(/An active user is already named "Dana"\. Rename dana with Edit, then reactivate/);

    await userEvent.click(screen.getByRole("button", { name: "Edit dana" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit dana" });
    const save = within(dialog).getByRole("button", { name: "Save as Patrick" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    const name = within(dialog).getByLabelText(/Display name/);
    await userEvent.clear(name);
    await userEvent.type(name, "Dana Former");
    await userEvent.click(save);
    expect(await screen.findByText(/Saved Dana Former\./)).toBeInTheDocument();
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ displayName: "Dana Former" });
  });

  it("reactivates an inactive user as the selected user and refreshes the picker", async () => {
    selectUser(USER_ID);
    let users = [user, formerUser];
    const calls = mockApi({
      ...baseRoutes,
      "GET /users": () => ({ json: { users } }),
      [`POST /users/${INACTIVE_ID}/reactivate`]: () => {
        users = [user, { ...formerUser, active: true }];
        return { json: users[1] };
      },
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: "Reactivate Alex" }));
    const dialog = await screen.findByRole("dialog", { name: "Reactivate Alex?" });
    expect(within(dialog).getByText("alex@example.com")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Reactivate as Patrick" }));
    expect(await screen.findByText(/Reactivated Alex/)).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByLabelText("Acting as")).getByRole("option", { name: "Alex" })).toBeInTheDocument());
    expect(within(await list(/^Inactive users/)).queryByText("alex@example.com")).toBeNull();
    expect(calls.find((c) => c.method === "POST")?.headers["x-moonbeam-user"]).toBe(USER_ID);
    expect(localStorage.getItem(SELECTION_KEY)).toBe(USER_ID);
  });

  it("shows a last-active-user refusal when another browser changes the registry", async () => {
    selectUser(USER_ID);
    mockApi({
      ...baseRoutes,
      [`POST /users/${USER_ID}/deactivate`]: () => ({ status: 422, json: { error: { category: "validation", message: "Cannot deactivate the last active user." } } }),
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: "Deactivate Patrick" }));
    const dialog = await screen.findByRole("dialog", { name: "Deactivate Patrick?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Deactivate as Patrick" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Cannot deactivate the last active user.");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("(validation)");
    expect(localStorage.getItem(SELECTION_KEY)).toBe(USER_ID);
  });

  it("validates active-user edits and saves an updated e-mail without changing identity", async () => {
    selectUser(USER_ID);
    const calls = mockApi({
      ...baseRoutes,
      [`PATCH /users/${USER_ID}`]: (body: unknown) => ({ json: { ...user, ...(body as object) } }),
    });
    renderUsers();
    await userEvent.click(await screen.findByRole("button", { name: "Edit Patrick" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Patrick" });
    const name = within(dialog).getByLabelText(/Display name/);
    const email = within(dialog).getByLabelText(/E-mail address/);
    await userEvent.clear(name);
    await userEvent.type(name, "Dana");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save as Patrick" }));
    expect(name).toHaveAccessibleDescription(/An active user is already named/);
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
    await userEvent.clear(name);
    await userEvent.type(name, "Patrick");
    await userEvent.clear(email);
    await userEvent.type(email, "new@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save as Patrick" }));
    expect(await screen.findByText(/Saved Patrick/)).toBeInTheDocument();
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.body).toEqual({ email: "new@example.com" });
    expect(patch?.headers["x-moonbeam-user"]).toBe(USER_ID);
  });


  it("clears a stored inactive selection and accepts an explicit choice from another tab", async () => {
    selectUser(INACTIVE_ID);
    mockApi({ ...baseRoutes, "GET /users": { users: [user, formerUser] } });
    renderUsers();
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer active");
    await waitFor(() => expect(localStorage.getItem(SELECTION_KEY)).toBeNull());
    expect(screen.getByLabelText("Acting as")).toHaveValue("");
    localStorage.setItem(SELECTION_KEY, USER_ID);
    window.dispatchEvent(new StorageEvent("storage", { key: SELECTION_KEY, newValue: USER_ID }));
    await waitFor(() => expect(screen.getByLabelText("Acting as")).toHaveValue(USER_ID));
    expect(screen.queryByRole("alert")).toBeNull();
  });

});
