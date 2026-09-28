import { projectListResponseSchema, recentAuditResponseSchema, taskListResponseSchema, taskStateSchema, type DecisionQueue } from "@moonbeam/shared";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { request } from "../api/client";
import { keys, useDecisionQueue } from "../api/queries";
import { EmptyState, Skeleton, Time } from "../components/common";
import { StatusBadge } from "../components/StatusBadge";
import { TaskCard } from "../components/TaskCard";
import { actorLabel, auditLabel } from "../lib/format";
import { useSelectedUserId } from "../lib/selection";
import { TASK_STATE } from "../lib/status";

const LIVE = 10_000;
const groups: [keyof DecisionQueue, string][] = [
  ["proposed", "Proposed, awaiting approval"],
  ["inReview", "In review"],
  ["subtaskFindings", "Subtask findings"],
  ["fellBack", "Fell back"],
  ["blocked", "Blocked"],
  ["authorityViolations", "Agent authority violations"],
  ["acceptedNotMerged", "Accepted, not merged"],
];

function ReadFailure({ label }: { label: string }) {
  return <p role="alert" className="text-sm text-tone-danger-fg">{label} could not be refreshed. Any displayed data may be out of date. Retrying automatically.</p>;
}

export function Dashboard() {
  const selectedId = useSelectedUserId();
  const queue = useDecisionQueue();
  const projects = useQuery({
    queryKey: keys.projects,
    queryFn: () => request("GET", "/projects", projectListResponseSchema).then((r) => r.projects),
    refetchInterval: LIVE,
  });
  const lists = useQueries({ queries: (projects.data ?? []).map((p) => ({
    queryKey: [...keys.tasks(p.id), selectedId],
    queryFn: () => request("GET", `/projects/${p.id}/tasks`, taskListResponseSchema).then((r) => r.tasks),
    refetchInterval: LIVE,
  })) });
  const tasks = lists.flatMap((q) => q.data ?? []);
  const audit = useQuery({
    queryKey: [...keys.recentAudit, selectedId],
    queryFn: () => request("GET", "/audit/recent?limit=10", recentAuditResponseSchema).then((r) => r.events),
    refetchInterval: LIVE,
  });
  const loadingTasks = projects.isPending || lists.some((q) => q.isPending);
  const failedTasks = projects.isError || lists.some((q) => q.isError);
  const claims = tasks.filter((t) => t.claim !== null);
  const events = audit.data ?? [];
  const loadingAudit = audit.isPending;
  const failedAudit = audit.isError;
  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "Unknown project";

  return <div className="min-w-0 space-y-8 [overflow-wrap:anywhere]">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Across all projects. Updates every 10 seconds while this page is open.</p>
    </div>

    <section aria-labelledby="dashboard-decisions" className="card min-w-0 space-y-3 p-4">
      <h2 id="dashboard-decisions" className="text-lg font-semibold">Decision queue</h2>
      <p className="text-sm text-muted-foreground">What needs a board member. A task can appear in more than one group.</p>
      {queue.isError && <ReadFailure label="Decision queue" />}
      {queue.isPending ? <Skeleton lines={3} label="Loading decision summary" /> : queue.data ? <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map(([key, label]) => <div key={key} className="flex items-start justify-between gap-3 text-sm">
          <dt>{label}</dt><dd className="font-mono font-semibold">{queue.data[key].length}</dd>
        </div>)}
      </dl> : null}
      <Link className="inline-block text-sm text-primary underline" to="/decisions">Open decision queue</Link>
    </section>

    <section aria-labelledby="dashboard-projects" className="min-w-0 space-y-3">
      <h2 id="dashboard-projects" className="text-lg font-semibold">Tasks by project</h2>
      <p className="text-sm text-muted-foreground">All tasks, including subtasks. Blocked and paused are conditions, not separate states.</p>
      {projects.isError && <ReadFailure label="Projects" />}
      {projects.isPending ? <Skeleton label="Loading projects" /> : projects.data?.length === 0 ? <EmptyState title="No projects registered."><Link to="/projects" className="text-primary underline">Register a project</Link> to start tracking work.</EmptyState> : null}
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        {projects.data?.map((p, i) => <article key={p.id} aria-label={p.name} className="card min-w-0 space-y-3 p-4">
          <h3 className="font-semibold"><Link to={`/projects/${p.id}`} className="text-primary underline">{p.name}</Link></h3>
          {lists[i]?.isError && <ReadFailure label={`Tasks for ${p.name}`} />}
          {lists[i]?.isPending ? <Skeleton lines={2} label={`Loading tasks for ${p.name}`} /> : lists[i]?.data ? <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {taskStateSchema.options.map((state) => <div key={state} className="flex items-center justify-between gap-2">
              <dt><StatusBadge status={TASK_STATE[state]} compact /></dt>
              <dd className="font-mono text-sm">{lists[i]!.data!.filter((t) => t.state === state).length}</dd>
            </div>)}
          </dl> : null}
        </article>)}
      </div>
    </section>

    <section aria-labelledby="dashboard-claims" className="min-w-0 space-y-3">
      <h2 id="dashboard-claims" className="text-lg font-semibold">Active claims</h2>
      {failedTasks && <ReadFailure label="Active claims" />}
      {loadingTasks && <Skeleton lines={2} label="Loading active claims" />}
      {!loadingTasks && !failedTasks && claims.length === 0 && <EmptyState title="No active claims.">Open a project to find approved work.</EmptyState>}
      <ul className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {claims.map((t) => <li key={t.id} className="min-w-0"><TaskCard task={t} extra={<p className="text-xs text-muted-foreground">{projectName(t.projectId)}</p>} /></li>)}
      </ul>
    </section>

    <section aria-labelledby="dashboard-audit" className="min-w-0 space-y-3">
      <h2 id="dashboard-audit" className="text-lg font-semibold">Recent audit events</h2>
      <p className="text-sm text-muted-foreground">The 10 most recent task events across projects, newest first. Open a task for its full history.</p>
      {failedAudit && <ReadFailure label="Task history" />}
      {loadingAudit && <Skeleton lines={2} label="Loading task history" />}
      {!loadingAudit && !failedAudit && events.length === 0 && <EmptyState title="No task events yet.">Task changes will appear here.</EmptyState>}
      <ol className="space-y-2">
        {events.map((r) => {
          const task = r.task;
          return <li key={r.id} className="card min-w-0 space-y-1 p-3 text-sm">
            <p className="font-medium">{auditLabel(r.action, r.rejected)}</p>
            <p>{actorLabel(r.actor)} · <Time iso={r.occurredAt} /></p>
            <p className="text-muted-foreground">{r.project.name}{r.taskId && <> · <Link className="text-primary underline" to={`/tasks/${r.taskId}`}>
              {task ? <><span className="font-mono">#{task.number}</span> {task.title}</> : "Open task"}
            </Link></>}</p>
            {r.reason && <p>{r.reason}</p>}
          </li>;
        })}
      </ol>
    </section>
  </div>;
}
