import { Link } from "react-router";
import { useDashboard } from "../api/queries";
import { EmptyState, LoadError, Skeleton } from "../components/common";
import { SourceStatus } from "../components/SourceStatus";
import { FlagList } from "../components/FlagList";
import { AttributionText, CommitFacts } from "./Project";

export function Dashboard() {
  const query = useDashboard();
  const data = query.data;
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
    <p className="text-sm text-muted-foreground">Projects as of their last successful poll. Unpushed work is invisible.</p>
    {query.isPending ? <Skeleton label="Loading dashboard" /> : null}
    {query.error ? <LoadError error={query.error} notFound="Dashboard unavailable." /> : null}
    {data ? <>
      <section aria-label="Projects" className="space-y-4">
        <h2 className="text-lg font-semibold">Projects</h2>
        {data.projects.length ? data.projects.map((p) => <article key={p.projectId} aria-label={p.name} className="card space-y-3 p-4">
          <h3 className="font-semibold"><Link className="text-primary underline" to={`/projects/${p.projectId}`}>{p.name}</Link></h3>
          <p>Lead developer: {p.leadDeveloperLabel}{p.leadDeveloper?.inactive ? " (inactive)" : ""}</p>
          <SourceStatus meta={p} />
          <dl className="flex flex-wrap gap-6 text-sm">{[
            ["Proposed", p.proposedCount], ["Approved", p.approvedCount],
            ["Stale approvals (open FL-5)", p.staleApprovalCount], ["Open flags", p.openFlagCount],
            ["Completions in the last 30 days", p.completedLast30Days],
          ].map(([label, count]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{p.readState === "ready" || label === "Open flags" || label === "Stale approvals (open FL-5)" ? count : "Not yet available"}</dd></div>)}</dl>
        </article>) : <EmptyState title="No projects registered.">Register a project from the Projects page.</EmptyState>}
      </section>
      <section aria-label="Recent acceptances" className="space-y-3">
        <h2 className="text-lg font-semibold">10 most recent acceptances</h2>
        {data.recentAcceptances.length ? data.recentAcceptances.map(({ projectId, projectName, task }) => <article key={`${projectId}-${task.id}`} className="card space-y-2 p-4 text-sm">
          <Link className="text-primary underline" to={`/projects/${projectId}`}>{projectName}</Link>
          <h3 className="font-semibold"><Link className="text-primary underline" to={`/projects/${projectId}/tasks/${task.id}`}>{task.id}: {task.title ?? "Title unavailable"}</Link></h3>
          {task.files.map((file) => <p key={file.file.path}>{file.file.path} · {file.formatLabel}</p>)}
          <p>Acceptance: <CommitFacts commit={task.acceptance?.commit ?? null} /></p>
          <p>Acceptor: <AttributionText value={task.acceptance?.acceptor ?? null} /></p>
        </article>) : <EmptyState title="No acceptances observed." />}
      </section>
      <section aria-label="Recently raised flags" className="space-y-3">
        <h2 className="text-lg font-semibold">10 most recently raised flags</h2>
        <p className="text-sm text-muted-foreground">Ordered by first raised time, including dismissed, resolved, and withdrawn flags.</p>
        {data.recentFlags.length ? data.recentFlags.map(({ projectId, projectName, flag }) => <div key={flag.id} className="space-y-2">
          <Link className="text-primary underline" to={`/projects/${projectId}`}>{projectName}</Link>
          <FlagList flags={[flag]} project={projectId} />
        </div>) : <EmptyState title="No flags raised." />}
      </section>
    </> : null}
  </div>;
}
