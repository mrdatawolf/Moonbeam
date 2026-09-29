import type { AuthorIdentity } from "../identity/index.js";
import type {
  AdrHeader, ArtifactPath, ContractHeader, FileRead, ParsedTaskFile, TaskPath, TaskState, Unknown,
} from "../parse/index.js";

export const SNAPSHOT_VERSION = 1;

export interface ChainCommit {
  sha: string;
  parents: readonly string[];
  subject: string;
  author: AuthorIdentity & { login: string | null };
  committer: { name: string; email: string };
  committedAt: string;
  /** Relative to the first parent (empty tree for root), without rename detection. */
  changes: readonly { path: string; kind: "added" | "modified" | "deleted" }[];
  changesComplete: boolean;
}

export type FileReader = (sha: string, path: string) => Promise<FileRead>;
/** Text is read on demand by the view, never retained in the snapshot. */
export type FileReadStatus = { kind: FileRead["kind"] };

export interface CommitFacts {
  sha: string;
  subject: string;
  author: ChainCommit["author"];
  committer: ChainCommit["committer"];
  committedAt: string;
  isMerge: boolean;
  baseWorkPaths: string[];
  completedIds: string[];
  changesComplete: boolean;
}

export interface TaskFileRecord {
  path: string;
  classification: TaskPath;
  read: FileReadStatus;
  parsed: ParsedTaskFile | null;
  /** Index into ProjectSnapshot.commits; null if only an incomplete modification was observed. */
  lastAddedCommitIndex: number | null;
  approvedBy: string | null;
  approvedDate: string | null;
}

export type TaskEvent =
  | { kind: "enters" | "leaves"; state: TaskState; commitIndex: number }
  | { kind: "removed"; commitIndex: number };

export interface TaskEntry {
  state: "approved" | "completed";
  commitIndex: number;
  /** All files for this ID in this state, including duplicate slugs. */
  files: TaskFileRecord[];
}

export interface TaskHistory {
  id: string;
  events: TaskEvent[];
  firstProposed: number | null;
  firstApproved: number | null;
  firstCompleted: number | null;
  latestApproved: number | null;
  acceptance: { commitIndex: number; kind: "merged" | "direct" } | null;
  currentStates: (TaskState | "removed" | "withdrawn")[];
  entries: TaskEntry[];
  /** Per-file header values are preserved, even when the ID is duplicated. */
  headFiles: TaskFileRecord[];
}

export interface ArtifactRecord {
  path: string;
  classification: ArtifactPath;
  read: FileReadStatus;
  parsed: ContractHeader | AdrHeader | Unknown | null;
}

export interface ProjectSnapshot {
  version: typeof SNAPSHOT_VERSION;
  head: string | null;
  /** Oldest first, like commits and event histories. */
  chainShas: string[];
  commits: CommitFacts[];
  /** Sorted by ID; all formerly present IDs remain here. */
  tasks: TaskHistory[];
  /** Every head path under tasks/, sorted by path, including ignored/stray paths. */
  taskFiles: TaskFileRecord[];
  hasTasksDirectory: boolean;
  artifacts: ArtifactRecord[];
  project: { path: "docs/PROJECT.md"; present: boolean; read: FileReadStatus };
}

export interface SnapshotComparison {
  droppedCommitCount: number;
  changedTaskIds: string[];
}
