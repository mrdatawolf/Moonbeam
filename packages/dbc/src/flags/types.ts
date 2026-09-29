import type { CommitFacts, SnapshotComparison, TaskEvent } from "../history/index.js";
import type { HeaderField, PathsSection, TaskPath, V1Problem } from "../parse/index.js";

export interface FlagRegistration {
  baselineSha: string;
  baselineCommittedAt: string;
  exemptPaths: readonly string[];
  staleThresholdDays: number;
  leadDeveloper: { userId: string; displayName: string } | null;
}

/** Self-contained event evidence: indexes alone would not survive a rebuild. */
export type FlagHistoryEvent = TaskEvent & { commit: CommitFacts };
type TaskCommit = { taskId: string; commitSha: string };
type ApprovalRecord = { path: string; approvedBy: string | null; approvedDate: string | null };
export type UnreadableReason = Extract<TaskPath, { kind: "stray" }>["reason"] |
  "too_large" | "not_utf8" | "absent" | "not_v1";

interface RuleData {
  "FL-1": { subject: TaskCommit; evidence: { commit: CommitFacts; history: FlagHistoryEvent[]; records: ApprovalRecord[] } };
  "FL-2": { subject: { taskId: string; path: string; problems: string[] }; evidence: { path: string; head: string | null; problems: V1Problem[]; rawHeaderLines: string[] } };
  "FL-3": { subject: { commitSha: string }; evidence: { commit: CommitFacts; workPaths: string[] } };
  "FL-4": { subject: { commitSha: string }; evidence: { commit: CommitFacts; completedTasks: { taskId: string; files: { path: string; paths: PathsSection }[] }[]; unmatchedPaths: string[] } };
  "FL-5": { subject: { taskId: string; entryCommitSha: string }; evidence: { taskId: string; entryCommit: CommitFacts; entryTime: string; ageDays: number; thresholdDays: number; leadDeveloper: FlagRegistration["leadDeveloper"]; assignedAgents: { path: string; assignedAgent: string | null }[] } };
  "FL-6": { subject: { taskId: string; paths: string[] }; evidence: { paths: { path: string; lastAddedCommit: CommitFacts | null }[] } };
  "FL-7": { subject: { path: string; reason: UnreadableReason }; evidence: { path: string; reason: UnreadableReason; fields: HeaderField[] } };
  "FL-8": { subject: TaskCommit & { action: "approval" | "acceptance" }; evidence: { commit: CommitFacts; authorCheckFailed: boolean; recordedNames: { path: string; recordedName: string | null; name: string; checkFailed: boolean | null }[] } };
  "FL-9": { subject: TaskCommit; evidence: { commit: CommitFacts; lastPaths: string[]; history: FlagHistoryEvent[] } };
  "FL-10": { subject: { previousHead: string; newHead: string }; evidence: SnapshotComparison & { previousHead: string; newHead: string; detectedAt: string } };
  "FL-11": { subject: TaskCommit & { state: "in-progress" | "review" }; evidence: { commit: CommitFacts; history: FlagHistoryEvent[] } };
}
export type FlagRule = keyof RuleData;
type ConditionRule = "FL-2" | "FL-5" | "FL-6" | "FL-7";
export type FlagFor<R extends FlagRule> = {
  subject: RuleData[R]["subject"];
  evidence: RuleData[R]["evidence"];
  rule: R;
  /** Canonical JSON tuple [rule, subject]; sets are sorted before encoding. Project-local. */
  subjectKey: string;
  kind: R extends ConditionRule ? "condition" : "event";
  /** FG5: event commit SHA (new head for FL-10); conditions have no subject commit. */
  subjectCommitSha: R extends ConditionRule ? null : string;
  autoResolves: R extends "FL-8" ? true : false;
  message: string;
};
export type EvaluatedFlag = { [R in FlagRule]: FlagFor<R> }[FlagRule];
export interface FlagEvaluation {
  flags: EvaluatedFlag[];
  baselineNeedsReset: boolean;
  /** F6 fallback or configured baseline; null means no chain commit met the cutoff. */
  effectiveBaselineSha: string | null;
  evaluatedCommitShas: string[];
  scopeNotCheckable: string[];
  notFullyChecked: string[];
}
