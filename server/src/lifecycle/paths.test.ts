import { describe, expect, it } from "vitest";
import { checkPath, checkPaths, filesOutsidePaths, pathsOverlap, pathWithin } from "./paths.js";

describe("paths (CONTRACT-001 Definitions, Board A1)", () => {
  it("accepts and normalises plain relative paths", () => {
    expect(checkPath("src/")).toEqual({ ok: true, path: "src" });
    expect(checkPath("./docs/a.md")).toEqual({ ok: true, path: "docs/a.md" });
    expect(checkPath("a/b/../c")).toEqual({ ok: true, path: "a/c" });
  });

  it.each(["src/*.ts", "a?", "[ab]", "{a,b}", "!x"])("rejects the glob %s", (p) => {
    expect(checkPath(p).ok).toBe(false);
  });

  it.each(["/etc/passwd", "C:/x", "~/x"])("rejects the absolute path %s", (p) => {
    expect(checkPath(p).ok).toBe(false);
  });

  it.each(["..", "../x", "a/../../x"])("rejects %s, which leaves the root", (p) => {
    expect(checkPath(p).ok).toBe(false);
  });

  it("rejects empty paths and backslashes, and reports every failure", () => {
    const r = checkPaths(["", "a\\b", "ok"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons).toHaveLength(2);
  });

  it("overlap means the same path or containment; no paths never overlap", () => {
    expect(pathsOverlap(["src"], ["src/a.ts"])).toBe(true);
    expect(pathsOverlap(["src/a.ts"], ["src"])).toBe(true);
    expect(pathsOverlap(["src/a.ts"], ["src/a.ts"])).toBe(true);
    expect(pathsOverlap(["src/a"], ["src/ab"])).toBe(false);
    expect(pathsOverlap([], ["src"])).toBe(false);
    expect(pathsOverlap(["docs"], ["src"])).toBe(false);
    expect(pathWithin("x", ".")).toBe(true);
  });

  it("finds files outside the declared paths", () => {
    expect(filesOutsidePaths(["src/a.ts", "docs/b.md"], ["src"])).toEqual(["docs/b.md"]);
    expect(filesOutsidePaths(["a"], [])).toEqual(["a"]);
  });
});
