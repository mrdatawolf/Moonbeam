import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { baseRoutes, mockApi, otherUser, renderAt, selectUser, user, USER_ID } from "../test/fixtures";
import { UserPicker } from "../components/Layout";

describe("user selection", () => {
  it("persists the selection in this browser and asks again when the user is no longer active", async () => {
    mockApi({ ...baseRoutes, "GET /users": { users: [user] } });
    selectUser(otherUser.id);
    renderAt(<UserPicker />);
    expect(await screen.findByRole("alert")).toHaveTextContent("no longer active");
    await userEvent.selectOptions(screen.getByLabelText("Acting as"), "Patrick");
    expect(localStorage.getItem("moonbeam.selectedUserId")).toBe(USER_ID);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
