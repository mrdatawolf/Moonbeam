import { identityInputSchema, type IdentitiesResponse, type IdentityInput } from "@moonbeam/shared";
import { useId, useState } from "react";
import { ApiRequestError } from "../api/client";
import { useConnectionLost } from "../api/connection";
import { useIdentities, useIdentityChange } from "../api/queries";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";
import { Field, LoadError, Refusal, Skeleton } from "./common";
import { Dialog } from "./Dialog";

const labels = { email: "Git e-mail", login: "GitHub login", alias: "Name alias" };
function MemberIdentities({ member }: { member: IdentitiesResponse["members"][number] }) {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const change = useIdentityChange();
  const id = useId();
  const [kind, setKind] = useState<IdentityInput["kind"]>("email");
  const [value, setValue] = useState("");
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [removing, setRemoving] = useState<{ id: string; value: string } | null>(null);
  const [notice, setNotice] = useState("");
  const blocked = !user || lost || change.isPending;
  return <section aria-labelledby={`${id}-heading`} className="space-y-3 border-t border-border pt-3">
    <h3 id={`${id}-heading`} className="font-medium">Identities for {member.displayName}{member.active ? "" : " (inactive)"}</h3>
    <ul className="space-y-2 text-sm">
      {member.identities.map((identity) => <li key={identity.id ?? `automatic-${identity.kind}`} className="flex flex-wrap items-center gap-2">
        <span>{labels[identity.kind]}: {identity.value}</span>
        {identity.automatic ? <span className="text-muted-foreground">Automatic from registry e-mail; change it using Edit user.</span> : <button className="btn-secondary" aria-label={`Remove ${identity.value} from ${member.displayName}`} aria-disabled={blocked} onClick={() => {
          if (!blocked && identity.id) { change.reset(); setRemoving({ id: identity.id, value: identity.value }); }
        }}>Remove identity</button>}
      </li>)}
    </ul>
    <form className="space-y-3" noValidate onSubmit={(e) => {
      e.preventDefault();
      if (blocked) return;
      const parsed = identityInputSchema.safeParse({ kind, value });
      if (!parsed.success) { setError(new ApiRequestError("validation", parsed.error.issues.map((i) => i.message).join("; "), null)); return; }
      setError(null);
      change.mutate({ kind: "add", userId: member.userId, body: parsed.data }, { onSuccess: () => { setValue(""); setNotice("Identity added."); } });
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`${id}-kind`} className="block text-sm font-medium">Identity kind for {member.displayName}</label>
          <select id={`${id}-kind`} className="field-input" value={kind} onChange={(e) => setKind(e.target.value as IdentityInput["kind"])}>
            {Object.entries(labels).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <Field label={`Identity value for ${member.displayName}`} required value={value} onChange={setValue} />
      </div>
      {!removing ? <Refusal error={error ?? change.error} /> : null}
      <button className="btn-primary" type="submit" aria-disabled={blocked}>Add identity for {member.displayName}</button>
    </form>
    {notice ? <p role="status">{notice}</p> : null}
    <Dialog open={!!removing} onClose={() => { if (!change.isPending) setRemoving(null); }} title={`Remove identity from ${member.displayName}?`} onSubmit={() => {
      if (!blocked && removing) change.mutate({ kind: "remove", id: removing.id }, { onSuccess: () => { setRemoving(null); setNotice("Identity removed. Past events use the current mapping."); } });
    }} footer={<>
      <button type="button" className="btn-secondary" disabled={change.isPending} onClick={() => setRemoving(null)}>Keep identity</button>
      <button type="submit" className="btn-danger" aria-disabled={blocked}>Confirm identity removal</button>
    </>}>
      <p>Remove {removing?.value}? Moonbeam's data is kept. Past events are attributed using the remaining identities.</p>
      <Refusal error={change.error} />
      {!user ? <button type="button" className="text-primary underline" onClick={focusUserPicker}>Choose who you are to take this action</button> : null}
    </Dialog>
  </section>;
}

export function Identities() {
  const identities = useIdentities();
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  return <section aria-labelledby="identities-heading" className="card space-y-4 p-4">
    <h2 id="identities-heading" className="text-base font-semibold">Member identities</h2>
    <p className="text-sm text-muted-foreground">Git e-mails and GitHub logins map commit authors. Name aliases map recorded names only. Changes re-attribute past events; inactive members still match. A match does not prove who acted.</p>
    {!user ? <button type="button" className="text-primary underline" onClick={focusUserPicker}>Choose who you are to take this action</button> : lost ? <p>Connection lost. Retrying.</p> : null}
    {identities.isPending ? <Skeleton label="Loading identities" /> : identities.isError ? <LoadError error={identities.error} notFound="Identities not found." /> : <>
      {identities.data.conflicts.length ? <div role="alert" className="rounded-control border border-tone-attention-border bg-tone-attention-bg p-3 text-sm text-tone-attention-fg">
        <p className="font-medium">Identity conflicts: these identities count as unmatched.</p>
        <ul>{identities.data.conflicts.map((conflict, i) => <li key={i}>{conflict.kind}: {conflict.value} — {conflict.members.map((m) => `${m.displayName}${m.inactive ? " (inactive)" : ""}`).join(", ")}</li>)}</ul>
      </div> : null}
      {identities.data.members.map((member) => <MemberIdentities key={member.userId} member={member} />)}
    </>}
  </section>;
}
