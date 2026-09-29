import type { TaskReadView } from "@moonbeam/shared";
import { useParams } from "react-router";
import { useProjectTask } from "../api/queries";
import { LoadError, Skeleton } from "../components/common";
import { FlagList } from "../components/FlagList";
import { FileLink, ProjectNav, SourceStatus } from "../components/SourceStatus";
import { CommitFacts, References, TaskSummary } from "./Project";
import { RenderedFile } from "./ProjectDocuments";
function ParsedFile({ file, project }: { file: TaskReadView["files"][number]; project: string }) {
  return <div className="card space-y-3 p-4 text-sm"><h3 className="font-semibold">{file.file.path} · {file.formatLabel}</h3><FileLink {...file.file} /><p>State: {file.state} · Read: {file.read}</p>
    {file.parsed ? <><dl>{file.parsed.header.fields.map((f,i) => <div key={i} className="my-2"><dt className="font-semibold">{f.name} (line {f.line})</dt><dd className="whitespace-pre-wrap break-words">{f.value}</dd></div>)}</dl><p>Title: {file.parsed.title?.text ?? "Not recorded"}</p><p>Paths: {file.parsed.paths.kind === "patterns" ? file.parsed.paths.patterns.join(", ") : file.parsed.paths.kind}</p>
      <details><summary>Raw header and parse details</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify({ rawHeaderLines: file.parsed.rawHeaderLines, duplicates: file.parsed.header.duplicates, unattached: file.parsed.header.unattached },null,2)}</pre></details></> : <p>Could not be read</p>}
    <p>Parse problems: {file.problems.length ? JSON.stringify(file.problems) : "None"}</p>
    <p>Related contracts: <References refs={file.relatedContracts} project={project} /></p><p>Related ADRs: <References refs={file.relatedAdrs} project={project} /></p><p>Dependencies: <References refs={file.dependencies} project={project} /></p>
  </div>;
}
export function ProjectTaskPage() {
  const { id = "", taskId = "" } = useParams(); const q = useProjectTask(id,taskId);
  return <div className="space-y-6"><ProjectNav id={id} /><h1 className="text-2xl font-semibold">{taskId}: {q.data?.task.title ?? "Task detail"}</h1>
    {q.data ? <><SourceStatus meta={q.data} /><TaskSummary task={q.data.task} project={id} />
      <section className="space-y-3"><h2 className="text-lg font-semibold">Parsed files at head</h2>{q.data.task.files.map((f) => <ParsedFile key={f.file.path} file={f} project={id} />)}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Full event history on main</h2>{q.data.history.length ? q.data.history.map((e,i) => <article className="card space-y-2 p-4 text-sm" key={i}><h3>{e.kind} {e.state ?? ""}</h3><p><CommitFacts commit={e.commit} /></p><p>Paths: {e.paths.join(", ")}</p></article>) : <p>No events found.</p>}</section>
      <section className="space-y-3"><h2 className="text-lg font-semibold">Recorded fields at approval and acceptance</h2>{q.data.entries.map((entry,i) => <article key={i} className="space-y-3"><p>{entry.state}: <CommitFacts commit={entry.commit} /></p>{entry.files.map((f) => <ParsedFile key={f.file.path} file={f} project={id} />)}</article>)}</section>
      <FlagList flags={q.data.flags} project={id} />
      <section className="space-y-3"><h2 className="text-lg font-semibold">Rendered files at head</h2>{q.data.task.files.length ? q.data.task.files.map((f) => <RenderedFile key={`${f.file.path}-${q.data!.headSha}`} project={id} path={f.file.path} head={q.data!.headSha} />) : <p>No task file on main.</p>}</section>
    </> : q.isPending ? <Skeleton label="Loading task" /> : <LoadError error={q.error} notFound="Task not found." />}
    {q.data && q.error ? <LoadError error={q.error} notFound="Task not found." /> : null}
  </div>;
}
