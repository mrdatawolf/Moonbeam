import type { Attribution, TaskReadView, ProjectViewResponse } from "@moonbeam/shared";
import { Link, useParams } from "react-router";
import { useProjectTasks, useProjectView } from "../api/queries";
import { EmptyState, LoadError, Skeleton, Time } from "../components/common";
import { ExternalLink } from "../components/Markdown";
import { ProjectNav, SourceStatus } from "../components/SourceStatus";
import { FlagList } from "../components/FlagList";
export function AttributionText({ value }: { value: Attribution | null }) {
  if (!value) return <>Not recorded</>;
  return <>{typeof value.recorded === "string" ? value.recorded : JSON.stringify(value.recorded)} · {value.kind === "unmatched" ? "not a board member" : value.label}{value.inactive ? " (inactive)" : ""}</>;
}
export function CommitFacts({ commit }: { commit: TaskReadView["firstProposed"] }) {
  if (!commit) return <>Not found on main</>;
  return <span><ExternalLink href={commit.githubUrl}>{commit.sha}</ExternalLink> · {commit.subject} · <Time iso={commit.committedAt} /> · {commit.isMerge ? "merged" : "direct commit"} · Author: {commit.author.name} &lt;{commit.author.email}&gt; {commit.author.login} (<AttributionText value={commit.attribution} />) · Committer: {commit.committer.name} &lt;{commit.committer.email}&gt;</span>;
}
export function References({ refs, project }: { refs: TaskReadView["files"][number]["dependencies"]; project: string }) {
  return <>{refs.length ? refs.map((ref, i) => <span key={`${ref.id}-${i}`} className="mr-3">{ref.found ? <Link className="text-primary underline" to={ref.kind === "TASK" ? `/projects/${project}/tasks/${ref.id}` : `/projects/${project}/documents/file?path=${encodeURIComponent(ref.files[0]?.path ?? "")}`}>{ref.id}</Link> : `${ref.id} (not found on main)`}{ref.states.length ? ` (${ref.states.join(", ")})` : ""}</span>) : "None"}</>;
}
const duration = (ms: number | null) => ms === null ? "Not available" : `${(ms / 86_400_000).toFixed(1)} days`;
export function TaskSummary({ task, project }: { task: TaskReadView; project: string }) {
  return <article className="card space-y-2 p-4 text-sm">
    <h3 className="font-semibold"><Link className="text-primary underline" to={`/projects/${project}/tasks/${task.id}`}>{task.id}: {task.title ?? "Title unavailable"}</Link></h3>
    <p>State on main: {task.states.join(", ")}</p>
    {task.files.map((f) => <div key={f.file.path} className="space-y-1"><p>{f.file.path} · <strong>{f.formatLabel}</strong></p>
      <p>Proposed by: <AttributionText value={f.proposedBy} /> · Proposed date: {f.proposedDate ?? "Not recorded"}</p>
      <p>Approved by: <AttributionText value={f.approvedBy} /> · Approved date: {f.approvedDate ?? "Not recorded"}</p>
      <p>Assigned agent: {f.assignedAgent ?? "Not recorded"}</p><p>Dependencies: <References refs={f.dependencies} project={project} /></p></div>)}
    <p>First entry into proposed: <CommitFacts commit={task.firstProposed} /> · Time since: {duration(task.proposedAgeMs)}</p>
    <p>Most recent entry into approved: <CommitFacts commit={task.latestApproved} /> · Wait: {duration(task.approvedWaitMs)}</p>
    <p>FL-5: {task.staleApproval ? "Approval has reached the staleness threshold" : "Does not apply"}</p>
    {task.acceptance ? <><p>Acceptance ({task.acceptance.kind === "merged" ? "merged" : "direct commit"}): <CommitFacts commit={task.acceptance.commit} /></p><p>Acceptor: <AttributionText value={task.acceptance.acceptor} /> · Approval to acceptance: {duration(task.acceptance.approvalToAcceptanceMs)}</p></> : null}
  </article>;
}
function TaskSection({ title, tasks, id }: { title: string; tasks: TaskReadView[]; id: string }) {
  return <section className="space-y-3"><h2 className="text-lg font-semibold">{title}</h2>{tasks.length ? tasks.map((t) => <TaskSummary key={t.id} task={t} project={id} />) : <EmptyState title="No tasks in this section." />}</section>;
}
export function ProjectPage() {
  const { id = "" } = useParams(); const query = useProjectView(id);
  if (!query.data) return query.isPending ? <Skeleton label="Loading project" /> : <LoadError error={query.error} notFound="Project not found." back={{ to: "/projects", label: "Projects" }} />;
  const p: ProjectViewResponse = query.data;
  return <div className="space-y-6"><ProjectNav id={id} /><h1 className="text-2xl font-semibold">{p.name}</h1>
    <p><ExternalLink href={p.githubUrl}>Repository on GitHub</ExternalLink> · Tracked branch: {p.trackedBranch}</p>
    <p>{p.leadDeveloperLabel}{p.leadDeveloper?.inactive ? " (inactive)" : ""} · {p.openFlagCount} open flags · {p.v1FileCount} DbC task v1 files · {p.nonV1FileCount} not DbC task v1 files</p>
    <SourceStatus meta={p} />{query.error ? <LoadError error={query.error} notFound="Project not found." /> : null}{p.notices.map((n) => <p key={n}>{n}</p>)}
    <TaskSection title="Proposed tasks" tasks={p.proposed} id={id} /><TaskSection title="Approved tasks" tasks={p.approved} id={id} />
    <TaskSection title="Recently completed" tasks={p.recentlyCompleted} id={id} /><Link className="text-primary underline" to={`/projects/${id}/tasks`}>All completed tasks</Link>
    <TaskSection title="Other states on main" tasks={p.other} id={id} />
    <section className="space-y-3"><h2 className="text-lg font-semibold">Activity over the last 12 weeks</h2><div className="overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Weekly entries, commits, and flags raised</caption><thead><tr>{["Week", "Proposed", "Approved", "Completed", "Commits", "Flags raised"].map((s) => <th className="p-2" key={s} scope="col">{s}</th>)}</tr></thead><tbody>{p.activity.map((w) => <tr key={w.start}><th scope="row" className="p-2">{w.start.slice(0,10)} to {w.end.slice(0,10)}</th>{[w.proposed,w.approved,w.completed,w.commits,w.flagsRaised].map((n,i) => <td className="p-2" key={i}>{n}</td>)}</tr>)}</tbody></table></div></section>
    <FlagList flags={p.flags} project={id} />
  </div>;
}
export function CompletedTasksPage() {
  const { id = "" } = useParams(); const q = useProjectTasks(id);
  return <div className="space-y-6"><ProjectNav id={id} /><h1 className="text-2xl font-semibold">All completed tasks</h1>{q.data ? <><SourceStatus meta={q.data} /><TaskSection title="Completed on main" tasks={q.data.tasks.filter((t) => t.states.includes("completed"))} id={id} />{q.error ? <LoadError error={q.error} notFound="Project not found." /> : null}</> : q.isPending ? <Skeleton /> : <LoadError error={q.error} notFound="Project not found." />}</div>;
}
