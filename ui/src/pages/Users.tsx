// User management (CONTRACT-002 "User registry" and "UX expectations"): add,
// edit, deactivate and reactivate users. Users are never deleted. Active users
// and inactive users are listed separately, ordered by display name, with
// their e-mail addresses.
//
// Every registry change is recorded with the acting human, so each one needs a
// selected user. A newcomer chooses any existing user in "Acting as", adds
// themselves here, then switches to themselves. The page offers that switch
// after adding someone but never makes it on its own.
import { userInputSchema, type User } from "@moonbeam/shared";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useConnectionLost } from "../api/connection";
import { useAllUsers, useUserChange } from "../api/queries";
import { EmptyState, Field, LoadError, Mono, Refusal, SectionHeading, Skeleton, Time } from "../components/common";
import { Dialog } from "../components/Dialog";
import { CHOOSE_USER, CONNECTION_LOST } from "../lib/actions";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";

/** Anchor of the add form; the header's "Add a user" link points here. */
export const ADD_USER_ANCHOR = "add-user";

export const LAST_ACTIVE_USER = "The last active user can't be deactivated. Add or reactivate someone else first.";

const byName = (a: User, b: User) => a.displayName.localeCompare(b.displayName);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

interface Errors {
  displayName: string | null;
  email: string | null;
}

/**
 * The CONTRACT-002 input rules, checked before sending so the person can fix
 * them in place: a display name, unique among active users (ignoring case and
 * surrounding whitespace), and a valid e-mail address. The server still
 * decides; its refusal is shown if it disagrees.
 */
export function checkUserInput(input: { displayName: string; email: string }, activeUsers: User[], exceptId?: string): Errors {
  const name = input.displayName.trim();
  const email = input.email.trim();
  const clash = name ? activeUsers.find((u) => u.id !== exceptId && sameName(u.displayName, name)) : undefined;
  return {
    displayName: !name ? "Enter a display name." : clash ? `An active user is already named "${clash.displayName}". Choose another name.` : null,
    email: !email ? "Enter an e-mail address." : userInputSchema.shape.email.safeParse(email).success ? null : "Enter a valid e-mail address, like name@example.com.",
  };
}

const hasErrors = (e: Errors) => !!(e.displayName || e.email);

/** Why registry changes can't be made right now, or null. */
function useChangeReason(): string | null {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  return !user ? CHOOSE_USER : lost ? CONNECTION_LOST : null;
}

function ChooseUserButton() {
  return (
    <button type="button" className="text-primary underline" onClick={focusUserPicker}>
      {CHOOSE_USER}
    </button>
  );
}

// ---- add ---------------------------------------------------------------------

