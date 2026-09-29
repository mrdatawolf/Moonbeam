import { Link } from "react-router";
import type { ProjectView } from "@moonbeam/shared";
import { useId, useState } from "react";
import { useConnectionLost } from "../api/connection";
import { useAllUsers, useProjectChange, useProjects, useRegistrationSource } from "../api/queries";
import { EmptyState, LoadError, Refusal, Skeleton } from "../components/common";
import { Dialog } from "../components/Dialog";
import { ProjectForm } from "../components/ProjectForm";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";

function Registration({ project }: { project: ProjectView }) {
  const users = useAllUsers();
  const source = useRegistrationSource(project.id);
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const change = useProjectChange();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [lead, setLead] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const id = useId();
  const blocked = !user || lost || change.isPending;
  const currentLead = users.data?.find((u) => u.id === project.leadDeveloperUserId);
  const redirected = source.data?.source?.redirectedFullName;
  return <section aria-labelledby={`${id}-heading`} className="card space-y-3 p-4">
    <h2 id={`${id}-heading`} className="text-lg font-semibold"><Link className="text-primary underline" to={`/projects/${project.id}`}>{project.name}</Link></h2>
    <p className="text-sm">{project.githubOwner}/{project.githubRepo} · Branch: <span className="font-mono">{project.trackedBranch}</span></p>
    <p className="text-sm">{project.leadDeveloperUserId ? `Lead developer: ${currentLead?.displayName ?? "Loading member"}${currentLead && !currentLead.active ? " (inactive)" : ""}` : "No lead developer"}</p>
    {redirected ? <p role="status" className="rounded-control border border-tone-attention-border bg-tone-attention-bg p-3 text-tone-attention-fg">Now at {redirected}; update the registration.</p> : null}
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" aria-disabled={blocked} onClick={() => { if (!blocked) setEditing(!editing); }}>{editing ? "Close registration editor" : `Edit registration ${project.name}`}</button>
      <button className="btn-danger" aria-disabled={blocked} onClick={() => { if (!blocked) { change.reset(); setRemoving(true); } }}>Remove registration {project.name}</button>
    </div>
    {editing ? <ProjectForm project={project} onDone={() => { setEditing(false); setNotice("Registration saved."); }} /> : null}
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (blocked || lead === null || lead === (project.leadDeveloperUserId ?? "")) return;
      change.mutate({ kind: "lead", id: project.id, userId: lead || null }, { onSuccess: () => { setLead(null); setNotice("Lead developer saved."); } });
    }}>
      <div>
        <label htmlFor={`${id}-lead`} className="block text-sm font-medium">Lead developer for {project.name}</label>
        <select id={`${id}-lead`} className="field-input" value={lead ?? project.leadDeveloperUserId ?? ""} onChange={(e) => setLead(e.target.value)}>
          <option value="">No lead developer</option>
          {currentLead && !currentLead.active ? <option value={currentLead.id} disabled>{currentLead.displayName} (inactive)</option> : null}
          {users.data?.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
        </select>
      </div>
      <button type="submit" className="btn-secondary" aria-disabled={blocked || lead === null || lead === (project.leadDeveloperUserId ?? "")}>Save lead developer</button>
    </form>
    <Refusal error={users.error} />
    {!removing ? <Refusal error={change.error} /> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <Dialog open={removing} onClose={() => { if (!change.isPending) setRemoving(false); }} title={`Remove registration ${project.name}?`} onSubmit={() => {
      if (!blocked) change.mutate({ kind: "remove", id: project.id });
    }} footer={<>
      <button type="button" className="btn-secondary" disabled={change.isPending} onClick={() => setRemoving(false)}>Keep registration</button>
      <button type="submit" className="btn-danger" aria-disabled={blocked}>{change.isPending ? "Removing…" : "Confirm removal"}</button>
    </>}>
      <p>Remove this registration from Moonbeam? Moonbeam's data is kept, including snapshots, flags, and audit history. The repository can be registered again.</p>
      <Refusal error={change.error} />
      {!user ? <button type="button" className="text-primary underline" onClick={focusUserPicker}>Choose who you are to take this action</button> : null}
    </Dialog>
  </section>;
}

export function ProjectsPage() {
  const projects = useProjects();
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const [version, setVersion] = useState(0);
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
    <p className="text-sm text-muted-foreground">Register GitHub repositories for Moonbeam to observe. These settings change only Moonbeam's records.</p>
    {!user ? <button className="text-primary underline" onClick={focusUserPicker}>Choose who you are to take this action</button> : lost ? <p role="status">Connection lost. Retrying. Actions are disabled.</p> : null}
    {projects.isPending ? <Skeleton label="Loading registrations" /> : projects.isError ? <LoadError error={projects.error} notFound="Registrations not found." /> : projects.data.projects.length ? projects.data.projects.map((p) => <Registration key={p.id} project={p} />) : <EmptyState title="No projects registered." />}
    <section aria-labelledby="register-project" className="card space-y-3 p-4">
      <h2 id="register-project" className="text-lg font-semibold">Register a project</h2>
      {version > 0 ? <p role="status">Project registered.</p> : null}
      <ProjectForm key={version} onDone={() => setVersion((n) => n + 1)} />
    </section>
  </div>;
}
