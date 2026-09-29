import { describe, expect, it, vi } from "vitest";
import { buildChainFixture, compareSnapshots, deriveSnapshot, type FixtureCommit } from "../history/index.js";
import { buildMatcher } from "../identity/index.js";
import { evaluateFlags, rewriteFlag } from "./index.js";
import type { FlagRegistration, FlagRule } from "./index.js";

const p = (state: string, id = "001", slug = "sample") => `tasks/${state}/TASK-${id}-${slug}.md`;
const text = (id = "001", paths = "- `src/`", extra = "") => `# TASK-${id}: Example

Format: DbC task v1
Proposed by: Board
Proposed date: 2026-01-01
Approved by: Board (recorded note)
Approved date: 2026-01-01
Related contracts: None
Related ADRs: None
Dependencies: None
Assigned agent: Agent (model)
${extra}
## Scope
### Paths
${paths}
`;
const registration: FlagRegistration = {
  baselineSha: "root", baselineCommittedAt: "2026-01-01T00:00:00Z", exemptPaths: [],
  staleThresholdDays: 14, leadDeveloper: { userId: "board", displayName: "Board" },
};
const members = [{ userId: "board", displayName: "Board", active: true,
  emails: ["author@example.test"], logins: [], aliases: [] }];
const matcher = buildMatcher(members);
const now = "2026-01-20T00:00:00Z";
async function snapshot(commits: FixtureCommit[]) {
  const fixture = buildChainFixture(commits);
  return deriveSnapshot(fixture.chain, fixture.readFile);
}
async function evaluate(commits: FixtureCommit[], settings: Partial<FlagRegistration> = {}, at = now) {
  return evaluateFlags(await snapshot(commits), { ...registration, ...settings }, matcher, at);
}
function rules(result: ReturnType<typeof evaluateFlags>, rule: FlagRule) {
  return result.flags.filter((flag) => flag.rule === rule);
}
const root: FixtureCommit = { sha: "root", files: {} };