function AddUser({ activeUsers, onAdded }: { activeUsers: User[]; onAdded: (u: User) => void }) {
  const { user } = useCurrentUser();
  const reason = useChangeReason();
  const change = useUserChange();
  const location = useLocation();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const errors = submitted ? checkUserInput({ displayName, email }, activeUsers) : { displayName: null, email: null };

  // Arriving from the header's "Add a user" link puts the cursor in the form.
  useEffect(() => {
    if (location.hash === `#${ADD_USER_ANCHOR}`) {
      document.getElementById(ADD_USER_ANCHOR)?.scrollIntoView?.({ block: "start" });
      nameRef.current?.focus();
    }
  }, [location.hash, location.key]);

  return (
    <section id={ADD_USER_ANCHOR} aria-labelledby="add-user-h" className="card scroll-mt-4 space-y-3 p-4">
      <SectionHeading id="add-user-h">Add a user</SectionHeading>
      <p className="text-sm text-muted-foreground">
        The new user is active straight away and can be chosen in "Acting as". Adding someone is recorded under the person who adds them.
      </p>
      {!user ? (
        <div id={noteId} className="rounded-control border border-tone-attention-border bg-tone-attention-bg px-3 py-2 text-sm text-tone-attention-fg">
          <p className="font-medium">Choose who you are first.</p>
          <p className="mt-0.5">
            New here? Choose any existing user in "Acting as", add yourself below, then switch to yourself.
          </p>
          <p className="mt-1">
            <ChooseUserButton />
          </p>
        </div>
      ) : null}
      <form
        className="space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (reason || change.isPending) return;
          setSubmitted(true);
          const errs = checkUserInput({ displayName, email }, activeUsers);
          if (errs.displayName) return nameRef.current?.focus();
          if (errs.email) return emailRef.current?.focus();
          change.mutate(
            { kind: "add", body: { displayName: displayName.trim(), email: email.trim() } },
            {
              onSuccess: (u) => {
                setDisplayName("");
                setEmail("");
                setSubmitted(false);
                onAdded(u);
              },
            },
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Display name" required value={displayName} onChange={setDisplayName} error={errors.displayName} inputRef={nameRef} autoComplete="off" />
          <Field
            label="E-mail address"
            hint="Used as the git author of the merges into main this person requests."
            type="email"
            required
            value={email}
            onChange={setEmail}
            error={errors.email}
            inputRef={emailRef}
            autoComplete="off"
          />
        </div>
        <Refusal error={change.error} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn-primary"
            aria-disabled={!!reason || change.isPending}
            aria-describedby={!user ? noteId : undefined}
          >
            {change.isPending ? "Adding…" : user ? `Add user as ${user.displayName}` : "Add user"}
          </button>
          {reason && reason !== CHOOSE_USER ? <p className="text-sm text-muted-foreground">{reason}</p> : null}
        </div>
      </form>
    </section>
  );
}

// ---- row actions and dialogs ----------------------------------------------

type Pending = { kind: "edit" | "deactivate" | "reactivate"; target: User; open: boolean } | null;

function RowButton({ label, target, reason, sharedReasonId, onClick, variant = "secondary" }: { label: string; target: User; reason: string | null; sharedReasonId?: string; onClick: () => void; variant?: "secondary" | "danger" }) {
  const reasonId = useId();
  // "Choose who you are" is explained once above the lists; other reasons are shown by the button.
  const shared = reason === CHOOSE_USER && sharedReasonId;
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <button
        type="button"
        className={`btn-${variant}`}
        aria-label={`${label} ${target.displayName}`}
        aria-disabled={!!reason}
        aria-describedby={reason ? (shared ? sharedReasonId : reasonId) : undefined}
        onClick={() => !reason && onClick()}
      >
        {label}
      </button>
      {reason && !shared ? (
        <p id={reasonId} className="max-w-xs text-xs text-muted-foreground">
          {reason}
        </p>
      ) : null}
    </div>
  );
}

