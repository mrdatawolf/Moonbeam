import type { ProjectViewResponse } from "@moonbeam/shared";
import { useState } from "react";
import { useAllUsers, useFlagDetail, useFlagNote } from "../api/queries";
import { useConnectionLost } from "../api/connection";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";
import { AttributionText } from "../pages/Project";
import { Dialog } from "./Dialog";
import { EmptyState, Field, Refusal, Skeleton, Time } from "./common";
import { ExternalLink } from "./Markdown";
type Flag = ProjectViewResponse["flags"][number];
// Evidence can name multiple historical commits (including a rewritten head).
function evidenceCommits(flag: Flag): string[] {
  const shas = new Set<string>();
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (["sha", "commitSha", "entryCommitSha", "head", "previousHead", "newHead"].includes(key) && typeof item === "string" && /^[a-f0-9]{40}$/i.test(item)) shas.add(item);
      visit(item);
    }
  }
  visit(flag.evidence);
  return [...shas].filter((sha) => sha !== flag.commitSha);
}
function repositoryUrl(flag: Flag): string | null {
  const url = flag.commitUrl ?? flag.files.find((f) => f.githubUrl)?.githubUrl;
  return url?.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\//)?.[1] ?? null;
}
export function FlagDetail({ flag, project }: { flag: Flag; project: string }) {
  const detail = useFlagDetail(project, flag.id); const members = useAllUsers();
  const mutation = useFlagNote(project, flag.id); const { user } = useCurrentUser(); const lost = useConnectionLost();
  const [action, setAction] = useState<"dismiss" | "reopen" | null>(null); const [note, setNote] = useState("");
  const status = detail.data?.status ?? flag.status;
  const blocked = !user || lost || mutation.isPending;
  const submit = () => { if (!blocked && action && note.trim()) mutation.mutate({ action, note: note.trim() }, { onSuccess: () => { setAction(null); setNote(""); } }); };
  return <div className="space-y-3"><h4 className="font-semibold">Evidence</h4><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(flag.evidence, null, 2)}</pre>
    {flag.attributions.map((a, i) => <p key={i}>{a.location}: <AttributionText value={a.attribution} /></p>)}
    {flag.rule === "FL-7" && flag.evidence.reason === "not_v1" ? <p>not DbC task v1</p> : null}
    {repositoryUrl(flag) ? evidenceCommits(flag).map((sha) => <p key={sha}><ExternalLink href={`${repositoryUrl(flag)}/commit/${sha}`}>Commit {sha} on GitHub</ExternalLink></p>) : null}
    <ExternalLink href={flag.commitUrl}>{flag.commitSha ? `Commit ${flag.commitSha} on GitHub` : null}</ExternalLink>
    {flag.files.map((f) => <p key={`${f.path}-${f.headSha}`}><ExternalLink href={f.githubUrl}>{f.path} on GitHub</ExternalLink></p>)}
    <h4 className="font-semibold">Notes and status history</h4>
    {detail.isPending ? <Skeleton label="Loading flag history" /> : null}<Refusal error={detail.error} />
    {detail.data?.history.map((h) => <p key={h.id}>{h.action}: {h.fromState ?? "new"} → {h.toState} · <Time iso={h.occurredAt} /> · {h.actorKind === "system" ? "Moonbeam poller" : members.data?.find((u) => u.id === h.actorUserId)?.displayName ?? h.actorUserId} {h.note ? `· ${h.note}` : ""}</p>)}
    {!detail.data ? flag.notes.map((n,i) => <p key={i}>{n.note} · {n.actorUserId} · <Time iso={n.occurredAt} /></p>) : null}
    <p>Dismissal and reopening record a note in Moonbeam.</p>
    {!user ? <button className="text-primary underline" onClick={focusUserPicker}>Choose who you are to take this action</button> : null}
    {status === "open" || status === "dismissed" ? <button className="btn-secondary" aria-disabled={blocked} onClick={() => { if (!blocked) { mutation.reset(); setAction(status === "open" ? "dismiss" : "reopen"); } }}>{status === "open" ? "Dismiss flag" : "Reopen flag"}</button> : null}
    <Dialog open={action !== null} onClose={() => { if (!mutation.isPending) setAction(null); }} title={action === "dismiss" ? "Dismiss flag in Moonbeam" : "Reopen flag in Moonbeam"} onSubmit={submit} footer={<><button type="button" className="btn-secondary" disabled={mutation.isPending} onClick={() => setAction(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={blocked || !note.trim()}>Save note in Moonbeam</button></>}>
      <Field label="Note" required multiline value={note} onChange={setNote} /><Refusal error={mutation.error} />
      {!user ? <p>Choose who you are to save this note.</p> : null}
    </Dialog>
  </div>;
}
export function FlagList({ flags, project }: { flags: Flag[]; project: string }) {
  return <section aria-label="Flags" className="space-y-3"><h2 className="text-lg font-semibold">Flags</h2><p>Observations from main. Notes are kept in Moonbeam.</p>{flags.length ? [...flags].sort((a,b) => Number(b.status === "open") - Number(a.status === "open")).map((f) => <article key={f.id} className="card space-y-3 p-4 text-sm"><h3 className="font-semibold">{f.rule}: {f.ruleName} · {f.status}</h3><p>Subject: {JSON.stringify(f.subject)}</p><p>First raised: <Time iso={f.firstRaisedAt} /></p><FlagDetail flag={f} project={project} /></article>) : <EmptyState title="No flags." />}</section>;
}
