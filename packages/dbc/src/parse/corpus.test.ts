// CONTRACT-006 V5 (and N4): a corpus of malformed inputs. Every one is handled
// without throwing, and each produces the result the P rules call for.

import { describe, expect, it } from "vitest";
import { decodeFile } from "./files.js";
import { v1Problems } from "./problems.js";
import { parseTaskFile } from "./task-file.js";
import { classifyTaskPath } from "./task-path.js";

const encode = (text: string) => new TextEncoder().encode(text);

const COMPLETE = `# TASK-060: Corpus

Format: DbC task v1
Proposed by: Claude
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: None
Related ADRs: None
Dependencies: None

## Scope

### Paths

- \`docs/\`
`;

interface Case {
  name: string;
  path: string;
  bytes: Uint8Array;
}

const corpus: Case[] = [
  { name: "non-UTF-8", path: "tasks/approved/TASK-060-corpus.md", bytes: new Uint8Array([0x23, 0x20, 0xff, 0xfe]) },
  { name: "over 1 MiB", path: "tasks/approved/TASK-060-corpus.md", bytes: encode(COMPLETE + "x".repeat(1_048_576)) },
  { name: "no title line", path: "tasks/approved/TASK-060-corpus.md", bytes: encode(COMPLETE.replace("# TASK-060: Corpus\n", "")) },
  { name: "ID mismatch", path: "tasks/approved/TASK-061-corpus.md", bytes: encode(COMPLETE) },
  { name: "duplicate field", path: "tasks/approved/TASK-060-corpus.md", bytes: encode(COMPLETE.replace("Dependencies: None", "Dependencies: None\nProposed by: Other")) },
  {
    name: "wrapped field values",
    path: "tasks/approved/TASK-060-corpus.md",
    bytes: encode(COMPLETE.replace("Related ADRs: None", "Related ADRs: ADR-001, ADR-002 (both\naffected), ADR-003")),
  },
  { name: "unknown fields", path: "tasks/approved/TASK-060-corpus.md", bytes: encode(COMPLETE.replace("Dependencies: None", "Dependencies: None\nMood: calm\nPriority: high")) },
  { name: "missing Format", path: "tasks/approved/TASK-060-corpus.md", bytes: encode(COMPLETE.replace("Format: DbC task v1\n", "")) },
  { name: "Format: DbC task v2", path: "tasks/approved/TASK-060-corpus.md", bytes: encode(COMPLETE.replace("DbC task v1", "DbC task v2")) },
  { name: "stray file in tasks/", path: "tasks/notes.md", bytes: encode("scratch notes") },
  { name: "unknown directory under tasks/", path: "tasks/archive/TASK-060-corpus.md", bytes: encode(COMPLETE) },
  { name: "empty file", path: "tasks/proposed/TASK-060-corpus.md", bytes: new Uint8Array() },
  { name: "binary noise that is valid UTF-8", path: "tasks/proposed/TASK-060-corpus.md", bytes: encode("\u0000\u0001## \n### Paths\n- ``\n: :\n#") },
];

/** What a poll would do with one file, end to end through the parse layer. */
function process(c: Case) {
  const where = classifyTaskPath(c.path);
  if (where.kind !== "task") return { where };
  const read = decodeFile(c.bytes);
  if (read.kind !== "text") return { where, read: read.kind };
  const parsed = parseTaskFile(read.text);
  return { where, read: "text" as const, parsed, problems: parsed.isV1 ? v1Problems(parsed, where.state, where.id) : null };
}

describe("V5 malformed-file corpus", () => {
  it.each(corpus)("$name is handled without throwing", (c) => {
    expect(() => process(c)).not.toThrow();
  });

  it("each case gives the expected outcome", () => {
    const results = Object.fromEntries(corpus.map((c) => [c.name, process(c)]));

    expect(results["non-UTF-8"]).toMatchObject({ read: "not_utf8" });
    expect(results["over 1 MiB"]).toMatchObject({ read: "too_large" });
    expect(results["no title line"]!.problems).toEqual([{ kind: "missing_title" }]);
    expect(results["ID mismatch"]!.problems).toEqual([
      { kind: "title_id_mismatch", titleId: "TASK-060", fileId: "TASK-061" },
    ]);
    expect(results["duplicate field"]!.problems).toEqual([{ kind: "duplicate_field", field: "Proposed by" }]);
    expect(results["wrapped field values"]!.problems).toEqual([]);
    expect(results["wrapped field values"]!.parsed!.header.fields.find((f) => f.key === "related adrs")?.value).toBe(
      "ADR-001, ADR-002 (both affected), ADR-003",
    );
    expect(results["unknown fields"]!.problems).toEqual([]);
    expect(results["missing Format"]).toMatchObject({ problems: null, parsed: { isV1: false, format: null } });
    expect(results["Format: DbC task v2"]).toMatchObject({ problems: null, parsed: { isV1: false, format: "DbC task v2" } });
    expect(results["stray file in tasks/"]!.where).toEqual({ kind: "stray", reason: "not_directly_in_state_directory" });
    expect(results["unknown directory under tasks/"]!.where).toEqual({ kind: "stray", reason: "unknown_directory" });
    expect(results["empty file"]).toMatchObject({ problems: null, parsed: { title: null, isV1: false } });
  });

  it("a pre-v1 file still yields best-effort fields and Paths (P9)", () => {
    const parsed = parseTaskFile(COMPLETE.replace("Format: DbC task v1\n", ""));
    expect(parsed.isV1).toBe(false);
    expect(parsed.title?.id).toBe("TASK-060");
    expect(parsed.header.fields.find((f) => f.key === "approved by")?.value).toBe("Patrick");
    expect(parsed.paths).toEqual({ kind: "patterns", patterns: ["docs/"] });
  });
});
