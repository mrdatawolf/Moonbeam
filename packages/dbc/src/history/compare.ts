import type { ProjectSnapshot, SnapshotComparison, TaskHistory } from "./types.js";

function eventHistory(snapshot: ProjectSnapshot, task: TaskHistory): string {
  // Indexes are local to each snapshot: compare the referenced facts, not offsets.
  return JSON.stringify(task.events.map((event) => {
    const commit = snapshot.commits[event.commitIndex];
    return {
      kind: event.kind, paths: event.paths, state: event.kind === "removed" ? null : event.state,
      commit: commit ? {
        sha: commit.sha, subject: commit.subject, author: commit.author,
        committer: commit.committer, committedAt: commit.committedAt, isMerge: commit.isMerge,
      } : null,
    };
  }));
}

/** FL-10 evidence only; deciding whether a rewrite occurred belongs to the poller. */
export function compareSnapshots(previous: ProjectSnapshot, next: ProjectSnapshot): SnapshotComparison {
  const nextShas = new Set(next.chainShas);
  const before = new Map(previous.tasks.map((task) => [task.id, eventHistory(previous, task)]));
  const after = new Map(next.tasks.map((task) => [task.id, eventHistory(next, task)]));
  return {
    droppedCommitCount: new Set(previous.chainShas.filter((sha) => !nextShas.has(sha))).size,
    changedTaskIds: [...new Set([...before.keys(), ...after.keys()])].sort()
      .filter((id) => before.get(id) !== after.get(id)),
  };
}