function EditDialog({ open, target, activeUsers, onClose, onDone }: { open: boolean; target: User; activeUsers: User[]; onClose: () => void; onDone: (msg: string) => void }) {
  const { user } = useCurrentUser();
  const reason = useChangeReason();
  const change = useUserChange();
  const [displayName, setDisplayName] = useState(target.displayName);
  const [email, setEmail] = useState(target.email);
  const [submitted, setSubmitted] = useState(false);
  // An inactive user's name only has to be unique again when they are reactivated.
  const checked = checkUserInput({ displayName, email }, target.active ? activeUsers : [], target.id);
  const errors = submitted ? checked : { displayName: null, email: null };
  const body: { displayName?: string; email?: string } = {};
  if (displayName.trim() !== target.displayName) body.displayName = displayName.trim();
  if (email.trim() !== target.email) body.email = email.trim();
  const unchanged = Object.keys(body).length === 0;
  const blocked = reason ?? (unchanged ? "Change the name or e-mail address to save." : null);

  const submit = () => {
    if (blocked || change.isPending) return;
    setSubmitted(true);
    if (hasErrors(checked)) return;
    change.mutate(
      { kind: "edit", id: target.id, body },
      { onSuccess: (u) => onDone(`Saved ${u.displayName}. Past records now show the current name.`) },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit ${target.displayName}`}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Keep as is
          </button>
          <button type="submit" className="btn-primary" aria-disabled={!!blocked || change.isPending} aria-describedby={blocked ? "edit-user-blocked" : undefined}>
            {change.isPending ? "Saving…" : user ? `Save as ${user.displayName}` : "Save"}
          </button>
        </>
      }
    >
      {!target.active ? <p>{target.displayName} is inactive. Their name has to be unique among active users only when they are reactivated.</p> : null}
      <Field label="Display name" required value={displayName} onChange={setDisplayName} error={errors.displayName} autoFocus autoComplete="off" />
      <Field
        label="E-mail address"
        hint="Merges made from now on use the new address. Commits already made keep the name and address they were made with."
        type="email"
        required
        value={email}
        onChange={setEmail}
        error={errors.email}
        autoComplete="off"
      />
      <Refusal error={change.error} />
      {blocked ? (
        <p id="edit-user-blocked" className="text-xs text-muted-foreground">
          {blocked === CHOOSE_USER ? <ChooseUserButton /> : blocked}
        </p>
      ) : null}
    </Dialog>
  );
}

function SetActiveDialog({ open, kind, target, onClose, onDone }: { open: boolean; kind: "deactivate" | "reactivate"; target: User; onClose: () => void; onDone: (msg: string) => void }) {
  const { user } = useCurrentUser();
  const reason = useChangeReason();
  const change = useUserChange();
  const self = user?.id === target.id;
  const deactivate = kind === "deactivate";
  const submit = () => {
    if (reason || change.isPending) return;
    change.mutate(
      { kind, id: target.id },
      {
        onSuccess: (u) =>
          onDone(
            deactivate
              ? self
                ? `Deactivated ${u.displayName}. That was you, so choose who you are in "Acting as" before your next action.`
                : `Deactivated ${u.displayName}. They are listed under inactive users.`
              : `Reactivated ${u.displayName}. They can be chosen in "Acting as" again.`,
          ),
      },
    );
  };
  const verb = deactivate ? "Deactivate" : "Reactivate";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${verb} ${target.displayName}?`}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {deactivate ? "Keep active" : "Keep inactive"}
          </button>
          <button type="submit" className={deactivate ? "btn-danger" : "btn-primary"} aria-disabled={!!reason || change.isPending}>
            {change.isPending ? `${verb.slice(0, -1)}ing…` : user ? `${verb} as ${user.displayName}` : verb}
          </button>
        </>
      }
    >
      {deactivate ? (
        <>
          <ul className="list-disc space-y-1 pl-5">
            <li>{target.displayName} will no longer appear in "Acting as" and can't take actions.</li>
            <li>Past records keep showing their name, marked inactive.</li>
            <li>Any task they have claimed stays claimed by them. Any board member can break that claim.</li>
            <li>Users are never deleted. You can reactivate {target.displayName} later.</li>
          </ul>
          {self ? (
            <p className="rounded-control border border-tone-attention-border bg-tone-attention-bg px-3 py-2 text-tone-attention-fg">
              This is you. After deactivating, this browser has no active user, and you'll be asked to choose who you are.
            </p>
          ) : null}
        </>
      ) : (
        <p>
          {target.displayName} will be active again, appear in "Acting as", and can take actions. E-mail: <Mono>{target.email}</Mono>
        </p>
      )}
      <Refusal error={change.error} />
      {reason ? <p className="text-xs text-muted-foreground">{reason === CHOOSE_USER ? <ChooseUserButton /> : reason}</p> : null}
    </Dialog>
  );
}

// ---- lists ----------------------------------------------------------------------

function UserRow({ u, children, you }: { u: User; children: ReactNode; you: boolean }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium">
          {u.displayName}
          {you ? <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span> : null}
          {!u.active ? (
            <span className="ml-2 rounded-control border border-tone-neutral-border bg-tone-neutral-bg px-1.5 py-0.5 text-xs font-normal text-tone-neutral-fg">
              Inactive
            </span>
          ) : null}
        </p>
        <p>
          <Mono>{u.email}</Mono>
        </p>
        <p className="text-xs text-muted-foreground">
          {u.active ? "Added " : "Inactive since "}
          <Time iso={u.active ? u.createdAt : u.updatedAt} />
        </p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  );
}

