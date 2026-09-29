import { describe, expect, it } from "vitest";
import { isHeaderOnlyEdit } from "./header-only.js";

const DOC = `# CONTRACT-099: Example

Status: Proposed
Approved by:

## Purpose

Body text.
`;

describe("isHeaderOnlyEdit (Q4)", () => {
  it("a status-line change is header-only", () => {
    const approved = DOC.replace("Status: Proposed", "Status: Approved").replace("Approved by:", "Approved by: Patrick");
    expect(isHeaderOnlyEdit(DOC, approved)).toBe(true);
  });

  it("a change at or after the first ## line is not header-only", () => {
    expect(isHeaderOnlyEdit(DOC, DOC.replace("Body text.", "Body text, edited."))).toBe(false);
    expect(isHeaderOnlyEdit(DOC, DOC.replace("## Purpose", "## Purpose and scope"))).toBe(false);
    expect(isHeaderOnlyEdit(DOC, `${DOC}\n## Appendix\n`)).toBe(false);
  });

  it("added and deleted files are not header-only", () => {
    expect(isHeaderOnlyEdit(null, DOC)).toBe(false);
    expect(isHeaderOnlyEdit(DOC, null)).toBe(false);
    expect(isHeaderOnlyEdit(undefined, DOC)).toBe(false);
  });

  it("a document without a ## line is never header-only", () => {
    expect(isHeaderOnlyEdit("# Title\nStatus: a\n", "# Title\nStatus: b\n")).toBe(false);
  });

  it("### headings do not start the body", () => {
    const withSub = "# T\nStatus: a\n### Not body\n## Body\nx\n";
    expect(isHeaderOnlyEdit(withSub, withSub.replace("### Not body", "### Changed"))).toBe(true);
  });
});
