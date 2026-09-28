# CONTRACT-006: What Moonbeam reads from a DbC project

Status: Approved
Approved by: Patrick
Approved date: 2026-09-25
Related tasks: TASK-021
Related ADRs: ADR-008 (governing, with its 2026-09-28 amendment: decision 8 =
alternative A), ADR-009, ADR-007, ADR-003 (context: ADR-002, ADR-004, ADR-005)
Related contracts: CONTRACT-002 (kept parts: user registry and user select);
CONTRACT-003, CONTRACT-004, CONTRACT-005 are shelved and not used here
Reads: upstream Project Template DbC, task format "DbC task v1" (defined in
this contract; see "Required upstream template changes")

## Purpose

Define exactly what Moonbeam reads from a DbC project on GitHub, what it derives
from that, what it shows, and what it flags. This is the "DbC is the API"
interface of ADR-008. A project that follows it is fully visible in Moonbeam. A
project that doesn't is flagged, not broken.

Moonbeam is an observer. It reads each project's main branch on GitHub, keeps no
task state of its own, never writes to a repository or to GitHub, and never
blocks anything (ADR-007, ADR-008 decisions 6 and 7).

## Scope

### Included

- The source: the GitHub repository, its tracked branch, polling, the read-only
  token, and behavior when GitHub or the repository misbehaves (S, F).
- The task file format Moonbeam parses, named "DbC task v1", with required and
  optional fields and tolerance for older or malformed files (P).
- The task history Moonbeam derives from main's commits (H).
- The other artifacts read and rendered read-only: contracts, ADRs, and
  `docs/PROJECT.md` (R).
- The information in the per-project view (D).
- The flags: rule, evidence, and dismissal (FL, FG).
- Mapping commit authors and recorded names to board members (I).
- The changes the upstream DbC template needs so that it produces DbC task v1
  (U).
- Validation requirements, including a walk-through against this repository's
  history (V).

### Excluded

- Any write to a repository or to GitHub, including comments, statuses, checks,
  labels, reviews, and webhook registration.
- Approving, accepting, merging, or any other lifecycle action from Moonbeam.
- Branches other than the tracked branch, pull requests, issues, and tags.
- Tracking `in-progress/` and `review/` on the lead developer's branch.
- Sub-projects and concurrent lead developers.
- Pauses, runs, costs, and model track records.
- Visual design. This contract states the information each view must show, not
  its layout.
- The cross-project dashboard. It may summarize data defined here, under its
  own task.
- Verifying commit signatures.
- Implementation, including the choice of GitHub API (REST, GraphQL, or git
  fetch).

## Actors

- **Board member:** a Moonbeam user (CONTRACT-002 user registry), chosen from
  the user select on the honor system (ADR-003). Anyone may view without
  choosing a user. Actions inside Moonbeam (registering a project, assigning a
  lead developer, managing identities, dismissing or reopening a flag) require a
  selected user and are recorded in the audit trail.
- **Lead developer:** the one board member assigned to a project in Moonbeam
  (ADR-008 decision 1). They act in the repository, not in Moonbeam.
- **Commit author:** whoever git records as author of a commit on main: a board
  member, another person, or an agent using some git identity. Git identities
  are unauthenticated.
- **Moonbeam poller:** the system actor that reads GitHub on a schedule.
- **GitHub:** the source of truth for what has been pushed.

## Inputs and outputs

Inputs:

- Per project, the registration held in Moonbeam (S1).
- Per board member, their git identities and name aliases (I1).
- From GitHub, read only: the tracked branch's head, the commits on its
  first-parent chain, their trees, their change sets, and the contents of the
  files named in P, R.

Outputs, all inside Moonbeam and all read-only toward the repository:

- The derived task list and history per project (H).
- Rendered contracts, ADRs, and project goals (R).
- The per-project view (D).
- Flags with evidence, and their dismissal records (FL, FG).
- Source status per project (S, F).

## Preconditions

1. The project is registered in Moonbeam (S1) by a board member.
2. A token that can read the repository is configured for it (S4).
3. Nothing is required of the repository. A repository without DbC files, with
   older files, or with malformed files is still read, and its problems are
   shown as notices or flags (F7, FL-7).

## Required behavior

### Definitions

- **Tracked branch:** the branch named in the registration, `main` by default
  (Q13). "Main" in this contract means the tracked branch.
- **Head:** the commit the tracked branch points to on GitHub at a poll.
- **Chain:** the first-parent chain from head back to the root commit. Only
  commits on the chain are "commits on main". Commits reached only through a
  merge's second parent are part of that merge, not separate events.
- **First parent of C:** C's first parent; for the root commit, an empty tree.
- **Change set of C:** every path added, modified, or deleted between the first
  parent's tree and C's tree. A rename counts as both its old and its new path.
  For a merge commit this is everything the merge brought into main.
- **State directories:** `tasks/proposed/`, `tasks/approved/`,
  `tasks/in-progress/`, `tasks/review/`, `tasks/completed/`.
- **Task file:** a file directly inside a state directory whose name matches P1.
  The task's **ID** comes from its file name. Its **state** at a commit is the
  state directory holding it in that commit's tree.
