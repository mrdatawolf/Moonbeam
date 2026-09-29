import { expect, it } from "vitest";
import { buildChainFixture } from "./fixtures.js";

it("V1 H3: fixture diffs use the first parent, root uses empty tree, renames are delete/add", async () => {
  const fixture = buildChainFixture([
    { sha: "a", files: { old: "same", modified: "before" } },
    { sha: "branch", files: { old: "same", modified: "branch", extra: "branch" } },
    { sha: "merge", parents: ["a", "branch"], files: { renamed: "same", modified: "after", extra: "branch" } },
  ]);
  expect(fixture.chain.map((commit) => commit.sha)).toEqual(["a", "merge"]);
  expect(fixture.chain[0]?.changes).toEqual([{ path: "modified", kind: "added" }, { path: "old", kind: "added" }]);
  expect(fixture.chain[1]?.changes).toEqual([
    { path: "extra", kind: "added" }, { path: "modified", kind: "modified" },
    { path: "old", kind: "deleted" }, { path: "renamed", kind: "added" },
  ]);
  expect(await fixture.readFile("branch", "extra")).toEqual({ kind: "text", text: "branch" });
  expect(await fixture.readFile("merge", "old")).toEqual({ kind: "absent" });
});

it("V1 H9: supports explicit heads, empty fixtures, and detached roots", () => {
  const fixtures = [{ sha: "a", files: {} }, { sha: "b", parents: [], files: {} }];
  expect(buildChainFixture(fixtures, "a").chain.map((c) => c.sha)).toEqual(["a"]);
  expect(buildChainFixture(fixtures).chain.map((c) => c.sha)).toEqual(["b"]);
  expect(buildChainFixture([]).chain).toEqual([]);
});

it("V1: invalid fixture graphs fail clearly", () => {
  expect(() => buildChainFixture([{ sha: "a", parents: ["missing"], files: {} }])).toThrow("Missing fixture parent");
  expect(() => buildChainFixture([{ sha: "a", files: {} }, { sha: "a", files: {} }])).toThrow("Duplicate fixture SHA");
  expect(() => buildChainFixture([], "missing")).toThrow("Missing fixture head");
});
