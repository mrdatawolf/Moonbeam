// CONTRACT-006 P1 and P2: what a path under `tasks/` is.

export const TASK_STATES = ["proposed", "approved", "in-progress", "review", "completed"] as const;
export type TaskState = (typeof TASK_STATES)[number];

export type TaskPath =
  | { kind: "task"; id: string; state: TaskState; slug: string }
  /** `tasks/README.md` and any `.gitkeep` (P2). */
  | { kind: "ignored" }
  /** Any other path under `tasks/`; reported by FL-7 with this reason. */
  | { kind: "stray"; reason: "bad_name" | "not_directly_in_state_directory" | "unknown_directory" }
  /** Not under `tasks/`; P1 and P2 do not apply. */
  | { kind: "outside" };

// P1: at least three digits; the slug is lowercase letters, digits, and hyphens.
const TASK_FILE_NAME = /^(TASK-\d{3,})-([a-z0-9-]+)\.md$/;

export function classifyTaskPath(path: string): TaskPath {
  const parts = path.split("/");
  if (parts[0] !== "tasks" || parts.length < 2) return { kind: "outside" };
  if (path === "tasks/README.md" || parts.at(-1) === ".gitkeep") return { kind: "ignored" };
  if (parts.length === 2) return { kind: "stray", reason: "not_directly_in_state_directory" };

  const state = parts[1]!;
  if (!(TASK_STATES as readonly string[]).includes(state)) return { kind: "stray", reason: "unknown_directory" };
  if (parts.length !== 3) return { kind: "stray", reason: "not_directly_in_state_directory" };

  const match = TASK_FILE_NAME.exec(parts[2]!);
  if (!match) return { kind: "stray", reason: "bad_name" };
  return { kind: "task", id: match[1]!, state: state as TaskState, slug: match[2]! };
}
