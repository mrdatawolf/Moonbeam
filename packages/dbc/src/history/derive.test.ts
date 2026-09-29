import { describe, expect, it } from "vitest";
import { deriveSnapshot } from "./derive.js";
import { buildChainFixture, type FixtureCommit } from "./fixtures.js";
import { SNAPSHOT_VERSION } from "./types.js";

const path = (state: string, slug = "example", id = "001") => `tasks/${state}/TASK-${id}-${slug}.md`;
const text = (name = "Board", date = "2020-02-29", scope = "src/**") =>
  `# TASK-001: Example\nFormat: DbC task v1\nApproved by: ${name}\nApproved date: ${date}\n## Scope\n### Paths\n- \`${scope}\`\n`;
async function derive(fixtures: FixtureCommit[]) {
  const fixture = buildChainFixture(fixtures);
  return deriveSnapshot(fixture.chain, fixture.readFile);
}

describe("deriveSnapshot", () => {
  it("H1 H2 H3: preserves ID across moves and slug changes, with exact events", async () => {
    const snapshot = await derive([
      { sha: "a", files: { [path("proposed")]: text() } },
      { sha: "b", files: { [path("approved", "renamed")]: text() } },
      { sha: "c", files: { [path("approved", "another")]: text() } },
      { sha: "d", files: {} },
    ]);
    expect(snapshot.tasks).toHaveLength(1);
    expect(snapshot.tasks[0]?.events).toEqual([
      { kind: "enters", state: "proposed", commitIndex: 0 },
      { kind: "leaves", state: "proposed", commitIndex: 1 },
      { kind: "enters", state: "approved", commitIndex: 1 },
      { kind: "leaves", state: "approved", commitIndex: 3 },
      { kind: "removed", commitIndex: 3 },
    ]);
    expect(snapshot.tasks[0]?.currentStates).toEqual(["removed"]);
  });

  it("H2 H3 H7: duplicates in one or several directories use set presence", async () => {
    const approved = path("approved");
    const duplicate = path("approved", "duplicate");
    const completed = path("completed");
    const snapshot = await derive([
      { sha: "a", files: { [approved]: text(), [duplicate]: text() } },
      { sha: "b", files: { [duplicate]: text(), [completed]: text() } },
    ]);
    expect(snapshot.tasks[0]?.events).toEqual([
      { kind: "enters", state: "approved", commitIndex: 0 },
      { kind: "enters", state: "completed", commitIndex: 1 },
    ]);
    expect(snapshot.tasks[0]?.currentStates).toEqual(["approved", "completed"]);
    expect(snapshot.tasks[0]?.entries[0]?.files.map((f) => f.path)).toEqual([duplicate, approved].sort());
    expect(snapshot.tasks[0]?.headFiles).toHaveLength(2);
  });

  it("H3 H4 H5 V1: only first-parent events exist and merge changes include branch work", async () => {
    const fixture = buildChainFixture([
      { sha: "root", files: { [path("proposed")]: text() } },
      { sha: "approval", files: { [path("approved")]: text() } },
      { sha: "branch", files: { [path("review")]: text(), "src/a.ts": "code" } },
      { sha: "merge", parents: ["approval", "branch"], subject: "Accept task",
        author: { name: "Human", email: "human@test", login: "human" },
        committer: { name: "Bot", email: "bot@test" }, committedAt: "2026-09-28T17:00:00Z",
        files: { [path("completed")]: text(), "src/a.ts": "code" } },
    ]);
    const snapshot = await deriveSnapshot(fixture.chain, fixture.readFile);
    expect(snapshot.chainShas).toEqual(["root", "approval", "merge"]);
    expect(snapshot.tasks[0]?.events).toEqual([
      { kind: "enters", state: "proposed", commitIndex: 0 },
      { kind: "leaves", state: "proposed", commitIndex: 1 },
      { kind: "enters", state: "approved", commitIndex: 1 },
      { kind: "leaves", state: "approved", commitIndex: 2 },
      { kind: "enters", state: "completed", commitIndex: 2 },
    ]);
    expect(snapshot.tasks[0]).toMatchObject({ firstProposed: 0, firstApproved: 1, firstCompleted: 2,
      latestApproved: 1, acceptance: { commitIndex: 2, kind: "merged" } });
    expect(snapshot.commits[2]).toEqual({ sha: "merge", subject: "Accept task",
      author: { name: "Human", email: "human@test", login: "human" },
      committer: { name: "Bot", email: "bot@test" }, committedAt: "2026-09-28T17:00:00Z",
      isMerge: true, baseWorkPaths: ["src/a.ts"], completedIds: ["TASK-001"], changesComplete: true });
  });

  it("H5 H6: first dates stay fixed, latest approval advances, and direct acceptance stays first", async () => {
    const states = ["proposed", "approved", "in-progress", "review", "approved", "completed", "approved", "completed"];
    const snapshot = await derive(states.map((state, i) => ({ sha: String(i), files: { [path(state)]: text() } })));
    expect(snapshot.tasks[0]).toMatchObject({ firstProposed: 0, firstApproved: 1, latestApproved: 6,
      firstCompleted: 5, acceptance: { commitIndex: 5, kind: "direct" } });
    expect(snapshot.tasks[0]?.events.filter((e) => e.kind === "enters").map((e) => "state" in e && e.state)).toEqual(states);
    expect(snapshot.tasks[0]?.entries.map((e) => e.commitIndex)).toEqual([1, 4, 5, 6, 7]);
  });

  it("H7: only-ever-proposed is withdrawn; reintroduced IDs retain history", async () => {
    const snapshot = await derive([
      { sha: "a", files: { [path("proposed")]: text(), [path("review", "other", "002")]: "bad" } },
      { sha: "b", files: {} }, { sha: "c", files: { [path("proposed")]: text() } },
      { sha: "d", files: {} },
    ]);
    expect(snapshot.tasks.map((task) => task.currentStates)).toEqual([["withdrawn"], ["removed"]]);
    expect(snapshot.tasks[0]?.firstProposed).toBe(0);
    expect(snapshot.tasks[0]?.events.filter((e) => e.kind === "removed")).toHaveLength(2);
  });

  it("H8: head headers are per-file, unreconciled, and entry files keep historical parses", async () => {
    const snapshot = await derive([
      { sha: "a", files: { [path("approved")]: text("First", "2020-02-29", "old/**") } },
      { sha: "b", files: { [path("completed")]: text("Second", "not-a-date", "new/**") } },
      { sha: "c", files: { [path("completed")]: text("Third", "1999-01-01"),
        [path("completed", "duplicate")]: text("Fourth", "") } },
    ]);
    const task = snapshot.tasks[0]!;
    expect(task.entries.map((entry) => entry.files[0]?.approvedBy)).toEqual(["First", "Second"]);
    expect(task.entries.map((entry) => entry.files[0]?.parsed?.paths)).toEqual([
      { kind: "patterns", patterns: ["old/**"] }, { kind: "patterns", patterns: ["new/**"] },
    ]);
    expect(task.headFiles.map((file) => [file.approvedBy, file.approvedDate])).toEqual([
      ["Fourth", ""], ["Third", "1999-01-01"],
    ]);
    expect(task.headFiles.map((file) => file.lastAddedCommitIndex)).toEqual([2, 1]);
  });

  it.each(["too_large", "not_utf8", "absent"] as const)("P10 N4: %s files stay present at entries and head", async (kind) => {
    const snapshot = await derive([{ sha: "a", files: { [path("approved")]: { kind } } }]);
    expect(snapshot.tasks[0]?.currentStates).toEqual(["approved"]);
    expect(snapshot.tasks[0]?.entries[0]?.files[0]).toMatchObject({ read: { kind }, parsed: null });
    expect(snapshot.taskFiles[0]).toMatchObject({ read: { kind }, parsed: null });
  });

  it("N4 F8: malformed, pre-v1, ignored and stray head files are inventoried", async () => {
    const snapshot = await derive([{ sha: "a", files: {
      [path("proposed")]: "garbage\nApproved by: A\nApproved by: B",
      "tasks/unknown/file.md": "???", "tasks/README.md": "readme", "tasks/proposed/.gitkeep": "",
    } }]);
    expect(snapshot.taskFiles).toHaveLength(4);
    expect(snapshot.taskFiles.map((file) => file.classification.kind).sort()).toEqual(["ignored", "ignored", "stray", "task"]);
    expect(snapshot.tasks[0]?.headFiles[0]?.parsed).toMatchObject({ title: null, isV1: false,
      header: { duplicates: ["Approved by"] } });
  });

  it("Q4 W(C): task records and header edits are excluded, body edits remain", async () => {
    const contract = "docs/contracts/CONTRACT-001-example.md";
    const adr = "docs/decisions/ADR-001-example.md";
    const body = "## Body\nunchanged";
    const snapshot = await derive([
      { sha: "a", files: { [contract]: `Status: Proposed\n${body}`, [adr]: `Status: Proposed\n${body}` } },
      { sha: "b", files: { [contract]: `Status: Approved\n${body}`, [adr]: `Status: Approved\n${body}`,
        [path("approved")]: text(), "tasks/stray.txt": "record" } },
      { sha: "c", files: { [contract]: "Status: Approved\n## Body\nchanged", [adr]: `Status: Approved\n${body}` } },
    ]);
    expect(snapshot.commits.map((commit) => commit.baseWorkPaths)).toEqual([[contract, adr].sort(), [], [contract]]);
  });

  it("Q4 W(C): added, deleted, sectionless and unreadable documents remain work", async () => {
    const a = "docs/contracts/new.md", b = "docs/decisions/no-section.md", c = "docs/contracts/unreadable.md";
    const snapshot = await derive([
      { sha: "a", files: { [a]: "## Body\n", [b]: "Status: Proposed", [c]: { kind: "not_utf8" } } },
      { sha: "b", files: { [b]: "Status: Approved", [c]: "Status: Approved\n## Body\n" } },
    ]);
    expect(snapshot.commits.map((commit) => commit.baseWorkPaths)).toEqual([[a, b, c].sort(), [a, b, c].sort()]);
  });

  it("F7 R1 R2 R3 R6: artifacts remain without tasks, with unknown and unreadable outcomes", async () => {
    const snapshot = await derive([{ sha: "a", files: {
      "docs/contracts/CONTRACT-001-example.md": "# CONTRACT-001: Contract\nStatus: Approved\n## Body\nsecret body",
      "docs/decisions/ADR-001-example.md": "# ADR-001: Decision\nDate: 2026-09-29",
      "docs/decisions/ADR-002-bad.md": "bad",
      "docs/contracts/CONTRACT-002-bad.md": { kind: "too_large" },
      "docs/PROJECT.md": { kind: "not_utf8" }, "docs/contracts/README.md": "ignore",
    } }]);
    expect(snapshot.hasTasksDirectory).toBe(false);
    expect(snapshot.artifacts).toHaveLength(4);
    expect(snapshot.artifacts.map((artifact) => artifact.parsed?.kind ?? null)).toEqual(["contract", null, "adr", "unknown"]);
    expect(snapshot.project).toEqual({ path: "docs/PROJECT.md", present: true, read: { kind: "not_utf8" } });
    expect(JSON.stringify(snapshot)).not.toContain("secret body");
  });

  it("F7 R3: ignored tracked paths establish tasks directory; deletion removes it", async () => {
    const fixture = buildChainFixture([
      { sha: "a", files: { "tasks/.gitkeep": "", "docs/PROJECT.md": "# Goals" } },
      { sha: "b", files: {} },
    ]);
    const first = await deriveSnapshot(fixture.chain.slice(0, 1), fixture.readFile);
    expect(first.hasTasksDirectory).toBe(true);
    expect(first.project).toMatchObject({ present: true, read: { kind: "text" } });
    const next = await deriveSnapshot(fixture.chain, fixture.readFile);
    expect(next.hasTasksDirectory).toBe(false);
    expect(next.project).toMatchObject({ present: false, read: { kind: "absent" } });
  });

  it("F9 N4: incomplete changes are carried and a previously unseen modified file is tolerated", async () => {
    const fixture = buildChainFixture([{ sha: "a", files: { [path("approved")]: text(), "src/a.ts": "a" }, changesComplete: false }]);
    fixture.chain[0]!.changes = [{ path: path("approved"), kind: "modified" }, { path: "src/a.ts", kind: "modified" }];
    const snapshot = await deriveSnapshot(fixture.chain, fixture.readFile);
    expect(snapshot.commits[0]).toMatchObject({ changesComplete: false, baseWorkPaths: ["src/a.ts"] });
    expect(snapshot.taskFiles[0]?.lastAddedCommitIndex).toBeNull();
  });

  it("H9 N3 V3: rebuilds and prefix polling agree despite change order and read completion order", async () => {
    const fixture = buildChainFixture([
      { sha: "a", files: { [path("approved")]: text(), [path("approved", "other", "002")]: "bad" } },
      { sha: "b", files: { [path("completed")]: text(), [path("completed", "other", "002")]: "bad" } },
    ]);
    const original = JSON.stringify(fixture.chain);
    const expected = await deriveSnapshot(fixture.chain, fixture.readFile);
    for (let length = 0; length <= fixture.chain.length; length++) {
      await deriveSnapshot(fixture.chain.slice(0, length), fixture.readFile);
    }
    const reversed = fixture.chain.map((commit) => ({ ...commit, changes: [...commit.changes].reverse() }));
    const actual = await deriveSnapshot(reversed, async (sha, file) => {
      await new Promise((resolve) => setTimeout(resolve, file.includes("002") ? 0 : 2));
      return fixture.readFile(sha, file);
    });
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
    expect(JSON.parse(JSON.stringify(actual))).toEqual(actual);
    expect(JSON.stringify(fixture.chain)).toBe(original);
    expect(actual.version).toBe(SNAPSHOT_VERSION);
  });

  it("H9 F7: an empty chain yields an empty serializable snapshot without reads", async () => {
    const snapshot = await deriveSnapshot([], async () => { throw new Error("unexpected read"); });
    expect(snapshot).toEqual({ version: SNAPSHOT_VERSION, head: null, chainShas: [], commits: [], tasks: [], taskFiles: [],
      hasTasksDirectory: false, artifacts: [], project: { path: "docs/PROJECT.md", present: false, read: { kind: "absent" } } });
  });

  it("H2: reads only entries, header-only candidates and head inventory", async () => {
    const fixture = buildChainFixture([
      { sha: "a", files: { [path("proposed")]: text(), "src/a.ts": "work" } },
      { sha: "b", files: { [path("approved")]: text(), "src/a.ts": "work" } },
      { sha: "c", files: { [path("approved")]: text("Updated"), "src/a.ts": "more work" } },
    ]);
    const reads: string[] = [];
    await deriveSnapshot(fixture.chain, async (sha, file) => { reads.push(`${sha}:${file}`); return fixture.readFile(sha, file); });
    expect(reads).toEqual([`b:${path("approved")}`, `c:${path("approved")}`]);
  });
});
