import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TaskPage } from "./Task";
import { DecisionQueuePage } from "./DecisionQueue";
import { baseRoutes, detail, emptyQueue, enabledActions, humanRef, mockApi, NOW, OTHER_USER_ID, renderAt, selectUser, summary, TASK_ID, USER_ID, user } from "../test/fixtures";
import { chooseSelectedUserId, readSelectedUserId } from "../lib/selection";

const renderTask = () => renderAt(<TaskPage />, { path: "/tasks/:taskId", route: `/tasks/${TASK_ID}` });

describe("edit proposal", () => {
  it("edits every content field, submits with identity, and displays the changed history", async () => {
    selectUser(USER_ID);
    let t = detail();
    const calls = mockApi({ ...baseRoutes,
      [`GET /tasks/${TASK_ID}`]: () => ({ json: t }),
      [`PATCH /tasks/${TASK_ID}`]: (body: unknown) => {
        const input = body as { title: string; desiredOutcome: string; acceptanceCriteria: string[]; envelope: { inclusions: string[]; exclusions: string[]; constraints: string[]; contracts: string[]; paths: string[] } };
        t = detail({ ...input, envelope: { ...input.envelope, inclusions: input.envelope.inclusions.map((text, i) => ({ key: `I${i + 1}`, text, derivedFrom: null })) },
          audit: [{ id: 1, projectId: t.projectId, taskId: TASK_ID, parentTaskId: null, subjectUserId: null, action: "edited", fromState: "proposed", toState: "proposed", rejected: false, actor: humanRef(user), reason: null, details: { changes: { title: { previous: "Add login page", new: input.title } } }, occurredAt: NOW, recordedAt: NOW }] });
        return { json: { task: t, audit: t.audit } };
      },
    });
    renderTask();
    const button = await screen.findByRole("button", { name: "Edit proposed task" });
    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Edit proposed task" });
    for (const [label, value] of [["Title", "Improved login"], ["Desired outcome", "Better sign-in"], ["Acceptance criteria", "A\nB"], ["Included", "Form\nHelp"], ["Excluded", "SSO"], ["Constraints", "No dependencies"], ["Linked contracts", "CONTRACT-005"], ["Paths", "ui/login\ndocs/login.md"]]) {
      const field = within(dialog).getByLabelText(label!, { exact: false });
      await userEvent.clear(field); await userEvent.type(field, value!);
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes as Patrick" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Proposal updated");
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.headers["x-moonbeam-user"]).toBe(USER_ID);
    expect(patch?.body).toEqual({ title: "Improved login", desiredOutcome: "Better sign-in", acceptanceCriteria: ["A", "B"], envelope: { inclusions: ["Form", "Help"], exclusions: ["SSO"], constraints: ["No dependencies"], contracts: ["CONTRACT-005"], paths: ["ui/login", "docs/login.md"] } });
    expect(await screen.findByText("Proposal edited")).toBeInTheDocument();
    expect(screen.getByText(/Previous: "Add login page"/)).toBeInTheDocument();
    expect(screen.getByText(/New: "Improved login"/)).toBeInTheDocument();
  });
  it("keeps draft input and the server's refusal visible", async () => {
    selectUser(USER_ID);
    mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail(), [`PATCH /tasks/${TASK_ID}`]: () => ({ status: 422, json: { error: { category: "validation", message: "At least one field must change." } } }) });
    renderTask();
    const button = await screen.findByRole("button", { name: "Edit proposed task" });
    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(button);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save changes as Patrick" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("At least one field must change.");
    expect(within(dialog).getByLabelText(/^Title/)).toHaveValue("Add login page");
  });
  it("disables invalid paths and missing required content without sending", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail() });
    renderTask();
    const button = await screen.findByRole("button", { name: "Edit proposed task" });
    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(button);
    const dialog = await screen.findByRole("dialog");
    const paths = within(dialog).getByLabelText("Paths");
    await userEvent.clear(paths); await userEvent.type(paths, "../outside");
    const save = within(dialog).getByRole("button", { name: "Save changes as Patrick" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(save);
    await userEvent.clear(paths); await userEvent.clear(within(dialog).getByLabelText(/^Title/));
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });
  it("has no edit form after approval", async () => {
    selectUser(USER_ID);
    mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail({ state: "approved", allowedActions: { ...enabledActions, edit: { enabled: false, reason: "Already approved" } } }) });
    renderTask();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Edit proposed task" })).toBeNull();
  });
});

describe("API availability", () => {
  it("uses server decisions even when local task fields suggest otherwise", async () => {
    selectUser(USER_ID);
    mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: detail({ allowedActions: { ...enabledActions, edit: { enabled: false, reason: "Server edit refusal" }, approve: { enabled: false, reason: "Server approval refusal" }, claim: { enabled: true } } }) });
    renderTask();
    expect(await screen.findByText("Server approval refusal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAccessibleDescription("Server approval refusal");
    expect(screen.getByRole("button", { name: "Edit proposed task" })).toHaveAttribute("aria-disabled", "true");
    await waitFor(() => expect(screen.getByRole("button", { name: "Claim" })).toHaveAttribute("aria-disabled", "false"));
  });
  it("fetches new permissions when the acting user changes", async () => {
    selectUser(USER_ID);
    const calls = mockApi({ ...baseRoutes, [`GET /tasks/${TASK_ID}`]: () => ({ json: detail({ allowedActions: { ...enabledActions,
      approve: readSelectedUserId() === USER_ID ? { enabled: true } : { enabled: false, reason: "Dana's server decision" },
    } }) }) });
    renderTask();
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute("aria-disabled", "false"));
    act(() => chooseSelectedUserId(OTHER_USER_ID));
    expect(await screen.findByText("Dana's server decision")).toBeInTheDocument();
    expect(calls.filter((c) => c.path === `/tasks/${TASK_ID}`).map((c) => c.headers["x-moonbeam-user"])).toEqual([USER_ID, OTHER_USER_ID]);
  });
});

describe("additional decision queue groups", () => {
  it("renders findings with review/parent context and fallen-back tasks", async () => {
    const sub = summary({ parentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Fix login" });
    mockApi({ ...baseRoutes, "GET /decision-queue": { ...emptyQueue,
      subtaskFindings: [{ task: sub, review: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", handoffId: null, reviewerRunId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", reviewerModel: "m", verdict: "changes_required", findings: [{ severity: "major", text: "Missing error state" }], sameModel: true, createdAt: NOW } }],
      fellBack: [summary({ title: "Retry directly", state: "approved", fellBack: true })],
    } });
    renderAt(<DecisionQueuePage />);
    const findings = await screen.findByRole("region", { name: /Subtask findings/ });
    expect(within(findings).getByText("major: Missing error state")).toBeInTheDocument();
    expect(within(findings).getByRole("link", { name: "Open parent task" })).toHaveAttribute("href", `/tasks/${sub.parentId}`);
    expect(within(screen.getByRole("region", { name: /Fell back/ })).getByText("Retry directly")).toBeInTheDocument();
  });
  it("renders the empty states", async () => {
    mockApi({ ...baseRoutes, "GET /decision-queue": emptyQueue }); renderAt(<DecisionQueuePage />);
    expect(await screen.findByText("No subtask findings need attention.")).toBeInTheDocument();
    expect(screen.getByText("No tasks fell back.")).toBeInTheDocument();
  });
});
