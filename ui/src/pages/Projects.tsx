// Projects: the projects root and the registered projects, with registration
// of an existing git repository under the root (ADR-006; CONTRACT-004 B13).
// Setting the root and registering are human-only actions.
import { useState } from "react";
import { Link } from "react-router";
import { useProjects, useProjectsRoot, useRegisterProject, useSetProjectsRoot } from "../api/queries";
import { useConnectionLost } from "../api/connection";
import { EmptyState, Field, LoadError, Mono, Refusal, SectionHeading, Skeleton, Time } from "../components/common";
import { CHOOSE_USER, CONNECTION_LOST } from "../lib/actionPresentation";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";

function DisabledReason({ reason }: { reason: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {reason === CHOOSE_USER ? (
        <button type="button" className="text-primary underline" onClick={focusUserPicker}>
          {CHOOSE_USER}
        </button>
      ) : (
        reason
      )}
    </p>
  );
}

function useActReason(): string | null {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  return !user ? CHOOSE_USER : lost ? CONNECTION_LOST : null;
}

function ProjectsRootSection() {
  const root = useProjectsRoot();
  const set = useSetProjectsRoot();
  const [editing, setEditing] = useState(false);
  const [path, setPath] = useState("");
  const reason = useActReason();
  const { user } = useCurrentUser();

  return (
    <section aria-labelledby="root-h" className="card space-y-3 p-4">
      <SectionHeading id="root-h">Projects root</SectionHeading>
      {root.isPending ? <Skeleton lines={1} /> : root.isError ? <LoadError error={root.error} notFound="" /> : null}
      {root.data ? (
        <p className="text-sm">
          Projects live under <Mono>{root.data}</Mono>
        </p>
      ) : root.isSuccess ? (
        <p className="text-sm">No projects root is set yet. Set it before registering projects.</p>
      ) : null}
      {editing ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason) return;
            set.mutate({ path: path.trim() }, { onSuccess: () => setEditing(false) });
          }}
        >
          <Field
            label="Projects root"
            hint="An absolute path to an existing folder, outside Moonbeam's install and data folders."
            required
            mono
            value={path}
            onChange={setPath}
            autoFocus
          />
          <Refusal error={set.error} />
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
              Keep current
            </button>
            <button type="submit" className="btn-primary" aria-disabled={!!reason || set.isPending}>
              {user ? `Set projects root as ${user.displayName}` : "Set projects root"}
            </button>
          </div>
          {reason ? <DisabledReason reason={reason} /> : null}
        </form>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            className="btn-secondary"
            aria-disabled={!!reason}
            onClick={() => {
              if (reason) return;
              setPath(root.data ?? "");
              setEditing(true);
            }}
          >
            {root.data ? "Change projects root" : "Set projects root"}
          </button>
          {reason ? <DisabledReason reason={reason} /> : null}
        </div>
      )}
    </section>
  );
}

function RegisterProject({ hasRoot }: { hasRoot: boolean }) {
  const register = useRegisterProject();
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("main");
  const [done, setDone] = useState<string | null>(null);
  const actReason = useActReason();
  const reason = actReason ?? (hasRoot ? null : "Set the projects root before registering projects.");
  const { user } = useCurrentUser();

  return (
    <section aria-labelledby="register-h" className="card space-y-3 p-4">
      <SectionHeading id="register-h">Register a project</SectionHeading>
      <p className="text-sm text-muted-foreground">
        Register an existing git repository under the projects root. Moonbeam does not copy or move it.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason) return;
          setDone(null);
          register.mutate(
            { path: path.trim(), ...(name.trim() ? { name: name.trim() } : {}), mainBranch: branch.trim() || "main" },
            {
              onSuccess: (p) => {
                setDone(`Registered ${p.name}.`);
                setPath("");
                setName("");
              },
            },
          );
        }}
      >
        <Field label="Repository folder" hint="Absolute path to the repository's top-level folder." required mono value={path} onChange={setPath} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" hint="Defaults to the folder name." value={name} onChange={setName} />
          <Field label="Main branch" mono value={branch} onChange={setBranch} />
        </div>
        <Refusal error={register.error} />
        {done ? (
          <p role="status" className="text-sm text-tone-success-fg">
            {done}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" aria-disabled={!!reason || register.isPending}>
            {user ? `Register as ${user.displayName}` : "Register project"}
          </button>
          {reason ? <DisabledReason reason={reason} /> : null}
        </div>
      </form>
    </section>
  );
}

export function ProjectsPage() {
  const projects = useProjects();
  const root = useProjectsRoot();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <section aria-labelledby="list-h" className="space-y-3">
        <SectionHeading id="list-h" count={projects.data?.length}>
          Registered projects
        </SectionHeading>
        {projects.isPending ? (
          <Skeleton lines={2} />
        ) : projects.isError ? (
          <LoadError error={projects.error} notFound="" />
        ) : projects.data.length === 0 ? (
          <EmptyState title="No projects yet.">Set the projects root, then register a repository below.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-4 font-medium">Name</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Folder</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Main branch</th>
                  <th scope="col" className="py-2 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.map((p) => (
                  <tr key={p.id} className="border-b border-border">
                    <td className="py-2 pr-4">
                      <Link to={`/projects/${p.id}`} className="font-medium text-primary underline-offset-2 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">
                      <Mono>{p.repoPath}</Mono>
                    </td>
                    <td className="py-2 pr-4">
                      <Mono>{p.mainBranch}</Mono>
                    </td>
                    <td className="py-2">
                      <Time iso={p.registeredAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <RegisterProject hasRoot={!!root.data} />
        <ProjectsRootSection />
      </div>
    </div>
  );
}
