import { execFile } from "node:child_process";

const GIT_ALLOWLIST = new Set(["init", "config", "fetch", "rev-parse", "rev-list", "log", "cat-file", "merge-base", "update-ref", "for-each-ref"]);
export interface GitResult { code: number; stdout: Buffer; stderr: string }
export interface GitInvocation { cwd: string; args: string[]; env: NodeJS.ProcessEnv; timeoutMs: number }
export type GitExecutor = (invocation: GitInvocation) => Promise<GitResult>;
const execute: GitExecutor = ({ cwd, args, env, timeoutMs }) => new Promise((resolve) => {
  execFile("git", args, { cwd, env, encoding: "buffer", timeout: timeoutMs, maxBuffer: 128 * 1024 * 1024 }, (error, stdout, stderr) => {
    resolve({ code: error ? typeof error.code === "number" ? error.code : -1 : 0, stdout, stderr: stderr.toString("utf8") });
  });
});

/** Remove inherited git config, tracing, repository overrides and askpass programs. */
export function isolatedGitEnvironment(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(source).filter(([key]) => !key.startsWith("GIT_") && !["SSH_ASKPASS", "SSH_ASKPASS_REQUIRE"].includes(key)));
  return { ...env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_SYSTEM: "/dev/null", GIT_CONFIG_GLOBAL: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_NO_REPLACE_OBJECTS: "1", LC_ALL: "C" };
}
export function scrubGitOutput(text: string, token?: string): string {
  if (!token) return text;
  for (const secret of [token, encodeURIComponent(token), Buffer.from(`x-access-token:${token}`).toString("base64"), Buffer.from(token).toString("base64")]) {
    text = text.split(secret).join("[REDACTED]");
  }
  return text;
}

export class GitRunner {
  constructor(private readonly executor: GitExecutor = execute, private readonly timeoutMs = 60_000) {}
  async run(cwd: string, command: string, args: readonly string[] = [], auth?: { token: string; origin: string }): Promise<GitResult> {
    if (!GIT_ALLOWLIST.has(command)) throw new Error("Git command is not allowed");
    if (auth && (command !== "fetch" || !auth.token || args.some((arg) => scrubGitOutput(arg, auth.token) !== arg))) throw new Error("Invalid git authentication arguments");
    const env = isolatedGitEnvironment();
    const config: [string, string][] = [];
    if (auth) {
      let origin: URL;
      try { origin = new URL(auth.origin); } catch { throw new Error("Invalid git origin"); }
      if (origin.protocol !== "https:" || origin.username || origin.password || origin.origin !== auth.origin) throw new Error("Invalid git origin");
      config.push([`http.${origin.origin}/.extraheader`, `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${auth.token}`).toString("base64")}`]);
    }
    config.push(["credential.helper", ""], ["core.hooksPath", "/dev/null"], ["protocol.allow", "never"], ["protocol.https.allow", "always"], ["protocol.file.allow", "always"], ["http.followRedirects", "false"]);
    env.GIT_CONFIG_COUNT = String(config.length);
    config.forEach(([key, value], index) => { env[`GIT_CONFIG_KEY_${index}`] = key; env[`GIT_CONFIG_VALUE_${index}`] = value; });
    try {
      const result = await this.executor({ cwd, args: [command, ...args], env, timeoutMs: this.timeoutMs });
      return { code: result.code, stdout: auth ? Buffer.from(scrubGitOutput(result.stdout.toString("utf8"), auth.token)) : result.stdout, stderr: scrubGitOutput(result.stderr, auth?.token) };
    } catch {
      // Never attach the native error: it can include argv, env, stdout, stderr.
      throw new Error("Git process could not be run");
    }
  }
}
