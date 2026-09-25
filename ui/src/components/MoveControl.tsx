// D1: move a task in its project queue, or a subtask among its siblings.
// Human only; requires confirmation. The server refuses a move that would
// make a started task wait on an unfinished one; after a move, the
// dependency changes it produced are listed from the returned audit records.
import type { AuditRecordView } from "@moonbeam/shared";
import { useState } from "react";
import { useConnectionLost } from "../api/connection";
import { useTaskAction } from "../api/queries";
import { moveAvailability } from "../lib/actions";
import { useCurrentUser } from "../lib/currentUser";
import { Dialog } from "./Dialog";
import { Field, Refusal } from "./common";

interface Props {
  task: { id: string; number: number; title: string; parentId: string | null; queuePosition: number | null; siblingPosition: number | null };
  /** Number of positions in the queue or sibling list. */
  count: number;
}

function describe(a: AuditRecordView): string | null {
  if (a.action !== "path_dependencies_changed") return null;
  const d = a.details ?? {};
  const nums = (x: unknown) => (Array.isArray(x) ? x.map((y) => `#${(y as { number?: number }).number ?? "?"}`).join(", ") : "");
  const gained = nums(d.gained);
  const lost = nums(d.lost);
  return [gained && `a task now waits for ${gained}`, lost && `a task no longer waits for ${lost}`].filter(Boolean).join("; ");
}

export function MoveControl({ task, count }: Props) {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const avail = moveAvailability(task, { userId: user?.id ?? null, connectionLost: lost });
  const current = (task.parentId === null ? task.queuePosition : task.siblingPosition) ?? 1;
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(String(current));
  const [result, setResult] = useState<string | null>(null);
  const move = useTaskAction(task.id, "move");
  const where = task.parentId === null ? "project queue" : "sibling order";
  const n = Number(target);
  const valid = Number.isInteger(n) && n >= 1 && n <= count && n !== current;

  const quick = (to: number) => {
    setTarget(String(to));
    move.reset();
    setOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" className="btn-secondary px-2 py-0.5 text-xs" aria-disabled={!avail.enabled || current <= 1} aria-label={`Move #${task.number} up`} title={avail.enabled ? undefined : avail.reason} onClick={() => avail.enabled && current > 1 && quick(current - 1)}>
        Up
      </button>
      <button type="button" className="btn-secondary px-2 py-0.5 text-xs" aria-disabled={!avail.enabled || current >= count} aria-label={`Move #${task.number} down`} title={avail.enabled ? undefined : avail.reason} onClick={() => avail.enabled && current < count && quick(current + 1)}>
        Down
      </button>
      <button type="button" className="btn-secondary px-2 py-0.5 text-xs" aria-disabled={!avail.enabled} aria-label={`Move #${task.number} to a position`} title={avail.enabled ? undefined : avail.reason} onClick={() => avail.enabled && quick(current)}>
        Move…
      </button>
      {result ? (
        <span role="status" className="text-xs text-muted-foreground">
          {result}
        </span>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Move #${task.number} in the ${where}`}
        onSubmit={() => {
          if (!valid || !avail.enabled) return;
          move.mutate(
            { position: n },
            {
              onSuccess: (r) => {
                const changes = r.audit.map(describe).filter(Boolean);
                setResult(`Moved to position ${n}.${changes.length ? ` Dependencies changed: ${changes.join(". ")}.` : " No dependencies changed."}`);
                setOpen(false);
              },
            },
          );
        }}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Keep position
            </button>
            <button type="submit" className="btn-primary" aria-disabled={!valid || move.isPending}>
              Move to position {valid ? n : "…"}
            </button>
          </>
        }
      >
        <p>
          <strong>{task.title}</strong> is at position {current} of {count}. Tasks later in the queue wait for earlier tasks whose paths overlap
          theirs, so moving changes who waits for whom. Moonbeam refuses a move that would make a task already in progress or in review
          wait on an unfinished task.
        </p>
        <Field label={`New position (1 to ${count})`} type="number" required value={target} onChange={setTarget} autoFocus />
        {user ? <p className="text-muted-foreground">Moving as {user.displayName}.</p> : null}
        <Refusal error={move.error} />
      </Dialog>
    </div>
  );
}
