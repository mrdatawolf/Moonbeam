/** Q4: absence and section-less documents are never header-only edits. */
export function isHeaderOnlyEdit(oldText: string | null | undefined, newText: string | null | undefined): boolean {
  if (oldText == null || newText == null) return false;
  const oldStart = /^## /m.exec(oldText)?.index;
  const newStart = /^## /m.exec(newText)?.index;
  return oldStart !== undefined && newStart !== undefined && oldText.slice(oldStart) === newText.slice(newStart);
}
