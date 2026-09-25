// The human actions on a task (CONTRACT-001 T2, T3, T4, T6, T9, T10, T15, C1;
// CONTRACT-003 A-1, A-2, A-3, A-5). Every action stays visible; unavailable
// ones are disabled with the reason. Each one names the acting user, is sent
// to the server, shows its refusal category in place and keeps entered text,
// and moves focus to the result message on success.
import type { TaskDetail } from "@moonbeam/shared";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiRequestError } from "../api/client";
import { useConnectionLost } from "../api/connection";
import { useProjects, useTaskAction } from "../api/queries";
import { availability, CHOOSE_USER, needsReviewWaiver, releaseMode, type Availability } from "../lib/actions";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";
import { latestHandoff, REVIEW_VERDICT, reviewsOfLatestAttempt, WARNING } from "../lib/status";
import { Dialog } from "./Dialog";
import { Field, Mono, Refusal } from "./common";
import { StatusBadge } from "./StatusBadge";

type DialogKey = "approve" | "break" | "handoff" | "accept" | "return" | "cancel" | "blocker" | null;

function ActionButton({ label, avail, onClick, variant = "secondary", pending }: { label: string; avail: Availability; onClick: () => void; variant?: "primary" | "secondary" | "danger"; pending?: boolean }) {
  const reasonId = useId();
  const disabled = !avail.enabled || !!pending;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        className={`btn-${variant} self-start`}
        aria-disabled={disabled}
        aria-describedby={!avail.enabled ? reasonId : undefined}
        onClick={() => !disabled && onClick()}
      >
        {pending ? `${label}…` : label}
      </button>
      {!avail.enabled ? (
        <p id={reasonId} className="max-w-xs text-xs text-muted-foreground">
          {avail.reason === CHOOSE_USER ? (
            <button type="button" className="text-primary underline" onClick={focusUserPicker}>
              {CHOOSE_USER}
            </button>
          ) : (
            avail.reason
          )}
        </p>
      ) : null}
    </div>
  );
}

const trivial = (s: string) => /^\s*(none|n\/a|na|nothing|-)\.?\s*$/i.test(s);

/** Warnings shown in the accept confirmation (CONTRACT-003 A-1); they never block accepting. */
function acceptWarnings(task: TaskDetail): ReactNode[] {
  const out: ReactNode[] = [];
  for (const r of reviewsOfLatestAttempt(task)) {
    if (r.verdict !== "pass") out.push(<>Agent review verdict: <StatusBadge status={REVIEW_VERDICT[r.verdict]} compact /></>);
    if (r.sameModel) out.push(<>The reviewer used the same model as the implementer <StatusBadge status={WARNING.sameModel} compact /></>);
  }
  const h = latestHandoff(task);
  if (h && !trivial(h.record.deviations)) out.push(<>Handoff deviations: {h.record.deviations}</>);
  if (h && !trivial(h.record.risks)) out.push(<>Handoff risks: {h.record.risks}</>);
  return out;
}

