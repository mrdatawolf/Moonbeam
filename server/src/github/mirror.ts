import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GitRunner } from "./git.js";

export interface Change { path: string; kind: "added" | "modified" | "deleted" }
export interface ChainCommit {
  sha: string; parents: string[]; subject: string;
  authorName: string; authorEmail: string; committerName: string; committerEmail: string;
  committerTime: string; changes: Change[];
}
export type FileResult = { kind: "ok"; bytes: Buffer } | { kind: "too_large" } | { kind: "absent" };
export type MirrorFetch = { kind: "ok"; head: string } | { kind: "branch_missing" } | { kind: "unreachable" };
export type RemoteUrlBuilder = (owner: string, repo: string) => string;
export const githubRemoteUrl: RemoteUrlBuilder = (owner, repo) => `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}.git`;
export function mirrorDirectory(projectId: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Invalid project ID");
  return join(env.MOONBEAM_HOME ?? join(homedir(), ".moonbeam"), "mirrors", `${projectId}.git`);
}
const shaPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i;
function checkSha(sha: string): void { if (!shaPattern.test(sha)) throw new Error("Invalid commit SHA"); }
function checkBranch(branch: string): void {
  if (!branch || branch.startsWith("-") || /[\x00-\x20\x7f~^:?*\[\\]/.test(branch) || branch.includes("..") || branch.includes("@{") || branch.split("/").some((p) => !p || p.startsWith(".") || p.endsWith(".") || p.endsWith(".lock"))) throw new Error("Invalid branch");
}

/** One bare, rebuildable cache. The caller serializes operations per project. */
export class Mirror {
  readonly remoteUrl: RemoteUrlBuilder;
  private readonly git: GitRunner;
  readonly directory: string;
  constructor(directory: string, options: { git?: GitRunner; remoteUrl?: RemoteUrlBuilder } = {}) {
    this.directory = resolve(directory);
    this.git = options.git ?? new GitRunner();
    this.remoteUrl = options.remoteUrl ?? githubRemoteUrl;
  }
  private async checked(command: string, args: string[]): Promise<Buffer> {
    const result = await this.git.run(this.directory, command, args);
    if (result.code !== 0) throw new Error("Mirror read failed");
    return result.stdout;
  }
  async ensure(): Promise<void> {
    try { await stat(join(this.directory, "HEAD")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("Mirror initialization failed");
      await mkdir(dirname(this.directory), { recursive: true });
      const result = await this.git.run(dirname(this.directory), "init", ["--bare", "--template=", "--", this.directory]);
      if (result.code !== 0) throw new Error("Mirror initialization failed");
    }
    if ((await this.checked("rev-parse", ["--is-bare-repository"])).toString().trim() !== "true") throw new Error("Mirror must be bare");
  }
  async fetch(url: string, branch: string, token: string): Promise<MirrorFetch> {
    checkBranch(branch);
    let remote: URL;
    try { remote = new URL(url); } catch { throw new Error("Invalid remote URL"); }
    if (!["https:", "file:"].includes(remote.protocol) || remote.username || remote.password || remote.search || remote.hash || (token && url.includes(token))) throw new Error("Invalid remote URL");
    const result = await this.git.run(this.directory, "fetch", ["--no-tags", "--prune", "--no-recurse-submodules", "--", url, `+refs/heads/${branch}:refs/moonbeam/tracked`], remote.protocol === "https:" ? { token, origin: remote.origin } : undefined);
    if (result.code !== 0) return { kind: result.stderr.includes("couldn't find remote ref") ? "branch_missing" : "unreachable" };
    const head = (await this.checked("rev-parse", ["--verify", "refs/moonbeam/tracked^{commit}"])).toString().trim();
    checkSha(head);
    return { kind: "ok", head };
  }
  async readChain(head: string): Promise<ChainCommit[]> {
    checkSha(head);
    const bytes = await this.checked("log", ["--first-parent", "--diff-merges=first-parent", "--no-renames", "--no-ext-diff", "--no-textconv", "--root", "--name-status", "-z", "--reverse", "--format=%x00%H%x00%P%x00%s%x00%an%x00%ae%x00%cn%x00%ce%x00%cI", head, "--"]);
    const fields = bytes.toString("utf8").split("\0");
    const commits: ChainCommit[] = [];
    let i = 0;
    while (i < fields.length) {
      while (fields[i] === "") i++;
      if (i >= fields.length) break;
      const sha = fields[i++]!;
      if (!shaPattern.test(sha) || i + 7 > fields.length) throw new Error("Incomplete mirror change set");
      const parents = fields[i++]!;
      const commit: ChainCommit = { sha, parents: parents ? parents.split(" ") : [], subject: fields[i++]!, authorName: fields[i++]!, authorEmail: fields[i++]!, committerName: fields[i++]!, committerEmail: fields[i++]!, committerTime: fields[i++]!, changes: [] };
      while (i < fields.length && fields[i] !== "") {
        const status = fields[i++]!.replace(/^\n/, "");
        const path = fields[i++];
        if (!["A", "M", "D", "T"].includes(status) || path === undefined || path === "") throw new Error("Incomplete mirror change set");
        commit.changes.push({ path, kind: status === "A" ? "added" : status === "D" ? "deleted" : "modified" });
      }
      commits.push(commit);
    }
    return commits;
  }
  async readFile(sha: string, path: string): Promise<FileResult> {
    checkSha(sha);
    if (!path || path.includes("\0") || path.startsWith("/") || path.split("/").some((part) => part === ".." || part === ".")) throw new Error("Invalid repository path");
    const object = `${sha}:${path}`;
    const size = await this.git.run(this.directory, "cat-file", ["-s", object]);
    if (size.code !== 0) {
      // An invalid/missing commit is a cache failure, not an absent file.
      await this.checked("cat-file", ["-e", `${sha}^{commit}`]);
      if (size.code !== 128 || !/does not exist in|exists on disk, but not in/.test(size.stderr)) throw new Error("Mirror read failed");
      return { kind: "absent" };
    }
    const byteLength = Number(size.stdout.toString().trim());
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error("Mirror read failed");
    if (byteLength > 1024 * 1024) return { kind: "too_large" };
    const type = await this.checked("cat-file", ["-t", object]);
    if (type.toString().trim() !== "blob") return { kind: "absent" };
    return { kind: "ok", bytes: await this.checked("cat-file", ["blob", object]) };
  }
  async isAncestor(a: string, b: string): Promise<boolean> {
    checkSha(a); checkSha(b);
    const result = await this.git.run(this.directory, "merge-base", ["--is-ancestor", a, b]);
    if (result.code > 1 || result.code < 0) throw new Error("Mirror ancestry check failed");
    return result.code === 0;
  }
  async pin(sha: string): Promise<void> {
    checkSha(sha);
    await this.checked("cat-file", ["-e", `${sha}^{commit}`]);
    await this.checked("update-ref", ["refs/moonbeam/last-processed", sha]);
  }
}
