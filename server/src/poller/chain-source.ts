import { decodeFile, type ChainCommit, type FileReader } from "@moonbeam/dbc";
import { schema, type Transaction } from "@moonbeam/db";
import { eq } from "drizzle-orm";
import type { Mirror } from "../github/mirror.js";

/** Cache misses are not the same as GitHub's explicit null (unlinked author). */
export async function cachedLogins(tx: Transaction, projectId: string): Promise<Map<string, string | null>> {
  const rows = await tx.select().from(schema.commitLogins).where(eq(schema.commitLogins.projectId, projectId));
  return new Map(rows.map((row) => [row.sha, row.login]));
}
export async function chainSource(mirror: Mirror, head: string, logins: ReadonlyMap<string, string | null>): Promise<{
  chain: ChainCommit[]; readFile: FileReader;
}> {
  const chain = (await mirror.readChain(head)).map((commit): ChainCommit => {
    if (!logins.has(commit.sha)) throw new Error("Commit login lookup incomplete");
    return {
      sha: commit.sha, parents: commit.parents, subject: commit.subject,
      author: { name: commit.authorName, email: commit.authorEmail, login: logins.get(commit.sha)! },
      committer: { name: commit.committerName, email: commit.committerEmail },
      committedAt: commit.committerTime, changes: commit.changes, changesComplete: true,
    };
  });
  return { chain, readFile: async (sha, path) => {
    const file = await mirror.readFile(sha, path);
    return file.kind === "ok" ? decodeFile(file.bytes) : file;
  } };
}
