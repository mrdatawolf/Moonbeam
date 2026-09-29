import { describe, expect, it } from "vitest";
import { problemKey, v1Problems } from "./problems.js";
import { parseTaskFile } from "./task-file.js";

const header = (fields: string, paths = "\n### Paths\n\n- `docs/`\n") =>
  parseTaskFile(`# TASK-050: Sample\n\nFormat: DbC task v1\n${fields}\n\n## Scope\n${paths}`);

const PROPOSAL_FIELDS = `Proposed by: Claude
Proposed date: 2026-09-28
Related contracts: None
Related ADRs: None
Dependencies: None`;

const APPROVED_FIELDS = `${PROPOSAL_FIELDS}
Approved by: Patrick
Approved date: 2026-09-28`;

describe("v1Problems (P6, FL-2)", () => {
  it("a complete file has no problems in any state", () => {
    const parsed = header(APPROVED_FIELDS);
    for (const state of ["proposed", "approved", "in-progress", "review", "completed"] as const) {
      expect(v1Problems(parsed, state, "TASK-050")).toEqual([]);
    }
  });

  it("a proposal needs no approval fields and no Paths", () => {
    expect(v1Problems(header(PROPOSAL_FIELDS, ""), "proposed", "TASK-050")).toEqual([]);
  });

  it("from approval on, approval fields and Paths are required", () => {
    expect(v1Problems(header(PROPOSAL_FIELDS, ""), "approved", "TASK-050")).toEqual([
      { kind: "missing_field", field: "Approved by" },
      { kind: "missing_field", field: "Approved date" },
      { kind: "paths_missing" },
    ]);
  });

  it("reports empty fields separately from missing ones", () => {
    const parsed = header(`${PROPOSAL_FIELDS}\nApproved by:\nApproved date: 2026-09-28`);
    expect(v1Problems(parsed, "completed", "TASK-050")).toEqual([{ kind: "empty_field", field: "Approved by" }]);
  });

  it("list fields must be present, with None for empty (Q10)", () => {
    const parsed = header("Proposed by: Claude\nProposed date: 2026-09-28\nRelated ADRs:");
    expect(v1Problems(parsed, "proposed", "TASK-050")).toEqual([
      { kind: "missing_field", field: "Related contracts" },
      { kind: "empty_field", field: "Related ADRs" },
      { kind: "missing_field", field: "Dependencies" },
    ]);
  });

  it("an invalid date is a problem in any state, even where the field is optional", () => {
    const parsed = header(`${PROPOSAL_FIELDS.replace("2026-09-28", "2026-02-30")}\nApproved date: soon`);
    expect(v1Problems(parsed, "proposed", "TASK-050")).toEqual([
      { kind: "invalid_date", field: "Proposed date", value: "2026-02-30" },
      { kind: "invalid_date", field: "Approved date", value: "soon" },
    ]);
  });

  it("reports duplicated fields", () => {
    const parsed = header(`${APPROVED_FIELDS}\nApproved by: Someone else`);
    expect(v1Problems(parsed, "approved", "TASK-050")).toEqual([{ kind: "duplicate_field", field: "Approved by" }]);
  });

  it("reports a missing title and a title ID that differs from the file name", () => {
    const noTitle = parseTaskFile(`Format: DbC task v1\n${APPROVED_FIELDS}\n\n## Scope\n\n### Paths\n- \`a/\`\n`);
    expect(v1Problems(noTitle, "approved", "TASK-050")).toEqual([{ kind: "missing_title" }]);
    expect(v1Problems(header(APPROVED_FIELDS), "approved", "TASK-051")).toEqual([
      { kind: "title_id_mismatch", titleId: "TASK-050", fileId: "TASK-051" },
    ]);
  });

  it("an empty Paths section is a problem where Paths is required; None is not", () => {
    expect(v1Problems(header(APPROVED_FIELDS, "\n### Paths\n\nNo items.\n"), "review", "TASK-050")).toEqual([
      { kind: "paths_empty" },
    ]);
    expect(v1Problems(header(APPROVED_FIELDS, "\n### Paths\n\n- None\n"), "review", "TASK-050")).toEqual([]);
    expect(v1Problems(header(PROPOSAL_FIELDS, "\n### Paths\n"), "proposed", "TASK-050")).toEqual([]);
  });

  it("no acceptance fields are required (U2)", () => {
    expect(v1Problems(header(APPROVED_FIELDS), "completed", "TASK-050")).toEqual([]);
  });

  it("problem keys are stable and distinguish the problems", () => {
    const keys = [
      problemKey({ kind: "missing_field", field: "Approved by" }),
      problemKey({ kind: "empty_field", field: "approved  BY" }),
      problemKey({ kind: "invalid_date", field: "Approved date", value: "soon" }),
      problemKey({ kind: "title_id_mismatch", titleId: "TASK-1", fileId: "TASK-001" }),
      problemKey({ kind: "paths_empty" }),
    ];
    expect(keys).toEqual([
      "missing_field:approved by",
      "empty_field:approved by",
      "invalid_date:approved date:soon",
      "title_id_mismatch:TASK-1:TASK-001",
      "paths_empty",
    ]);
  });
});
