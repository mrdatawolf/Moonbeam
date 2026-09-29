import type { ProjectDocumentsResponse } from "@moonbeam/shared";
import { Link, useParams, useSearchParams } from "react-router";
import { useProjectDocuments, useProjectFile } from "../api/queries";
import { EmptyState, LoadError, Skeleton } from "../components/common";
import { Markdown } from "../components/Markdown";
import { FileLink, ProjectNav, SourceStatus } from "../components/SourceStatus";
import { AttributionText } from "./Project";
export function RenderedFile({ project, path, head }: { project: string; path: string; head: string | null }) {
  const q = useProjectFile(project, path, head);
  if (!q.data) return q.isPending ? <Skeleton label="Loading file" /> : <LoadError error={q.error} notFound="File not found on main." />;
  // File requests can race a poll. Never combine content from a different head.
  if (q.data.headSha !== head) return <p role="status">The source head changed. Refresh project to read this file with the current snapshot.</p>;
  return <div className="space-y-3"><FileLink {...q.data.file} />{q.data.status === "ok" && q.data.text !== null ? <Markdown text={q.data.text} githubUrl={q.data.file.githubUrl} /> : <p>{q.data.status}: {q.data.reason}</p>}</div>;
}
type Doc = NonNullable<ProjectDocumentsResponse["goals"]>;
function DocumentMetadata({ doc, project }: { doc: Doc; project: string }) {
  return <article className="card space-y-2 p-4 text-sm"><h3 className="font-semibold"><Link className="text-primary underline" to={`/projects/${project}/documents/file?path=${encodeURIComponent(doc.file.path)}`}>{doc.id ?? "Project goals"}: {doc.title ?? doc.file.path}</Link></h3>
    <p>Status: {doc.status} · Read: {doc.read}</p>
    {doc.supersedes !== null ? <p>Supersedes: {doc.supersedes}</p> : null}
    {doc.approvedBy !== null ? <p>Approved by: {doc.approvedBy} · <AttributionText value={doc.approvedByAttribution} /></p> : null}
    {doc.approvedDate !== null ? <p>Approved date: {doc.approvedDate}</p> : null}
    {doc.relatedTasks !== null ? <p>Related tasks: {doc.relatedTasks}</p> : null}
    {doc.date !== null ? <p>Date: {doc.date}</p> : null}
    <FileLink {...doc.file} />
  </article>;
}
export function ProjectDocumentsPage({ file = false }: { file?: boolean }) {
  const { id = "" } = useParams(); const [params] = useSearchParams(); const q = useProjectDocuments(id);
  const path = params.get("path") ?? "";
  const selected = q.data ? [q.data.goals, ...q.data.contracts, ...q.data.adrs].find((d) => d?.file.path === path) : null;
  return <div className="space-y-6"><ProjectNav id={id} /><h1 className="text-2xl font-semibold">{file ? selected?.title ?? "Document" : "Documents"}</h1>
    {q.data ? <><SourceStatus meta={q.data} />{file ? selected ? <><DocumentMetadata doc={selected} project={id} /><RenderedFile project={id} path={path} head={q.data.headSha} /></> : <EmptyState title="Document not found on main." /> : <>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Project goals</h2>{q.data.goals ? <><DocumentMetadata doc={q.data.goals} project={id} /><RenderedFile project={id} path={q.data.goals.file.path} head={q.data.headSha} /></> : <p>{q.data.goalsMessage ?? "No project definition found"}</p>}</section>
      {([['Contracts',q.data.contracts],['ADRs',q.data.adrs]] as const).map(([title,docs]) => <section key={title} className="space-y-3"><h2 className="text-lg font-semibold">{title}</h2>{docs.length ? docs.map((d) => <DocumentMetadata key={d.file.path} doc={d} project={id} />) : <EmptyState title={`No ${title.toLowerCase()} found.`} />}</section>)}</>}</> : q.isPending ? <Skeleton label="Loading documents" /> : <LoadError error={q.error} notFound="Project not found." />}
    {q.data && q.error ? <LoadError error={q.error} notFound="Project not found." /> : null}
  </div>;
}
