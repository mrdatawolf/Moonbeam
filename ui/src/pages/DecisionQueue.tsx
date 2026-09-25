// The decision queue: everything that needs a human, in the phase-2 groups
// (TASK-007 scope; CONTRACT-001 UX; CONTRACT-003 Q24): proposed tasks
// awaiting approval, top-level tasks in review, blocked tasks, rejected agent
// authority-violation attempts, and accepted tasks not yet merged.
import type { AuditRecordView, TaskSummary } from "@moonbeam/shared";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useDecisionQueue, useProjects } from "../api/queries";
import { EmptyState, LoadError, SectionHeading, Skeleton, Time } from "../components/common";
import { StatusBadge } from "../components/StatusBadge";
import { TaskCard } from "../components/TaskCard";
import { actorLabel } from "../lib/format";
import { INTEGRATION } from "../lib/status";

function Group({ id, title, description, count, children, empty }: { id: string; title: string; description: string; count: number; children: ReactNode; empty: string }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <SectionHeading id={id} count={count}>
        {title}
      </SectionHeading>
      <p className="text-sm text-muted-foreground">{description}</p>
      {count === 0 ? <EmptyState title={empty} /> : children}
    </section>
  );
}

function Tasks({ tasks, projectName, extra }: { tasks: TaskSummary[]; projectName: (id: string) => string; extra?: (t: TaskSummary) => ReactNode }) {
  return (
    <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {tasks.map((t) => (
        <li key={t.id}>
          <TaskCard
            task={t}
            extra={
              <>
                <p className="text-xs text-muted-foreground">{projectName(t.projectId)}</p>
                {extra?.(t)}
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function Violations({ records, projectName }: { records: AuditRecordView[]; projectName: (id: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-3 font-medium">When</th>
            <th scope="col" className="py-2 pr-3 font-medium">Agent</th>
            <th scope="col" className="py-2 pr-3 font-medium">Attempted</th>
            <th scope="col" className="py-2 pr-3 font-medium">Target</th>
            <th scope="col" className="py-2 font-medium">Project</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-border align-top">
              <td className="py-2 pr-3 whitespace-nowrap">
                <Time iso={r.occurredAt} />
              </td>
              <td className="py-2 pr-3">
                {actorLabel(r.actor)}
                {r.actor.runId ? <div className="font-mono text-xs text-muted-foreground">run {r.actor.runId.slice(0, 8)}</div> : null}
              </td>
              <td className="py-2 pr-3">
                <span className="font-mono text-xs">{r.action}</span>
                {r.reason ? <div className="text-xs text-muted-foreground">{r.reason}</div> : null}
              </td>
              <td className="py-2 pr-3">
                {r.taskId ? (
                  <Link to={`/tasks/${r.taskId}`} className="text-primary underline">
                    Open task
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2">{r.projectId ? projectName(r.projectId) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionQueuePage() {
  const queue = useDecisionQueue();
  const projects = useProjects();
  const projectName = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? "Unknown project";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Decision queue</h1>
        <p className="text-sm text-muted-foreground">Everything waiting for a board member, across all projects.</p>
      </div>
      {queue.isPending ? (
        <Skeleton lines={6} label="Loading the decision queue" />
      ) : queue.isError ? (
        <LoadError error={queue.error} notFound="" />
      ) : (
        <>
          <Group
            id="q-proposed"
            title="Proposed, awaiting approval"
            description="Plans waiting for a board member to approve or cancel them."
            count={queue.data.proposed.length}
            empty="No proposed tasks are waiting."
          >
            <Tasks tasks={queue.data.proposed} projectName={projectName} />
          </Group>
          <Group
            id="q-review"
            title="In review"
            description="Handed-off work waiting for a board member to accept or return it."
            count={queue.data.inReview.length}
            empty="No tasks are in review."
          >
            <Tasks tasks={queue.data.inReview} projectName={projectName} />
          </Group>
          <Group
            id="q-blocked"
            title="Blocked"
            description="Tasks with an open blocker. Open a task to see what is needed and who can resolve it."
            count={queue.data.blocked.length}
            empty="No tasks are blocked."
          >
            <Tasks tasks={queue.data.blocked} projectName={projectName} />
          </Group>
          <Group
            id="q-violations"
            title="Agent authority violations"
            description="Rejected attempts by agent runs to take a human-only action. Nothing changed; each attempt is recorded."
            count={queue.data.authorityViolations.length}
            empty="No agent has attempted a human-only action."
          >
            <Violations records={queue.data.authorityViolations} projectName={projectName} />
          </Group>
          <Group
            id="q-not-merged"
            title="Accepted, not merged"
            description="Completed tasks whose work is not on main yet. Merging into main comes with phase 3."
            count={queue.data.acceptedNotMerged.length}
            empty="Every accepted task is on main."
          >
            <Tasks tasks={queue.data.acceptedNotMerged} projectName={projectName} extra={() => <StatusBadge status={INTEGRATION.notMerged} compact />} />
          </Group>
        </>
      )}
    </div>
  );
}
