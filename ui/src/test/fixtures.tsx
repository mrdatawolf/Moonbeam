// Test fixtures: schema-valid API objects and a render helper with the app's
// providers and a fake `fetch` that answers per method and path.
import type { User, ProjectView, IdentitiesResponse } from "@moonbeam/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { vi } from "vitest";
import { CurrentUserProvider } from "../lib/currentUser";
import { SELECTION_KEY } from "../lib/selection";

export const NOW = "2026-09-25T10:00:00.000Z";
export const USER_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_USER_ID = "33333333-3333-4333-8333-333333333333";

export const user: User = { id: USER_ID, displayName: "Patrick", email: "p@example.com", active: true, createdAt: NOW, updatedAt: NOW };
export const otherUser: User = { id: OTHER_USER_ID, displayName: "Dana", email: "d@example.com", active: true, createdAt: NOW, updatedAt: NOW };
type Handler = (body: unknown) => { status?: number; json: unknown };
export type Routes = Record<string, Handler | unknown>;

/** Install a fake fetch. Keys are "METHOD /path" (without /api). Values are bodies or handlers. */
export function mockApi(routes: Routes) {
  const calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = url.replace(/^\/api/, "").replace(/\?.*$/, "");
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
  "GET /identities": { members: [], conflicts: [] },
  "GET /projects": { projects: [] },
  "GET /github/tokens": { state: "ok", tokens: [{ label: "example", masked: "••••1234" }] },
  "GET /setup": { needsSetup: false },
  "GET /users": { users: [user, otherUser] },
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

export const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
export const IDENTITY_ID = "55555555-5555-4555-8555-555555555555";
export const project: ProjectView = { id: PROJECT_ID, name: "Moonbeam", githubOwner: "example", githubRepo: "moonbeam", githubRepoId: "123", trackedBranch: "main", tokenLabel: "example", leadDeveloperUserId: null, baselineSha: "a".repeat(40), baselineCommittedAt: NOW, exemptPaths: [], staleThresholdDays: 14, registeredAt: NOW, registeredByUserId: USER_ID, removedAt: null };
export const identities: IdentitiesResponse = { members: [user, otherUser].map((u) => ({ userId: u.id, displayName: u.displayName, active: u.active, identities: [{ id: null, userId: u.id, kind: "email", value: u.email, automatic: true }] })), conflicts: [] };

import type { ProjectViewResponse, ProjectTaskResponse, ProjectDocumentsResponse, ProjectFileResponse, TaskReadView, FlagDetail, SourceView } from "@moonbeam/shared";
export const HEAD = "b".repeat(40);
export const source: SourceView = { projectId: PROJECT_ID, status: "ok", message: "Source read successfully", statusSince: NOW, lastAttemptAt: NOW, lastSuccessAt: NOW, lastProcessedHead: HEAD, rateLimitedUntil: null, redirectedFullName: null, tokenWriteScopes: false, consecutiveFailures: 0, baselineNeedsReset: false };
export const readMeta = { projectId: PROJECT_ID, headSha: HEAD, lastSuccessfulPollAt: NOW, notCurrent: false, readState: "ready" as const, source };
const unmatched = { kind: "unmatched" as const, recorded: "Robot", userId: null, displayName: null, inactive: false, label: "not a board member" };
export const commit = { sha: HEAD, subject: "Record task", committedAt: NOW, isMerge: false, author: { name: "Robot", email: "robot@example.com", login: null }, attribution: unmatched, committer: { name: "Committer", email: "committer@example.com" }, githubUrl: `https://github.com/example/moonbeam/commit/${HEAD}`, changesComplete: true, label: "direct commit" };
export const fileRef = { path: "tasks/approved/TASK-001-example.md", headSha: HEAD, githubUrl: `https://github.com/example/moonbeam/blob/${HEAD}/tasks/approved/TASK-001-example.md`, href: `/api/projects/${PROJECT_ID}/file?path=tasks%2Fapproved%2FTASK-001-example.md` };
export const readTask: TaskReadView = { id: "TASK-001", title: "Observe work", states: ["approved"], files: [{ file: fileRef, state: "approved", read: "ok", parsed: { title: { id: "TASK-001", text: "Observe work", line: 1 }, header: { fields: [{ name: "Custom field", key: "custom field", value: "Preserved unknown value", line: 2 }], duplicates: [], unattached: [] }, rawHeaderLines: ["Custom field: Preserved unknown value"], format: null, isV1: false, paths: { kind: "patterns", patterns: ["ui/**"] } }, formatLabel: "not DbC task v1", problems: [{ kind: "missing", field: "Approved by" }], proposedBy: unmatched, approvedBy: unmatched, proposedDate: "2026-09-01", approvedDate: "2026-09-02", assignedAgent: "Implementer", relatedContracts: [{ id: "CONTRACT-001", kind: "CONTRACT", found: true, label: null, href: "unused", files: [{ ...fileRef, path: "docs/contracts/CONTRACT-001-example.md" }], states: [] }], relatedAdrs: [], dependencies: [{ id: "TASK-099", kind: "TASK", found: false, label: "not found on main", href: null, files: [], states: [] }] }], firstProposed: commit, firstApproved: commit, firstCompleted: null, latestApproved: commit, proposedAgeMs: 172800000, approvedWaitMs: 86400000, staleApproval: true, acceptance: null };
export const readFlag: ProjectViewResponse["flags"][number] = { id: "66666666-6666-4666-8666-666666666666", projectId: PROJECT_ID, rule: "FL-5", ruleName: "Stale approval", kind: "condition", subjectKey: "TASK-001", subject: { taskId: "TASK-001" }, commitSha: HEAD, taskIdText: "TASK-001", status: "open", firstRaisedAt: NOW, statusChangedAt: NOW, evidence: { observation: "Approval still on main", paths: [fileRef.path] }, href: "/api/flags/example", commitUrl: commit.githubUrl, files: [fileRef], notes: [], attributions: [{ location: "approver", attribution: unmatched }] };
export const flagDetail: FlagDetail = { ...readFlag, history: [{ id: 1, flagId: readFlag.id, action: "raised", fromState: null, toState: "open", actorKind: "system", actorUserId: null, systemTrigger: "poll", occurredAt: NOW, recordedAt: NOW, note: null, details: null }] };
export const projectView: ProjectViewResponse = { ...readMeta, name: "Moonbeam", githubUrl: "https://github.com/example/moonbeam", trackedBranch: "main", leadDeveloper: null, leadDeveloperLabel: "No lead developer", notices: [], openFlagCount: 1, v1FileCount: 0, nonV1FileCount: 1, proposed: [{ ...readTask, id: "TASK-002", states: ["proposed"] }], approved: [readTask], recentlyCompleted: [{ ...readTask, id: "TASK-003", states: ["completed"], acceptance: { commit, kind: "direct", label: "direct commit", acceptor: unmatched, approvalToAcceptanceMs: 86400000 } }], other: [{ ...readTask, id: "TASK-004", states: ["removed"] }], activity: Array.from({ length: 12 }, (_, i) => ({ start: `2026-07-${String(i + 1).padStart(2,"0")}T00:00:00.000Z`, end: `2026-08-${String(i + 1).padStart(2,"0")}T00:00:00.000Z`, proposed: 1, approved: 2, completed: 3, commits: 4, flagsRaised: 5 })), flags: [readFlag], allTasksHref: `/api/projects/${PROJECT_ID}/tasks` };
export const taskDetail: ProjectTaskResponse = { ...readMeta, task: readTask, history: [{ kind: "enters", state: "approved", paths: [fileRef.path], commit }, { kind: "leaves", state: "proposed", paths: [fileRef.path], commit }], entries: [{ state: "approved", commit, files: readTask.files }], flags: [readFlag] };
export const documentView: ProjectDocumentsResponse = { ...readMeta, goals: null, goalsMessage: "No project definition found", contracts: [{ id: "CONTRACT-001", kind: "contract", title: "Reading contract", status: "Approved", read: "ok", file: { ...fileRef, path: "docs/contracts/CONTRACT-001-example.md" }, supersedes: "CONTRACT-000", approvedBy: "Robot", approvedByAttribution: unmatched, approvedDate: "2026-09-02", relatedTasks: "TASK-001", date: null }], adrs: [{ id: "ADR-001", kind: "adr", title: null, status: "status unknown", read: "could not be read", file: { ...fileRef, path: "docs/decisions/ADR-001-example.md" }, supersedes: null, approvedBy: null, approvedByAttribution: null, approvedDate: null, relatedTasks: null, date: "2026-09-01" }] };
export const maliciousMarkdown = '# Repository content\n\n<script>window.repositoryExecuted = true</script>\n\n<img src="x" onerror="window.repositoryExecuted = true">\n\n<iframe src="https://example.com"></iframe>\n\n[unsafe](javascript:alert%281%29)\n\n[data link](data:text/html,bad)\n\n[safe](https://example.com)\n\n![remote](https://example.com/tracker.png)\n\n| Field | Value |\n| --- | --- |\n| safe | text |';
export const fileView: ProjectFileResponse = { ...readMeta, file: fileRef, text: maliciousMarkdown, status: "ok", reason: null };
export const projectReadRoutes: Routes = { ...baseRoutes, "GET /projects": { projects: [project] }, [`GET /projects/${PROJECT_ID}/view`]: projectView, [`GET /projects/${PROJECT_ID}/tasks`]: { ...readMeta, tasks: projectView.recentlyCompleted }, [`GET /projects/${PROJECT_ID}/tasks/TASK-001`]: taskDetail, [`GET /projects/${PROJECT_ID}/documents`]: documentView, [`GET /projects/${PROJECT_ID}/file`]: fileView, [`GET /flags/${readFlag.id}`]: flagDetail, [`POST /projects/${PROJECT_ID}/refresh`]: source };