export function UsersPage() {
  const users = useAllUsers();
  const { user } = useCurrentUser();
  const reason = useChangeReason();
  const [pending, setPending] = useState<Pending>(null);
  const [done, setDone] = useState<{ msg: string; switchTo?: User } | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const sharedReasonId = useId();
  const { select } = useCurrentUser();

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const all = users.data ?? [];
  const active = all.filter((u) => u.active).sort(byName);
  const inactive = all.filter((u) => !u.active).sort(byName);
  const close = () => setPending((p) => (p ? { ...p, open: false } : p));
  const finish = (msg: string) => {
    setPending(null);
    setDone({ msg });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every active user is a board member who approves and accepts work. Each e-mail address is used as the git author of the merges
        into main that person requests. Users are never deleted: deactivate someone who should no longer act.
      </p>

      {done ? (
        <div ref={doneRef} tabIndex={-1} role="status" className="rounded-control border border-tone-success-border bg-tone-success-bg px-3 py-2 text-sm text-tone-success-fg">
          <p>{done.msg}</p>
          {done.switchTo && user?.id !== done.switchTo.id ? (
            <button type="button" className="btn-secondary mt-2" onClick={() => {
              select(done.switchTo!.id);
              setDone({ msg: `You are now acting as ${done.switchTo!.displayName}.` });
            }}>
              Switch to {done.switchTo.displayName}
            </button>
          ) : null}
        </div>
      ) : null}

      <AddUser activeUsers={active} onAdded={(u) => setDone({ msg: `Added ${u.displayName}. They can now be chosen in "Acting as".`, switchTo: u })} />

      {users.isPending ? (
        <Skeleton lines={3} label="Loading users" />
      ) : users.isError ? (
        <LoadError error={users.error} notFound="" />
      ) : (
        <>
          {reason === CHOOSE_USER ? (
            <p id={sharedReasonId} className="text-sm text-muted-foreground">
              To edit, deactivate or reactivate users, <ChooseUserButton />.
            </p>
          ) : reason ? (
            <p className="text-sm text-muted-foreground">{reason}</p>
          ) : null}

          <section aria-labelledby="active-users-h" className="card p-4">
            <SectionHeading id="active-users-h" count={active.length}>
              Active users
            </SectionHeading>
            <ul className="mt-1">
              {active.map((u) => (
                <UserRow key={u.id} u={u} you={user?.id === u.id}>
                  <RowButton label="Edit" target={u} reason={reason} sharedReasonId={sharedReasonId} onClick={() => setPending({ kind: "edit", target: u, open: true })} />
                  <RowButton
                    label="Deactivate"
                    target={u}
                    reason={reason ?? (active.length <= 1 ? LAST_ACTIVE_USER : null)}
                    sharedReasonId={sharedReasonId}
                    onClick={() => setPending({ kind: "deactivate", target: u, open: true })}
                  />
                </UserRow>
              ))}
            </ul>
          </section>

          <section aria-labelledby="inactive-users-h" className="card p-4">
            <SectionHeading id="inactive-users-h" count={inactive.length}>
              Inactive users
            </SectionHeading>
            <p className="mt-1 text-sm text-muted-foreground">Not shown in "Acting as" and can't take actions. Past records still name them.</p>
            {inactive.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="No inactive users." />
              </div>
            ) : (
              <ul className="mt-1">
                {inactive.map((u) => {
                  const clash = active.find((a) => sameName(a.displayName, u.displayName));
                  const clashReason = clash ? `An active user is already named "${clash.displayName}". Rename ${u.displayName} with Edit, then reactivate.` : null;
                  return (
                    <UserRow key={u.id} u={u} you={false}>
                      <RowButton label="Edit" target={u} reason={reason} sharedReasonId={sharedReasonId} onClick={() => setPending({ kind: "edit", target: u, open: true })} />
                      <RowButton
                        label="Reactivate"
                        target={u}
                        reason={reason ?? clashReason}
                        sharedReasonId={sharedReasonId}
                        onClick={() => setPending({ kind: "reactivate", target: u, open: true })}
                      />
                    </UserRow>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Closing keeps the dialog mounted, so focus returns to its trigger and entered text survives reopening. */}
      {pending?.kind === "edit" ? (
        <EditDialog key={pending.target.id} open={pending.open} target={pending.target} activeUsers={active} onClose={close} onDone={finish} />
      ) : pending ? (
        <SetActiveDialog key={`${pending.kind}-${pending.target.id}`} open={pending.open} kind={pending.kind} target={pending.target} onClose={close} onDone={finish} />
      ) : null}
    </div>
  );
}
