import { describe, expect, it } from "vitest";
import { parseTaskFile, taskField } from "./task-file.js";
import { isValidDate, parseIdList, parseName } from "./values.js";

const V1_TASK = `# TASK-043: Sample task

Format: DbC task v1
Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick (instructed in planning session)
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: None
Dependencies: TASK-027, TASK-028

## Desired outcome

Something.

## Scope

### Included

- a thing

### Excluded

- another thing

### Paths

Files and directories this task may create or change.

- \`packages/dbc/\`
- \`pnpm-lock.yaml\` (only the lockfile entry)

## Plan
`;

describe("parseTaskFile", () => {
  it("P3: reads the title line and its ID", () => {
    const parsed = parseTaskFile(V1_TASK);
    expect(parsed.title).toEqual({ id: "TASK-043", text: "Sample task", line: 1 });
  });

  it("P3: a first non-blank line that is not a task title means no title", () => {
    expect(parseTaskFile("Proposed by: Patrick\n").title).toBeNull();
    expect(parseTaskFile("# Sample task\n").title).toBeNull();
    expect(parseTaskFile("\n\n# TASK-001: after blank lines\n").title).toMatchObject({ id: "TASK-001", line: 3 });
  });

  it("P3: keeps a title ID as written, so TASK-21 is not TASK-021", () => {
    expect(parseTaskFile("# TASK-21: short\n").title?.id).toBe("TASK-21");
  });

  it("P4: reads the header block up to the first ## line", () => {
    const parsed = parseTaskFile(V1_TASK);
    expect(parsed.header.fields.map((f) => f.name)).toEqual([
      "Format",
      "Owner role",
      "Assigned agent",
      "Proposed by",
      "Proposed date",
      "Approved by",
      "Approved date",
      "Related contracts",
      "Related ADRs",
      "Dependencies",
    ]);
    expect(parsed.header.duplicates).toEqual([]);
  });

  it("P4: continuation lines join with one space (TASK-020's wrapped Related contracts)", () => {
    const parsed = parseTaskFile(`# TASK-020: ADR-008

Related contracts: CONTRACT-002, CONTRACT-003, CONTRACT-004, CONTRACT-005 (all
affected)
Related ADRs: ADR-001, ADR-004, ADR-005, ADR-006, ADR-007 (affected)
Dependencies: None

## Desired outcome
`);
    expect(taskField(parsed, "Related contracts")?.value).toBe(
      "CONTRACT-002, CONTRACT-003, CONTRACT-004, CONTRACT-005 (all affected)",
    );
    expect(parseIdList(taskField(parsed, "Related contracts")!.value, "CONTRACT")).toEqual({
      kind: "ids",
      ids: ["CONTRACT-002", "CONTRACT-003", "CONTRACT-004", "CONTRACT-005"],
    });
  });

  it("P4: a wrapped value containing a colon is a continuation, not a field", () => {
    const parsed = parseTaskFile(`# TASK-001: x

Related ADRs: ADR-008 (governing), ADR-007, ADR-003 (context:
ADR-002, ADR-004)

## A
`);
    expect(parsed.header.fields).toHaveLength(1);
    expect(taskField(parsed, "Related ADRs")?.value).toBe("ADR-008 (governing), ADR-007, ADR-003 (context: ADR-002, ADR-004)");
  });

  it("P4: a duplicated field keeps its first value and is reported", () => {
    const parsed = parseTaskFile(`# TASK-001: x

Approved by: Patrick
Approved by: Someone else
continued text belongs to the discarded duplicate
Approved date: 2026-09-28

## A
`);
    expect(taskField(parsed, "Approved by")?.value).toBe("Patrick");
    expect(parsed.header.duplicates).toEqual(["Approved by"]);
    expect(taskField(parsed, "Approved date")?.value).toBe("2026-09-28");
  });

  it("P4: unknown fields are kept and names match case-insensitively", () => {
    const parsed = parseTaskFile("# TASK-001: x\n\nPROPOSED  BY: Patrick\nReviewer mood: calm\n\n## A\n");
    expect(taskField(parsed, "Proposed by")?.value).toBe("Patrick");
    expect(taskField(parsed, "reviewer mood")?.value).toBe("calm");
  });

  it("P4: empty values are empty", () => {
    const parsed = parseTaskFile("# TASK-001: x\n\nApproved by:\nApproved date:   \n\n## A\n");
    expect(taskField(parsed, "Approved by")?.value).toBe("");
    expect(taskField(parsed, "Approved date")?.value).toBe("");
  });

  it("accepts CRLF line endings", () => {
    const parsed = parseTaskFile(V1_TASK.replace(/\n/g, "\r\n"));
    expect(parsed.title?.id).toBe("TASK-043");
    expect(taskField(parsed, "Dependencies")?.value).toBe("TASK-027, TASK-028");
    expect(parsed.paths).toEqual({ kind: "patterns", patterns: ["packages/dbc/", "pnpm-lock.yaml"] });
  });

  it("P9: Format marks the file v1 only for exactly DbC task v1, in any case", () => {
    expect(parseTaskFile(V1_TASK).isV1).toBe(true);
    expect(parseTaskFile("# TASK-001: x\nFormat: dbc TASK V1\n").isV1).toBe(true);
    const v2 = parseTaskFile("# TASK-001: x\nFormat: DbC task v2\n");
    expect(v2).toMatchObject({ isV1: false, format: "DbC task v2" });
    const none = parseTaskFile("# TASK-001: x\nProposed by: Patrick\n");
    expect(none).toMatchObject({ isV1: false, format: null });
  });

  describe("P7 Paths section", () => {
    it("uses the first backtick span of each item, or the whole item text", () => {
      expect(parseTaskFile(V1_TASK).paths).toEqual({ kind: "patterns", patterns: ["packages/dbc/", "pnpm-lock.yaml"] });
      const plain = parseTaskFile("### Paths\n\n- docs/DEVELOPMENT.md\n* server/\n1. `ui/` then `other/`\n");
      expect(plain.paths).toEqual({ kind: "patterns", patterns: ["docs/DEVELOPMENT.md", "server/", "ui/"] });
    });

    it("distinguishes None, empty, and absent", () => {
      expect(parseTaskFile("### Paths\n\n- None\n").paths).toEqual({ kind: "none" });
      expect(parseTaskFile("### Paths\n\n- `none`\n").paths).toEqual({ kind: "none" });
      expect(parseTaskFile("### Paths\n\nProse only, no items.\n\n## Plan\n- not a path\n").paths).toEqual({
        kind: "empty",
      });
      expect(parseTaskFile("## Scope\n\n- `server/`\n").paths).toEqual({ kind: "absent" });
    });

    it("ends at the next heading of level 1 to 3 but not level 4", () => {
      const parsed = parseTaskFile("### Paths\n\n- `a/`\n#### Notes\n- `b/`\n### Other\n- `c/`\n");
      expect(parsed.paths).toEqual({ kind: "patterns", patterns: ["a/", "b/"] });
    });

    it("uses only the first Paths section and ignores fenced code", () => {
      const parsed = parseTaskFile("```\n### Paths\n- `fenced/`\n```\n### Paths\n- `real/`\n```\n- `in-fence/`\n```\n### Paths\n- `second/`\n");
      expect(parsed.paths).toEqual({ kind: "patterns", patterns: ["real/"] });
    });

    it("None among other items is an ordinary pattern", () => {
      expect(parseTaskFile("### Paths\n- None\n- `a/`\n").paths).toEqual({ kind: "patterns", patterns: ["None", "a/"] });
    });
  });
});

