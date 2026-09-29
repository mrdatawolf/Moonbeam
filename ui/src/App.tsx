// Routes. While the user registry is empty, Moonbeam offers first-run setup
// and nothing else (CONTRACT-002 "User registry").
import { Route, Routes } from "react-router";
import { useSetupStatus } from "./api/queries";
import { LoadError, Skeleton } from "./components/common";
import { Layout } from "./components/Layout";
import { CurrentUserProvider } from "./lib/currentUser";
import { Dashboard } from "./pages/Dashboard";
import { NotFoundPage } from "./pages/NotFound";
import { ProjectsPage } from "./pages/Projects";
import { SetupPage } from "./pages/Setup";
import { UsersPage } from "./pages/Users";

export function App() {
  const setup = useSetupStatus();
  if (setup.isPending) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton label="Loading Moonbeam" />
      </div>
    );
  }
  if (setup.isError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <LoadError error={setup.error} notFound="Moonbeam could not be reached." />
      </div>
    );
  }
  if (setup.data.needsSetup) return <SetupPage />;
  return (
    <CurrentUserProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </CurrentUserProvider>
  );
}
