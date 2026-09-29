import { describe, expect, it } from "vitest";
import { matchesPattern, normalizePattern } from "./paths.js";

describe("matchesPattern (P7)", () => {
  it("server/, server, and server/** all match server/src/a.ts", () => {
    for (const pattern of ["server/", "server", "server/**"]) {
      expect(matchesPattern("server/src/a.ts", pattern)).toBe(true);
    }
  });

  it("a plain pattern matches the path itself or anything below it", () => {
    expect(matchesPattern("docs/DEVELOPMENT.md", "docs/DEVELOPMENT.md")).toBe(true);
    expect(matchesPattern("server", "server/")).toBe(true);
    expect(matchesPattern("docs/DEVELOPMENT.md.bak", "docs/DEVELOPMENT.md")).toBe(false);
  });

  it("server does not match serverless/a.ts", () => {
    expect(matchesPattern("serverless/a.ts", "server")).toBe(false);
    expect(matchesPattern("serverless/a.ts", "server/")).toBe(false);
  });

  it("* stays within one segment", () => {
    expect(matchesPattern("docs/a.md", "docs/*.md")).toBe(true);
    expect(matchesPattern("docs/sub/a.md", "docs/*.md")).toBe(false);
    expect(matchesPattern("src/x/index.ts", "src/*/index.ts")).toBe(true);
    expect(matchesPattern("src/x/y/index.ts", "src/*/index.ts")).toBe(false);
  });

  it("** matches any number of segments, and **/ may match none", () => {
    expect(matchesPattern("docs/a.md", "docs/**/a.md")).toBe(true);
    expect(matchesPattern("docs/x/y/a.md", "docs/**/a.md")).toBe(true);
    expect(matchesPattern("a.test.ts", "**/*.test.ts")).toBe(true);
    expect(matchesPattern("server/src/a.test.ts", "**/*.test.ts")).toBe(true);
    expect(matchesPattern("server/src/a.ts", "**/*.test.ts")).toBe(false);
  });

  it("a glob pattern is a glob match only, with no directory prefix rule", () => {
    expect(matchesPattern("docs/a/b.md", "docs/*")).toBe(false);
    expect(matchesPattern("docs/a", "docs/*")).toBe(true);
  });

  it("matching is case-sensitive", () => {
    expect(matchesPattern("Server/a.ts", "server/")).toBe(false);
    expect(matchesPattern("docs/A.md", "docs/*.md")).toBe(true);
    expect(matchesPattern("docs/a.MD", "docs/*.md")).toBe(false);
  });

  it("a leading / or ./ is removed", () => {
    expect(normalizePattern("/server/")).toBe("server");
    expect(normalizePattern("./docs/a.md")).toBe("docs/a.md");
    expect(matchesPattern("server/a.ts", "/server")).toBe(true);
    expect(matchesPattern("docs/a.md", "./docs/a.md")).toBe(true);
  });

  it("an empty pattern matches nothing", () => {
    expect(matchesPattern("a", "")).toBe(false);
    expect(matchesPattern("a", "/")).toBe(false);
  });

  it("handles long adversarial patterns without backtracking blow-up", () => {
    const path = `${"a/".repeat(200)}b`;
    const pattern = `${"**/".repeat(50)}c`;
    const started = Date.now();
    expect(matchesPattern(path, pattern)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
