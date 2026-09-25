// Mirror of the server's path rule (CONTRACT-001 Definitions, Board A1; server
// `lifecycle/paths.ts`): plain paths relative to the repository root, no
// globs, not absolute, never leaving the root. Used to say before approving
// why the server would refuse; the server stays the authority.
const GLOB_CHARS = /[*?[\]{}!]/;

export function pathProblem(raw: string): string | null {
  const input = raw.trim();
  if (input === "") return "A path may not be empty.";
  if (GLOB_CHARS.test(input)) return `"${raw}" is a glob pattern; use plain paths.`;
  if (input.includes("\\")) return `"${raw}" uses backslashes; use "/" separators.`;
  if (input.startsWith("/") || /^[A-Za-z]:/.test(input) || input.startsWith("~")) {
    return `"${raw}" is absolute; paths are relative to the repository root.`;
  }
  const parts: string[] = [];
  for (const seg of input.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length === 0) return `"${raw}" leaves the repository root.`;
      parts.pop();
    } else parts.push(seg);
  }
  return null;
}

export function pathProblems(paths: readonly string[]): string[] {
  return paths.map(pathProblem).filter((p): p is string => p !== null);
}
