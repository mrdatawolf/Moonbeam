// App shell: header with navigation and the user select, which is always
// visible and always one step away (CONTRACT-002 UX), and the connection
// banner (CONTRACT-003 "Failure behavior").
import { Link, NavLink, Outlet } from "react-router";
import { useConnectionLost } from "../api/connection";
import { useUsers } from "../api/queries";
import { USER_PICKER_ID, useCurrentUser } from "../lib/currentUser";
import { ADD_USER_ANCHOR } from "../pages/Users";

export function UserPicker() {
  const { user, selectionInvalid, select } = useCurrentUser();
  const users = useUsers();
  const active = (users.data ?? []).filter((u) => u.active).sort((a, b) => a.displayName.localeCompare(b.displayName));
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <label htmlFor={USER_PICKER_ID} className="text-muted-foreground">
        Acting as
      </label>
      <select
        id={USER_PICKER_ID}
        className="field-input w-auto py-1"
        value={user?.id ?? ""}
        onChange={(e) => select(e.target.value || null)}
        aria-describedby={selectionInvalid || !user ? "user-picker-note" : undefined}
      >
        <option value="">Nobody (view only)</option>
        {active.map((u) => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
      {/* Not in the list? Adding a user needs someone selected; the add form explains it (CONTRACT-002). */}
      <Link to={`/users#${ADD_USER_ANCHOR}`} className="text-primary underline underline-offset-2">
        Add a user
      </Link>
      {selectionInvalid ? (
        <span id="user-picker-note" role="alert" className="text-tone-attention-fg">
          The user chosen in this browser is no longer active. Choose who you are.
        </span>
      ) : !user ? (
        <span id="user-picker-note" className="sr-only">
          Viewing without a user. Choose who you are to take actions.
        </span>
      ) : null}
    </div>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-control px-2.5 py-1 text-sm ${isActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`;

export function Layout() {
  const lost = useConnectionLost();
  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:bg-card focus:p-2">
        Skip to content
      </a>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-base font-semibold tracking-tight">Moonbeam</span>
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-1">
                <li>
                  <NavLink to="/" end className={navClass}>
                    Dashboard
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/decisions" className={navClass}>
                    Decision queue
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/projects" className={navClass}>
                    Projects
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/users" className={navClass}>
                    Users
                  </NavLink>
                </li>
              </ul>
            </nav>
          </div>
          <UserPicker />
        </div>
      </header>
      {lost ? (
        <div role="status" className="border-b border-tone-attention-border bg-tone-attention-bg px-4 py-2 text-center text-sm text-tone-attention-fg">
          Connection lost. Retrying. What you see may be out of date, and actions are disabled until Moonbeam is reachable.
        </div>
      ) : null}
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
