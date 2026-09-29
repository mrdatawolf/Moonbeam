/** P7 normalization does not resolve dot segments or change case. */
export function normalizePattern(pattern: string): string {
  return pattern.replace(/^(?:\.\/|\/)/, "").replace(/\/+$/, "");
}

export function matchesPattern(changedPath: string, pattern: string): boolean {
  const p = normalizePattern(pattern);
  if (!p) return false;
  if (!p.includes("*")) return changedPath === p || changedPath.startsWith(`${p}/`);
  // A small glob automaton avoids regex backtracking on untrusted patterns.
  const tokens: string[] = [];
  for (let i = 0; i < p.length; i++) {
    if (p.slice(i, i + 3) === "**/") { tokens.push("**/"); i += 2; }
    else if (p.slice(i, i + 2) === "**") { tokens.push("**"); i++; }
    else tokens.push(p[i]!);
  }
  let next = new Uint8Array(changedPath.length + 1);
  next[changedPath.length] = 1;
  for (let t = tokens.length - 1; t >= 0; t--) {
    const token = tokens[t]!;
    const current = new Uint8Array(next.length);
    let slashSuffix = false;
    for (let i = changedPath.length; i >= 0; i--) {
      const ch = changedPath[i];
      if (token === "**/") {
        if (ch === "/" && next[i + 1]) slashSuffix = true;
        current[i] = Number(Boolean(next[i]) || slashSuffix);
      } else if (token === "*" || token === "**") {
        current[i] = Number(Boolean(next[i]) || (ch !== undefined && (token === "**" || ch !== "/") && Boolean(current[i + 1])));
      } else current[i] = Number(ch === token && Boolean(next[i + 1]));
    }
    next = current;
  }
  return Boolean(next[0]);
}