- **Record paths:** every path under `tasks/`.
- **Header-only edit:** a change to a file under `docs/contracts/` or
  `docs/decisions/` in which every added or removed line lies before the file's
  first line starting with `## `, in both the old and the new version (Q4).
- **Work paths of C, W(C):** the change set of C minus record paths, minus
  header-only edits, minus the project's exempt paths (S1, Q5).
- **Completed at C:** the set of task IDs that enter `completed/` at C (H3).
- **Baseline:** a commit on the chain chosen at registration (S1, Q3).
  **Evaluated commits** are the commits on the chain strictly newer than the
  baseline. Event-based flags are raised only for evaluated commits. History
  (H) is always derived from the whole chain.
- **Now:** the Moonbeam server's clock at evaluation time.

### Source (S)

- **S1 Registration.** A project registration holds:
  - the GitHub owner and repository name
  - the GitHub repository's numeric ID, recorded at registration
  - the tracked branch, default `main`
  - which configured token is used (S4)
  - the lead developer: one board member, or none
  - the baseline commit (default: head at registration, Q3)
  - exempt paths, default empty (Q5)
  - the staleness threshold, default from Q1

  Registration and every later change to it are Moonbeam data, recorded in the
  audit trail with the selected user.
- **S2 Main only.** Moonbeam reads only the tracked branch. It reads no other
  branch, pull request, issue, or tag.
- **S3 Read only.** Every request Moonbeam makes to GitHub is a read. It never
  creates, changes, or deletes anything on GitHub or in the repository.
- **S4 Token.** Moonbeam reads through a token that the operator configures per
  project or per GitHub owner (Q11). The token should grant repository contents
  read and metadata read, and nothing else.
  - The token is never sent to the browser, never written to logs, and never
    shown after it is entered, except in a masked form.
  - If GitHub reports that a token carries write scopes, the project shows a
    warning. Reading continues.
- **S5 Polling.** Moonbeam polls each project on a fixed interval, 5 minutes by
  default (Q2).
  - Any viewer can ask for an immediate refresh of one project.
  - Polls of the same project never overlap.
  - Moonbeam respects GitHub's rate limits. When rate-limited, it waits until
    the reset time GitHub reports and shows "rate limited until T" (F1).
- **S6 Poll outcome.** A poll reads the head.
  - If the head equals the last processed head, only time-based conditions are
    re-evaluated (FL-5).
  - Otherwise Moonbeam reads what it needs of the new chain commits and updates
    derived data and flags. A viewer sees either the whole previous result or
    the whole new one, never a mix.
  - If the new head does not descend from the last processed head (or equal
    it), F6 applies.
- **S7 Last known state.** The result of the last successful poll stays
  visible, labeled with its time and head commit, whatever later polls do.
- **S8 Repository identity.** Moonbeam reads a repository only if its GitHub
  numeric ID equals the one recorded in S1 (see F4).

### Task file format: DbC task v1 (P)

DbC task v1 is the upstream task template after the changes in "Required
upstream template changes". A file declares it with the `Format:` field (P4).
Current upstream files, and this repository's files, have no `Format:` line and
are "pre-v1".

- **P1 File name.** `TASK-<digits>-<slug>.md`, where `<digits>` is at least
  three digits and `<slug>` is lowercase letters, digits, and hyphens. The ID is
  `TASK-<digits>`, compared as written (`TASK-021` and `TASK-21` differ).
- **P2 What is ignored.** `tasks/README.md` and any `.gitkeep`. Every other path
  under `tasks/` that is not a task file (P1 name, directly inside a state
  directory) is reported by FL-7.
- **P3 Title line.** The first non-blank line is `# TASK-<digits>: <title>`. The
  ID in it must equal the file-name ID.
- **P4 Header block.** The lines after the title line and before the first line
  starting with `## `.
  - A field line is `<Field name>: <value>`. Field names are matched
    case-insensitively after trimming.
  - A non-blank line that is not a field line continues the previous field's
    value (joined with a single space). This accepts wrapped values such as
    TASK-020's "Related contracts".
  - A field that appears twice keeps its first value and is reported by FL-2.
  - Unknown fields are kept and shown, and are not flagged.
  - Values are trimmed. A value that is empty after trimming is "empty".
- **P5 Value formats.**
  - **Name:** the text before the first ` (` is the name. The rest is a note,
    shown but not interpreted. "Patrick (instructed in planning session)" has
    the name "Patrick".
  - **Date:** `YYYY-MM-DD`, a real calendar date.
  - **ID list:** the IDs found in the value by the pattern for its kind
    (`CONTRACT-<digits>`, `ADR-<digits>`, `TASK-<digits>`). Surrounding text is
    a note. The single word `None` (any case) means an explicitly empty list.
    A non-empty value with no ID and not `None` is kept as free text and is
    valid.
  - **Free text:** any non-empty value.
