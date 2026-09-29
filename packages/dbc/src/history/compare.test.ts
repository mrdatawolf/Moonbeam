import { expect, it } from "vitest";
import { compareSnapshots } from "./compare.js";
import { deriveSnapshot } from "./derive.js";
import { buildChainFixture, type FixtureCommit } from "./fixtures.js";

async function snapshot(commits: FixtureCommit[]) {
  const fixture = buildChainFixture(commits);
  return deriveSnapshot(fixture.chain, fixture.readFile);
}
const proposed = "tasks/proposed/TASK-001-example.md";
const approved = "tasks/approved/TASK-001-example.md";

it("FL-10: counts dropped commits and changed, vanished, and new histories", async () => {
  const root = { sha: "root", files: { [proposed]: "task" } };
  const previous = await snapshot([root, { sha: "old", files: { [approved]: "task", "tasks/approved/TASK-002-other.md": "task" } }]);
  const next = await snapshot([root, { sha: "new", files: { [proposed]: "task", "tasks/approved/TASK-003-new.md": "task" } }]);
  expect(compareSnapshots(previous, next)).toEqual({ droppedCommitCount: 1, changedTaskIds: ["TASK-001", "TASK-002", "TASK-003"] });
});

it("FL-10 H4: shifting commit indexes without changing event facts is not a changed history", async () => {
  const event = { sha: "event", files: { [proposed]: "task" } };
  const previous = await snapshot([event]);
  const next = await snapshot([{ sha: "empty", files: {} }, event]);
  expect(compareSnapshots(previous, next)).toEqual({ droppedCommitCount: 0, changedTaskIds: [] });
});

it("FL-10 H3: text-only edits and new work commits do not change event history", async () => {
  const root = { sha: "root", files: { [proposed]: "task" } };
  const previous = await snapshot([root]);
  const next = await snapshot([root, { sha: "edit", files: { [proposed]: "changed", "src/a": "work" } }]);
  expect(compareSnapshots(previous, next)).toEqual({ droppedCommitCount: 0, changedTaskIds: [] });
  expect(compareSnapshots(next, next)).toEqual({ droppedCommitCount: 0, changedTaskIds: [] });
});

it("FL-10 H4: the same transition on a replacement commit changes history", async () => {
  const previous = await snapshot([{ sha: "old", files: { [approved]: "task" } }]);
  const next = await snapshot([{ sha: "new", files: { [approved]: "task" } }]);
  expect(compareSnapshots(previous, next)).toEqual({ droppedCommitCount: 1, changedTaskIds: ["TASK-001"] });
});
