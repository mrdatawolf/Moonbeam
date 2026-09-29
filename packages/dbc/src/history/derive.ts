import {
  classifyArtifactPath, classifyTaskPath, isHeaderOnlyEdit, parseAdrHeader,
  parseContractHeader, parseTaskFile, taskField, TASK_STATES,
  type FileRead, type TaskState,
} from "../parse/index.js";
import {
  SNAPSHOT_VERSION, type ChainCommit, type FileReader, type ProjectSnapshot,
  type TaskFileRecord, type TaskHistory,
} from "./types.js";

type Presence = Map<string, Map<TaskState, string[]>>;

function presence(paths: Map<string, number | null>): Presence {
  const result: Presence = new Map();
  for (const path of [...paths.keys()].sort()) {
    const classified = classifyTaskPath(path);
    if (classified.kind !== "task") continue;
    let states = result.get(classified.id);
    if (!states) result.set(classified.id, states = new Map());
    const files = states.get(classified.state) ?? [];
    files.push(path);
    states.set(classified.state, files);
  }
  return result;
}

function newHistory(id: string): TaskHistory {
  return {
    id, events: [], firstProposed: null, firstApproved: null, firstCompleted: null,
    latestApproved: null, acceptance: null, currentStates: [], entries: [], headFiles: [],
  };
}

/**
 * H1–H9: rebuild from a root-to-head first-parent chain, never from cached state.
 * The source supplies first-parent diffs and FileRead outcomes (including absent).
 * Transport failures reject so the poller can retain its previous successful snapshot.
 * Incomplete diffs are applied as supplied and remain marked on their commit (F9).
 */
export async function deriveSnapshot(chain: readonly ChainCommit[], readFile: FileReader): Promise<ProjectSnapshot> {
  const snapshot: ProjectSnapshot = {
    version: SNAPSHOT_VERSION, head: chain.at(-1)?.sha ?? null,
    chainShas: chain.map((commit) => commit.sha), commits: [], tasks: [],
    taskFiles: [], hasTasksDirectory: false, artifacts: [],
    project: { path: "docs/PROJECT.md", present: false, read: { kind: "absent" } },
  };
  const paths = new Map<string, number | null>();
  const histories = new Map<string, TaskHistory>();
  let previous: Presence = new Map();

  // Retain parsed records and read statuses, not whole file texts.
  async function taskFile(sha: string, path: string): Promise<TaskFileRecord> {
    const file = await readFile(sha, path);
    const parsed = file.kind === "text" ? parseTaskFile(file.text) : null;
    return {
      path, classification: classifyTaskPath(path), read: { kind: file.kind }, parsed,
      lastAddedCommitIndex: paths.get(path) ?? null,
      approvedBy: parsed ? taskField(parsed, "Approved by")?.value ?? null : null,
      approvedDate: parsed ? taskField(parsed, "Approved date")?.value ?? null : null,
    };
  }

  for (const [commitIndex, commit] of chain.entries()) {
    for (const change of commit.changes) {
      if (change.kind === "deleted") paths.delete(change.path);
      else if (change.kind === "added") paths.set(change.path, commitIndex);
      else if (!paths.has(change.path)) paths.set(change.path, null);
    }
    const current = presence(paths);
    const completedIds: string[] = [];
    const ids = [...new Set([...previous.keys(), ...current.keys()])].sort();
    for (const id of ids) {
      let history = histories.get(id);
      if (!history) histories.set(id, history = newHistory(id));
      const before = previous.get(id);
      const after = current.get(id);
      for (const state of TASK_STATES) {
        if (before?.has(state) && !after?.has(state)) {
          history.events.push({ kind: "leaves", state, commitIndex });
        }
        if (!before?.has(state) && after?.has(state)) {
          history.events.push({ kind: "enters", state, commitIndex });
          if (state === "proposed") history.firstProposed ??= commitIndex;
          if (state === "approved") {
            history.firstApproved ??= commitIndex;
            history.latestApproved = commitIndex;
          }
          if (state === "completed") {
            history.firstCompleted ??= commitIndex;
            history.acceptance ??= { commitIndex, kind: commit.parents.length > 1 ? "merged" : "direct" };
            completedIds.push(id);
          }
          if (state === "approved" || state === "completed") {
            const files = await Promise.all(after.get(state)!.map((path) => taskFile(commit.sha, path)));
            history.entries.push({ state, commitIndex, files });
          }
        }
      }
      if (before && !after) history.events.push({ kind: "removed", commitIndex });
    }
    const work = await Promise.all(commit.changes.map(async (change) => {
      if (change.path.startsWith("tasks/")) return null;
      if (change.kind === "modified" &&
          (change.path.startsWith("docs/contracts/") || change.path.startsWith("docs/decisions/"))) {
        const parent = commit.parents[0];
        const [oldFile, newFile] = await Promise.all([
          parent === undefined ? Promise.resolve<FileRead>({ kind: "absent" }) : readFile(parent, change.path),
          readFile(commit.sha, change.path),
        ]);
        if (isHeaderOnlyEdit(oldFile.kind === "text" ? oldFile.text : null,
          newFile.kind === "text" ? newFile.text : null)) return null;
      }
      return change.path;
    }));
    snapshot.commits.push({
      sha: commit.sha, subject: commit.subject, author: { ...commit.author },
      committer: { ...commit.committer }, committedAt: commit.committedAt,
      isMerge: commit.parents.length > 1, baseWorkPaths: [...new Set(work.filter((p) => p !== null))].sort(),
      completedIds, changesComplete: commit.changesComplete,
    });
    previous = current;
  }

  const head = snapshot.head;
  if (head !== null) {
    const headPaths = [...paths.keys()].sort();
    snapshot.taskFiles = await Promise.all(headPaths.filter((path) => path.startsWith("tasks/"))
      .map((path) => taskFile(head, path)));
    snapshot.hasTasksDirectory = snapshot.taskFiles.length > 0;
    for (const path of headPaths) {
      const classification = classifyArtifactPath(path);
      if (!classification) continue;
      const file = await readFile(head, path);
      if (classification.kind === "project") {
        snapshot.project = { path: "docs/PROJECT.md", present: true, read: { kind: file.kind } };
        continue;
      }
      const parsed = file.kind !== "text" ? null : classification.kind === "contract"
        ? parseContractHeader(file.text) : parseAdrHeader(file.text);
      snapshot.artifacts.push({ path, classification, read: { kind: file.kind }, parsed });
    }
  }
  snapshot.tasks = [...histories.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const history of snapshot.tasks) {
    const states = previous.get(history.id);
    history.currentStates = states ? TASK_STATES.filter((state) => states.has(state)) :
      [history.events.some((event) => event.kind === "enters" && event.state !== "proposed") ? "removed" : "withdrawn"];
    history.headFiles = snapshot.taskFiles.filter((file) => file.classification.kind === "task" &&
      file.classification.id === history.id);
  }
  return snapshot;
}
