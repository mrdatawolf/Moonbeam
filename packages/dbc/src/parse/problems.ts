// CONTRACT-006 P6 and FL-2: the problems of a DbC task v1 file in a given state.
// Flags use this only for v1 files; a file that is not v1 raises FL-7 instead (P9).

import { fieldKey } from "./header.js";
import type { TaskState } from "./task-path.js";
import type { ParsedTaskFile } from "./task-file.js";
import { isValidDate } from "./values.js";

export type V1Problem =
  | { kind: "missing_title" }
  | { kind: "title_id_mismatch"; titleId: string; fileId: string }
  | { kind: "missing_field"; field: string }
  | { kind: "empty_field"; field: string }
  | { kind: "invalid_date"; field: string; value: string }
  | { kind: "duplicate_field"; field: string }
  | { kind: "paths_missing" }
  | { kind: "paths_empty" };

const ALL_STATES: readonly TaskState[] = ["proposed", "approved", "in-progress", "review", "completed"];
const FROM_APPROVAL: readonly TaskState[] = ["approved", "in-progress", "review", "completed"];

/** P6: header fields required per state. Title and Paths are checked separately; Format is P9. */
export const REQUIRED_FIELDS: readonly { field: string; states: readonly TaskState[] }[] = [
  { field: "Proposed by", states: ALL_STATES },
  { field: "Proposed date", states: ALL_STATES },
  { field: "Approved by", states: FROM_APPROVAL },
  { field: "Approved date", states: FROM_APPROVAL },
  { field: "Related contracts", states: ALL_STATES },
  { field: "Related ADRs", states: ALL_STATES },
  { field: "Dependencies", states: ALL_STATES },
];

const DATE_FIELDS = ["Proposed date", "Approved date"];

export function v1Problems(parsed: ParsedTaskFile, state: TaskState, fileId: string): V1Problem[] {
  const problems: V1Problem[] = [];

  if (!parsed.title) problems.push({ kind: "missing_title" });
  else if (parsed.title.id !== fileId) {
    problems.push({ kind: "title_id_mismatch", titleId: parsed.title.id, fileId });
  }

  for (const { field, states } of REQUIRED_FIELDS) {
    if (!states.includes(state)) continue;
    const found = parsed.header.fields.find((f) => f.key === fieldKey(field));
    if (!found) problems.push({ kind: "missing_field", field });
    else if (found.value === "") problems.push({ kind: "empty_field", field });
  }

  // A date field that is present and non-empty must be valid, whatever the state.
  for (const field of DATE_FIELDS) {
    const found = parsed.header.fields.find((f) => f.key === fieldKey(field));
    if (found && found.value !== "" && !isValidDate(found.value)) {
      problems.push({ kind: "invalid_date", field, value: found.value });
    }
  }

  for (const field of parsed.header.duplicates) problems.push({ kind: "duplicate_field", field });

  if (FROM_APPROVAL.includes(state)) {
    if (parsed.paths.kind === "absent") problems.push({ kind: "paths_missing" });
    else if (parsed.paths.kind === "empty") problems.push({ kind: "paths_empty" });
  }

  return problems;
}

/** A stable key for one problem. FL-2's subject includes the set of problems. */
export function problemKey(problem: V1Problem): string {
  switch (problem.kind) {
    case "title_id_mismatch":
      return `${problem.kind}:${problem.titleId}:${problem.fileId}`;
    case "missing_field":
    case "empty_field":
    case "duplicate_field":
      return `${problem.kind}:${fieldKey(problem.field)}`;
    case "invalid_date":
      return `${problem.kind}:${fieldKey(problem.field)}:${problem.value}`;
    default:
      return problem.kind;
  }
}
