import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GitFixture } from "../test/git-fixture.js";
import { GitRunner } from "./git.js";
import { Mirror, mirrorDirectory, githubRemoteUrl } from "./mirror.js";

const fixtures: GitFixture[] = [];
afterEach(async () => { await Promise.all(fixtures.splice(0).map((f) => f.dispose())); });
async function setup() {
  const fixture = await GitFixture.create(); fixtures.push(fixture);
  const mirror = new Mirror(join(fixture.directory, "home", "mirrors", "project.git"), { remoteUrl: () => fixture.url });
  await mirror.ensure(); return { fixture, mirror };
}
async function fetchHead(fixture: GitFixture, mirror: Mirror) {
  await fixture.publish();
  const result = await mirror.fetch(mirror.remoteUrl("o", "r"), "main", "fixture-secret");
  expect(result.kind).toBe("ok");
  if (result.kind !== "ok") throw new Error("Expected fetch");
  return result.head;
}
describe("bare mirror with local file remotes", () => {
  it("initializes idempotently, fetches only the tracked branch, no tags, and never changes the remote", async () => {
    const { fixture, mirror } = await setup(); await mirror.ensure();
    const root = await fixture.commit({ "root.txt": "root" });
    await fixture.git(["tag", "v1"]);
    await fixture.branch("other"); await fixture.commit({ "other.txt": "other" }); await fixture.publish("other");
    await fixture.checkout("main"); await fixture.publish(); await fixture.git(["push", fixture.url, "refs/tags/v1"]);
    const before = await fixture.git(["show-ref"], {}, fixture.remote);
    expect(await mirror.fetch(fixture.url, "main", "fixture-secret")).toEqual({ kind: "ok", head: root });
    expect(await fixture.git(["show-ref"], {}, mirror.directory)).toBe(`${root} refs/moonbeam/tracked`);
    expect(await fixture.git(["show-ref"], {}, fixture.remote)).toBe(before);
    const config = await readFile(join(mirror.directory, "config"), "utf8");
    expect(config).not.toContain("fixture-secret"); expect(config).not.toContain("extraheader"); expect(config).not.toContain("remote");
    expect(githubRemoteUrl("owner", "repo")).toBe("https://github.com/owner/repo.git");
    expect(mirrorDirectory("id", { MOONBEAM_HOME: fixture.directory })).toBe(join(fixture.directory, "mirrors", "id.git"));
  });
  it("reads root, first-parent merge changes, rename as delete/add, identities and exact unusual paths", async () => {
    const { fixture, mirror } = await setup();
    const odd = " odd\tfile\n☃.txt";
    const root = await fixture.commit({ "old.txt": "original", [odd]: "odd" }, { subject: "root subject", author: { name: "Author", email: "a@example.test" }, committer: { name: "Committer", email: "c@example.test" }, time: "2025-02-03T04:05:06+02:00" });
    await fixture.branch("feature"); const side = await fixture.commit({ "feature.txt": "feature", "old.txt": "modified" });
    await fixture.checkout("main"); const main = await fixture.commit({ "main.txt": "main" });
    const merge = await fixture.merge("feature");
    const renamed = await fixture.commit({ "old.txt": null, "new.txt": "modified" });
    const empty = await fixture.commit({}, { subject: "empty commit" });
    const head = await fetchHead(fixture, mirror);
    const chain = await mirror.readChain(head);
    expect(chain.map((c) => c.sha)).toEqual([root, main, merge, renamed, empty]);
    expect(chain[0]).toMatchObject({ parents: [], subject: "root subject", authorName: "Author", authorEmail: "a@example.test", committerName: "Committer", committerEmail: "c@example.test", committerTime: "2025-02-03T04:05:06+02:00" });
    expect(chain[0]?.changes).toEqual([{ path: odd, kind: "added" }, { path: "old.txt", kind: "added" }]);
    expect(chain[2]?.parents).toEqual([main, side]);
    expect(chain[2]?.changes).toEqual([{ path: "feature.txt", kind: "added" }, { path: "old.txt", kind: "modified" }]);
    expect(chain[3]?.changes).toEqual([{ path: "new.txt", kind: "added" }, { path: "old.txt", kind: "deleted" }]);
    expect(chain[4]?.changes).toEqual([]);
  });
  it("reads exact binary bytes, absent paths, and the inclusive 1 MiB boundary", async () => {
    const { fixture, mirror } = await setup();
    const binary = Buffer.from([0, 255, 254, 13, 10]);
    const boundary = Buffer.alloc(1024 * 1024, 42);
    await fixture.commit({ "binary": binary, "boundary": boundary, "big": Buffer.alloc(1024 * 1024 + 1), "dir/file": "text" });
    const head = await fetchHead(fixture, mirror);
    expect(await mirror.readFile(head, "binary")).toEqual({ kind: "ok", bytes: binary });
    expect(await mirror.readFile(head, "boundary")).toEqual({ kind: "ok", bytes: boundary });
    expect(await mirror.readFile(head, "big")).toEqual({ kind: "too_large" });
    expect(await mirror.readFile(head, "absent")).toEqual({ kind: "absent" });
    expect(await mirror.readFile(head, "dir")).toEqual({ kind: "absent" });
    await expect(mirror.readFile("f".repeat(40), "binary")).rejects.toThrow("Mirror read failed");
  });
  it("checks size before reading an oversized blob", async () => {
    const commands: string[][] = [];
    const mirror = new Mirror("/unused", { git: new GitRunner(async ({ args }) => { commands.push(args); return { code: 0, stdout: Buffer.from("1048577\n"), stderr: "" }; }) });
    expect(await mirror.readFile("a".repeat(40), "big")).toEqual({ kind: "too_large" });
    expect(commands).toEqual([["cat-file", "-s", `${"a".repeat(40)}:big`]]);
  });
  it("detects fast-forwards and rewrites and retains the pinned old chain", async () => {
    const { fixture, mirror } = await setup(); const root = await fixture.commit({ "file": "root" });
    await fetchHead(fixture, mirror);
    await fixture.branch("ff"); const fast = await fixture.commit({ "file": "fast" });
    await fixture.checkout("main"); expect(await fixture.fastForward("ff")).toBe(fast);
    await fetchHead(fixture, mirror); expect(await mirror.isAncestor(root, fast)).toBe(true); expect(await mirror.isAncestor(fast, fast)).toBe(true);
    await mirror.pin(fast);
    await fixture.reset(root); const rewritten = await fixture.commit({ "file": "rewrite" });
    expect(await fetchHead(fixture, mirror)).toBe(rewritten);
    expect(await mirror.isAncestor(fast, rewritten)).toBe(false);
    expect(await mirror.readFile(fast, "file")).toEqual({ kind: "ok", bytes: Buffer.from("fast") });
    expect(await fixture.git(["rev-parse", "refs/moonbeam/last-processed"], {}, mirror.directory)).toBe(fast);
  });
  it("supports squash fixtures without importing side commits into the chain", async () => {
    const { fixture, mirror } = await setup(); const root = await fixture.commit({ "base": "base" });
    await fixture.branch("feature"); await fixture.commit({ "one": "1" }); await fixture.commit({ "two": "2" });
    await fixture.checkout("main"); const squash = await fixture.squash("feature");
    const chain = await mirror.readChain(await fetchHead(fixture, mirror));
    expect(chain.map((c) => c.sha)).toEqual([root, squash]);
    expect(chain[1]?.changes).toEqual([{ path: "one", kind: "added" }, { path: "two", kind: "added" }]);
  });
  it("returns branch_missing and unreachable distinctly without replacing a good tracked head", async () => {
    const { fixture, mirror } = await setup(); await fixture.commit({ "file": "yes" }); const head = await fetchHead(fixture, mirror);
    expect(await mirror.fetch(fixture.url, "missing", "secret")).toEqual({ kind: "branch_missing" });
    expect(await mirror.fetch(fixture.url + "/nonexistent", "main", "secret")).toEqual({ kind: "unreachable" });
    expect(await fixture.git(["rev-parse", "refs/moonbeam/tracked"], {}, mirror.directory)).toBe(head);
  });
  it("rejects URL credentials, unsafe transports, revision and refspec injection", async () => {
    const { fixture, mirror } = await setup();
    for (const url of ["https://secret@github.com/o/r", "ext::evil", "ssh://github.com/o/r", "https://github.com/o/r?token=secret"]) await expect(mirror.fetch(url, "main", "secret")).rejects.toThrow("Invalid remote URL");
    for (const branch of ["main:refs/heads/evil", "*", "../x", "-x", "main\n"]) await expect(mirror.fetch(fixture.url, branch, "secret")).rejects.toThrow("Invalid branch");
    await expect(mirror.readChain("--all")).rejects.toThrow("Invalid commit SHA");
    expect(() => mirrorDirectory("../outside", { MOONBEAM_HOME: fixture.directory })).toThrow();
  });
});