- **P6 Fields.** "Required in" names the states in which the field must be
  present and non-empty for a v1 file (FL-2). A state not listed means optional.

  | Field | Format | Required in |
  |---|---|---|
  | Title (P3) | text after `TASK-NNN: ` | all states |
  | `Format` | exactly `DbC task v1`, case-insensitive | all states (absent or other value: FL-7, not FL-2) |
  | `Owner role` | free text | optional |
  | `Assigned agent` | free text; names the agent and, where known, the model, for example `implementer (Claude)` | optional |
  | `Proposed by` | name | all states |
  | `Proposed date` | date | all states |
  | `Approved by` | name | approved, in-progress, review, completed |
  | `Approved date` | date | approved, in-progress, review, completed |
  | `Related contracts` | ID list or `None` | all states (Q10) |
  | `Related ADRs` | ID list or `None` | all states (Q10) |
  | `Dependencies` | ID list, free text, or `None` | all states (Q10) |
  | Paths (P7) | path list or `None` | approved, in-progress, review, completed (Q9) |

- **P7 Paths.** The first `### Paths` heading in the file, up to the next
  heading of level 3 or higher.
  - Each list item is one pattern: the first backtick-quoted span in the item,
    or the whole item text if it has none. Any other text is a note.
  - A single item `None` declares that the task changes no work paths.
  - Patterns are repository-relative. A leading `/` or `./` is removed.
    Matching is case-sensitive.
  - A changed path c matches pattern p when:
    - p contains `*`: glob match, where `*` matches within one path segment,
      `**` matches any number of segments, and `**/` may match none; or
    - otherwise, c equals p, or c starts with p followed by `/` (so `server/`,
      `server`, and `docs/DEVELOPMENT.md` all work as written).
  - A Paths section with no items is empty (FL-2 where required).
- **P8 Sections not parsed.** Moonbeam renders the whole file (R4) but does not
  interpret any other section.
- **P9 Pre-v1 and unknown versions.** A task file without `Format:`, or with a
  value other than `DbC task v1`, is still parsed by P1 to P7 on a best-effort
  basis. Its fields are shown, labeled "not DbC task v1". It raises FL-7 and
  does not raise FL-2. Its best-effort Paths and names are still used by FL-4
  and FL-8.
- **P10 Limits.** A file that is not valid UTF-8 or is larger than 1 MiB is not
  parsed. It raises FL-7 and still counts as present in its state directory for
  history (H).

### Derived task history (H)

- **H1 Source.** History is derived from the whole chain, oldest commit first.
  It is keyed by task ID, not by file path, so a task keeps its history across
  moves and slug changes. Moonbeam does not rely on git rename detection.
- **H2 Presence.** For each commit C, Moonbeam knows which task IDs are present
  in which state directories in C's tree.
- **H3 Events.** For each commit C on the chain and each ID:
  - **enters S:** the ID is in state directory S at C and was not in S at C's
    first parent;
  - **leaves S:** the reverse;
  - **removed:** the ID is in some state directory at the first parent and in
    none at C.
- **H4 Event facts.** Each event records C's SHA, subject line, committer
  timestamp (the event time), author (name, e-mail, and the GitHub login GitHub
  associates with it, if any), committer, and whether C is a merge commit. The
  author is mapped to a board member by I3.
- **H5 Dates shown per task.**
  - first entered `proposed/`, `approved/`, and `completed/` on main, each with
    the commit author;
  - the most recent entry into `approved/` (used by FL-5 and D3);
  - the **acceptance commit**: the commit where the task first entered
    `completed/`, shown as "merged" if it is a merge commit and "direct commit"
    otherwise.
- **H6 Other states.** Entries into `in-progress/` and `review/` on main are
  recorded as events and raise FL-11. They are not otherwise tracked.
- **H7 Current state.** A task's current state is its state directory at head.
  A task in more than one state directory at head has all of them, and raises
  FL-6. A removed task's state is "removed" (withdrawn if it was only ever in
  `proposed/`).
- **H8 Header values next to history.** Recorded values (`Approved by` and
  `Approved date`) are shown beside the commit facts. Moonbeam
  does not reconcile them. A header date that differs from the commit date is
  shown, not flagged.
- **H9 Determinism.** History for a given head is a function of the chain
  alone. Rebuilding from nothing gives the same result as incremental polling.

### Other artifacts read (R)

All are read from head and rendered read-only.

- **R1 Contracts.** Files matching `docs/contracts/CONTRACT-<digits>-<slug>.md`.
  Moonbeam shows the ID, the title (text after `: ` in the first `# ` line), and
  these header lines when present: `Status`, `Supersedes`, `Approved by`,
  `Approved date`, `Related tasks`. Other files in the directory are ignored.
- **R2 ADRs.** Files matching `docs/decisions/ADR-<digits>-<slug>.md`, with ID,
  title, `Status`, and `Date`. Other files are ignored.
- **R3 Project goals.** `docs/PROJECT.md`, rendered as the project's goals. If
  it is missing, the view says "No project definition found".
- **R4 Rendering.** Markdown is rendered read-only with the head commit and a
  link to the file on GitHub. Rendering never executes scripts or other active
  content from the repository.
- **R5 Links.** IDs in a task's `Related contracts`, `Related ADRs`, and
  `Dependencies` link to the rendered artifact or task when it exists on main.
  An ID that is not found is shown unlinked, marked "not found on main". This
  is not a flag.
- **R6 Unreadable artifacts.** A contract, ADR, or `PROJECT.md` that cannot be
  parsed is listed with "status unknown" or "could not be read". This is not a
  flag. Flags concern the task process only.

