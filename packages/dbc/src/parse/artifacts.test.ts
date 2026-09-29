import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyArtifactPath, parseAdrHeader, parseContractHeader } from "./artifacts.js";

const repoRoot = new URL("../../../../", import.meta.url);
const repoFile = (dir: string, prefix: string) => {
  const name = readdirSync(new URL(dir, repoRoot)).find((f) => f.startsWith(prefix));
  if (!name) throw new Error(`${dir}${prefix}* not found`);
  return readFileSync(new URL(`${dir}${name}`, repoRoot), "utf8");
};

describe("classifyArtifactPath (R1, R2, R3)", () => {
  it("recognizes contracts, ADRs, and the project definition", () => {
    expect(classifyArtifactPath("docs/contracts/CONTRACT-006-what-moonbeam-reads.md")).toEqual({
      kind: "contract",
      id: "CONTRACT-006",
      slug: "what-moonbeam-reads",
    });
    expect(classifyArtifactPath("docs/decisions/ADR-008-moonbeam-observes-dbc-through-github.md")).toEqual({
      kind: "adr",
      id: "ADR-008",
      slug: "moonbeam-observes-dbc-through-github",
    });
    expect(classifyArtifactPath("docs/PROJECT.md")).toEqual({ kind: "project" });
  });

  it("ignores other files in those directories", () => {
    for (const path of [
      "docs/contracts/README.md",
      "docs/contracts/TEMPLATE.md",
      "docs/contracts/BOARD-QUESTIONS-2026-09-24.md",
      "docs/decisions/ADR-TEMPLATE.md",
      "docs/decisions/sub/ADR-001-x.md",
      "docs/contracts/CONTRACT-001-Upper.md",
      "docs/project.md",
    ]) {
      expect(classifyArtifactPath(path)).toBeNull();
    }
  });
});

describe("header parsers (R1, R2, R6)", () => {
  it("R1: parses this repository's CONTRACT-006 header", () => {
    const parsed = parseContractHeader(repoFile("docs/contracts/", "CONTRACT-006-"));
    expect(parsed).toMatchObject({
      kind: "contract",
      id: "CONTRACT-006",
      title: "What Moonbeam reads from a DbC project",
      status: "Approved",
      approvedBy: "Patrick",
      relatedTasks: "TASK-021",
    });
  });

  it("R1: reads Supersedes when present", () => {
    const parsed = parseContractHeader("# CONTRACT-007: Next\n\nStatus: Proposed\nSupersedes: CONTRACT-006\n\n## Purpose\n");
    expect(parsed).toMatchObject({ supersedes: "CONTRACT-006", approvedBy: null, approvedDate: null });
  });

  it("R2: parses this repository's ADR-008 header", () => {
    const parsed = parseAdrHeader(repoFile("docs/decisions/", "ADR-008-"));
    expect(parsed).toMatchObject({
      kind: "adr",
      id: "ADR-008",
      title: "Moonbeam observes DbC projects through GitHub",
      status: "Approved",
      date: "2026-09-28",
    });
  });

  it("R2: reads a wrapped status line", () => {
    const parsed = parseAdrHeader("# ADR-001: X\n\nStatus: Approved; superseded by ADR-008 (2026-09-28), see the\namendment at the end\nDate: 2026-09-24\n\n## Context\n");
    expect(parsed).toMatchObject({
      status: "Approved; superseded by ADR-008 (2026-09-28), see the amendment at the end",
      date: "2026-09-24",
    });
  });

  it("R6: a file without a # line has status unknown", () => {
    expect(parseContractHeader("Status: Approved\n\n## Purpose\n")).toEqual({ kind: "unknown" });
    expect(parseAdrHeader("")).toEqual({ kind: "unknown" });
  });

  it("a title without an ID keeps the whole text as the title", () => {
    expect(parseAdrHeader("# Just a title\n")).toMatchObject({ id: null, title: "Just a title", status: null });
  });
});