describe("CONTRACT-006 flag evaluation", () => {
  it("FL-1: completion without older approval carries facts, headers and full event history", async () => {
    const s = await snapshot([root, { sha: "done", files: { [p("completed")]: text() } }]);
    const f = evaluateFlags(s, registration, matcher, now).flags.find((f) => f.rule === "FL-1")!;
    expect(f.subject).toEqual({ taskId: "TASK-001", commitSha: "done" });
    expect(f.evidence).toEqual({ commit: s.commits[1],
      history: [{ ...s.tasks[0]!.events[0], commit: s.commits[1] }],
      records: [{ path: p("completed"), approvedBy: "Board (recorded note)", approvedDate: "2026-01-01" }] });
  });

  it("FL-1: older approval before baseline prevents a flag for a later merge", async () => {
    const r = await evaluate([{ sha: "root", files: { [p("approved")]: text() } },
      { sha: "side", parents: ["root"], files: { [p("completed")]: text() } },
      { sha: "merge", parents: ["root", "side"], files: { [p("completed")]: text(), "src/a": "work" } }]);
    expect(r.flags).toEqual([]);
    expect(r.evaluatedCommitShas).toEqual(["merge"]);
  });

  it("FL-1: approval in the completion commit is not an earlier approval", async () => {
    expect(rules(await evaluate([root, { sha: "both", files: {
      [p("approved")]: text(), [p("completed")]: text(),
    } }]), "FL-1")).toHaveLength(1);
  });

  it("FL-2/P4: preserves duplicate values, whitespace and continuation evidence; problem-set keys change", async () => {
    const first = text("001", "- None", "  Proposed by: Alice  \n  duplicate continuation\n\n");
    const second = first.replace("Alice", "Bob");
    const a = await evaluate([root, { sha: "head", files: { [p("proposed")]: first } }]);
    const b = await evaluate([root, { sha: "head", files: { [p("proposed")]: second } }]);
    const fa = a.flags.find((f) => f.rule === "FL-2")!;
    const fb = b.flags.find((f) => f.rule === "FL-2")!;
    expect(fa.evidence.problems).toEqual([{ kind: "duplicate_field", field: "Proposed by" }]);
    expect(fa.evidence.rawHeaderLines).toContain("  Proposed by: Alice  ");
    expect(fa.evidence.rawHeaderLines).toContain("  duplicate continuation");
    expect(fa.evidence.rawHeaderLines).toContain("");
    expect(fa.evidence.rawHeaderLines).not.toEqual(fb.evidence.rawHeaderLines);
    expect(fa.subjectKey).toBe(fb.subjectKey);
    const c = await evaluate([root, { sha: "head", files: {
      [p("proposed")]: first.replace("Proposed date: 2026-01-01", "Proposed date: bad"),
    } }]);
    expect(c.flags.find((f) => f.rule === "FL-2")!.subjectKey).not.toBe(fa.subjectKey);
  });

  it("FL-2/P9: valid v1 and malformed pre-v1 files never raise incomplete-record flags", async () => {
    const r = await evaluate([root, { sha: "head", files: {
      [p("approved")]: text(), [p("proposed", "002")]: "# Old file\n",
    } }]);
    expect(rules(r, "FL-2")).toEqual([]);
    expect(rules(r, "FL-7")).toHaveLength(1);
  });

  it("FL-2: reports required fields, dates, title mismatch and empty Paths at head", async () => {
    const r = await evaluate([root, { sha: "head", files: { [p("completed")]: text("002", "")
      .replace("Proposed by: Board\n", "").replace("Approved by: Board (recorded note)", "Approved by:")
      .replace("Approved date: 2026-01-01", "Approved date: 2026-02-30") } }]);
    const f = r.flags.find((f) => f.rule === "FL-2")!;
    expect(f.evidence.problems.map((p) => p.kind)).toEqual([
      "title_id_mismatch", "missing_field", "empty_field", "invalid_date", "paths_empty",
    ]);
  });

  it("FL-3: reports non-exempt work paths with complete commit facts", async () => {
    const s = await snapshot([root, { sha: "work", files: { "src/a": "a", "docs/a": "b" } }]);
    const f = evaluateFlags(s, { ...registration, exemptPaths: ["docs/"] }, matcher, now)
      .flags.find((f) => f.rule === "FL-3")!;
    expect(f.evidence).toEqual({ commit: s.commits[1], workPaths: ["src/a"] });
  });

  it("FL-3: proposals, approvals and header-only contract edits are not work", async () => {
    const contract = "# Contract\nStatus: Proposed\n## Body\nSame\n";
    const r = await evaluate([{ sha: "root", files: { "docs/contracts/CONTRACT-001.md": contract } },
      { sha: "proposal", files: { [p("proposed")]: text(), "docs/contracts/CONTRACT-001.md": contract } },
      { sha: "approval", files: { [p("approved")]: text(),
        "docs/contracts/CONTRACT-001.md": contract.replace("Proposed", "Approved") } }]);
    expect(rules(r, "FL-3")).toEqual([]);
  });

  it("FL-3/Q5: P7 exempt patterns suppress work flags", async () => {
    const r = await evaluate([root, { sha: "work", files: { "src/deep/a.ts": "a" } }], { exemptPaths: ["./src/**"] });
    expect(rules(r, "FL-3")).toEqual([]);
  });

  it("FL-4: compares against the union of all completing tasks and names every task", async () => {
    const r = await evaluate([root, { sha: "done", files: {
      [p("completed")]: text(), [p("completed", "002")]: text("002", "- `docs/`"),
      "src/a": "a", "docs/a": "a", "other/a": "a",
    } }]);
    const f = r.flags.find((f) => f.rule === "FL-4")!;
    expect(f.evidence.unmatchedPaths).toEqual(["other/a"]);
    expect(f.evidence.completedTasks).toEqual([
      { taskId: "TASK-001", files: [{ path: p("completed"), paths: { kind: "patterns", patterns: ["src/"] } }] },
      { taskId: "TASK-002", files: [{ path: p("completed", "002"), paths: { kind: "patterns", patterns: ["docs/"] } }] },
    ]);
  });

  it.each(["src", "src/", "**", "./src/**", "/src/**"])("FL-4/P7/P9: pre-v1 pattern %s accounts for work", async (pattern) => {
    const r = await evaluate([root, { sha: "done", files: {
      [p("completed")]: text("001", `- ${pattern}`).replace("Format: DbC task v1\n", ""), "src/deep/a": "a",
    } }]);
    expect(rules(r, "FL-4")).toEqual([]);
    expect(r.scopeNotCheckable).toEqual([]);
  });

  it.each(["absent", "unreadable"])("FL-4: any completing task with %s Paths makes scope uncheckable", async (kind) => {
    const r = await evaluate([root, { sha: "done", files: {
      [p("completed")]: text(), [p("completed", "002")]: kind === "absent"
        ? text("002").split("### Paths")[0]! : { kind: "not_utf8" }, "other/a": "a",
    } }]);
    expect(rules(r, "FL-4")).toEqual([]);
    expect(r.scopeNotCheckable).toEqual(["done"]);
  });

  it.each(["", "- None"])("FL-4: a present Paths section with no patterns (%s) does not account for work", async (paths) => {
    const r = await evaluate([root, { sha: "done", files: { [p("completed")]: text("001", paths), "src/a": "a" } }]);
    expect(rules(r, "FL-4")).toHaveLength(1);
    expect(r.scopeNotCheckable).toEqual([]);
    expect(rules(await evaluate([root, { sha: "done", files: { [p("completed")]: text("001", paths), "src/a": "a" } }],
      { exemptPaths: ["src"] }), "FL-4")).toEqual([]);
  });

  it("FL-5/L2: uses the latest entry time, explicit now, lead and per-file assigned agents", async () => {
    const r = await evaluate([root, { sha: "old", files: { [p("approved")]: text() } },
      { sha: "leave", files: { [p("proposed")]: text() } },
      { sha: "new", committedAt: "2026-01-05T00:00:00Z", files: { [p("approved")]: text() } }]);
    const f = r.flags.find((f) => f.rule === "FL-5")!;
    expect(f.subject).toEqual({ taskId: "TASK-001", entryCommitSha: "new" });
    expect(f.evidence).toMatchObject({ entryTime: "2026-01-05T00:00:00Z", ageDays: 15, thresholdDays: 14,
      leadDeveloper: registration.leadDeveloper, assignedAgents: [{ path: p("approved"), assignedAgent: "Agent (model)" }] });
  });

  it("FL-5: exactly the threshold, recent re-entry, or another current state are near misses", async () => {
    expect(rules(await evaluate([root, { sha: "a", files: { [p("approved")]: text() } }], {},
      "2026-01-15T00:00:00Z"), "FL-5")).toEqual([]);
    expect(rules(await evaluate([root, { sha: "a", files: { [p("approved")]: text() } },
      { sha: "b", files: {} }, { sha: "c", committedAt: "2026-01-19T00:00:00Z", files: { [p("approved")]: text() } }]), "FL-5")).toEqual([]);
    expect(rules(await evaluate([root, { sha: "a", files: { [p("approved")]: text(), [p("review")]: text() } }]), "FL-5")).toEqual([]);
  });

  it("FL-6: duplicate path set is canonical and each path names its most recent addition", async () => {
    const a = p("proposed"), b = p("proposed", "001", "other");
    const r = await evaluate([root, { sha: "a", files: { [a]: text(), [b]: text() } },
      { sha: "b", files: { [b]: text() } }, { sha: "c", files: { [a]: text(), [b]: text() + "edit" } }]);
    const f = r.flags.find((f) => f.rule === "FL-6")!;
    expect(f.subject.paths).toEqual([b, a]);
    expect(f.evidence.paths.map((p) => [p.path, p.lastAddedCommit?.sha])).toEqual([[b, "a"], [a, "c"]]);
    expect(rules(await evaluate([root, { sha: "one", files: { [a]: text() } }]), "FL-6")).toEqual([]);
  });

  it.each([
    ["tasks/approved/wrong.md", "text", "bad_name"],
    ["tasks/approved/nested/TASK-001-x.md", "text", "not_directly_in_state_directory"],
    ["tasks/root.md", "text", "not_directly_in_state_directory"],
    ["tasks/unknown/TASK-001-x.md", "text", "unknown_directory"],
    [p("approved"), "too_large", "too_large"],
    [p("approved"), "not_utf8", "not_utf8"],
    [p("approved"), "absent", "absent"],
    [p("approved"), "text", "not_v1"],
  ] as const)("FL-7/P2/P9/P10/N4: %s (%s) has reason %s", async (path, kind, reason) => {
    const r = await evaluate([root, { sha: "head", files: {
      [path]: kind === "text" ? "Proposed by: Someone\n" : { kind },
      [p("proposed", "002")]: text("002"),
    } }]);
    const f = r.flags.find((f) => f.rule === "FL-7")!;
    expect(f.subject).toEqual({ path, reason });
    expect(f.evidence.fields).toEqual(kind === "text"
      ? [{ name: "Proposed by", key: "proposed by", value: "Someone", line: 1 }] : []);
    expect(rules(r, "FL-2")).toEqual([]);
  });

  it("FL-7: ignored paths and valid v1 tasks raise no unreadable flag", async () => {
    const r = await evaluate([root, { sha: "head", files: {
      "tasks/README.md": "anything", "tasks/unknown/.gitkeep": { kind: "not_utf8" }, [p("proposed")]: text(),
    } }]);
    expect(rules(r, "FL-7")).toEqual([]);
  });

  it.each(["approved", "completed"])("FL-8/I2/FG3: unmatched %s author is flagged, remapping resolves it", async (state) => {
    const s = await snapshot([root, { sha: "event", files: { [p(state)]: text() },
      author: { name: "Board", email: "unknown@example.test", login: null },
      committer: { name: "Board", email: "author@example.test" } }]);
    const f = evaluateFlags(s, registration, matcher, now).flags.find((f) => f.rule === "FL-8")!;
    expect(f.autoResolves).toBe(true);
    expect(f.evidence.authorCheckFailed).toBe(true);
    expect(f.subject.action).toBe(state === "approved" ? "approval" : "acceptance");
    const mapped = buildMatcher([{ ...members[0]!, emails: ["unknown@example.test"] }]);
    expect(rules(evaluateFlags(s, registration, mapped, now), "FL-8")).toEqual([]);
  });

  it.each(["", "Unknown"])("FL-8: empty/unmatched recorded approval name (%s) is checked at the event", async (name) => {
    const r = await evaluate([root, { sha: "approval", files: {
      [p("approved")]: text().replace("Board (recorded note)", name),
    } }, { sha: "fixed", files: { [p("approved")]: text() } }]);
    const f = r.flags.find((f) => f.rule === "FL-8")!;
    expect(f.evidence.authorCheckFailed).toBe(false);
    expect(f.evidence.recordedNames).toEqual([{ path: p("approved"), recordedName: name, name, checkFailed: true }]);
    expect(f.subject.commitSha).toBe("approval");
  });

  it("FL-8/P9/I4: best-effort names are used and ambiguous identities fail both checks", async () => {
    const s = await snapshot([root, { sha: "approval", files: {
      [p("approved")]: text().replace("Format: DbC task v1\n", ""),
    } }]);
    expect(rules(evaluateFlags(s, registration, matcher, now), "FL-8")).toEqual([]);
    const ambiguous = buildMatcher([...members, { ...members[0]!, userId: "other" }]);
    const f = evaluateFlags(s, registration, ambiguous, now).flags.find((f) => f.rule === "FL-8")!;
    expect(f.evidence.authorCheckFailed).toBe(true);
    expect(f.evidence.recordedNames[0]!.checkFailed).toBe(true);
  });

  it("FL-8: acceptance checks only author; an unmatched committer and recorded name are near misses", async () => {
    const r = await evaluate([root, { sha: "done", files: {
      [p("completed")]: text().replace("Board (recorded note)", "Unknown"),
    } }]);
    expect(rules(r, "FL-8")).toEqual([]);
  });

  it.each(["approved", "completed"])("FL-9: removal after %s retains the path at each removal despite reappearance", async (state) => {
    const old = p(state, "001", "old"), renamed = p(state, "001", "renamed");
    const r = await evaluate([root, { sha: "entry", files: { [old]: text() } },
      { sha: "rename", files: { [renamed]: text() } }, { sha: "removed", files: {} },
      { sha: "again", files: { [p("proposed")]: text() } }, { sha: "removed-again", files: {} }]);
    const found = r.flags.filter((f) => f.rule === "FL-9");
    expect(found).toHaveLength(2);
    expect(found.find((f) => f.subject.commitSha === "removed")!.evidence.lastPaths).toEqual([renamed]);
    expect(found.find((f) => f.subject.commitSha === "removed-again")!.evidence.lastPaths).toEqual([p("proposed")]);
    expect(found[0]!.evidence.history.every((event) => event.commit.sha.length > 0)).toBe(true);
  });

  it("FL-9: a withdrawn proposal and removal of only one duplicate are near misses", async () => {
    expect(rules(await evaluate([root, { sha: "p", files: { [p("proposed")]: text() } },
      { sha: "gone", files: {} }]), "FL-9")).toEqual([]);
    expect(rules(await evaluate([root, { sha: "a", files: { [p("approved")]: text(), [p("completed")]: text() } },
      { sha: "b", files: { [p("completed")]: text() } }]), "FL-9")).toEqual([]);
  });

  it("FL-10/F6/FG5: rewrite helper carries comparison evidence independently of baseline", async () => {
    const before = await snapshot([root, { sha: "old", files: { [p("approved")]: text() } }]);
    const after = await snapshot([root, { sha: "new", files: { [p("completed", "002")]: text("002") } }]);
    const f = rewriteFlag("old", "new", now, compareSnapshots(before, after));
    expect(f.evidence).toEqual({ previousHead: "old", newHead: "new", detectedAt: now,
      droppedCommitCount: 1, changedTaskIds: ["TASK-001", "TASK-002"] });
    expect(f.subject).toEqual({ previousHead: "old", newHead: "new" });
    expect(f.subjectCommitSha).toBe("new");
    expect(rules(evaluateFlags(after, { ...registration, baselineSha: "new" }, matcher, now), "FL-10")).toEqual([]);
    // The helper does not detect ancestry; ordinary fast-forward detection is TASK-034.
    expect(rules(evaluateFlags(before, registration, matcher, now), "FL-10")).toEqual([]);
  });

  it("FL-11: raises once per entry into each work state, not for edits or leaving", async () => {
    const r = await evaluate([root, { sha: "start", files: { [p("in-progress")]: text() } },
      { sha: "edit", files: { [p("in-progress")]: text() + "edit" } },
      { sha: "review", files: { [p("review")]: text() } }, { sha: "done", files: { [p("completed")]: text() } }]);
    const found = r.flags.filter((f) => f.rule === "FL-11");
    expect(found.map((f) => f.subject)).toEqual([
      { taskId: "TASK-001", commitSha: "review", state: "review" },
      { taskId: "TASK-001", commitSha: "start", state: "in-progress" },
    ]);
    expect(found.every((f) => f.evidence.history.length === 5)).toBe(true);
  });

  it("Baseline: excludes root, baseline and older event flags; all condition rules ignore baseline", async () => {
    const s = await snapshot([{ sha: "root", files: { "src/a": "work", [p("completed")]: text() } },
      { sha: "baseline", files: { [p("approved", "002")]: text("002"),
        [p("proposed", "003")]: "Format: DbC task v1\n", [p("proposed", "004")]: "old",
        [p("proposed", "004", "copy")]: text("004"), "src/a": "more" } }]);
    const r = evaluateFlags(s, { ...registration, baselineSha: "baseline" }, matcher, now);
    expect(r.evaluatedCommitShas).toEqual([]);
    expect(r.flags.map((f) => f.rule).sort()).toEqual(["FL-2", "FL-5", "FL-6", "FL-7"]);
    expect(r.flags.every((f) => f.kind === "condition" && f.subjectCommitSha === null)).toBe(true);
  });

  it("F6: missing baseline uses newest eligible chain position even with nonmonotonic times", async () => {
    const commits: FixtureCommit[] = [root,
      { sha: "future", committedAt: "2026-01-10T00:00:00Z", files: { "a": "1" } },
      { sha: "eligible", committedAt: "2026-01-02T00:00:00Z", files: { "a": "2" } },
      { sha: "head", committedAt: "2026-01-09T00:00:00Z", files: { "a": "3" } }];
    const r = await evaluate(commits, { baselineSha: "gone", baselineCommittedAt: "2026-01-03T00:00:00Z" });
    expect(r).toMatchObject({ baselineNeedsReset: true, effectiveBaselineSha: "eligible", evaluatedCommitShas: ["head"] });
    expect(rules(r, "FL-3")).toHaveLength(1);
    const all = await evaluate(commits, { baselineSha: "gone", baselineCommittedAt: "2025-01-01T00:00:00Z" });
    expect(all.effectiveBaselineSha).toBeNull();
    expect(all.evaluatedCommitShas).toEqual(["root", "future", "eligible", "head"]);
    const none = await evaluate(commits, { baselineSha: "gone", baselineCommittedAt: "2027-01-01T00:00:00Z" });
    expect(none.evaluatedCommitShas).toEqual([]);
    expect(none.baselineNeedsReset).toBe(true);
  });

  it("F9: incomplete change sets still evaluate FL-3/FL-4 and annotate evaluated commits", async () => {
    const r = await evaluate([{ ...root, changesComplete: false },
      { sha: "work", changesComplete: false, files: { "a": "1" } },
      { sha: "done", changesComplete: false, files: { [p("completed")]: text(), "a": "2" } }]);
    expect(r.notFullyChecked).toEqual(["work", "done"]);
    expect(rules(r, "FL-3")).toHaveLength(1);
    expect(rules(r, "FL-4")).toHaveLength(1);
  });

  it("N3/UX4/FG2/FG5: deterministic, JSON-safe, observational, no clock or input mutation", async () => {
    const s = await snapshot([root, { sha: "head", files: {
      [p("completed")]: text(), [p("approved", "002")]: "old", [p("review", "003")]: text("003"), "other": "x",
    } }]);
    const before = JSON.stringify(s);
    const readClock = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("clock read"); });
    try {
      const a = evaluateFlags(s, registration, buildMatcher([]), now);
      expect(evaluateFlags(s, registration, buildMatcher([]), now)).toEqual(a);
      expect(JSON.parse(JSON.stringify(a))).toEqual(a);
      expect(JSON.stringify(s)).toBe(before);
      expect(new Set(a.flags.map((f) => f.subjectKey)).size).toBe(a.flags.length);
      for (const f of a.flags) {
        expect(f.message).not.toMatch(/violation|blocked/i);
        if (f.kind === "event") expect(s.chainShas).toContain(f.subjectCommitSha);
      }
    } finally { readClock.mockRestore(); }
  });

  it("N4/F7: empty snapshots evaluate without stopping", async () => {
    expect(await evaluate([])).toEqual({ flags: [], baselineNeedsReset: true, effectiveBaselineSha: null,
      evaluatedCommitShas: [], scopeNotCheckable: [], notFullyChecked: [] });
  });
});
