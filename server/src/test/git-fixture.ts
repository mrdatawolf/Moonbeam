import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { isolatedGitEnvironment } from "../github/git.js";

const exec = promisify(execFile);
export interface FixtureIdentity { name: string; email: string }
export interface FixtureCommitOptions {
  subject?: string; author?: FixtureIdentity; committer?: FixtureIdentity; time?: string;
}
const identity = { name: "Fixture Author", email: "author@example.test" };

/** Writes only under its own temporary directory; never uses host git config. */
export class GitFixture {
  readonly work: string;
  readonly remote: string;
  readonly url: string;
  private tick = 0;
  private constructor(readonly directory: string) {
    this.work = join(directory, "work");
    this.remote = join(directory, "remote.git");
    this.url = pathToFileURL(this.remote).href;
  }
  static async create(): Promise<GitFixture> {
    const fixture = new GitFixture(await mkdtemp(join(tmpdir(), "moonbeam-git-")));
    try {
      await mkdir(fixture.work);
      await fixture.git(["init", "--initial-branch=main", "--template="]);
      await fixture.git(["init", "--bare", "--template=", fixture.remote]);
      return fixture;
    } catch (error) { await fixture.dispose(); throw error; }
  }
  async git(args: string[], extra: NodeJS.ProcessEnv = {}, cwd = this.work): Promise<string> {
    const env = { ...isolatedGitEnvironment(), GIT_CONFIG_COUNT: "3", GIT_CONFIG_KEY_0: "credential.helper", GIT_CONFIG_VALUE_0: "", GIT_CONFIG_KEY_1: "core.hooksPath", GIT_CONFIG_VALUE_1: "/dev/null", GIT_CONFIG_KEY_2: "commit.gpgSign", GIT_CONFIG_VALUE_2: "false", ...extra };
    const result = await exec("git", args, { cwd, env });
    return result.stdout.trim();
  }
  private commitEnv(options: FixtureCommitOptions): NodeJS.ProcessEnv {
    const author = options.author ?? identity;
    const committer = options.committer ?? identity;
    const time = options.time ?? new Date(Date.UTC(2025, 0, 1, 0, 0, this.tick++)).toISOString();
    return { GIT_AUTHOR_NAME: author.name, GIT_AUTHOR_EMAIL: author.email, GIT_COMMITTER_NAME: committer.name, GIT_COMMITTER_EMAIL: committer.email, GIT_AUTHOR_DATE: time, GIT_COMMITTER_DATE: time };
  }
  async commit(files: Record<string, string | Buffer | null>, options: FixtureCommitOptions = {}): Promise<string> {
    for (const [path, bytes] of Object.entries(files)) {
      const target = resolve(this.work, path);
      if (!target.startsWith(this.work + sep) || target.startsWith(join(this.work, ".git") + sep) || target === join(this.work, ".git")) throw new Error("Invalid fixture path");
      if (bytes === null) await rm(target, { force: true });
      else { await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes); }
    }
    await this.git(["add", "--all"]);
    await this.git(["commit", "--allow-empty", "-m", options.subject ?? "fixture commit"], this.commitEnv(options));
    return this.head();
  }
  head(): Promise<string> { return this.git(["rev-parse", "HEAD"]); }
  async branch(name: string, start?: string): Promise<void> { await this.git(["checkout", "-b", name, ...(start ? [start] : [])]); }
  async checkout(name: string): Promise<void> { await this.git(["checkout", name]); }
  async merge(branch: string, options: FixtureCommitOptions = {}): Promise<string> {
    await this.git(["merge", "--no-ff", "-m", options.subject ?? "merge fixture", branch], this.commitEnv(options));
    return this.head();
  }
  async squash(branch: string, options: FixtureCommitOptions = {}): Promise<string> {
    await this.git(["merge", "--squash", branch], this.commitEnv(options));
    return this.commit({}, options);
  }
  async fastForward(branch: string): Promise<string> { await this.git(["merge", "--ff-only", branch]); return this.head(); }
  async reset(sha: string): Promise<void> { await this.git(["reset", "--hard", sha]); }
  async publish(branch = "main"): Promise<void> { await this.git(["push", "--force", this.url, `refs/heads/${branch}:refs/heads/${branch}`]); }
  async dispose(): Promise<void> { await rm(this.directory, { recursive: true, force: true }); }
}
