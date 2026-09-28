// Paths in a scope envelope (CONTRACT-005 Definitions, Board A1): plain file
// and directory paths relative to the repository root. No globs, not absolute,
// never leaving the root.
import { posix } from "node:path";

const GLOB_CHARS = /[*?[\]{}!]/;

export type PathCheck = { ok: true; path: string } | { ok: false; reason: string };

/** Validate and normalise one path. */
export function checkPath(raw: string): PathCheck {
  const input = raw.trim();
  if (input === "") return { ok: false, reason: "A path may not be empty." };
  if (GLOB_CHARS.test(input)) return { ok: false, reason: `"${raw}" is a glob pattern; use plain paths.` };
  if (input.includes("\\")) return { ok: false, reason: `"${raw}" uses backslashes; use "/" separators.` };
  if (input.startsWith("/") || /^[A-Za-z]:/.test(input) || input.startsWith("~")) {
    return { ok: false, reason: `"${raw}" is absolute; paths are relative to the repository root.` };
  }
  let normalised = posix.normalize(input);
  if (normalised.endsWith("/") && normalised.length > 1) normalised = normalised.slice(0, -1);
  if (normalised === ".." || normalised.startsWith("../")) {
    return { ok: false, reason: `"${raw}" leaves the repository root.` };
  }
  return { ok: true, path: normalised };
}

/** Validate a list; returns normalised, de-duplicated paths or every failing rule. */
export function checkPaths(raw: readonly string[]): { ok: true; paths: string[] } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  const paths: string[] = [];
  for (const p of raw) {
    const r = checkPath(p);
    if (r.ok) {
      if (!paths.includes(r.path)) paths.push(r.path);
    } else reasons.push(r.reason);
  }
  return reasons.length ? { ok: false, reasons } : { ok: true, paths };
}

/** Whether `inner` is equal to, or contained in, `outer`. */
export function pathWithin(inner: string, outer: string): boolean {
  if (outer === ".") return true;
  return inner === outer || inner.startsWith(`${outer}/`);
}

/** Overlap (Board A1): the same file or directory, or one containing the other. */
export function pathsOverlap(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) => b.some((y) => pathWithin(x, y) || pathWithin(y, x)));
}

/** Changed files outside every declared path (a task with no paths: all of them). */
export function filesOutsidePaths(files: readonly string[], paths: readonly string[]): string[] {
  return files.filter((f) => !paths.some((p) => pathWithin(posix.normalize(f), p)));
}
