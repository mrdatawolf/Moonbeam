// CONTRACT-006 P4: the header block of a task file, shared with the contract
// and ADR header parsers (R1, R2), which use the same `Field: value` lines.

export interface HeaderField {
  /** The field name as written, trimmed. */
  name: string;
  /** Lowercase name with inner whitespace collapsed; fields are matched by this. */
  key: string;
  /** Value with continuation lines joined by one space, trimmed. */
  value: string;
  /** 1-based line number of the field line. */
  line: number;
}

export interface HeaderBlock {
  /** First occurrence of each field, in file order. */
  fields: HeaderField[];
  /** Names (as first written) of fields that appeared more than once. */
  duplicates: string[];
  /** Non-blank lines before the first field line; there is no field for them to continue. */
  unattached: string[];
}

// A field name starts with a letter and holds letters, digits, spaces, hyphens,
// and underscores, so wrapped values such as "ADR-003 (context: ADR-002)" are
// continuations, not fields.
const FIELD_LINE = /^([A-Za-z][A-Za-z0-9 _-]*?)\s*:(.*)$/;

export function fieldKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/** Parse `lines` (already cut to the header block). `firstLine` is the 1-based number of lines[0]. */
export function parseHeaderBlock(lines: readonly string[], firstLine: number): HeaderBlock {
  const fields: HeaderField[] = [];
  const duplicates: string[] = [];
  const unattached: string[] = [];
  const seen = new Set<string>();
  // The field that continuation lines append to; null for a discarded duplicate.
  let current: HeaderField | null = null;
  let started = false;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line === "") return;
    const match = FIELD_LINE.exec(line);
    if (match) {
      started = true;
      const name = match[1]!.trim();
      const key = fieldKey(name);
      if (seen.has(key)) {
        if (!duplicates.some((d) => fieldKey(d) === key)) {
          duplicates.push(fields.find((f) => f.key === key)!.name);
        }
        current = null;
        return;
      }
      seen.add(key);
      current = { name, key, value: match[2]!.trim(), line: firstLine + i };
      fields.push(current);
      return;
    }
    if (!started) {
      unattached.push(line);
      return;
    }
    if (current) current.value = current.value === "" ? line : `${current.value} ${line}`;
  });

  return { fields, duplicates, unattached };
}

export function getField(block: { fields: readonly HeaderField[] }, name: string): HeaderField | undefined {
  const key = fieldKey(name);
  return block.fields.find((f) => f.key === key);
}
