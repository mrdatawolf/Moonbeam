// T1 Propose a task. Title and desired outcome are required; the draft scope
// envelope and acceptance criteria may be incomplete, but approval needs at
// least one inclusion and one criterion. Proposals may be edited until approval.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConnectionLost } from "../api/connection";
import { useCreateTask, useProject } from "../api/queries";
import { Field, lines, Refusal } from "../components/common";
import { CHOOSE_USER, CONNECTION_LOST } from "../lib/actionPresentation";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";
import { pathProblems } from "../lib/paths";

export function ProposeTaskPage() {
  const { projectId = "" } = useParams();
  const project = useProject(projectId);
  const navigate = useNavigate();
  const create = useCreateTask(projectId);
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const [f, setF] = useState({ title: "", outcome: "", criteria: "", inclusions: "", exclusions: "", constraints: "", contracts: "", paths: "" });
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const reason = !user ? CHOOSE_USER : lost ? CONNECTION_LOST : null;
  const approvalGaps = [
    lines(f.inclusions).length === 0 && "at least one scope inclusion",
    lines(f.criteria).length === 0 && "at least one acceptance criterion",
  ].filter(Boolean);
  const badPaths = pathProblems(lines(f.paths));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-sm">
        <Link to={`/projects/${projectId}`} className="text-muted-foreground underline-offset-2 hover:underline">
          {project.data?.project.name ?? "Project"}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Propose a task</h1>
      <p className="text-sm text-muted-foreground">
        A proposed task is a plan. No work is authorized until a board member approves it. After approval its scope and paths are fixed.
      </p>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason) return;
          create.mutate(
            {
              title: f.title.trim(),
              desiredOutcome: f.outcome.trim(),
              acceptanceCriteria: lines(f.criteria),
              envelope: {
                inclusions: lines(f.inclusions),
                exclusions: lines(f.exclusions),
                constraints: lines(f.constraints),
                contracts: lines(f.contracts),
                paths: lines(f.paths),
              },
            },
            { onSuccess: (r) => navigate(`/tasks/${r.task.id}`) },
          );
        }}
      >
        <fieldset className="card space-y-3 p-4">
          <legend className="px-1 font-semibold">What and why</legend>
          <Field label="Title" required value={f.title} onChange={set("title")} autoFocus />
          <Field label="Desired outcome" required multiline value={f.outcome} onChange={set("outcome")} />
          <Field label="Acceptance criteria" hint="One per line." multiline value={f.criteria} onChange={set("criteria")} />
        </fieldset>
        <fieldset className="card space-y-3 p-4">
          <legend className="px-1 font-semibold">Scope envelope</legend>
          <Field label="Included" hint="One inclusion per line." multiline value={f.inclusions} onChange={set("inclusions")} />
          <Field label="Excluded" hint="One per line." multiline value={f.exclusions} onChange={set("exclusions")} />
          <Field label="Constraints" hint="One per line." multiline rows={2} value={f.constraints} onChange={set("constraints")} />
          <Field label="Linked contracts" hint="One per line, for example CONTRACT-005." multiline rows={2} mono value={f.contracts} onChange={set("contracts")} />
          <Field
            label="Paths"
            hint="The files and folders this task may change, one per line, relative to the repository root. No wildcards. Leave empty for a task that changes no files."
            multiline
            mono
            value={f.paths}
            onChange={set("paths")}
          />
          {badPaths.length ? (
            <ul className="list-disc pl-5 text-sm text-tone-attention-fg">
              {badPaths.map((p) => (
                <li key={p}>{p} The path must be fixed before proposing.</li>
              ))}
            </ul>
          ) : null}
        </fieldset>
        {approvalGaps.length ? (
          <p className="rounded-control border border-tone-attention-border bg-tone-attention-bg px-3 py-2 text-sm text-tone-attention-fg">
            To be approved, this task needs {approvalGaps.join(" and ")}. You can also add them by editing the proposal before approval.
          </p>
        ) : null}
        <Refusal error={create.error} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to={`/projects/${projectId}`} className="btn-secondary">
            Back to project
          </Link>
          <div className="flex items-center gap-3">
            {reason ? (
              reason === CHOOSE_USER ? (
                <button type="button" className="text-sm text-primary underline" onClick={focusUserPicker}>
                  {CHOOSE_USER}
                </button>
              ) : (
                <span className="text-sm text-muted-foreground">{reason}</span>
              )
            ) : null}
            <button type="submit" className="btn-primary" aria-disabled={!!reason || create.isPending}>
              {user ? `Propose as ${user.displayName}` : "Propose task"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
