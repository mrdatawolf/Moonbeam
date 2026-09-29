import type { FailureCategory } from "@moonbeam/shared";
import type { ErrorCategory } from "../api/client";

/** Plain-language names for the failure categories. The code itself is always shown too. */
export const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  unidentified: "Not identified",
  not_found: "Not found",
  invalid_transition: "Not allowed in this state",
  conflict: "Changed by someone else",
  validation: "Missing or invalid input",
  connection: "Connection lost",
  unexpected: "Unexpected response",
} satisfies Record<FailureCategory | "connection" | "unexpected", string>;


const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return absoluteTime(iso);
}

export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
