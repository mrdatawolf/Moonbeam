import type { FileRead } from "../parse/index.js";
import type { ChainCommit, FileReader } from "./types.js";

export interface FixtureCommit {
  sha: string;
  /** Full tree, not a patch. Non-text FileRead values model unreadable tracked files. */
  files: Readonly<Record<string, string | FileRead>>;
  /** Defaults to the preceding fixture commit; [] explicitly makes a root. */
  parents?: readonly string[];
  subject?: string;
  author?: ChainCommit["author"];
  committer?: ChainCommit["committer"];
  committedAt?: string;
  changesComplete?: boolean;
}

/** V1: build a graph, then select only head's first-parent chain, oldest first. */
export function buildChainFixture(fixtures: readonly FixtureCommit[], head = fixtures.at(-1)?.sha): {
  chain: ChainCommit[]; readFile: FileReader;
} {
  const trees = new Map<string, Map<string, FileRead>>();
  const commits = new Map<string, ChainCommit>();
  for (const [index, fixture] of fixtures.entries()) {
    if (trees.has(fixture.sha)) throw new Error(`Duplicate fixture SHA: ${fixture.sha}`);
    const tree = new Map(Object.entries(fixture.files).map(([path, file]) =>
      [path, typeof file === "string" ? { kind: "text" as const, text: file } : { ...file }] as const));
    const preceding = fixtures[index - 1];
    const parents = fixture.parents ?? (preceding ? [preceding.sha] : []);
    const firstParent = parents[0];
    if (firstParent !== undefined && !trees.has(firstParent)) throw new Error(`Missing fixture parent: ${firstParent}`);
    const old = firstParent === undefined ? new Map<string, FileRead>() : trees.get(firstParent)!;
    const changes: ChainCommit["changes"][number][] = [];
    for (const path of [...new Set([...old.keys(), ...tree.keys()])].sort()) {
      if (!tree.has(path)) changes.push({ path, kind: "deleted" });
      else if (!old.has(path)) changes.push({ path, kind: "added" });
      else if (JSON.stringify(old.get(path)) !== JSON.stringify(tree.get(path))) changes.push({ path, kind: "modified" });
    }
    trees.set(fixture.sha, tree);
    commits.set(fixture.sha, {
      sha: fixture.sha, parents: [...parents], subject: fixture.subject ?? fixture.sha,
      author: { ...(fixture.author ?? { name: "Author", email: "author@example.test", login: null }) },
      committer: { ...(fixture.committer ?? { name: "Committer", email: "committer@example.test" }) },
      committedAt: fixture.committedAt ?? "2026-01-01T00:00:00.000Z",
      changes, changesComplete: fixture.changesComplete ?? true,
    });
  }
  const chain: ChainCommit[] = [];
  let sha = head;
  while (sha !== undefined) {
    const commit = commits.get(sha);
    if (!commit) throw new Error(`Missing fixture head or parent: ${sha}`);
    chain.push(commit);
    sha = commit.parents[0];
  }
  chain.reverse();
  return {
    chain,
    readFile: async (commitSha, path) => ({ ...(trees.get(commitSha)?.get(path) ?? { kind: "absent" }) }),
  };
}
