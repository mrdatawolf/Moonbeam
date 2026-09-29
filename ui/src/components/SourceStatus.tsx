import type { ProjectViewResponse } from "@moonbeam/shared";
import { Link } from "react-router";
import { useProjectRefresh } from "../api/queries";
import { Refusal, Time } from "./common";
import { ExternalLink } from "./Markdown";
type Meta = Pick<ProjectViewResponse, "projectId" | "headSha" | "lastSuccessfulPollAt" | "notCurrent" | "readState" | "source">;
export function SourceStatus({ meta }: { meta: Meta }) {
  const refresh = useProjectRefresh(meta.projectId);
  const source = meta.source;
  return <section aria-label="Source status" className="card space-y-2 p-4 text-sm">
    <h2 className="font-semibold">Source status</h2>
    <p>Head commit: <span className="font-mono break-all">{meta.headSha ?? "Not yet read"}</span></p>
    <p>Last successful poll: {meta.lastSuccessfulPollAt ? <Time iso={meta.lastSuccessfulPollAt} /> : "Never"}</p>
    <p>Unpushed work is invisible. This view reflects the last successful poll.</p>
    {meta.notCurrent ? <p role="status" className="text-tone-attention-fg">Data is not current. {meta.headSha ? "Showing last known state." : meta.readState}</p> : null}
    <p>{source?.message ?? meta.readState}</p>
    {source ? <><p>Status: {source.status} · Since <Time iso={source.statusSince} /></p>
      {source.lastAttemptAt ? <p>Last attempt: <Time iso={source.lastAttemptAt} /></p> : null}
      {source.rateLimitedUntil ? <p>Rate limited until {source.rateLimitedUntil}</p> : null}
      {source.redirectedFullName ? <p>Now at {source.redirectedFullName}; update the registration.</p> : null}
      {source.tokenWriteScopes ? <p>Warning: GitHub reports write scopes for the configured token.</p> : null}
      {source.baselineNeedsReset ? <p>The baseline needs to be reset in the registration.</p> : null}</> : null}
    <button className="btn-secondary" disabled={refresh.isPending} onClick={() => refresh.mutate()}>{refresh.isPending ? "Refreshing…" : "Refresh project"}</button>
    {refresh.isSuccess ? <p role="status">Refresh finished. {refresh.data.message}</p> : null}<Refusal error={refresh.error} />
  </section>;
}
export function ProjectNav({ id }: { id: string }) {
  return <nav aria-label="Project" className="flex flex-wrap gap-4 text-primary underline"><Link to="/projects">Projects</Link><Link to={`/projects/${id}`}>Project overview</Link><Link to={`/projects/${id}/documents`}>Documents</Link></nav>;
}
export function FileLink({ path, githubUrl, headSha }: { path: string; githubUrl: string | null; headSha: string | null }) {
  return <p className="text-sm break-all"><ExternalLink href={githubUrl}>{path} on GitHub</ExternalLink> · Head commit: {headSha ?? "Unknown"}</p>;
}
