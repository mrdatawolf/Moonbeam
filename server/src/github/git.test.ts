import { describe, expect, it, vi } from "vitest";
import { GitRunner, isolatedGitEnvironment, scrubGitOutput, type GitInvocation } from "./git.js";

const token = "a-private-token-9876";
const encoded = Buffer.from(`x-access-token:${token}`).toString("base64");
describe("git boundary", () => {
  it.each(["push", "commit", "remote", "checkout", "clone", "-c", "--help", "upload-pack", "fetch-pack", "anything"])("rejects %s before spawning", async (command) => {
    const execute = vi.fn();
    await expect(new GitRunner(execute).run("/tmp", command, ["set-url", "--push"])).rejects.toThrow("not allowed");
    expect(execute).not.toHaveBeenCalled();
  });
  it("places authentication only in ephemeral config and scrubs both streams", async () => {
    let invocation: GitInvocation | undefined;
    const runner = new GitRunner(async (value) => {
      invocation = value;
      return { code: 128, stdout: Buffer.from(token), stderr: `failure ${token} AUTHORIZATION: basic ${encoded}` };
    });
    const result = await runner.run("/tmp", "fetch", ["https://github.com/o/r.git"], { token, origin: "https://github.com" });
    expect(invocation?.args.join(" ")).not.toContain(token);
    expect(invocation?.args.join(" ")).not.toContain(encoded);
    expect(invocation?.env).toMatchObject({ GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${encoded}`, GIT_CONFIG_KEY_1: "credential.helper", GIT_CONFIG_VALUE_1: "", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" });
    expect(result.stderr).toBe("failure [REDACTED] AUTHORIZATION: basic [REDACTED]");
    expect(result.stdout.toString()).toBe("[REDACTED]");
  });
  it("clears inherited config, tracing, askpass, and repository overrides", () => {
    const env = isolatedGitEnvironment({ PATH: "/bin", GIT_TRACE: "/tmp/leak", GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "bad", GIT_DIR: "/elsewhere", GIT_ASKPASS: "steal", SSH_ASKPASS: "steal", GIT_CONFIG_PARAMETERS: "bad" });
    expect(env.PATH).toBe("/bin");
    for (const key of ["GIT_TRACE", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_DIR", "GIT_ASKPASS", "SSH_ASKPASS", "GIT_CONFIG_PARAMETERS"]) expect(env[key]).toBeUndefined();
  });
  it("never forwards native errors or attaches a cause", async () => {
    const runner = new GitRunner(async () => { throw Object.assign(new Error(token), { stderr: encoded }); });
    try { await runner.run("/tmp", "fetch", [], { token, origin: "https://github.com" }); throw new Error("expected failure"); }
    catch (error) { expect(String(error)).toBe("Error: Git process could not be run"); expect((error as Error).cause).toBeUndefined(); }
  });
  it("rejects auth in argv, non-fetch auth, and unsafe origins", async () => {
    const execute = vi.fn(); const runner = new GitRunner(execute);
    for (const [command, args, origin] of [["fetch", [token], "https://github.com"], ["config", [], "https://github.com"], ["fetch", [], `https://${token}@github.com`], ["fetch", [], "http://github.com"]] as const) {
      await expect(runner.run("/tmp", command, args, { token, origin })).rejects.toThrow();
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it("scrubs literal, URL-encoded, and basic-encoded secrets", () => {
    expect(scrubGitOutput("secret%3Fvalue secret?value", "secret?value")).toBe("[REDACTED] [REDACTED]");
  });
});
