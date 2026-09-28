import type { TaskDetail } from "@moonbeam/shared";
import { useState } from "react";
import { useConnectionLost } from "../api/connection";
import { useTaskAction } from "../api/queries";
import { browserAvailability } from "../lib/actionPresentation";
import { useCurrentUser } from "../lib/currentUser";
import { pathProblems } from "../lib/paths";
import { Dialog } from "./Dialog";
import { Field, Refusal } from "./common";

const lines = (value: string) => value.split("\n").map((s) => s.trim()).filter(Boolean);
const fields = (task: TaskDetail) => ({
  title: task.title, desiredOutcome: task.desiredOutcome,
  acceptanceCriteria: task.acceptanceCriteria.join("\n"),
  inclusions: task.envelope.inclusions.map((i) => i.text).join("\n"),
  exclusions: task.envelope.exclusions.join("\n"), constraints: task.envelope.constraints.join("\n"),
  contracts: task.envelope.contracts.join("\n"), paths: task.envelope.paths.join("\n"),
});

export function EditProposedTask({ task }: { task: TaskDetail }) {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const avail = browserAvailability(task.allowedActions.edit, { userId: user?.id ?? null, connectionLost: lost });
  const edit = useTaskAction(task.id, "edit");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => fields(task));
  const [saved, setSaved] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const problems = pathProblems(lines(form.paths));
  const valid = !!form.title.trim() && !!form.desiredOutcome.trim() && !problems.length;
  return <div className="space-y-2">
    <button type="button" className="btn-secondary" aria-disabled={!avail.enabled} title={avail.enabled ? undefined : avail.reason}
      onClick={() => { if (avail.enabled) { setForm(fields(task)); edit.reset(); setSaved(false); setOpen(true); } }}>
      Edit proposed task
    </button>
    {!avail.enabled ? <p className="text-sm text-muted-foreground">{avail.reason}</p> : null}
    {saved ? <p role="status">Proposal updated. The changes are recorded in its history.</p> : null}
    <Dialog open={open} onClose={() => setOpen(false)} title="Edit proposed task" onSubmit={() => {
      if (!avail.enabled || !valid || edit.isPending) return;
      edit.mutate({
        title: form.title, desiredOutcome: form.desiredOutcome, acceptanceCriteria: lines(form.acceptanceCriteria),
        envelope: { inclusions: lines(form.inclusions), exclusions: lines(form.exclusions), constraints: lines(form.constraints), contracts: lines(form.contracts), paths: lines(form.paths) },
      }, { onSuccess: () => { setOpen(false); setSaved(true); } });
    }} footer={<>
      <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Keep proposal</button>
      <button type="submit" className="btn-primary" aria-disabled={!avail.enabled || !valid || edit.isPending}>Save changes{user ? ` as ${user.displayName}` : ""}</button>
    </>}>
      <Field label="Title" required autoFocus value={form.title} onChange={set("title")} />
      <Field label="Desired outcome" required multiline value={form.desiredOutcome} onChange={set("desiredOutcome")} />
      <Field label="Acceptance criteria" hint="One per line." multiline value={form.acceptanceCriteria} onChange={set("acceptanceCriteria")} />
      <Field label="Included" hint="One per line." multiline value={form.inclusions} onChange={set("inclusions")} />
      <Field label="Excluded" multiline value={form.exclusions} onChange={set("exclusions")} />
      <Field label="Constraints" multiline value={form.constraints} onChange={set("constraints")} />
      <Field label="Linked contracts" multiline value={form.contracts} onChange={set("contracts")} />
      <Field label="Paths" hint="Plain repository-relative paths, one per line. Empty means no files may change." multiline value={form.paths} onChange={set("paths")} />
      {problems.map((p) => <p key={p} className="text-tone-attention-fg">{p}</p>)}
      {!avail.enabled ? <p>{avail.reason}</p> : null}
      <Refusal error={edit.error} />
    </Dialog>
  </div>;
}
