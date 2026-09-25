// The repository boundary of the lifecycle (CONTRACT-004). TASK-006 has no
// git integration: branch mergeability, the changed-file set, and subtask
// integration are behind this port, and the default implementation reports
// "mergeable", "no changed files", and "integrated" until phase 3 replaces it.
// Tests substitute their own implementation to exercise the refusals.

export interface RepositoryTaskRef {
  projectId: string;
  repoPath: string;
  taskId: string;
  parentId: string | null;
}

export type MergeCheck = { mergeable: true } | { mergeable: false; conflictingFiles: string[] };

export interface RepositoryPort {
  /**
   * Whether the task branch merges cleanly into its target: main for a
   * top-level task, the parent's branch for a subtask (T6, CONTRACT-004 B6),
   * or current main for the known-conflict check at T9 (Q25).
   * May throw `ActionError("repository_unavailable")`.
   */
  checkMergeable(task: RepositoryTaskRef, target: "integration_target" | "main"): Promise<MergeCheck>;
  /** The task's changed-file set (T9 out-of-scope check). May throw `repository_unavailable`. */
  changedFiles(task: RepositoryTaskRef): Promise<string[]>;
  /** Merge a completed subtask into the parent's branch (T8, CONTRACT-004 B3). */
  integrateSubtask(subtask: RepositoryTaskRef): Promise<{ ok: true } | { ok: false; conflictingFiles: string[] }>;
}

/** Phase-2 stand-in: always mergeable, nothing changed, always integrated. */
export const stubRepository: RepositoryPort = {
  checkMergeable: async () => ({ mergeable: true }),
  changedFiles: async () => [],
  integrateSubtask: async () => ({ ok: true }),
};
