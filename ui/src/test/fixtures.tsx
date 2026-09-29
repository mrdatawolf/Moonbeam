// Test fixtures: schema-valid API objects and a render helper with the app's
// providers and a fake `fetch` that answers per method and path.
import type { User } from "@moonbeam/shared";
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
