import { describe, expect, it } from "vitest";
import { classifyTaskPath } from "./task-path.js";

describe("classifyTaskPath (P1, P2)", () => {
  it("P1: reads the ID, state, and slug of a task file", () => {
    expect(classifyTaskPath("tasks/approved/TASK-021-x.md")).toEqual({
      kind: "task",
      id: "TASK-021",
      state: "approved",
      slug: "x",
    });
    expect(classifyTaskPath("tasks/in-progress/TASK-1234-long-slug-2.md")).toMatchObject({ id: "TASK-1234" });
  });

  it("P1: two digits, uppercase slugs, and underscores are not task names", () => {
    for (const name of ["TASK-21-x.md", "TASK-021-Upper.md", "TASK-021-under_score.md", "TASK-021.md", "task-021-x.md"]) {
      expect(classifyTaskPath(`tasks/proposed/${name}`)).toEqual({ kind: "stray", reason: "bad_name" });
    }
  });

  it("P2: ignores tasks/README.md and any .gitkeep", () => {
    expect(classifyTaskPath("tasks/README.md")).toEqual({ kind: "ignored" });
    expect(classifyTaskPath("tasks/completed/.gitkeep")).toEqual({ kind: "ignored" });
    expect(classifyTaskPath("tasks/.gitkeep")).toEqual({ kind: "ignored" });
  });

  it("P2: every other path under tasks/ is stray, with its reason", () => {
    expect(classifyTaskPath("tasks/notes.md")).toEqual({ kind: "stray", reason: "not_directly_in_state_directory" });
    expect(classifyTaskPath("tasks/approved/sub/TASK-001-x.md")).toEqual({
      kind: "stray",
      reason: "not_directly_in_state_directory",
    });
    expect(classifyTaskPath("tasks/archive/TASK-001-x.md")).toEqual({ kind: "stray", reason: "unknown_directory" });
    expect(classifyTaskPath("tasks/proposed/README.md")).toEqual({ kind: "stray", reason: "bad_name" });
  });

  it("paths outside tasks/ are outside", () => {
    expect(classifyTaskPath("docs/tasks/TASK-001-x.md")).toEqual({ kind: "outside" });
    expect(classifyTaskPath("tasks")).toEqual({ kind: "outside" });
  });
});
