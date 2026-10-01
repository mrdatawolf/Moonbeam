import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { buildMatcher, deriveSnapshot, evaluateFlags, type ChainCommit, type FlagEvaluation, type ProjectSnapshot } from "@moonbeam/dbc";
import { GitRunner } from "../github/git.js";
import { Mirror } from "../github/mirror.js";
import { chainSource } from "../poller/chain-source.js";

const PINNED_SHA = "86be7ffb3b5e6f8f6cca472fe1530136b0d62c5e";
const directory = fileURLToPath(new URL("../../../.git", import.meta.url));
// Reject mutations before spawning git, even if a future helper starts using them.
class ReadOnlyGit extends GitRunner {
  override run(cwd: string, command: string, args: readonly string[] = []) {
    if (!["rev-parse", "log", "cat-file"].includes(command)) throw new Error(`V9 refuses git ${command}`);
    return super.run(cwd, command, args);
  }
}
const git = new ReadOnlyGit();
const shallow = existsSync(directory) ? await git.run(directory, "rev-parse", ["--is-shallow-repository"]) : null;
const skipReason = !shallow ? "repository .git is missing" : shallow.stdout.toString().trim() === "true" ? "repository is shallow" : null;
if (shallow && shallow.code !== 0) throw new Error("V9 could not inspect repository .git");
if (skipReason) console.warn(`Skipping V9 walkthrough: ${skipReason}`);
let snapshot: ProjectSnapshot;
let runs: FlagEvaluation[];
let chain: ChainCommit[];
const label = (sha: string) => {
  const commit = snapshot.commits.find((c) => c.sha === sha)!;
  return `${sha.slice(0, 7)} ${commit.subject}`;
};
const sorted = (values: string[]) => values.sort();
function evaluateBoth(snapshot: ProjectSnapshot): FlagEvaluation[] {
  const root = chain[0]!;
  // I1: include the registry e-mail, as poller/poll.ts does, using the Patrick
  // fixture in packages/dbc/src/identity/matcher.test.ts. No live user data.
  return [true, false].map((extra) => evaluateFlags(snapshot, {
    baselineSha: root.sha, baselineCommittedAt: root.committedAt, exemptPaths: [], staleThresholdDays: 14, leadDeveloper: null,
  }, buildMatcher([{ userId: "p", displayName: "Patrick", active: true, emails: ["patrick@example.com", ...(extra ? ["patrickmoon@outlook.com"] : [])], logins: [], aliases: [] }]), chain.at(-1)!.committedAt));
}
describe.skipIf(Boolean(skipReason))(`V9 pinned repository walkthrough${skipReason ? ` (skipped: ${skipReason})` : ""}`, () => {
  beforeAll(async () => {
    const mirror = new Mirror(directory, { git });
    const commits = await mirror.readChain(PINNED_SHA);
    const source = await chainSource(mirror, PINNED_SHA, new Map(commits.map((c) => [c.sha, null])));
    chain = source.chain;
    snapshot = await deriveSnapshot(source.chain, source.readFile);
    runs = evaluateBoth(snapshot);
  });
  for (const [index, identity] of ["configured plus Outlook e-mail", "configured e-mail only"].entries()) {
    describe(identity, () => {
      const flags = (rule: string) => runs[index]!.flags.filter((f) => f.rule === rule);
      const commitFlags = (rule: string) => sorted(flags(rule).map((f) => label(f.subjectCommitSha!)));

      it("V9.1: FL-7 for every task file at head, no FL-2", () => {
        const files = snapshot.taskFiles.filter((f) => f.classification.kind === "task");
        expect({ head: label(PINNED_SHA), files: files.length,
          unreadable: flags("FL-7").map((f) => f.subject), incomplete: flags("FL-2") }, label(PINNED_SHA)).toEqual({
          head: label(PINNED_SHA), files: 42,
          unreadable: files.map((f) => ({ path: f.path, reason: "not_v1" })), incomplete: [],
        });
      });

      it("V9.2: FL-11 for every dispatch and review entry, including rework", () => {
        // Use actual lifecycle entries, not just subjects: multi-task dispatches,
        // worktree merges and 'both to review' must also be covered.
        const entries = snapshot.tasks.flatMap((t) => t.events.flatMap((e) =>
          e.kind === "enters" && (e.state === "in-progress" || e.state === "review")
            ? [`${t.id} ${e.state} ${label(snapshot.commits[e.commitIndex]!.sha)}`] : []));
        expect({ count: flags("FL-11").length, entries: sorted(flags("FL-11").map((f) => {
          if (f.rule !== "FL-11") throw new Error("Expected FL-11");
          return `${f.subject.taskId} ${f.subject.state} ${label(f.subject.commitSha)}`;
        })) }, `Dispatch/review entries through ${label(PINNED_SHA)}`).toEqual({ count: 81, entries: sorted(entries) });
      });

      it("V9.3: FL-3 for to-review commits with non-task changes", () => {
        const reviews = chain.filter((c) => /\((?:both )?to review\)/.test(c.subject) &&
          c.changes.some((change) => !change.path.startsWith("tasks/")));
        expect({ count: reviews.length, missing: reviews.filter((c) =>
          !flags("FL-3").some((f) => f.subjectCommitSha === c.sha)).map((c) => label(c.sha)) },
        reviews.map((c) => label(c.sha)).join("\n")).toEqual({ count: 37, missing: [] });
      });

      it("V9.4: no FL-3 for acceptances with only tasks or exempt document headers", () => {
        // baseWorkPaths is the adapter/engine's Q4 header-aware work set.
        const acceptances = snapshot.commits.filter((c) => c.completedIds.length && !c.baseWorkPaths.length);
        expect({ count: acceptances.length, flagged: commitFlags("FL-3").filter((labelled) =>
          acceptances.some((c) => label(c.sha) === labelled)) }, acceptances.map((c) => label(c.sha)).join("\n"))
          .toEqual({ count: 13, flagged: [] });
      });

      it("V9.5: records the observed FL-1 exceptions and early approvals", () => {
        // Contract expectation: no FL-1 for TASK-004 onward. Observed instead:
        // TASK-012, TASK-014 and TASK-015 never enter approved/ on this chain.
        // TASK-001..003 are approved at the root (retained as baseline context).
        expect({ flagged: flags("FL-1").map((f) => {
          if (f.rule !== "FL-1") throw new Error("Expected FL-1");
          return `${f.subject.taskId} ${label(f.subject.commitSha)}`;
        }), early: snapshot.tasks.slice(0, 3).map((t) => ({ id: t.id, approved: t.firstApproved })) },
        `FL-1 through ${label(PINNED_SHA)}`).toEqual({ flagged: [
          "TASK-012 1d78ccc Board approves CONTRACT-002..004, accepts TASK-004/005/009/010/011/012, approves TASK-013",
          "TASK-014 860e2be Board: approve ADR-007, adopt defaults for 001-Q26/004-Q25/Q26, accept TASK-013/014; dispatch TASK-006 with scope boundaries",
          "TASK-015 707c085 Board accepts TASK-015 (moved by Patrick)",
        ], early: ["TASK-001", "TASK-002", "TASK-003"].map((id) => ({ id, approved: 0 })) });
      });

      it("V9.6: TASK-001..003 completion scope is not checkable", () => {
        expect(snapshot.tasks.slice(0, 3).map((t) => {
          const sha = snapshot.commits[t.firstCompleted!]!.sha;
          return { task: t.id, commit: label(sha), notCheckable: runs[index]!.scopeNotCheckable.includes(sha),
            flagged: flags("FL-4").some((f) => f.subjectCommitSha === sha) };
        }), "TASK-001..003: 2851241 stage 1").toEqual(["TASK-001", "TASK-002", "TASK-003"].map((task) => ({
          task, commit: "2851241 stage 1", notCheckable: true, flagged: false,
        })));
      });

      it("V9.7: FL-8 on every evaluated approval/acceptance only without Outlook", () => {
        // Root approvals supply context but are not evaluated (baseline is exclusive).
        const entries = snapshot.tasks.flatMap((t) => t.entries.filter((e) => e.commitIndex > 0).map((e) =>
          `${t.id} ${e.state === "approved" ? "approval" : "acceptance"} ${label(snapshot.commits[e.commitIndex]!.sha)}`));
        expect({ count: entries.length, flags: sorted(flags("FL-8").map((f) => {
          if (f.rule !== "FL-8") throw new Error("Expected FL-8");
          return `${f.subject.taskId} ${f.subject.action} ${label(f.subject.commitSha)}`;
        })) }, `Approval/acceptance identities through ${label(PINNED_SHA)}`)
          .toEqual({ count: 76, flags: index === 0 ? [] : sorted(entries) });
      });

      it("V9.8: no FL-5 or FL-6 at the pinned head time", () => {
        // V9's explanation names TASK-021 in-progress; at this later pin it is
        // completed. The expected absence of FL-5/FL-6 still holds.
        expect({ stale: flags("FL-5"), duplicate: flags("FL-6"),
          task021: snapshot.tasks.find((t) => t.id === "TASK-021")!.currentStates }, label(PINNED_SHA))
          .toEqual({ stale: [], duplicate: [], task021: ["completed"] });
      });
    });
  }
  // V9's local 2026-09-25 reset is intentionally excluded: no reflog or FL-10 input.
  it("N3: re-derivation of the pinned chain is deterministic", async () => {
    const mirror = new Mirror(directory, { git });
    const source = await chainSource(mirror, PINNED_SHA, new Map(chain.map((c) => [c.sha, null])));
    const rebuilt = await deriveSnapshot(source.chain, source.readFile);
    expect({ head: rebuilt.head, commits: rebuilt.commits.length, rootParents: source.chain[0]!.parents,
      snapshot: rebuilt, evaluations: evaluateBoth(rebuilt) }, label(PINNED_SHA))
      .toEqual({ head: PINNED_SHA, commits: 116, rootParents: [], snapshot, evaluations: runs });
  });
});