### Per-project view (D)

Information only. Every value is as of the last successful poll (S7).

- **D1 Project header.**
  - the name and a link to the GitHub repository
  - the tracked branch and head commit
  - the time of the last successful poll, and the source status (F)
  - the lead developer, or "No lead developer"
  - a count of open flags
  - how many task files are DbC task v1 and how many are not
- **D2 Proposed tasks:** ID, title, `Proposed by`, `Proposed date`, first entry
  into `proposed/` (time and author), and how long since.
- **D3 Approved tasks:** ID, title, `Approved by` and date, the most recent
  entry into `approved/` (time and author), how long it has waited since then,
  whether FL-5 applies, `Assigned agent`, and dependencies with their current
  states.
- **D4 Recently completed:** tasks whose acceptance commit falls in the last 30
  days, and at least the 10 most recent, newest first (Q15). Each shows ID,
  title, the acceptance commit (merged or direct) and its author, who is the
  acceptor (U2), and the time from the most recent approval entry to acceptance.
  The full list of completed tasks is reachable from here.
- **D5 Other states on main.** Tasks currently in `in-progress/` or `review/`
  on main, and removed tasks, each marked as such.
- **D6 Activity over time.** For each of the last 12 weeks: the number of tasks
  that entered `proposed/`, `approved/`, and `completed/`, the number of commits
  on main, and the number of flags raised.
- **D7 Flags.** Open flags first, each with its rule name, subject, time first
  raised, and evidence (FL). Dismissed and resolved flags are reachable, with
  their notes.
- **D8 Task detail.** All parsed fields (P6) with their parse problems, the
  full event history (H3, H4), the flags on the task, and the rendered file
  (R4).
- **D9 Documents.** The project goals (R3), and lists of contracts (R1) and ADRs
  (R2) with their status, each opening the rendered file.
- **D10 No actions on the repository.** The view offers no control that
  implies a change to the repository or to GitHub. Links to GitHub open GitHub.

### Flags (FL)

Each flag below states its rule, its **subject** (what one flag is about), its
kind, and its evidence. **Event** flags are raised for evaluated commits only.
**Condition** flags are evaluated at head on every poll and cover all tasks
regardless of the baseline. Every flag can be dismissed with a note (FG4).

- **FL-1 Approval skipped.**
  - Rule: at an evaluated commit C, task T enters `completed/`, and T was not in
    `approved/` at any commit on the chain older than C.
  - Subject: (T, C). Kind: event.
  - Evidence: C (SHA, subject, author, committer, time, merge or direct); T's
    event history on main; T's `Approved by` and `Approved date` at C.
- **FL-2 Incomplete record.**
  - Rule: at head, a DbC task v1 file in state S has any of these problems:
    - a field required in S (P6) is absent or empty;
    - a date field is not a valid date (P5), or a field is duplicated (P4);
    - the title line is missing or its ID differs from the file name (P3);
    - the Paths section is required in S and is absent or empty (P7).
  - Subject: (T, file path, the set of problems). A different set of problems is
    a new flag. Kind: condition.
  - Evidence: the file (linked), each problem with its field name, and the
    header block as found.
- **FL-3 Unaccounted change.**
  - Rule: at an evaluated commit C, W(C) is not empty and no task is completed
    at C.
  - Subject: C. Kind: event.
  - Evidence: C's facts (as in FL-1) and the paths in W(C). The display may
    shorten a long list, showing the total count.
- **FL-4 Out of scope.**
  - Rule: at an evaluated commit C, one or more tasks are completed at C, every
    one of them has a Paths section at C (v1 or best effort, P7, P9), and some
    path in W(C) matches none of the patterns in the union of their Paths.
  - If any task completed at C has no Paths section, FL-4 is not evaluated for
    C, and C is shown as "scope not checkable". The missing Paths is itself
    flagged by FL-2 (v1) or FL-7 (not v1).
  - When several tasks complete in one commit, the out-of-scope paths cannot be
    attributed to one of them. The flag names them all.
  - Subject: C. Kind: event.
  - Evidence: C's facts, the tasks completed at C with their declared patterns,
    and the paths that matched no pattern.
- **FL-5 Stale approval.**
  - Rule: at head, task T is in `approved/` and in no other state directory, and
    now minus the time of T's most recent entry into `approved/` exceeds the
    project's threshold (14 days by default, Q1).
  - Subject: (T, the commit of that most recent entry). Kind: condition. It
    resolves when T leaves `approved/`.
  - Dismissal lasts one further threshold period. If T is still in `approved/`
    when that period ends, a new FL-5 is raised for the same entry.
  - Evidence: T, the entry commit and time, the age in days, the threshold, the
    lead developer, and `Assigned agent`.
- **FL-6 Duplicate task ID.**
  - Rule: at head, more than one task file has the same ID, in the same or in
    different state directories.
  - Subject: (ID, the set of paths). Kind: condition.
  - Evidence: every path with that ID, and the commit that last added each.
