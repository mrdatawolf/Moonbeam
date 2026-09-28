// One project: its tasks by state (board) and its queue in order (CONTRACT-005
// "Project queue and path dependencies"), with proposing a task.
import { Link, useParams, useSearchParams } from "react-router";
import { useProject, useProjectTasks } from "../api/queries";
import { EmptyState, LoadError, Mono, SectionHeading, Skeleton } from "../components/common";
import { MoveControl } from "../components/MoveControl";
import { StatusBadge } from "../components/StatusBadge";
import { Claimant, TaskCard } from "../components/TaskCard";
import { BOARD_STATES, conditionsOf, INTEGRATION, TASK_STATE } from "../lib/status";

function Board({ projectId }: { projectId: string }) {
  const tasks = useProjectTasks(projectId);
  if (tasks.isPending) return <Skeleton lines={5} label="Loading tasks" />;
  if (tasks.isError) return <LoadError error={tasks.error} notFound="This project doesn't exist." />;
  const byId = new Map(tasks.data.map((t) => [t.id, t]));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {BOARD_STATES.map((state) => {
        const col = tasks.data.filter((t) => t.state === state);
        const headingId = `col-${state}`;
        return (
          <section key={state} aria-labelledby={headingId} className="space-y-2 rounded-card bg-muted p-3">
            <h3 id={headingId} className="flex items-center gap-2 text-sm font-semibold">
              <StatusBadge status={TASK_STATE[state]} />
              <span className="font-mono text-muted-foreground">{col.length}</span>
              <span className="sr-only">tasks</span>
            </h3>
            {col.length === 0 ? (
              <p className="text-xs text-muted-foreground">No {TASK_STATE[state].label.toLowerCase()} tasks.</p>
            ) : (
              <ul className="space-y-2">
                {col.map((t) => (
                  <li key={t.id}>
                    <TaskCard task={t} showState={false} parentNumber={t.parentId ? byId.get(t.parentId)?.number : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Queue({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  if (project.isPending) return <Skeleton lines={4} label="Loading queue" />;
  if (project.isError) return <LoadError error={project.error} notFound="This project doesn't exist." />;
  const queue = project.data.queue;
  if (queue.length === 0) {
    return <EmptyState title="The queue is empty.">Approved tasks join the end of the queue. Approve a proposed task to add it.</EmptyState>;
  }
  const numberOf = new Map(queue.map((q) => [q.task.id, q.task.number]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Project queue in order</caption>
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-3 font-medium">Position</th>
            <th scope="col" className="py-2 pr-3 font-medium">Task</th>
            <th scope="col" className="py-2 pr-3 font-medium">Status</th>
            <th scope="col" className="py-2 pr-3 font-medium">Paths overlap with</th>
            <th scope="col" className="py-2 font-medium">Move</th>
          </tr>
        </thead>
        <tbody>
          {queue.map(({ task, overlapsWith }) => (
            <tr key={task.id} className="border-b border-border align-top">
              <td className="py-2 pr-3 font-mono">{task.queuePosition}</td>
              <td className="py-2 pr-3">
                <Link to={`/tasks/${task.id}`} className="underline-offset-2 hover:underline">
                  <span className="font-mono text-muted-foreground">#{task.number}</span> {task.title}
                </Link>
                <div>
                  <Claimant task={task} />
                </div>
              </td>
              <td className="py-2 pr-3">
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={TASK_STATE[task.state]} compact />
                  {conditionsOf(task).map((c) => (
                    <StatusBadge key={c.label} status={c} compact />
                  ))}
                  {task.state === "completed" && !task.workOnMain ? <StatusBadge status={INTEGRATION.notMerged} compact /> : null}
                </div>
              </td>
              <td className="py-2 pr-3 font-mono text-xs">
                {overlapsWith.length ? overlapsWith.map((id) => `#${numberOf.get(id) ?? "?"}`).join(", ") : <span className="text-muted-foreground">none</span>}
              </td>
              <td className="py-2">
                <MoveControl task={task} count={queue.length} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectPage() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "queue" ? "queue" : "board";
  const project = useProject(projectId);

  if (project.isError) return <LoadError error={project.error} notFound="This project doesn't exist." back={{ to: "/projects", label: "Back to projects" }} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm">
            <Link to="/projects" className="text-muted-foreground underline-offset-2 hover:underline">
              Projects
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{project.data?.project.name ?? "Project"}</h1>
          {project.data ? (
            <p className="text-sm text-muted-foreground">
              <Mono>{project.data.project.repoPath}</Mono> · main branch <Mono>{project.data.project.mainBranch}</Mono>
            </p>
          ) : null}
        </div>
        <Link to={`/projects/${projectId}/tasks/new`} className="btn-primary">
          Propose a task
        </Link>
      </div>

      <nav aria-label="Project views">
        <ul className="flex gap-1 border-b border-border">
          {(["board", "queue"] as const).map((v) => (
            <li key={v}>
              <Link
                to={`?view=${v}`}
                onClick={(e) => {
                  e.preventDefault();
                  setParams(v === "board" ? {} : { view: v });
                }}
                aria-current={view === v ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 px-3 py-1.5 text-sm ${view === v ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}
              >
                {v === "board" ? "Tasks by state" : "Queue"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="view-h" className="space-y-3">
        <SectionHeading id="view-h">{view === "board" ? "Tasks by state" : "Queue"}</SectionHeading>
        {view === "board" ? <Board projectId={projectId} /> : <Queue projectId={projectId} />}
      </section>
    </div>
  );
}
