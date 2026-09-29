// CONTRACT-006 R1 to R3 and R6: contracts, ADRs, and the project definition.

import { getField, parseHeaderBlock, splitLines } from "./header.js";

export type ArtifactPath =
  | { kind: "contract"; id: string; slug: string }
  | { kind: "adr"; id: string; slug: string }
  | { kind: "project" };

export function classifyArtifactPath(path: string): ArtifactPath | null {
  const contract = /^docs\/contracts\/(CONTRACT-\d+)-([a-z0-9-]+)\.md$/.exec(path);
  if (contract) return { kind: "contract", id: contract[1]!, slug: contract[2]! };
  const adr = /^docs\/decisions\/(ADR-\d+)-([a-z0-9-]+)\.md$/.exec(path);
  if (adr) return { kind: "adr", id: adr[1]!, slug: adr[2]! };
  if (path === "docs/PROJECT.md") return { kind: "project" };
  return null;
}

/** R6: a document without a `# ` line has status unknown. */
export type Unknown = { kind: "unknown" };

export interface ContractHeader {
  kind: "contract";
  /** The ID before `: ` in the title line, or null when the title has no ID. */
  id: string | null;
  title: string;
  status: string | null;
  supersedes: string | null;
  approvedBy: string | null;
  approvedDate: string | null;
  relatedTasks: string | null;
}

export interface AdrHeader {
  kind: "adr";
  id: string | null;
  title: string;
  status: string | null;
  date: string | null;
}

interface DocumentHead {
  id: string | null;
  title: string;
  field(name: string): string | null;
}

function readHead(text: string): DocumentHead | null {
  const lines = splitLines(text);
  const titleIndex = lines.findIndex((l) => /^#\s/.test(l));
  if (titleIndex === -1) return null;
  const titleText = lines[titleIndex]!.replace(/^#\s+/, "").trim();
  const colon = titleText.indexOf(": ");
  const id = colon === -1 ? null : titleText.slice(0, colon).trim();
  const title = colon === -1 ? titleText : titleText.slice(colon + 2).trim();

  let end = lines.findIndex((l, i) => i > titleIndex && /^## /.test(l));
  if (end === -1) end = lines.length;
  const header = parseHeaderBlock(lines.slice(titleIndex + 1, end), titleIndex + 2);
  return {
    id,
    title,
    field: (name) => {
      const found = getField(header, name);
      return found && found.value !== "" ? found.value : null;
    },
  };
}

export function parseContractHeader(text: string): ContractHeader | Unknown {
  const head = readHead(text);
  if (!head) return { kind: "unknown" };
  return {
    kind: "contract",
    id: head.id,
    title: head.title,
    status: head.field("Status"),
    supersedes: head.field("Supersedes"),
    approvedBy: head.field("Approved by"),
    approvedDate: head.field("Approved date"),
    relatedTasks: head.field("Related tasks"),
  };
}

export function parseAdrHeader(text: string): AdrHeader | Unknown {
  const head = readHead(text);
  if (!head) return { kind: "unknown" };
  return {
    kind: "adr",
    id: head.id,
    title: head.title,
    status: head.field("Status"),
    date: head.field("Date"),
  };
}