- **FL-7 Unreadable task file.**
  - Rule: at head, a path under `tasks/` is one of:
    - not ignored (P2) and not a task file: wrong name, not directly inside a
      state directory, or inside an unknown directory under `tasks/`;
    - a task file that is not valid UTF-8 or is over the size limit (P10);
    - a task file without `Format:`, or with a value other than `DbC task v1`
      (P9).
  - Subject: (path, reason). Kind: condition.
  - Evidence: the path, the reason, and whatever fields a best-effort parse
    found.
- **FL-8 Unrecognized approver or acceptor (Q6).**
  - Rule: at an evaluated commit C where task T enters `approved/` or
    `completed/`, either:
    - C's author maps to no board member (I3), or
    - for an approval only: T's `Approved by`, as it reads at C, is empty or
      its name maps to no board member (I5). An acceptance is checked by its
      commit author alone (U2).
  - Subject: (T, C, approval or acceptance). Kind: event, but it resolves
    automatically when a change to the identity mapping would no longer raise it
    (I6).
  - Evidence: C's author and committer, the recorded name, and which of the two
    checks failed.
- **FL-9 Task removed (Q6).**
  - Rule: at an evaluated commit C, task T is removed (H3), and T had entered
    `approved/` or `completed/` at some earlier commit. A task removed while it
    had only ever been in `proposed/` is a withdrawn proposal and is not
    flagged.
  - Subject: (T, C). Kind: event.
  - Evidence: C's facts, T's last path, and T's event history.
- **FL-10 History rewritten.**
  - Rule: at a poll, the new head is neither the last processed head nor a
    descendant of it (F6). This covers force pushes and branch resets.
  - Subject: (last processed head, new head). Kind: event. It is raised whatever
    the baseline.
  - Evidence: both heads, the time detected, how many previously processed
    chain commits are no longer on the chain, and which tasks' histories
    changed.
- **FL-11 Work state on main (Q6).**
  - Rule: at an evaluated commit C, task T enters `in-progress/` or `review/`.
    Under ADR-008 these moves happen only on the lead developer's branch.
  - Subject: (T, C, state). Kind: event.
  - Evidence: C's facts and T's event history.

### Flag lifecycle (FG)

- **FG1 Record.** Each flag has its rule, subject, project, the time Moonbeam
  first raised it, its evidence, and a status: open, dismissed, resolved, or
  withdrawn.
- **FG2 Once per subject.** The same rule and subject never produce two open
  flags. Dismissals and notes survive polls, restarts, and rebuilds.
- **FG3 Resolution.** Condition flags become resolved when their condition no
  longer holds at head. Event flags stay open until dismissed, except as FL-8
  and FG5 say.
- **FG4 Dismissal.** Any board member with a selected user may dismiss any flag
  with a note, which must be non-empty. Moonbeam records who, when, and the
  note. Any board member may reopen a dismissed flag with a note, recorded the
  same way.
- **FG5 Rewritten history.** An event flag whose subject commit is no longer on
  the chain after a rewrite becomes withdrawn, and is listed in that FL-10's
  evidence. Its dismissal record, if any, is kept.
- **FG6 Never blocking.** No flag prevents, delays, or changes anything, in
  Moonbeam or in the repository.
- **FG7 Where records live.** Flags, dismissals, and notes are Moonbeam data in
  its audit trail. They are not written to the repository, and Moonbeam does
  not read dismissals from it (ADR-009, which rejects the repository clause of
  ADR-007 decision 4).

### Identity (I)

- **I1 Identities per board member.** Each board member has, in Moonbeam:
  - git e-mail addresses (their CONTRACT-002 e-mail counts automatically);
  - GitHub logins;
  - name aliases, used only for recorded names (I5).

  Any board member may edit these. Every change is audited. See Q12 for
  whether this needs a CONTRACT-002 successor.
- **I2 Commit identity.** A commit's author identity is its author name, author
  e-mail, and the GitHub login that GitHub associates with it, if any. The
  committer is shown as evidence but never mapped. For example, a merge made in
  GitHub's web interface has "GitHub" as committer.
- **I3 Commit matching,** in this order:
  1. the GitHub login equals one of a member's logins (case-insensitive);
  2. the author e-mail equals one of a member's e-mails (case-insensitive,
     trimmed);
  3. the author e-mail is a GitHub no-reply address (`<login>@users.noreply.github.com`
     or `<number>+<login>@users.noreply.github.com`) whose login equals one of a
     member's logins.

  Author names are never used to match commits.
- **I4 Ambiguity.** An identity that matches two or more members counts as
  unmatched, and the identity settings show a warning naming the conflict.
- **I5 Recorded names.** The name part (P5) of `Approved by`
  matches a member when it equals, case-insensitively, the member's display
  name or one of their name aliases. `Proposed by` is shown and mapped the same
  way but is never flagged, because agents may propose.
- **I6 Current mapping.** Attribution is shown with the current mapping, so
  editing identities re-attributes past events. Deactivated members still match
  and are marked as inactive.
- **I7 Unmatched.** An unmatched author or name is shown as recorded (name,
  e-mail, login) and marked "not a board member". Outside FL-8 this is not a
  flag.
- **I8 Honor system.** A match means that the identity, as git or the file
  recorded it, is one the board has attributed to a member. It does not prove
  who acted (ADR-003).

### Lead developer (L)

