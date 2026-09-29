// CONTRACT-006 P3 to P9: parse one task file's text. Never throws (N4).

import { getField, parseHeaderBlock, splitLines, type HeaderBlock, type HeaderField } from "./header.js";

export const DBC_TASK_V1 = "DbC task v1";

export interface TaskTitle {
  /** The ID as written in the title line, for example `TASK-021`. */
  id: string;
  text: string;
  line: number;
}

export type PathsSection =
  | { kind: "absent" }
  /** A `### Paths` heading with no list items. */
  | { kind: "empty" }
  /** A single item `None`: the task changes no work paths. */
  | { kind: "none" }
  | { kind: "patterns"; patterns: string[] };

export interface ParsedTaskFile {
  /** Null when the first non-blank line is not `# TASK-<digits>: <title>` (P3). */
  title: TaskTitle | null;
  header: HeaderBlock;
  /** P4/FL-2: original header lines, including duplicates, blanks and whitespace.
   * Line terminators are normalized by splitLines; the title is not part of P4. */
  rawHeaderLines: string[];
  /** The `Format` value as written, or null when there is no `Format:` field (P9). */
  format: string | null;
  isV1: boolean;
  paths: PathsSection;
}

const TITLE_LINE = /^#\s+(TASK-\d+):\s*(.*?)\s*$/;
const LEVEL_2_HEADING = /^## /;
const HEADING_1_TO_3 = /^#{1,3}\s/;
const PATHS_HEADING = /^###\s+Paths\s*$/i;
const FENCE = /^\s*(```|~~~)/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;

export function parseTaskFile(text: string): ParsedTaskFile {
  const lines = splitLines(text);

  const firstNonBlank = lines.findIndex((l) => l.trim() !== "");
  const titleMatch = firstNonBlank === -1 ? null : TITLE_LINE.exec(lines[firstNonBlank]!.trim());
  const title: TaskTitle | null = titleMatch
    ? { id: titleMatch[1]!, text: titleMatch[2]!, line: firstNonBlank + 1 }
    : null;

  // P4: after the title line (or from the top when there is none) up to the first `## ` line.
  const headerStart = title ? firstNonBlank + 1 : 0;
  let headerEnd = lines.findIndex((l, i) => i >= headerStart && LEVEL_2_HEADING.test(l));
  if (headerEnd === -1) headerEnd = lines.length;
  const header = parseHeaderBlock(lines.slice(headerStart, headerEnd), headerStart + 1);

  const formatField = getField(header, "Format");
  const format = formatField ? formatField.value : null;
  const isV1 = format !== null && format.trim().toLowerCase() === DBC_TASK_V1.toLowerCase();

  return { title, header, rawHeaderLines: lines.slice(headerStart, headerEnd), format, isV1, paths: parsePathsSection(lines) };
}

/** P7: the first `### Paths` heading up to the next heading of level 1 to 3. */
function parsePathsSection(lines: readonly string[]): PathsSection {
  let inFence = false;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && PATHS_HEADING.test(line.trim())) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return { kind: "absent" };

  const items: string[] = [];
  inFence = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!;
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (HEADING_1_TO_3.test(line)) break;
    const item = LIST_ITEM.exec(line);
    if (!item) continue;
    const pattern = itemPattern(item[1]!);
    if (pattern !== "") items.push(pattern);
  }

  if (items.length === 0) return { kind: "empty" };
  if (items.length === 1 && items[0]!.toLowerCase() === "none") return { kind: "none" };
  return { kind: "patterns", patterns: items };
}

/** The first backtick-quoted span in the item, or the whole item text. */
function itemPattern(itemText: string): string {
  const span = /`([^`]*)`/.exec(itemText);
  return (span ? span[1]! : itemText).trim();
}

export function taskField(parsed: ParsedTaskFile, name: string): HeaderField | undefined {
  return getField(parsed.header, name);
}