export function TaskActions({ task }: { task: TaskDetail }) {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const ctx = { userId: user?.id ?? null, connectionLost: lost };
  const av = (k: Parameters<typeof availability>[1]) => availability(task, k, ctx);
  const projects = useProjects();
  const mainBranch = projects.data?.find((p) => p.id === task.projectId)?.mainBranch ?? "main";

  const [dialog, setDialog] = useState<DialogKey>(null);
  const [done, setDone] = useState<string | null>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const approve = useTaskAction(task.id, "approve");
  const claim = useTaskAction(task.id, "claim");
  const release = useTaskAction(task.id, "release");
  const handoff = useTaskAction(task.id, "handoff");
  const accept = useTaskAction(task.id, "accept");
  const ret = useTaskAction(task.id, "return");
  const cancel = useTaskAction(task.id, "cancel");
  const blocker = useTaskAction(task.id, "blockers");

  // Entered text survives closing a dialog; it is cleared on success.
  const [breakReason, setBreakReason] = useState("");
  const [ho, setHo] = useState({ changes: "", validation: "", deviations: "", risks: "" });
  const [waiver, setWaiver] = useState("");
  const [oosReason, setOosReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [anywayReason, setAnywayReason] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [bl, setBl] = useState({ whatIsNeeded: "", whoCanResolve: "", effect: "" });

  const finish = (msg: string) => {
    setDialog(null);
    setDone(msg);
  };
  const open = (k: DialogKey, m?: { reset: () => void }) => {
    m?.reset();
    setDone(null);
    setDialog(k);
  };
  const as = user ? ` as ${user.displayName}` : "";
  const actingLine = user ? <p className="text-muted-foreground">Acting as {user.displayName}.</p> : null;

  const mode = releaseMode(task, ctx.userId);
  const waiverNeeded = needsReviewWaiver(task);
  const warnings = acceptWarnings(task);
  const acceptErr = accept.error instanceof ApiRequestError ? accept.error : null;
  const knownConflict = acceptErr?.category === "merge_conflict";
  const conflictFiles = knownConflict ? ((acceptErr?.details as { conflictingFiles?: string[] } | undefined)?.conflictingFiles ?? []) : [];
  const [oosFiles, setOosFiles] = useState<string[] | null>(null);
  useEffect(() => {
    const files = (acceptErr?.details as { outOfScopeFiles?: string[] } | undefined)?.outOfScopeFiles;
    if (acceptErr?.category === "validation" && files) setOosFiles(files);
  }, [acceptErr]);
  const noPaths = task.envelope.paths.length === 0;

  const acceptReady =
    (!waiverNeeded || waiver.trim() !== "") && (warnings.length === 0 || confirmed) && (!oosFiles || oosReason.trim() !== "");
  const submitAccept = (anyway: boolean) => {
    if (!acceptReady) return;
    accept.mutate(
      {
        ...(waiverNeeded ? { waiveReviewReason: waiver.trim() } : {}),
        ...(oosFiles ? { outOfScopeReason: oosReason.trim() } : {}),
        warningsConfirmed: warnings.length > 0 && confirmed,
        ...(anyway ? { acceptAnyway: true, ...(anywayReason.trim() ? { acceptAnywayReason: anywayReason.trim() } : {}) } : {}),
      },
      {
        onSuccess: () => {
          setWaiver("");
          setOosReason("");
          setConfirmed(false);
          setAnywayReason("");
          setOosFiles(null);
          finish(anyway ? "Accepted anyway. The override is recorded with your name. Merging is a separate step." : "Accepted. Merging into main is a separate step.");
        },
      },
    );
  };

  const directError = claim.error ?? (mode === "release" ? release.error : null);

  return (
    <section aria-labelledby="actions-h" className="card space-y-4 p-4">
      <h2 id="actions-h" className="text-base font-semibold">
        Actions
      </h2>
      {done ? (
        <p ref={doneRef} tabIndex={-1} role="status" className="rounded-control border border-tone-success-border bg-tone-success-bg px-3 py-2 text-sm text-tone-success-fg">
          {done}
        </p>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Decide</h3>
        <div className="flex flex-wrap gap-3">
          <ActionButton label="Approve" variant="primary" avail={av("approve")} onClick={() => open("approve", approve)} />
          <ActionButton label={waiverNeeded ? "Accept without review" : "Accept"} variant="primary" avail={av("accept")} onClick={() => open("accept", accept)} />
          <ActionButton label="Return" avail={av("return")} onClick={() => open("return", ret)} />
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Work</h3>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="Claim"
            avail={av("claim")}
            pending={claim.isPending}
            onClick={() => {
              release.reset();
              setDone(null);
              claim.mutate({}, { onSuccess: () => finish(`Claimed by ${user?.displayName ?? "you"}. The claim does not expire; release it when you stop.`) });
            }}
          />
          {mode === "release" ? (
            <ActionButton
              label="Release claim"
              avail={av("release")}
              pending={release.isPending}
              onClick={() => {
                claim.reset();
                setDone(null);
                release.mutate({}, { onSuccess: () => finish("Claim released. The task is Approved and anyone may claim it.") })
              }}
            />
          ) : (
            <ActionButton label="Break claim" avail={av("release")} onClick={() => open("break", release)} />
          )}
          <ActionButton label="Hand off" avail={av("handoff")} onClick={() => open("handoff", handoff)} />
        </div>
        <Refusal error={directError} />
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Other</h3>
        <div className="flex flex-wrap gap-3">
          <ActionButton label="Add blocker" avail={av("addBlocker")} onClick={() => open("blocker", blocker)} />
          <ActionButton label="Cancel task" variant="danger" avail={av("cancel")} onClick={() => open("cancel", cancel)} />
        </div>
      </div>

      {/* T2 Approve */}
      <Dialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title={`Approve #${task.number} ${task.title}`}
        onSubmit={() => approve.mutate({}, { onSuccess: () => finish("Approved. The task joined the end of the project queue.") })}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Not now
            </button>
            <button type="submit" className="btn-primary" aria-disabled={approve.isPending}>
              Approve{as}
            </button>
          </>
        }
      >
        <p>Approving authorizes the work. The task joins the end of the project queue, and its scope envelope and paths are fixed from now on.</p>
        {noPaths ? (
          <p className="rounded-control border border-tone-attention-border bg-tone-attention-bg px-3 py-2 text-tone-attention-fg">
            This task declares no paths. It will be approved as a task that changes no files. Any file it changes will need a written reason at acceptance.
          </p>
        ) : (
          <p>
            Paths: <Mono>{task.envelope.paths.join(", ")}</Mono>
          </p>
        )}
        {actingLine}
        <Refusal error={approve.error} />
      </Dialog>

      {/* T4 Break claim */}
      <Dialog
        open={dialog === "break"}
        onClose={() => setDialog(null)}
        title={`Break the claim on #${task.number}`}
        onSubmit={() => breakReason.trim() && release.mutate({ reason: breakReason.trim() }, { onSuccess: () => { setBreakReason(""); finish("Claim broken. The task is Approved and anyone may claim it."); } })}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Keep claim
            </button>
            <button type="submit" className="btn-danger" aria-disabled={!breakReason.trim() || release.isPending}>
              Break claim
            </button>
          </>
        }
      >
        <p>
          {task.claim?.claimantKind === "agent" ? "An agent run" : task.claim?.displayName ?? "Someone"} holds this task. Breaking the claim returns the task to
          Approved; work already done stays attached to the task. {task.claim?.claimantKind === "agent" ? "Moonbeam asks the run to stop." : ""}
        </p>
        <Field label="Reason" required multiline value={breakReason} onChange={setBreakReason} autoFocus />
        {actingLine}
        <Refusal error={release.error} />
      </Dialog>

      {/* T6 Hand off */}
      <Dialog
        open={dialog === "handoff"}
        onClose={() => setDialog(null)}
        title={`Hand off #${task.number}`}
        onSubmit={() => {
          if (Object.values(ho).some((v) => !v.trim())) return;
          handoff.mutate(
            { record: { changes: ho.changes.trim(), validation: ho.validation.trim(), deviations: ho.deviations.trim(), risks: ho.risks.trim() } },
            { onSuccess: () => { setHo({ changes: "", validation: "", deviations: "", risks: "" }); finish("Handed off. The task is In review and awaits an agent review and a board decision."); } },
          );
        }}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Keep working
            </button>
            <button type="submit" className="btn-primary" aria-disabled={Object.values(ho).some((v) => !v.trim()) || handoff.isPending}>
              Hand off
            </button>
          </>
        }
      >
        <p>The handoff ends your claim and puts the task In review. Write "None" where there is nothing to report.</p>
        <Field label="What changed" required multiline value={ho.changes} onChange={(v) => setHo((x) => ({ ...x, changes: v }))} autoFocus />
        <Field label="What was validated" required multiline value={ho.validation} onChange={(v) => setHo((x) => ({ ...x, validation: v }))} />
        <Field label="Deviations" required multiline rows={2} value={ho.deviations} onChange={(v) => setHo((x) => ({ ...x, deviations: v }))} />
        <Field label="Risks" required multiline rows={2} value={ho.risks} onChange={(v) => setHo((x) => ({ ...x, risks: v }))} />
        {actingLine}
        <Refusal error={handoff.error} />
      </Dialog>

      {/* T9 Accept (A-1, A-2) */}
      <Dialog
        open={dialog === "accept"}
        onClose={() => setDialog(null)}
        title={waiverNeeded ? "Accept without an agent review" : `Accept #${task.number} ${task.title}`}
        onSubmit={() => submitAccept(knownConflict)}
        footer={
          knownConflict ? (
            <>
              <button type="button" className="btn-secondary" onClick={() => open("return", ret)}>
                Return task instead
              </button>
              <button type="submit" className="btn-danger" aria-disabled={!acceptReady || accept.isPending}>
                Accept anyway
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
                Not now
              </button>
              <button type="submit" className="btn-primary" aria-disabled={!acceptReady || accept.isPending}>
                Accept
              </button>
            </>
          )
        }
      >
        <p>
          Accept #{task.number}. This records your decision. It does not merge: merging into <Mono>{mainBranch}</Mono> is a separate step on the completed task.
        </p>
        {waiverNeeded ? (
          <>
            <p>This task has no agent review for its latest handoff. Accepting without one needs a reason, which is shown in the task's history.</p>
            <Field label="Reason for accepting without a review" required multiline value={waiver} onChange={setWaiver} autoFocus />
          </>
        ) : null}
        {knownConflict ? (
          <div className="space-y-2 rounded-control border border-tone-danger-border bg-tone-danger-bg px-3 py-2 text-tone-danger-fg">
            <p>
              This task's branch conflicts with <Mono>{mainBranch}</Mono>
              {conflictFiles.length ? (
                <>
                  {" "}in <Mono>{conflictFiles.join(", ")}</Mono>
                </>
              ) : null}
              . Accepting is refused by default. Return resolves the conflict on the branch.
            </p>
            <p>Accept anyway: a merge requested later will be refused until the conflict is resolved. This override is recorded with your name.</p>
            <Field label="Reason for accepting anyway (optional)" multiline rows={2} value={anywayReason} onChange={setAnywayReason} />
          </div>
        ) : null}
        {oosFiles ? (
          <div className="space-y-2">
            <p>
              {oosFiles.length} {oosFiles.length === 1 ? "file" : "files"} outside the declared paths: <Mono>{oosFiles.join(", ")}</Mono>
            </p>
            <Field label="Reason for accepting out-of-scope files" required multiline value={oosReason} onChange={setOosReason} />
          </div>
        ) : null}
        {warnings.length ? (
          <div className="space-y-2">
            <p className="font-medium">Warnings (they don't block accepting)</p>
            <ul className="list-disc space-y-1 pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              I've reviewed these
            </label>
          </div>
        ) : null}
        {actingLine}
        {knownConflict ? null : <Refusal error={accept.error} />}
      </Dialog>

      {/* T10 Return (A-3) */}
      <Dialog
        open={dialog === "return"}
        onClose={() => setDialog(null)}
        title={`Return #${task.number} ${task.title}`}
        onSubmit={() =>
          returnNotes.trim() &&
          ret.mutate({ reason: returnNotes.trim() }, { onSuccess: (r) => { setReturnNotes(""); finish(`Returned. The task is ${r.task.state === "approved" ? "Approved" : "In progress"}, and the notes are shown to whoever claims it next.`); } })
        }
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Not now
            </button>
            <button type="submit" className="btn-primary" aria-disabled={!returnNotes.trim() || ret.isPending}>
              Return task
            </button>
          </>
        }
      >
        {task.isSplitParent ? (
          <p>
            This is a split parent. Returning it without new subtasks puts it back to Approved; its next claimant may only add subtasks, following
            your notes, and does not work the parent directly. Completed subtasks are never reopened.
          </p>
        ) : (
          <p>The task goes back to Approved, unclaimed. The work continues on its branch; nothing is merged.</p>
        )}
        <Field label="Return notes" hint="What the next claimant reads first." required multiline rows={5} value={returnNotes} onChange={setReturnNotes} autoFocus />
        {actingLine}
        <Refusal error={ret.error} />
      </Dialog>

      {/* T15 Cancel (A-5) */}
      <Dialog
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title={`Cancel #${task.number} ${task.title}`}
        onSubmit={() => cancelReason.trim() && cancel.mutate({ reason: cancelReason.trim() }, { onSuccess: () => { setCancelReason(""); finish("Cancelled."); } })}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Keep task
            </button>
            <button type="submit" className="btn-danger" aria-disabled={!cancelReason.trim() || cancel.isPending}>
              Cancel task
            </button>
          </>
        }
      >
        <p>
          Cancelling is final. Any claim ends and live runs on the task are stopped, open questions are closed, subtasks that are not done are
          cancelled, open blockers are closed, and the task's work is never merged.
        </p>
        <Field label="Reason" required multiline value={cancelReason} onChange={setCancelReason} autoFocus />
        {actingLine}
        <Refusal error={cancel.error} />
      </Dialog>

      {/* C1 Add blocker */}
      <Dialog
        open={dialog === "blocker"}
        onClose={() => setDialog(null)}
        title={`Add a blocker to #${task.number}`}
        onSubmit={() => {
          if (Object.values(bl).some((v) => !v.trim())) return;
          blocker.mutate(
            { whatIsNeeded: bl.whatIsNeeded.trim(), whoCanResolve: bl.whoCanResolve.trim(), effect: bl.effect.trim() },
            { onSuccess: () => { setBl({ whatIsNeeded: "", whoCanResolve: "", effect: "" }); finish("Blocker added. The task is Blocked until it is resolved."); } },
          );
        }}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setDialog(null)}>
              Not now
            </button>
            <button type="submit" className="btn-primary" aria-disabled={Object.values(bl).some((v) => !v.trim()) || blocker.isPending}>
              Add blocker
            </button>
          </>
        }
      >
        <p>Blocked is a condition, not a state. While blocked, agents can't claim or hand off, and the task can't be accepted.</p>
        <Field label="What is needed" required multiline rows={2} value={bl.whatIsNeeded} onChange={(v) => setBl((x) => ({ ...x, whatIsNeeded: v }))} autoFocus />
        <Field label="Who can resolve it" required value={bl.whoCanResolve} onChange={(v) => setBl((x) => ({ ...x, whoCanResolve: v }))} />
        <Field label="Effect" required multiline rows={2} value={bl.effect} onChange={(v) => setBl((x) => ({ ...x, effect: v }))} />
        {actingLine}
        <Refusal error={blocker.error} />
      </Dialog>
    </section>
  );
}
