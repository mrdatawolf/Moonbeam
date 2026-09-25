import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import {
  baseRoutes,
  detail,
  emptyQueue,
  handoff,
  humanClaim,
  mockApi,
  otherUser,
  renderAt,
  selectUser,
  summary,
  TASK_ID,
  user,
  USER_ID,
} from "../test/fixtures";
import { UserPicker } from "../components/Layout";
import { DecisionQueuePage } from "./DecisionQueue";
import { TaskPage } from "./Task";

const renderTask = () => renderAt(<TaskPage />, { path: "/tasks/:taskId", route: `/tasks/${TASK_ID}` });

async function noSeriousA11yViolations(container: HTMLElement) {
  // Colour contrast needs layout and computed colours, which jsdom lacks; it is checked in the browser walkthrough.
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  const serious = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

describe("task page actions", () => {
  it("keeps actions visible but disabled with the reason when no user is selected", async () => {
    mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail() });
    renderTask();
    const approve = await screen.findByRole("button", { name: "Approve" });
    expect(approve).toHaveAttribute("aria-disabled", "true");
    expect(approve).toHaveAccessibleDescription("Choose who you are to take this action");
    expect(screen.getByRole("button", { name: "Claim" })).toHaveAttribute("aria-disabled", "true");
  });

  it("offers only the actions the lifecycle allows, with reasons for the rest", async () => {
    selectUser(USER_ID);
    mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail({ state: "approved", queuePosition: 1 }) });
    renderTask();
    const claim = await screen.findByRole("button", { name: "Claim" });
    await waitFor(() => expect(claim).toHaveAttribute("aria-disabled", "false"));
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAccessibleDescription(/Only a proposed task can be approved/);
    expect(screen.getByRole("button", { name: "Accept" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Return" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Cancel task" })).toHaveAttribute("aria-disabled", "false");
  });

  it("approves as the selected user and shows the result in place", async () => {
    selectUser(USER_ID);
    const approved = detail({ state: "approved", queuePosition: 1 });
    const calls = mockApi({
      ...baseRoutes,
      [`GET /tasks/${TASK_ID}`]: detail(),
      [`POST /tasks/${TASK_ID}/approve`]: { task: approved, audit: [] },
    });
    renderTask();
    const approve = await screen.findByRole("button", { name: "Approve" });
    await waitFor(() => expect(approve).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(approve);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Approve as Patrick" }));
    expect(await screen.findByText(/Approved\. The task joined the end of the project queue/)).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST");
    expect(post?.path).toBe(`/tasks/${TASK_ID}/approve`);
    expect(post?.headers["x-moonbeam-user"]).toBe(USER_ID);
  });

  it("shows a refusal with its failure category and keeps the dialog open", async () => {
    selectUser(USER_ID);
    mockApi({
      ...baseRoutes,
      [`GET /tasks/${TASK_ID}`]: detail({ state: "in_progress", claim: humanClaim(otherUser) }),
      [`POST /tasks/${TASK_ID}/release`]: () => ({ status: 409, json: { error: { category: "conflict", message: "Someone else got there first." } } }),
    });
    renderTask();
    const brk = await screen.findByRole("button", { name: "Break claim" });
    await waitFor(() => expect(brk).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(brk);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Reason/), "Dana is away");
    await userEvent.click(within(dialog).getByRole("button", { name: "Break claim" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("Changed by someone else");
    expect(alert).toHaveTextContent("(conflict)");
    expect(within(dialog).getByLabelText(/Reason/)).toHaveValue("Dana is away");
  });

  it("switches the accept dialog to Accept anyway on a known merge conflict", async () => {
    selectUser(USER_ID);
    const inReview = detail({ state: "in_review", enteredReviewBy: "handoff", handoffs: [handoff] });
    const bodies: unknown[] = [];
    mockApi({
      ...baseRoutes,
      [`GET /tasks/${TASK_ID}`]: inReview,
      [`POST /tasks/${TASK_ID}/accept`]: (body: unknown) => {
        bodies.push(body);
        if (!(body as { acceptAnyway?: boolean }).acceptAnyway) {
          return { status: 409, json: { error: { category: "merge_conflict", message: "Known conflict.", details: { conflictingFiles: ["src/a.ts"] } } } };
        }
        return { json: { task: { ...inReview, state: "completed" }, audit: [] } };
      },
    });
    renderTask();
    const accept = await screen.findByRole("button", { name: "Accept without review" });
    await waitFor(() => expect(accept).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(accept);
    const dialog = await screen.findByRole("dialog", { name: "Accept without an agent review" });
    await userEvent.type(within(dialog).getByLabelText(/Reason for accepting without a review/), "Trivial change");
    await userEvent.click(within(dialog).getByRole("button", { name: "Accept" }));
    expect(await within(dialog).findByText(/Accepting is refused by default/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Accept" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Return task instead" })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Accept anyway" }));
    expect(await screen.findByText(/Accepted anyway/)).toBeInTheDocument();
    expect(bodies[1]).toMatchObject({ acceptAnyway: true, waiveReviewReason: "Trivial change" });
  });

  it("has no serious accessibility violations on a task in review", async () => {
    selectUser(USER_ID);
    mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail({ state: "in_review", enteredReviewBy: "handoff", handoffs: [handoff] }) });
    const { container } = renderTask();
    await screen.findByRole("heading", { level: 1 });
    await noSeriousA11yViolations(container);
  });
});

describe("decision queue", () => {
  it("lists the phase-2 groups with their tasks and empty states", async () => {
    mockApi({
      ...baseRoutes,
      "GET /decision-queue": {
        ...emptyQueue,
        proposed: [summary({ number: 3, title: "Proposed one" })],
        inReview: [summary({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", number: 4, title: "Review me", state: "in_review" })],
        blocked: [summary({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", number: 5, title: "Stuck", state: "approved", blocked: true })],
      },
    });
    const { container } = renderAt(<DecisionQueuePage />);
    const proposed = await screen.findByRole("region", { name: /Proposed, awaiting approval/ });
    expect(within(proposed).getByText("Proposed one")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: /In review/ })).getByText("Review me")).toBeInTheDocument();
    const blocked = screen.getByRole("region", { name: /^Blocked/ });
    expect(within(blocked).getByText("Stuck")).toBeInTheDocument();
    expect(within(blocked).getByText("Condition:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("No agent has attempted a human-only action.")).toBeInTheDocument();
    expect(screen.getByText("Every accepted task is on main.")).toBeInTheDocument();
    await noSeriousA11yViolations(container);
  });
});

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