describe("P5 value formats", () => {
  it("a name is the text before the first ' ('", () => {
    expect(parseName("Patrick (instructed in planning session)")).toEqual({
      name: "Patrick",
      note: "(instructed in planning session)",
    });
    expect(parseName("  Patrick Moon ")).toEqual({ name: "Patrick Moon", note: null });
  });

  it("dates are YYYY-MM-DD and real calendar dates", () => {
    expect(isValidDate("2026-09-28")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "2026-00-10", "2026-9-28", "28/09/2026", "", "2026-09-28x"]) {
      expect(isValidDate(bad)).toBe(false);
    }
  });

  it("ID lists: IDs of the kind, None in any case, free text, empty", () => {
    expect(parseIdList("TASK-027, TASK-028 (both needed)", "TASK")).toEqual({ kind: "ids", ids: ["TASK-027", "TASK-028"] });
    expect(parseIdList("CONTRACT-006 and ADR-008", "ADR")).toEqual({ kind: "ids", ids: ["ADR-008"] });
    expect(parseIdList("None", "ADR")).toEqual({ kind: "none" });
    expect(parseIdList("NONE", "ADR")).toEqual({ kind: "none" });
    expect(parseIdList(" none ", "TASK")).toEqual({ kind: "none" });
    expect(parseIdList("the board's go-ahead", "TASK")).toEqual({ kind: "text", text: "the board's go-ahead" });
    expect(parseIdList("  ", "TASK")).toEqual({ kind: "empty" });
    expect(parseIdList("TASK-021, TASK-21", "TASK")).toEqual({ kind: "ids", ids: ["TASK-021", "TASK-21"] });
  });
});

it("FL-2/P4: raw header lines preserve duplicates and layout with LF or CRLF", () => {
  const header = ["", "Format: DbC task v1", "  Proposed by: First  ", "Proposed by: Second",
    "  continued duplicate", "", "Unknown field: kept", ""];
  for (const newline of ["\n", "\r\n"]) {
    const parsed = parseTaskFile(["# TASK-001: Title", ...header, "## Body", "not header"].join(newline));
    expect(parsed.rawHeaderLines).toEqual(header);
    expect(taskField(parsed, "Proposed by")?.value).toBe("First");
  }
  expect(parseTaskFile("Format: DbC task v1\nProposed by: Second").rawHeaderLines)
    .toEqual(["Format: DbC task v1", "Proposed by: Second"]);
});
