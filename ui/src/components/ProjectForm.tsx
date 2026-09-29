import { projectRegistrationInputSchema, projectUpdateInputSchema, type ProjectView } from "@moonbeam/shared";
import { useId, useState } from "react";
import { ApiRequestError } from "../api/client";
import { useConnectionLost } from "../api/connection";
import { useAllUsers, useGitHubTokens, useProjectChange } from "../api/queries";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";
import { Field, Refusal } from "./common";

export function ProjectForm({ project, onDone }: { project?: ProjectView; onDone: () => void }) {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const tokens = useGitHubTokens();
  const users = useAllUsers();
  const change = useProjectChange();
  const id = useId();
  const [owner, setOwner] = useState(project?.githubOwner ?? "");
  const [repo, setRepo] = useState(project?.githubRepo ?? "");
  const [name, setName] = useState(project?.name ?? "");
  const [branch, setBranch] = useState(project?.trackedBranch ?? "main");
  const [token, setToken] = useState(project?.tokenLabel ?? "");
  const [baseline, setBaseline] = useState(project?.baselineSha ?? "");
  const [paths, setPaths] = useState(project?.exemptPaths.join("\n") ?? "");
  const [threshold, setThreshold] = useState(String(project?.staleThresholdDays ?? 14));
  const [lead, setLead] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const blocked = !user || lost || change.isPending;
  function ownerChanged(value: string) {
    // Accept a repository URL without contacting GitHub from the browser.
    const match = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(value.trim());
    if (match) { setOwner(match[1]!); setRepo(match[2]!.replace(/\.git$/, "")); }
    else setOwner(value);
  }
  return <form className="space-y-3" noValidate onSubmit={(event) => {
    event.preventDefault();
    if (blocked) return;
    const url = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(owner.trim());
    const resolvedOwner = url?.[1] ?? owner;
    const resolvedRepo = url ? url[2]!.replace(/\.git$/, "") : repo;
    const fields = { owner: resolvedOwner, repo: resolvedRepo, name: project ? name : name.trim() || undefined, trackedBranch: branch, tokenLabel: token || (project ? resolvedOwner.trim() : undefined),
      baselineSha: project ? baseline.trim() : baseline.trim() || undefined, exemptPaths: paths.split("\n").map((p) => p.trim()).filter(Boolean), staleThresholdDays: Number(threshold) };
    if (project) {
      // Send only changed fields. In particular, a branch edit without a new baseline lets the API choose its new head.
      const original = { owner: project.githubOwner, repo: project.githubRepo, name: project.name, trackedBranch: project.trackedBranch, tokenLabel: project.tokenLabel, baselineSha: project.baselineSha, exemptPaths: project.exemptPaths, staleThresholdDays: project.staleThresholdDays };
      const body = Object.fromEntries(Object.entries(fields).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(original[key as keyof typeof original])));
      const parsed = projectUpdateInputSchema.safeParse(body);
      if (!parsed.success) { setError(new ApiRequestError("validation", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), null)); return; }
      setError(null);
      change.mutate({ kind: "edit", id: project.id, body: parsed.data }, { onSuccess: onDone });
    } else {
      const parsed = projectRegistrationInputSchema.safeParse({ ...fields, leadDeveloperUserId: lead || null });
      if (!parsed.success) { setError(new ApiRequestError("validation", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), null)); return; }
      setError(null);
      change.mutate({ kind: "register", body: parsed.data }, { onSuccess: onDone });
    }
  }}>
    <div className="grid gap-3 sm:grid-cols-2">
      <div onBlur={() => ownerChanged(owner)}><Field label="GitHub owner or repository URL" required value={owner} onChange={setOwner} hint="Paste https://github.com/owner/repository to fill both fields." /></div>
      <Field label="Repository" required value={repo} onChange={setRepo} />
      <Field label="Project name" value={name} onChange={setName} hint={project ? undefined : "Optional; defaults to owner/repository."} />
      <Field label="Tracked branch" required value={branch} onChange={setBranch} />
    </div>
    <div className="space-y-1">
      <label htmlFor={`${id}-token`} className="block text-sm font-medium">Token label</label>
      <select id={`${id}-token`} className="field-input" value={token} onChange={(e) => setToken(e.target.value)}>
        <option value="">Use owner label (default)</option>
        {project && !tokens.data?.tokens.some((t) => t.label === project.tokenLabel) ? <option value={project.tokenLabel}>{project.tokenLabel} (currently configured label unavailable)</option> : null}
        {tokens.data?.tokens.map((t) => <option key={t.label} value={t.label}>{t.label} — {t.masked}</option>)}
      </select>
      <p className="text-xs text-muted-foreground">Tokens are configured by the operator. Only labels and masked values are shown.</p>
      {tokens.isPending ? <p role="status">Loading token labels…</p> : tokens.error ? <Refusal error={tokens.error} /> : tokens.data.state !== "ok" ? <p role="status">Token configuration is {tokens.data.state}. Ask the operator to configure it.</p> : !tokens.data.tokens.length ? <p role="status">No token labels configured.</p> : null}
    </div>
    {!project ? <div className="space-y-1">
      <label htmlFor={`${id}-lead`} className="block text-sm font-medium">Lead developer</label>
      <select id={`${id}-lead`} className="field-input" value={lead} onChange={(e) => setLead(e.target.value)}>
        <option value="">No lead developer</option>
        {users.data?.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
      </select>
      <Refusal error={users.error} />
    </div> : null}
    <Field label="Baseline commit SHA" value={baseline} onChange={setBaseline} hint={project ? "Changing the branch without changing this SHA uses the new branch head as baseline." : "Optional; default: head at registration."} />
    <Field label="Exempt paths" value={paths} onChange={setPaths} multiline hint="Optional; one path per line. Default: none." />
    <Field label="Staleness threshold (days)" value={threshold} onChange={setThreshold} type="number" hint="Default: 14 days." />
    <Refusal error={error ?? change.error} />
    {!user ? <button type="button" className="text-primary underline" onClick={focusUserPicker}>Choose who you are to take this action</button> : lost ? <p>Connection lost. Retrying.</p> : null}
    <button type="submit" className="btn-primary" aria-disabled={blocked}>{change.isPending ? "Saving…" : project ? "Save registration" : "Register project"}</button>
  </form>;
}
