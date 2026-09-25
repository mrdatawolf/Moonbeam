// Compact task row used on the board, in the queue and in the decision queue.
import type { TaskSummary } from "@moonbeam/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { conditionsOf, TASK_STATE } from "../lib/status";
import { StatusBadge } from "./StatusBadge";
import { Time } from "./common";

export function Claimant({ task }: { task: Pick<TaskSummary, "claim"> }) {
  const c = task.claim;
  if (!c) return null;
  return (
    <span className="text-xs text-muted-foreground">
      Claimed by{" "}
      {c.claimantKind === "human" ? (
        <span className="text-foreground">
          {c.displayName ?? "unknown user"}
          {c.userActive === false ? " (inactive)" : ""}
        </span>
      ) : (
        <span className="text-foreground">agent run ({c.model ?? "unknown model"})</span>
      )}
      {c.leaseDeadline ? (
        <>
          {" "}
          · lease {c.leaseSuspended ? "suspended" : <>until <Time iso={c.leaseDeadline} /></>}
        </>
      ) : null}
    </span>
  );
}

export function TaskCard({ task, showState = true, extra, parentNumber }: { task: TaskSummary; showState?: boolean; extra?: ReactNode; parentNumber?: number }) {
  const conditions = conditionsOf(task);
  return (
    <article className="card space-y-1.5 p-3 text-sm" aria-label={`#${task.number} ${task.title}`}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/tasks/${task.id}`} className="font-medium underline-offset-2 hover:underline">
          <span className="font-mono text-muted-foreground">#{task.number}</span> {task.title}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {showState ? <StatusBadge status={TASK_STATE[task.state]} compact /> : null}
        {conditions.map((c) => (
          <StatusBadge key={c.label} status={c} compact />
        ))}
        {task.parentId ? <span className="text-xs text-muted-foreground">Subtask{parentNumber ? ` of #${parentNumber}` : ""}</span> : null}
        {task.isSplitParent ? <span className="text-xs text-muted-foreground">Split parent</span> : null}
      </div>
      <Claimant task={task} />
      {extra}
      <p className="text-xs text-muted-foreground">
        Updated <Time iso={task.updatedAt} />
      </p>
    </article>
  );
}
