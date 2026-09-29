import type { ProjectSnapshot, SnapshotComparison, TaskHistory } from "../history/index.js";
import type { IdentityMatcher } from "../identity/index.js";
import { matchesPattern, parseName, problemKey, taskField, v1Problems } from "../parse/index.js";
import type { EvaluatedFlag, FlagEvaluation, FlagFor, FlagHistoryEvent, FlagRegistration, FlagRule, UnreadableReason } from "./types.js";

function flag<R extends FlagRule>(rule: R, subject: FlagFor<R>["subject"],
  evidence: FlagFor<R>["evidence"], message: string,
  kind: FlagFor<R>["kind"], subjectCommitSha: FlagFor<R>["subjectCommitSha"],
  autoResolves: FlagFor<R>["autoResolves"]): FlagFor<R> {
  return { rule, subject, subjectKey: JSON.stringify([rule, subject]), evidence,
    message, kind, subjectCommitSha, autoResolves };
}

/** Pure CONTRACT-006 evaluation. Timestamps are explicit ISO strings; no clock or I/O. */
export function evaluateFlags(snapshot: ProjectSnapshot, registration: FlagRegistration,
  matcher: IdentityMatcher, now: string): FlagEvaluation {
  let baseline = snapshot.chainShas.indexOf(registration.baselineSha);
  const baselineNeedsReset = baseline === -1;
  if (baselineNeedsReset) {
    const cutoff = Date.parse(registration.baselineCommittedAt);
    // Newest in chain order, not greatest timestamp: git times need not be monotonic.
    for (let i = snapshot.commits.length - 1; i >= 0; i--) {
      if (Date.parse(snapshot.commits[i]!.committedAt) <= cutoff) { baseline = i; break; }
    }
  }
  const flags: EvaluatedFlag[] = [];
  const result: FlagEvaluation = {
    flags, baselineNeedsReset, effectiveBaselineSha: snapshot.chainShas[baseline] ?? null,
    evaluatedCommitShas: snapshot.chainShas.slice(baseline + 1), scopeNotCheckable: [], notFullyChecked: [],
  };
  const history = (task: TaskHistory): FlagHistoryEvent[] => task.events.map((event) => ({
    ...event, commit: snapshot.commits[event.commitIndex]!,
  }));
  const tasks = new Map(snapshot.tasks.map((task) => [task.id, task]));
  for (const [index, commit] of snapshot.commits.entries()) {
    if (index <= baseline) continue;
    if (!commit.changesComplete) result.notFullyChecked.push(commit.sha);
    const workPaths = commit.baseWorkPaths.filter((path) =>
      !registration.exemptPaths.some((pattern) => matchesPattern(path, pattern)));
    const subject = { commitSha: commit.sha };
    if (workPaths.length && !commit.completedIds.length) {
      flags.push(flag("FL-3", subject, { commit, workPaths },
        "Work paths changed with no task completed at this commit", "event", commit.sha, false));
    }
    if (commit.completedIds.length) {
      const completedTasks = commit.completedIds.map((taskId) => ({ taskId,
        files: tasks.get(taskId)!.entries.find((entry) => entry.state === "completed" && entry.commitIndex === index)!.files
          .map((file) => ({ path: file.path, paths: file.parsed?.paths ?? { kind: "absent" as const } })),
      }));
      if (completedTasks.some((task) => task.files.some((file) => file.paths.kind === "absent"))) {
        result.scopeNotCheckable.push(commit.sha);
      } else {
        const patterns = completedTasks.flatMap((task) => task.files.flatMap((file) =>
          file.paths.kind === "patterns" ? file.paths.patterns : []));
        const unmatchedPaths = workPaths.filter((path) => !patterns.some((pattern) => matchesPattern(path, pattern)));
        if (unmatchedPaths.length) flags.push(flag("FL-4", subject, { commit, completedTasks, unmatchedPaths },
          "Work paths changed outside the completing tasks' declared Paths", "event", commit.sha, false));
      }
    }
  }
  for (const task of snapshot.tasks) {
    for (const event of task.events) {
      if (event.commitIndex <= baseline) continue;
      const commit = snapshot.commits[event.commitIndex]!;
      const subject = { taskId: task.id, commitSha: commit.sha };
      if (event.kind === "removed" && task.events.some((earlier) => earlier.commitIndex < event.commitIndex &&
        earlier.kind === "enters" && (earlier.state === "approved" || earlier.state === "completed"))) {
        flags.push(flag("FL-9", subject, { commit, lastPaths: event.paths, history: history(task) },
          "A previously approved or completed task was removed from main", "event", commit.sha, false));
      }
      if (event.kind !== "enters") continue;
      if (event.state === "in-progress" || event.state === "review") {
        flags.push(flag("FL-11", { ...subject, state: event.state }, { commit, history: history(task) },
          `The task entered ${event.state}/ on main`, "event", commit.sha, false));
      }
      if (event.state !== "approved" && event.state !== "completed") continue;
      const entry = task.entries.find((entry) => entry.state === event.state && entry.commitIndex === event.commitIndex)!;
      if (event.state === "completed" && (task.firstApproved === null || task.firstApproved >= event.commitIndex)) {
        flags.push(flag("FL-1", subject, { commit, history: history(task), records: entry.files.map((file) => ({
          path: file.path, approvedBy: file.approvedBy, approvedDate: file.approvedDate,
        })) }, "No approval on main was found before this task was completed", "event", commit.sha, false));
      }
      const action = event.state === "approved" ? "approval" : "acceptance";
      const authorCheckFailed = matcher.matchAuthor(commit.author).kind !== "member";
      const recordedNames = entry.files.map((file) => {
        const name = parseName(file.approvedBy ?? "").name;
        return { path: file.path, recordedName: file.approvedBy, name,
          checkFailed: action === "approval" ? name === "" || matcher.matchRecordedName(name).kind !== "member" : null };
      });
      if (authorCheckFailed || recordedNames.some((record) => record.checkFailed)) {
        flags.push(flag("FL-8", { ...subject, action }, { commit, authorCheckFailed, recordedNames },
          "The commit author or recorded approver could not be matched to a board member", "event", commit.sha, true));
      }
    }
    if (task.currentStates.length === 1 && task.currentStates[0] === "approved" && task.latestApproved !== null) {
      const entryCommit = snapshot.commits[task.latestApproved]!;
      const ageDays = (Date.parse(now) - Date.parse(entryCommit.committedAt)) / 86_400_000;
      if (ageDays > registration.staleThresholdDays) flags.push(flag("FL-5",
        { taskId: task.id, entryCommitSha: entryCommit.sha }, {
          taskId: task.id, entryCommit, entryTime: entryCommit.committedAt, ageDays,
          thresholdDays: registration.staleThresholdDays, leadDeveloper: registration.leadDeveloper,
          assignedAgents: task.headFiles.map((file) => ({ path: file.path,
            assignedAgent: file.parsed ? taskField(file.parsed, "Assigned agent")?.value ?? null : null })),
        }, "The task has remained approved longer than the project's threshold", "condition", null, false));
    }
    if (task.headFiles.length > 1) {
      const files = [...task.headFiles].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
      flags.push(flag("FL-6", { taskId: task.id, paths: files.map((file) => file.path) }, {
        paths: files.map((file) => ({ path: file.path, lastAddedCommit: file.lastAddedCommitIndex === null
          ? null : snapshot.commits[file.lastAddedCommitIndex]! })),
      }, "More than one task file has this task ID", "condition", null, false));
    }
  }
  for (const file of snapshot.taskFiles) {
    const classification = file.classification;
    if (classification.kind === "ignored" || classification.kind === "outside") continue;
    let reason: UnreadableReason | null = null;
    if (classification.kind === "stray") reason = classification.reason;
    else if (file.read.kind !== "text") reason = file.read.kind;
    else if (!file.parsed?.isV1) reason = "not_v1";
    if (reason) {
      flags.push(flag("FL-7", { path: file.path, reason }, {
        path: file.path, reason, fields: file.parsed?.header.fields ?? [],
      }, `The task path could not be read as DbC task v1: ${reason}`, "condition", null, false));
    } else if (classification.kind === "task" && file.parsed?.isV1) {
      const problems = v1Problems(file.parsed, classification.state, classification.id);
      if (problems.length) flags.push(flag("FL-2", {
        taskId: classification.id, path: file.path, problems: [...new Set(problems.map(problemKey))].sort(),
      }, { path: file.path, head: snapshot.head, problems, rawHeaderLines: file.parsed.rawHeaderLines },
      "The task file has missing or inconsistent record fields", "condition", null, false));
    }
  }
  flags.sort((a, b) => a.subjectKey < b.subjectKey ? -1 : a.subjectKey > b.subjectKey ? 1 : 0);
  return result;
}

/** FL-10: caller detects the rewrite; TASK-035 later attaches withdrawn flag records. */
export function rewriteFlag(previousHead: string, newHead: string, detectedAt: string,
  comparison: SnapshotComparison): FlagFor<"FL-10"> {
  return flag("FL-10", { previousHead, newHead }, {
    previousHead, newHead, detectedAt, droppedCommitCount: comparison.droppedCommitCount,
    changedTaskIds: [...new Set(comparison.changedTaskIds)].sort(),
  }, "The tracked branch's previously processed history changed", "event", newHead, false);
}
