// Test fixtures: schema-valid API objects and a render helper with the app's
// providers and a fake `fetch` that answers per method and path.
import type { ActorRef, DecisionQueue, Project, TaskDetail, TaskSummary, User } from "@moonbeam/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import { CurrentUserProvider } from "../lib/currentUser";
import { SELECTION_KEY } from "../lib/selection";

export const NOW = "2026-09-25T10:00:00.000Z";
export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
export const USER_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";
export const TASK_ID = "44444444-4444-4444-8444-444444444444";

export const user: User = { id: USER_ID, displayName: "Patrick", email: "p@example.com", active: true, createdAt: NOW, updatedAt: NOW };
export const otherUser: User = { id: OTHER_USER_ID, displayName: "Dana", email: "d@example.com", active: true, createdAt: NOW, updatedAt: NOW };
export const project: Project = { id: PROJECT_ID, name: "Demo", repoPath: "/srv/projects/demo", mainBranch: "main", registeredAt: NOW };

export const humanRef = (u: User): ActorRef => ({
  kind: "human",
  userId: u.id,
  displayName: u.displayName,
  userActive: true,
  identityMode: "selected",
  runId: null,
  role: null,
  model: null,
  systemTrigger: null,
});

export function summary(over: Partial<TaskSummary> = {}): TaskSummary {
  return {
    id: TASK_ID,
    projectId: PROJECT_ID,
    number: 1,
    parentId: null,
    title: "Add login page",
    state: "proposed",
    blocked: false,
    effectivelyBlocked: false,
    paused: false,
    queuePosition: null,
    siblingPosition: null,
    claim: null,
    paths: ["src/login"],
    isSplitParent: false,
    fellBack: false,
    workOnMain: false,
    updatedAt: NOW,
    ...over,
  };
}

export function detail(over: Partial<TaskDetail> = {}): TaskDetail {
  const base = summary(over);
  return {
    ...base,
    desiredOutcome: "Users can sign in.",
    acceptanceCriteria: ["A user can sign in"],
    envelope: { inclusions: [{ key: "I1", text: "Login form", derivedFrom: null }], exclusions: [], constraints: [], contracts: [], paths: ["src/login"] },
    author: humanRef(user),
    originTaskId: null,
    approvedAt: null,
    approvedBy: null,
    enteredReviewBy: null,
    returnNotes: null,
    acceptedAt: null,
    acceptedBy: null,
    acceptedCommit: null,
    reviewWaiverReason: null,
    parent: null,
    subtasks: [],
    blockers: [],
    pauses: [],
    handoffs: [],
    reviews: [],
    dependsOn: [],
    dependedOnBy: [],
    audit: [],
    createdAt: NOW,
    ...over,
  };
}

export const humanClaim = (u: User) => ({
  id: "55555555-5555-4555-8555-555555555555",
  claimantKind: "human" as const,
  userId: u.id,
  displayName: u.displayName,
  userActive: true,
  runId: null,
  model: null,
  startedAt: NOW,
  leaseDeadline: null,
  leaseSuspended: false,
  lastRenewedAt: null,
});

export const HANDOFF_ID = "66666666-6666-4666-8666-666666666666";
export const handoff = {
  id: HANDOFF_ID,
  claimantKind: "agent" as const,
  userId: null,
  runId: "77777777-7777-4777-8777-777777777777",
  model: "claude-opus",
  record: { changes: "Added the form", validation: "Tests pass", deviations: "None", risks: "None" },
  commit: null,
  createdAt: NOW,
};

export const emptyQueue: DecisionQueue = {
  proposed: [],
  inReview: [],
  subtaskFindings: [],
  blocked: [],
  fellBack: [],
  authorityViolations: [],
  acceptedNotMerged: [],
};

type Handler = (body: unknown) => { status?: number; json: unknown };
export type Routes = Record<string, Handler | unknown>;

/** Install a fake fetch. Keys are "METHOD /path" (without /api). Values are bodies or handlers. */
export function mockApi(routes: Routes) {
  const calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.replace(/^\/api/, "").split("?")[0]!;
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body, headers: (init?.headers ?? {}) as Record<string, string> });
    const entry = routes[`${method} ${path}`];
    if (entry === undefined) return new Response(JSON.stringify({ error: { category: "not_found", message: `No mock for ${method} ${path}` } }), { status: 404 });
    const res = typeof entry === "function" ? (entry as Handler)(body) : { json: entry };
    return new Response(JSON.stringify(res.json), { status: res.status ?? 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

export const baseRoutes: Routes = {
  "GET /setup": { needsSetup: false, projectsRoot: "/srv/projects" },
  "GET /users": { users: [user, otherUser] },
  "GET /projects": { projects: [project] },
};

export function selectUser(id: string | null) {
  if (id) localStorage.setItem(SELECTION_KEY, id);
  else localStorage.removeItem(SELECTION_KEY);
}

export function renderAt(ui: ReactElement, { path = "/", route = "/" }: { path?: string; route?: string } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <CurrentUserProvider>
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        </CurrentUserProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
