# Task Board

Task plan files move through the directories below. Their directory is the
authoritative status; do not add a redundant status field to task files.

See `docs/workflow/lifecycle.md` for transition authority and
`docs/templates/task.md` for the task format.

```text
proposed -> approved -> in-progress -> review -> completed
```

## Task format: DbC task v1

Task files use the format "DbC task v1", defined in
`docs/contracts/CONTRACT-006-what-moonbeam-reads.md` (rules P1 to P10, and the
field table in P6). A file declares it with `Format: DbC task v1` as the first
header line. Start new task files from `docs/templates/task.md`.

The header block is every line between the `# TASK-NNN: Title` line and the
first `## ` heading. It holds only `Field: value` lines. Field formats:

- Dates (`Proposed date`, `Approved date`) are `YYYY-MM-DD`.
- Names (`Proposed by`, `Approved by`) are a name, optionally followed by a note
  in parentheses, for example `Patrick (instructed in planning session)`.
- List fields (`Related contracts`, `Related ADRs`, `Dependencies`) are IDs
  separated by commas, optionally with notes in parentheses, or `None` when the
  list is empty. Write `None` rather than leaving the field blank.
- `Assigned agent` names the agent and, where known, the model, for example
  `implementer (Claude)`.
- Keep each field on one line where possible. Continuation lines are tolerated.

The `### Paths` guidance is in the template.

## Older task files

Task files written before this format was adopted have no `Format:` line. They
are pre-v1 and are not rewritten to the new format. Moonbeam reads them on a
best-effort basis and reports them as not DbC task v1 (CONTRACT-006 P9, FL-7).
