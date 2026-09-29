import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mask, TokenFile, tokenFile } from "./tokens.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true }))); });
async function setup() {
  const home = await mkdtemp(join(tmpdir(), "moonbeam-tokens-")); homes.push(home);
  const path = join(home, "github-tokens.json");
  const warn = vi.fn();
  return { home, path, warn, file: new TokenFile({ env: { MOONBEAM_HOME: home }, warn }) };
}
describe("token file", () => {
  it("resolves home and explicit override without touching the real home", async () => {
    const { home } = await setup();
    expect(tokenFile({ MOONBEAM_HOME: home })).toBe(join(home, "github-tokens.json"));
    expect(tokenFile({ MOONBEAM_HOME: home, MOONBEAM_GITHUB_TOKENS_FILE: join(home, "custom.json") })).toBe(join(home, "custom.json"));
  });
  it("distinguishes missing files, missing labels, and invalid/unreadable files", async () => {
    const { path, file } = await setup();
    expect(await file.labels()).toEqual({ kind: "missing" });
    await writeFile(path, JSON.stringify({ tokens: { Owner: "secret-abcd" } }));
    expect(await file.lookup("absent")).toEqual({ kind: "missing" });
    await writeFile(path, '{"tokens": {"secret":');
    expect(await file.labels()).toEqual({ kind: "unreadable" });
    await rm(path); await mkdir(path);
    expect(await file.lookup("Owner")).toEqual({ kind: "unreadable" });
  });
  it("lists only labels and masks, with case-insensitive private lookup", async () => {
    const { path, file } = await setup();
    await writeFile(path, JSON.stringify({ tokens: { MyOwner: "secret-abcd" } }), { mode: 0o600 });
    expect(await file.lookup("MYOWNER")).toEqual({ kind: "ok", token: "secret-abcd" });
    expect(await file.labels()).toEqual({ kind: "ok", labels: [{ label: "MyOwner", masked: "••••abcd" }] });
    expect(mask("secret-1234")).toBe("••••1234");
    expect(JSON.stringify(file)).not.toContain("secret-abcd");
  });
  it("picks up edits, replacement, deletion, and recovery without restarting", async () => {
    const { path, file } = await setup();
    await writeFile(path, '{"tokens":{"o":"first"}}');
    expect(await file.lookup("o")).toEqual({ kind: "ok", token: "first" });
    await writeFile(path, '{"tokens":{"o":"second"}}');
    expect(await file.lookup("o")).toEqual({ kind: "ok", token: "second" });
    await writeFile(path + ".new", '{"tokens":{"o":"third"}}'); await rename(path + ".new", path);
    expect(await file.lookup("o")).toEqual({ kind: "ok", token: "third" });
    await rm(path); expect(await file.lookup("o")).toEqual({ kind: "missing" });
    await writeFile(path, '{"tokens":{}}'); expect(await file.labels()).toEqual({ kind: "ok", labels: [] });
  });
  it.each([{ tokens: { x: 123 } }, { tokens: { x: "" } }, { tokens: { Owner: "one", owner: "two" } }, {}])("rejects invalid or ambiguous configuration: %j", async (body) => {
    const { path, file } = await setup(); await writeFile(path, JSON.stringify(body));
    expect(await file.labels()).toEqual({ kind: "unreadable" });
  });
  it("warns with only the path when group or others can read", async () => {
    const { path, file, warn } = await setup();
    await writeFile(path, '{"tokens":{"private-label":"private-secret"}}', { mode: 0o600 });
    await file.labels(); expect(warn).not.toHaveBeenCalled();
    await chmod(path, 0o640); await file.labels(); expect(warn).toHaveBeenLastCalledWith(path);
    await file.labels(); expect(warn).toHaveBeenCalledTimes(1);
    await chmod(path, 0o604); await file.labels(); expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-secret");
  });
});
