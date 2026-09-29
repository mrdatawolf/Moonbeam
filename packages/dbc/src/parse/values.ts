// CONTRACT-006 P5: value formats.

export interface NameValue {
  /** Text before the first " (", trimmed. */
  name: string;
  /** The rest, shown but not interpreted; null when there is none. */
  note: string | null;
}

export function parseName(value: string): NameValue {
  const trimmed = value.trim();
  const cut = trimmed.indexOf(" (");
  if (cut === -1) return { name: trimmed, note: null };
  return { name: trimmed.slice(0, cut).trim(), note: trimmed.slice(cut + 1).trim() };
}

/** `YYYY-MM-DD` and a real calendar date. */
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export type IdKind = "CONTRACT" | "ADR" | "TASK";

export type IdList =
  | { kind: "empty" }
  /** The single word `None`, in any case: an explicitly empty list. */
  | { kind: "none" }
  | { kind: "ids"; ids: string[] }
  /** Non-empty, no ID of the kind, not `None`: valid free text. */
  | { kind: "text"; text: string };

export function parseIdList(value: string, kind: IdKind): IdList {
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "empty" };
  if (trimmed.toLowerCase() === "none") return { kind: "none" };
  const ids = [...trimmed.matchAll(new RegExp(`\\b${kind}-\\d+\\b`, "g"))].map((m) => m[0]);
  if (ids.length > 0) return { kind: "ids", ids: [...new Set(ids)] };
  return { kind: "text", text: trimmed };
}
