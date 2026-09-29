import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const schema = z.object({ tokens: z.record(z.string().min(1), z.string().min(1)) });
export type TokenFailure = { kind: "missing" } | { kind: "unreadable" };
export type TokenLabels = TokenFailure | { kind: "ok"; labels: { label: string; masked: string }[] };
export type TokenLookup = TokenFailure | { kind: "ok"; token: string };
export const mask = (token: string): string => `••••${token.slice(-4)}`;
export function tokenFile(env: NodeJS.ProcessEnv = process.env): string {
  return env.MOONBEAM_GITHUB_TOKENS_FILE ?? join(env.MOONBEAM_HOME ?? join(homedir(), ".moonbeam"), "github-tokens.json");
}

/** Only lookup() exposes a secret, for server-to-source authentication. Never serialize it. */
export class TokenFile {
  readonly path: string;
  #stamp = "";
  #tokens = new Map<string, { label: string; token: string }>();
  constructor(options: { env?: NodeJS.ProcessEnv; warn?: (path: string) => void } = {}) {
    this.path = tokenFile(options.env);
    this.warn = options.warn ?? ((path) => console.warn(`GitHub token file is readable by group or others: ${path}`));
  }
  private readonly warn: (path: string) => void;

  private async refresh(): Promise<TokenFailure | undefined> {
    try {
      const info = await stat(this.path, { bigint: true });
      const stamp = `${info.mtimeNs}:${info.ctimeNs}:${info.ino}:${info.size}:${info.mode}`;
      if (stamp === this.#stamp) return;
      const parsed = schema.safeParse(JSON.parse(await readFile(this.path, "utf8")));
      if (!parsed.success) throw new Error();
      const tokens = new Map<string, { label: string; token: string }>();
      for (const [label, token] of Object.entries(parsed.data.tokens)) {
        const key = label.toLowerCase();
        // Ambiguous labels must not silently select a different credential.
        if (tokens.has(key)) throw new Error();
        tokens.set(key, { label, token });
      }
      this.#tokens = tokens;
      this.#stamp = stamp;
      if ((info.mode & 0o044n) !== 0n) this.warn(this.path);
    } catch (error) {
      this.#stamp = "";
      this.#tokens.clear();
      return { kind: (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unreadable" };
    }
  }
  async labels(): Promise<TokenLabels> {
    const failure = await this.refresh();
    return failure ?? { kind: "ok", labels: [...this.#tokens.values()].map(({ label, token }) => ({ label, masked: mask(token) })) };
  }
  async lookup(label: string): Promise<TokenLookup> {
    const failure = await this.refresh();
    if (failure) return failure;
    const entry = this.#tokens.get(label.toLowerCase());
    return entry ? { kind: "ok", token: entry.token } : { kind: "missing" };
  }
}