- **L1** A project has at most one lead developer, a board member. Any board
  member may assign or change it. The change is audited.
- **L2** The lead developer is displayed (D1) and named in FL-5 evidence. No
  rule depends on who authored a commit relative to the lead developer.

## Postconditions and invariants

- **N1 Read only.** Moonbeam never writes to any repository or to GitHub (S3).
- **N2 No task state of its own.** Everything Moonbeam shows about tasks is
  derived from the chain at head. Moonbeam's own data is limited to:
  - registrations and lead developers
  - identities
  - flag records, dismissals, and notes
  - poll status and caches that can be rebuilt
- **N3 Determinism.** Given the same chain, registration, identities, and time,
  two evaluations produce the same history and the same flags.
- **N4 Tolerance.** No file content, missing file, or malformed history stops
  Moonbeam from reading the rest of the project, or any other project.
- **N5 Never blocking.** Flags are records for review, not gates (FG6).
- **N6 Visibility needs a push.** Unpushed work is invisible. Every view says
  what head and poll time it reflects.

## Failure behavior

None of these raise a flag except F6 (FL-10) and F8. Source problems are shown
as source status, because they are not process violations. In every case the
last known state stays visible (S7) and no Moonbeam data is deleted.

- **F1 GitHub unreachable,** timed out, erroring on its side, or rate-limiting.
  Status "GitHub unreachable since T" (or "rate limited until T"). Retry at the
  normal interval; after repeated failures, back off to at most 30 minutes.
- **F2 Token rejected** (expired, revoked, invalid). Status "token rejected
  since T". Retry at the normal interval, so a replaced token is picked up.
- **F3 Repository not found or not accessible.** GitHub doesn't distinguish a
  deleted repository from one the token cannot see. Status "repository not
  found or not accessible since T", naming both causes. Moonbeam keeps the
  project and its data until a board member changes or removes the
  registration.
- **F4 Repository renamed or transferred.** If GitHub redirects to a
  repository with the recorded ID (S8), Moonbeam follows it and shows "now at
  owner/name; update the registration". It does not change the registration
  itself (Q16). If the name resolves to a repository with a different ID (for
  example, a new repository created under the old name), Moonbeam does not read
  it and shows "repository identity changed".
- **F5 Tracked branch missing.** Status "branch not found since T".
- **F6 History rewritten.** Raise FL-10, derive history again from the new
  chain (H9), re-evaluate condition flags, and withdraw event flags whose
  commits left the chain (FG5). If the baseline commit is no longer on the
  chain, evaluation starts after the newest chain commit whose committer time
  is not later than the old baseline's, and the project shows "baseline needs
  resetting" until a board member sets a new one.
- **F7 Not a DbC project.** If there is no `tasks/` directory at head, the
  project shows "no DbC task directories found". Artifacts that exist (R) are
  still shown.
- **F8 Malformed or older files.** FL-7 or FL-2 per file. Other files are read
  normally (N4).
- **F9 Incomplete change set.** If Moonbeam cannot obtain C's complete change
  set, FL-3 and FL-4 are evaluated on what it has, and C is shown as "not fully
  checked".
- **F10 Moonbeam restart.** Derived data is rebuilt from GitHub if needed.
  Moonbeam's own data (N2) survives.

Known limits, accepted and not failures:

- A fast-forward merge puts the branch's own commits on the chain. They then
  raise FL-3 and FL-11. U5 asks for merge commits or squash merges.
