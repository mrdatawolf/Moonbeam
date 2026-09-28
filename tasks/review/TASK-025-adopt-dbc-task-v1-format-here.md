# TASK-025: Adopt the DbC task v1 format for this repository's tasks

Owner role: Documentation
Assigned agent: librarian
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-006
Related ADRs: ADR-008
Dependencies: None

## Desired outcome

New task files in this repository are DbC task v1 (CONTRACT-006 P). When Moonbeam
first reads this repository, every task written from now on parses as v1, and
only older files raise FL-7.

## Context

This is TASK-023 decision 4, option B, part 1. The format comes now. The
main-branch rules (U5 to U8) come later in TASK-041. This repository's template
already has `### Paths` and no `## Human acceptance`. It lacks the `Format:`
line and the U3 and U4 guidance.

P4 matters here. Every non-blank line between the title and the first `## `
line is a field or a continuation of one. Guidance text therefore must not
appear in the header block.

## Scope

### Included

- `docs/templates/task.md`:
  - add `Format: DbC task v1` as the first header line (U1)
  - add the U3 Paths guidance under `### Paths`:
    - one repository-relative path per list item, in backticks
    - a trailing `/` for a directory
    - `*` and `**` allowed
    - `None` when the task changes no files outside `tasks/`
    - the task file itself is not listed
  - keep the existing sentence about the dispatcher
- `tasks/README.md`:
  - name the format ("DbC task v1")
  - give the U4 field formats: dates `YYYY-MM-DD`; a name optionally followed by a note in parentheses; list fields as comma-separated IDs or `None`; one line per field preferred; `Assigned agent` names the agent and, where known, the model
  - state that files written before this change are pre-v1 and are not rewritten

### Excluded

- The main-branch rules, lifecycle, approval gates, and AGENTS.md (TASK-041).
- Editing any existing task file.
- The upstream template.

### Paths

- `docs/templates/task.md`
- `tasks/README.md`

## Plan

1. Edit the template's header block and Paths guidance.
2. Add the format section to `tasks/README.md`.
3. Check the template by applying P3 to P7 by hand.

## Acceptance criteria

- [ ] The template's first header line is `Format: DbC task v1` (U1, P6).
- [ ] The header block has only field lines (P4): no guidance or comment lines before the first `## `.
- [ ] The template's field set matches the P6 table (Title, Format, Proposed by and date, Approved by and date, Related contracts, Related ADRs, Dependencies, Paths). No `## Human acceptance` section (U2).
- [ ] The Paths guidance matches U3, and the field formats are documented as U4 describes.
- [ ] A task filled in from the template, in `approved/`, would raise no FL-2 or FL-7 when checked by hand against P3 to P7.
- [ ] No other file changes.

## Validation requirements

Hand-check a sample filled-in task against P1 to P7 and record it in the handoff.
Once TASK-027 exists, its parser can confirm this. That check is not required
here.

## Risks and assumptions

- Assumes decision 4 is B or A. If it is C, drop this task.
- If this is approved before TASK-026 onward, the dispatcher may add the
  `Format:` line to those proposals when approving them.

## Blocker

None.

## Implementation handoff

Done by the librarian.

**Changed:**

- `docs/templates/task.md`: `Format: DbC task v1` is the first header line
  (U1). A U3 guidance paragraph is added under `### Paths`, as prose.
- `tasks/README.md`: new "Task format: DbC task v1" section with the U4 field
  formats, and an "Older task files" section: pre-v1 files are not rewritten,
  and Moonbeam reports them under FL-7.

**Validated:**

- A hand check of a filled-in sample against P1 to P7 found no FL-2 or FL-7.
  The sample was reasoned through only; no file was created. There is no
  machine check until TASK-027's parser exists.
- The dispatcher confirmed with `git status` that only the two files changed.

**Deviations:**

- The Paths guidance is prose, not a bulleted list. P7 reads every list item
  under `### Paths` as a path pattern.
- U8's "`in-progress/` and `review/` don't appear on main" is left to
  TASK-041, which the Excluded list assigns the main-branch rules to.
- Existing task files are not given `Format:` lines. That includes TASK-026
  onward, which were written before this template.

## Review

Not reviewed.
