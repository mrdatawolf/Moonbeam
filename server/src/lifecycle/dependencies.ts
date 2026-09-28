// Path dependencies (CONTRACT-005 "Project queue and path dependencies").
// Pure functions over a project's tasks; the queue and sibling order are the
// stored positions.
import type { schema } from "@moonbeam/db";
import { pathsOverlap } from "./paths.js";

type TaskRow = typeof schema.tasks.$inferSelect;

export type DependencyKind = "queue" | "inherited" | "sibling";

export interface Dependency {
  kind: DependencyKind;
  task: TaskRow;
  finished: boolean;
}

const terminal = (t: TaskRow) => t.state === "completed" || t.state === "cancelled";

/**
 * A queue or inherited dependency is finished when the earlier task is
 * cancelled, or completed with its work on main (ADR-005 amendment). A sibling
 * dependency is finished when the sibling is terminal.
 */
export function isFinished(kind: DependencyKind, dep: TaskRow): boolean {
  if (kind === "sibling") return terminal(dep);
  return dep.state === "cancelled" || (dep.state === "completed" && dep.workOnMain);
}

/** The project queue in order: top-level tasks with a queue position. */
export function projectQueue(tasks: readonly TaskRow[]): TaskRow[] {
  return tasks
    .filter((t) => t.parentId === null && t.queuePosition !== null)
    .sort((a, b) => a.queuePosition! - b.queuePosition!);
}

export function siblingsOf(tasks: readonly TaskRow[], parentId: string): TaskRow[] {
  return tasks.filter((t) => t.parentId === parentId).sort((a, b) => a.siblingPosition! - b.siblingPosition!);
}

function queueDependencies(task: TaskRow, tasks: readonly TaskRow[]): Dependency[] {
  if (task.parentId !== null || task.queuePosition === null) return [];
  return projectQueue(tasks)
    .filter((o) => o.id !== task.id && o.queuePosition! < task.queuePosition! && pathsOverlap(o.envelope.paths, task.envelope.paths))
    .map((o) => ({ kind: "queue" as const, task: o, finished: isFinished("queue", o) }));
}

/** Every path dependency of a task: queue, inherited, and sibling. */
export function dependenciesOf(task: TaskRow, tasks: readonly TaskRow[]): Dependency[] {
  if (task.parentId === null) return queueDependencies(task, tasks);
  const parent = tasks.find((t) => t.id === task.parentId);
  const inherited = parent
    ? queueDependencies(parent, tasks).map((d) => ({ ...d, kind: "inherited" as const }))
    : [];
  const sibling = siblingsOf(tasks, task.parentId)
    .filter((s) => s.id !== task.id && s.siblingPosition! < task.siblingPosition! && pathsOverlap(s.envelope.paths, task.envelope.paths))
    .map((s) => ({ kind: "sibling" as const, task: s, finished: isFinished("sibling", s) }));
  return [...inherited, ...sibling];
}

export function unfinishedDependencies(task: TaskRow, tasks: readonly TaskRow[]): Dependency[] {
  return dependenciesOf(task, tasks).filter((d) => !d.finished);
}

/** Tasks that depend on `task`, with the kind of each dependency. */
export function dependents(task: TaskRow, tasks: readonly TaskRow[]): { kind: DependencyKind; task: TaskRow }[] {
  const out: { kind: DependencyKind; task: TaskRow }[] = [];
  for (const other of tasks) {
    if (other.id === task.id) continue;
    for (const d of dependenciesOf(other, tasks)) {
      if (d.task.id === task.id) out.push({ kind: d.kind, task: other });
    }
  }
  return out;
}
