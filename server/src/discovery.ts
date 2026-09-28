import { execFile } from "node:child_process";
import { lstat, opendir, realpath, stat } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { promisify } from "node:util";
import type { ProjectDiscovery } from "@moonbeam/shared";
import { reject } from "./errors.js";

const run = promisify(execFile);
export const DISCOVERY_LIMITS = { maxDepth: 32, maxFolders: 10_000, maxMilliseconds: 10_000 };

async function hasGit(path: string) {
  try { await lstat(join(path, ".git")); return true; } catch { return false; }
}

/** Read only: local refs first, then the symbolic HEAD (also works before the first commit). */
export async function suggestMainBranch(path: string, timeout = 1_000): Promise<string> {
  const git = async (...args: string[]) => (await run("git", ["-C", path, ...args], { timeout, maxBuffer: 1024 * 1024 })).stdout.trim();
  for (const branch of ["main", "master"]) {
    try { await git("show-ref", "--verify", "--quiet", `refs/heads/${branch}`); return branch; } catch { /* try next */ }
  }
  try { return await git("symbolic-ref", "--quiet", "--short", "HEAD"); } catch { return ""; }
}

/** Symlink directories are skipped: in-root targets are reached through their real tree. */
export async function discoverRepositories(
  projectsRoot: string | null,
  registered: readonly string[],
  limits = DISCOVERY_LIMITS,
): Promise<ProjectDiscovery> {
  if (!projectsRoot) reject("validation", "Set the projects root before searching for repositories.");
  let root: string;
  try {
    root = await realpath(projectsRoot!);
    if (!(await stat(root)).isDirectory()) throw new Error();
  } catch { return reject("validation", "The projects root is missing or is not an accessible directory."); }
  const repositories: ProjectDiscovery["repositories"] = [];
  const excluded = new Set(registered);
  let truncated = false;
  let visited = 0;
  const deadline = Date.now() + limits.maxMilliseconds;
  const exhausted = () => visited >= limits.maxFolders || Date.now() >= deadline;
  async function walk(path: string, depth: number): Promise<void> {
    if (exhausted()) { truncated = true; return; }
    visited++;
    if (await hasGit(path)) {
      if (depth > 0 && !excluded.has(path)) repositories.push({
        path, relativePath: relative(root, path), suggestedName: basename(path),
        suggestedMainBranch: await suggestMainBranch(path, Math.max(1, Math.min(1_000, Math.floor((deadline - Date.now()) / 3)))),
      });
      return;
    }
    try {
      const directory = await opendir(path);
      for await (const entry of directory) {
        if (Date.now() >= deadline) { truncated = true; break; }
        if (entry.name.startsWith(".") || entry.name === "node_modules" || !entry.isDirectory()) continue;
        if (depth >= limits.maxDepth || exhausted()) { truncated = true; break; }
        const child = join(path, entry.name);
        // Recheck real location immediately before traversal, as registration does.
        if (await realpath(child).catch(() => null) !== child) continue;
        await walk(child, depth + 1);
      }
    } catch {
      if (depth === 0) reject("validation", "The projects root cannot be read.");
      truncated = true; // unreadable/removed subfolders make this a partial result
    }
  }
  await walk(root!, 0);
  return { repositories: repositories.sort((a, b) => a.relativePath.localeCompare(b.relativePath)), truncated };
}