- A "foxtrot" merge (main's first parent pointing into a feature branch) makes
  the chain follow the wrong line of history. Moonbeam does not detect this.
- Commit times and header dates are as recorded. Moonbeam does not verify them.

## Interfaces

- **GitHub:** read-only access to the tracked branch, commits, trees, change
  sets, file contents, and repository metadata (ID, name, redirects). The
  mechanism is an implementation choice (S3).
- **The DbC repository:** DbC task v1 (P), the contract and ADR file
  conventions (R1, R2), and `docs/PROJECT.md` (R3).
- **Moonbeam users:** CONTRACT-002's user registry and user select (kept parts),
  extended with identities (I1).

### Required upstream template changes (U)

Under ADR-008 decision 8 (alternative A), these changes are made in the
upstream Project Template DbC by a separate task. Together they define DbC task
v1. This contract does not edit upstream.

- **U1 Format marker.** `docs/templates/task.md`: add `Format: DbC task v1` as
  the first header line (P6, Q8).
- **U2 Acceptance is recorded by git (Board, 2026-09-28).**
  `docs/templates/task.md`: remove the `## Human acceptance` section, and add
  no acceptance header fields. Moving the task to `completed/` is the
  acceptance, and the merge commit that brings it to main records who accepted
  (its author) and when. A second, hand-filled record of the same fact goes
  stale: this repository's completed tasks mostly said "Pending." there,
  although a human had accepted each one. Notes the board wants to keep, for
  example return notes or a review waiver, go under an optional `## Board notes`
  section, which Moonbeam renders but does not parse.
- **U3 Paths section.** `docs/templates/task.md`: add `### Paths` under
  `## Scope`, after `### Excluded`. Guidance: one repository-relative path per
  list item in backticks; a trailing `/` for a directory; `*` and `**` allowed;
  `None` if the task changes no files outside `tasks/`; the task file itself is
  not listed. Upstream has no Paths section today. It exists only in this
  repository's own template.
- **U4 Field formats.** In `docs/templates/task.md` or a short companion
  document: dates as `YYYY-MM-DD`; a name optionally followed by a note in
  parentheses; list fields as IDs separated by commas, optionally with notes in
  parentheses, or `None`; one line per field preferred (continuation lines are
  tolerated); `Assigned agent` names the agent and, where known, the model.
- **U5 Main-branch rules.** `docs/workflow/lifecycle.md`:
  - Propose by committing the task to `tasks/proposed/` on main and pushing.
  - Approve by moving it to `tasks/approved/` on main, filling `Approved by`
    and `Approved date` in the same commit, and pushing. Only a human approves.
  - Branch from main after approval. The moves to `in-progress/`, `review/`,
    and back happen only on that branch.
  - At acceptance, move the task to `completed/` on the branch. Then merge the branch into main with a merge
    commit or a squash merge (not a fast-forward) and push. Merging is
    acceptance.
  - Never merge a branch whose task is not in `completed/`.
  - Every other change to main arrives through an accepted task's merge.
    One task per branch is recommended.
- **U6 Task IDs.** `docs/workflow/lifecycle.md`: a new ID is the highest
  `TASK-NNN` on main plus one, claimed by pushing the proposal to main. IDs are
  never reused. A withdrawn proposal is deleted from `tasks/proposed/`.
- **U7 Recording gates.** `docs/workflow/approval-gates.md`: approval is
  recorded in the header fields, in the commit that makes the move. Acceptance
  is recorded by the merge commit itself (U2). Contract and ADR approvals are
  commits to main that change only the document's header (Q4).
- **U8 Version name.** `tasks/README.md` names the task format ("DbC task v1")
  and states that `in-progress/` and `review/` do not appear on main. Upstream
  marks the commit that introduces v1 (for example, a `task-format-v1` tag), so
  the version this contract reads is identifiable.
- **U9 Stable paths.** Upstream keeps `docs/PROJECT.md`, `docs/contracts/`, and
  `docs/decisions/` where they are, and the contract and ADR file-name
  conventions. No change, but Moonbeam depends on them.

## UX expectations

- **UX1** Every project view shows the head commit and the last successful poll
  time, and says plainly when the data is not current (F).
- **UX2** Source status (F) and flags (FL) are visibly different things.
- **UX3** Every flag shows its evidence without the viewer having to open
  GitHub. It also links to the commits and files on GitHub.
- **UX4** Wording is observational: "no approval on main was found before this
  task was completed", not "violation" or "blocked".
- **UX5** Pre-v1 files are labeled as such wherever their fields are shown.
- **UX6** Nothing in the view looks like an action on the repository (D10).
  Dismissal is clearly a note in Moonbeam.

## Validation requirements

- **V1 Fixture histories.** For each flag FL-1 to FL-11, at least one small
  sample repository history that raises it and one near miss that does not.
  Near misses must include:
  - FL-1: a task that passed through `approved/` in an older commit, then
    completed by a merge commit;
  - FL-3: a commit whose only changes are proposals, approvals, or header-only
    contract edits;
  - FL-4: a path covered by a directory pattern written with and without its
    trailing `/`, and by `**`;
  - FL-9: a withdrawn proposal;
  - FL-10: an ordinary fast-forward of main.
- **V2 Read only.** With a read-only token, a full poll cycle succeeds. Traffic
  inspection (or an equivalent test double) shows only read requests (S3, N1).
- **V3 Determinism.** Building from nothing and building by incremental polls
  over the same fixture give identical history and flags (H9, N3).
- **V4 Source failures.** Simulated: unreachable, timeout, rate limit, 401,
  404, a redirect to the same repository ID, a different repository ID, a
  missing branch, and a force push. Each gives the F behavior, keeps the last
  known state, and loses no dismissals.
- **V5 Malformed files.** A corpus including: non-UTF-8; over 1 MiB; no title
  line; ID mismatch; duplicate field; wrapped field values; unknown fields;
  missing `Format:`; `Format: DbC task v2`; a stray file in `tasks/`; an
  unknown directory under `tasks/`. None stops the poll (N4).
- **V6 Identity.** Match by login, by e-mail, by no-reply address; an ambiguous
  identity; unmatched; a deactivated member; re-attribution after adding an
  e-mail, which resolves an FL-8.
- **V7 Rendering safety.** A Markdown file containing script and active HTML
  renders without executing it (R4).
- **V8 Dismissal.** Dismiss, reopen, persistence across restarts, FL-5's
  re-raise after one further threshold period, and withdrawal after a rewrite.
- **V9 Worked example.** A walk-through against this repository's history with
  the baseline set to the root commit, confirmed with `git log --first-parent`
  and `git show --stat`. This repository commits lifecycle moves directly to
  main and does not branch per task, so it exercises the tolerance paths more
  than the happy path. The expected results, each to be confirmed:
  - **FL-7 for every task file at head.** None has a `Format:` line (pre-v1).
    Consequently no FL-2 is raised.
  - **FL-11 for each dispatch commit,** for example "Dispatch TASK-016 to Codex
    (in-progress)", and for each "(to review)" move into `review/`.
  - **FL-3 for each "(to review)" commit that changes files outside `tasks/`,**
    for example "TASK-005: propose CONTRACT-002 identity and permission
    interface (to review)": it changes a contract but completes no task.
  - **No FL-3 for acceptance commits** such as "Board accepts TASK-015 (moved by
    Patrick)", provided they change only `tasks/` or contract headers (Q4).
  - **FL-1 for none of TASK-004 onward,** which passed through `approved/` on
    main. TASK-001 to TASK-003, added around the initial commit and the
    worktree merges, need checking. If they first appeared outside `approved/`,
    FL-1 or FL-11 applies to them.
  - **FL-4 not evaluated** where a completed task has no Paths section
    (TASK-001, TASK-002, TASK-003); shown as "scope not checkable".
  - **FL-8 on every approval and acceptance** unless the board member's
    identities include `patrickmoon@outlook.com`, the author e-mail on every
    commit here. This demonstrates why I1 allows several e-mail addresses per
    member.
  - **No FL-5 or FL-6 at head.** TASK-021 is in `in-progress/`, not
    `approved/`, and no ID appears twice.
  - **The local reset** of 2026-09-25 (the reflog's "reset: moving to HEAD~2")
    raises FL-10 only if the rewritten main had been pushed. It is a useful
    FL-10 fixture either way.

## Open questions

None.

## Resolved questions

The board accepted every recommendation in Q1 to Q16 on 2026-09-28. They are
now part of this contract as written.

- **Q17 Dismissals and ADR-007 decision 4.** Resolved 2026-09-28: the board
  formally rejected the repository clause of ADR-007 decision 4 (ADR-009).
  Flags, dismissals, and notes live only in Moonbeam (FG7). Dismissing a flag
  by committing a note in the repository was considered and not adopted.

- **Q1 Staleness threshold.** Recommendation: 14 days from the most recent
  entry into `approved/`, overridable per project, and a dismissal lasting one
  further threshold period (FL-5).
- **Q2 Poll interval.** Recommendation: 5 minutes, plus a manual refresh for
  any viewer.
- **Q3 Default baseline.** Options: the root commit (flag all history), head
  at registration, or the first commit that adds a DbC task v1 file.
  Recommendation: head at registration, which a board member may move to an
  earlier commit.
- **Q4 Contract and ADR approvals on main.** Should header-only edits to
  contracts and ADRs (such as a status change to Approved or Superseded) be
  excluded from FL-3, as the definition of W(C) now does? Recommendation: yes.
  Otherwise every contract approval committed to main is flagged as an
  unaccounted change.
- **Q5 Exempt paths.** Should a project be able to list paths whose direct
  changes on main are never flagged (for example `README.md`)?
  Recommendation: offer the setting, empty by default, with changes audited.
- **Q6 Flags beyond ADR-008.** FL-1 to FL-6 come from ADR-008, and FL-7 and
  FL-10 are needed for the failure behavior the task requires. FL-8
  (unrecognized approver or acceptor), FL-9 (task removed), and FL-11 (work
  state on main) are proposed here. Recommendation: keep all three, since each
  can be dismissed.
- **Q7 Proposal skipped.** Should a task that enters `approved/` without first
  being in `proposed/` on main be flagged? Recommendation: no. The proposal
  commit is for discussion; approval is the gate.
- **Q8 Where the format is declared.** Options: a `Format:` line in each task
  file, or one repository-level marker. Recommendation: per file, so older and
  newer files can coexist in one repository and each is judged by its own
  version.
- **Q9 When Paths becomes required.** Recommendation: from approval, since
  proposals are for discussion and scope may still change.
- **Q10 List fields.** Should `Related contracts`, `Related ADRs`, and
  `Dependencies` be required, with `None` for empty, or optional?
  Recommendation: required with `None`, so "nothing related" is distinguishable
  from "not filled in".
- **Q11 Token storage.** Options: entered in the Moonbeam UI and stored in its
  database, or configured on the server per GitHub owner. Recommendation:
  server configuration per owner, so secrets stay out of the database and the
  browser.
- **Q12 Identities and CONTRACT-002.** I1 adds git e-mails, GitHub logins, and
  name aliases per board member. Recommendation: this contract owns that
  mapping as data alongside the user registry, and CONTRACT-002's kept parts
  stay unchanged, so no CONTRACT-002 successor is needed yet. The board should
  confirm.
- **Q13 Tracked branch.** Literal `main`, or configurable per project?
  Recommendation: configurable, default `main`, for repositories whose default
  branch has another name.
- **Q14 Merge style.** U5 asks for merge commits or squash merges and rules out
  fast-forwards. Recommendation: adopt it upstream. Fast-forwards are not
  otherwise handled, and show up as FL-3 and FL-11 (see known limits).
- **Q15 "Recently completed."** Recommendation: the last 30 days, and at least
  the 10 most recent.
- **Q16 Renamed repositories.** Should Moonbeam update the registration itself
  when GitHub redirects to the same repository ID? Recommendation: no. Show a
  notice and let a board member update it, which keeps registration changes
  human and audited.
