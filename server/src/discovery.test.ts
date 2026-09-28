import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { discoverRepositories, DISCOVERY_LIMITS, suggestMainBranch } from "./discovery.js";
import { RegistryService } from "./registry.js";
import type { Database } from "@moonbeam/db";

let scratch: string;
let root: string;
beforeEach(async () => { scratch = await mkdtemp(join(tmpdir(), "discovery-")); root = join(scratch, "root"); await mkdir(root); });
afterEach(async () => { await rm(scratch, { recursive: true, force: true }); });
async function repo(name: string, branch = "main") {
  const path = join(root, name); await mkdir(path, { recursive: true });
  execFileSync("git", ["init", "-b", branch, path], { stdio: "ignore" });
  return path;
}
it("finds nested repositories, stops at repositories, skips hidden folders, node_modules and outside symlinks; excludes registered", async () => {
  const a = await repo("team/a"); await repo("team/a/inner");
  const b = await repo("deep/team/b"); await repo(".hidden/c"); await repo("node_modules/d");
  const registered = await repo("registered"); await repo("registered/inner");
  const outside = join(scratch, "outside"); await mkdir(join(outside, ".git"), { recursive: true });
  await symlink(outside, join(root, "outside")); await symlink(root, join(root, "cycle"));
  await symlink(a, join(root, "alias"));
  const before = await readFile(join(a, ".git/HEAD"), "utf8");
  const result = await discoverRepositories(root, [registered]);
  expect(result).toEqual({ repositories: [
    { path: b, relativePath: "deep/team/b", suggestedName: "b", suggestedMainBranch: "main" },
    { path: a, relativePath: "team/a", suggestedName: "a", suggestedMainBranch: "main" },
  ], truncated: false });
  expect(await readFile(join(a, ".git/HEAD"), "utf8")).toBe(before);
});
it("supports .git files and leaves an unavailable branch suggestion editable", async () => {
  const path = join(root, "broken"); await mkdir(path); await writeFile(join(path, ".git"), "gitdir: /nonexistent\n");
  expect((await discoverRepositories(root, [])).repositories[0]?.suggestedMainBranch).toBe("");
});
it("suggests main, then master, then current branch; detached HEAD has no suggestion", async () => {
  const path = await repo("branches", "trunk");
  const git = (...args: string[]) => execFileSync("git", ["-C", path, ...args], { stdio: "ignore" });
  expect(await suggestMainBranch(path)).toBe("trunk");
  git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-m", "initial");
  git("branch", "master"); expect(await suggestMainBranch(path)).toBe("master");
  git("branch", "main"); expect(await suggestMainBranch(path)).toBe("main");
  git("branch", "-D", "main", "master"); git("checkout", "--detach");
  expect(await suggestMainBranch(path)).toBe("");
});
it("returns partial results at depth, folder and time caps", async () => {
  await repo("a/b/c");
  for (const cap of [{ maxDepth: 1 }, { maxFolders: 1 }, { maxMilliseconds: 0 }]) {
    expect((await discoverRepositories(root, [], { ...DISCOVERY_LIMITS, ...cap })).truncated).toBe(true);
  }
  expect((await discoverRepositories(root, [], { ...DISCOVERY_LIMITS, maxDepth: 3, maxFolders: 4 })).truncated).toBe(false);
});
it("refuses unset and missing roots with validation", async () => {
  for (const path of [null, join(root, "missing")]) await expect(discoverRepositories(path, [])).rejects.toMatchObject({ category: "validation" });
});
it("refuses agents before accessing the database or filesystem", async () => {
  const registry = new RegistryService({ db: {} as Database, clock: () => new Date(), installDir: scratch, dataDir: scratch });
  await expect(registry.discoverProjects({ kind: "agent", runId: "run", taskId: "task", projectId: "project", role: "implementer", model: "test", credentialId: "credential" })).rejects.toMatchObject({ category: "not_permitted" });
});
