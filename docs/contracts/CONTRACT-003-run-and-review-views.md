# CONTRACT-003: Run view and review surface

Status: Proposed
Approved by:
Approved date:
Related tasks: TASK-009
Related ADRs: ADR-005, ADR-003, ADR-002 (context: ADR-001)
Related contracts: CONTRACT-001 (task lifecycle), CONTRACT-002 (identity),
CONTRACT-004 (run branches and merge on acceptance), future runs contract,
future pauses contract

## Purpose

Define what a board member sees and can do in the two screens where Moonbeam's
work becomes visible:

- the **run view**, where a board member watches one run live or reads it
  afterwards, and answers its pauses
- the **review surface**, where a board member sees a task's actual result
  (ADR-005) and accepts it, returns it, or cancels it

It also defines the **status vocabulary** that these screens share with every
other Moonbeam screen, so a board member learns it once.

This is a UI/UX contract. It specifies information hierarchy, states,
transitions between states as the user sees them, actions, feedback, empty and
error states, accessibility, responsive behavior, and the data each view needs.
It does not specify components, endpoints, storage, or visual values. Lifecycle
rules come from CONTRACT-001. This contract only decides how they are
presented and invoked.

### Design stance

Moonbeam adapts Paperclip's layered disclosure (summary, then artifacts, then
raw logs), its output-first rule, and its execution visibility without log
worship (Paperclip `doc/PRODUCT.md`, "Specific design goals" 4–6). It does
**not** adopt Paperclip's autonomy assumptions:

- There are no heartbeats and no scheduled runs. Every run was started by a
  named human, and the run view says who.
- Agents never approve or accept. The review surface is where a human decides,
  and it is built so that the decision is made on the actual result, not on an
  agent's description of it.
- Human acceptance happens once, on the top-level task. Subtasks are shown as
  the means, not as things to accept.

Every screen answers, in order: **what is happening, does it need me, what do I
do about it** (Paperclip `DESIGN.md`, "Product stance").

## Scope

### Included

- The shared status vocabulary: task states, conditions, run statuses, pause
  statuses, review verdicts, check results, scope-check results, branch
  statuses, and warnings. Labels, tones, and precedence.
- The run view: live and finished; summary, artifacts, raw logs; inline pauses
  with the answer interaction; cost; the agent role, model, and endpoint used.
- The review surface (ADR-005): rendered documents in full, the code diff,
  validation results, previews and screenshots, the handoff, the agent review,
  the pause history, declared paths compared with actually changed files, and
  the same-model reviewer warning.
- The review surface for a split parent with its subtasks.
- The human actions on these screens: accept (merge), accept without review
  (waiver), return with notes, cancel, answer a pause, and stop a run.
- Every run and review state these screens can show, including loading, empty,
  error, and read-only history.
- Accessibility and responsive requirements.
- The data each view needs, stated as requirements.

### Excluded

- Implementation, components, routes, endpoints, and schemas.
- Visual values (colors, spacing, type). Tones named here map to tokens in
  `ui/src/index.css` (ADR-002). Choosing the values is implementation.
- Lifecycle rules (CONTRACT-001), identity (CONTRACT-002), branch naming,
  merging, conflicts, and write-back (CONTRACT-004), how runs start, stop, and
  report (future runs contract), and how pauses are raised and delivered to the
  agent (future pauses contract). This contract only presents their outcomes.
- The dashboard (TASK-008), the task board and decision queue (TASK-007). This
  contract defines a **run summary** and **pause card** that those screens are
  expected to reuse (see "Interfaces"), but it does not design those screens.
- The pause review surface (periodic analysis of pauses).
- Track-record views.
- Notifications. V1 has none (see Q14).
- Mobile-specific UI (PROJECT.md excludes it). Narrow screens must be usable,
  not optimized.

## Actors

| Actor | On these screens |
|---|---|
| **Board member** (the user chosen in the user select, CONTRACT-002) | Reads everything. Performs every action in "Actions". Every action is attributed to the selected user, and the screen says so before it is performed. |
| **Agent** | Never uses these screens. Agent output (transcript, artifacts, handoff, review, pauses) is displayed here. No agent-context version of any action exists. |
| **System** | Produces automatic changes (claim ends, subtask completes, parent enters review) that these screens show as they happen, attributed to the system and its trigger. |

## Definitions

- **Run view** — the screen for one run.
- **Review surface** — the screen for one task's result, used for a task in
  `in_review` and kept as a read-only record afterwards.
- **Attempt** — one handoff of a task together with the runs that produced it
  and the reviews recorded against it. A task returned and handed off again has
  a second attempt.
- **Implementing run** — a run that claimed the task and produced (or was
  producing) work for an attempt.
- **Reviewer run** — a run that records an agent review (CONTRACT-001 T7).
- **Latest attempt** — the attempt for the task's most recent handoff. The
  review surface decides on the latest attempt only.
- **Review snapshot** — the branch commit that the latest handoff refers to.
  Everything on the review surface (documents, diff, scope check) is shown as of
  that commit (see RS-3).
- **Declared paths** — the paths in the task's scope envelope (ADR-005 point 4).
- **Out-of-scope change** — a changed file that no declared path covers.
- **Same-model review** — a review that the server flagged because its reviewer
  run used the same model as the implementing run (CONTRACT-001 T7, A11). A
  review of human-claimed work is never flagged. The screens show the stored
  flag and never compute it themselves (see Q9 for what "same model" means).
- **Headline status** — the single status shown when there is room for only
  one (see SV-4).
- **Tone** — the semantic color role of a status (see SV-1). Tones are never the
  only carrier of meaning.

## Inputs and outputs

Inputs are the records Moonbeam already holds: the task and its envelope, the
audit history, claims, runs with their events and costs, pauses, handoffs,
reviews, artifacts, and the run branch with its diff (see "Interfaces" for the
data each view needs). User inputs are the actions in "Actions" and the answer
to a pause.

Outputs are what the user sees, and the action requests sent to the server.
Every action produces either a visible success, shown in place, or a visible
rejection with its CONTRACT-001 failure category and reason.

## Preconditions

1. A board member is selected (CONTRACT-002). Actions require a selected user.
   Reading does not (see Q15).
2. The run or task exists in a registered project.
3. The screens never compute lifecycle state locally. They show the server's
   state and ask the server to act. When the server rejects an action, the
   screen shows why.

## Required behavior

### SV — Status vocabulary

**SV-1 Tones.** Every status maps to exactly one of six tones, used the same way
everywhere (badge, row, list, chart, transcript marker):

| Tone | Meaning | Examples |
|---|---|---|
| `neutral` | Not active, or ended without needing anyone. | Proposed, Approved, Cancelled, Stopped, Not reviewed |
| `live` | Work is happening now. | In progress, Running, Starting, Check running |
| `attention` | A human needs to look or answer. | Paused, Changes required, Same-model review, Behind main |
| `review` | Waiting in review. | In review |
| `success` | Done or passing. | Completed, Handed off, Pass, Check passed, Merged |
| `danger` | Something failed, is blocked, or is out of bounds. | Failed, Blocked, Check failed, Outside declared paths, Merge conflict |

**SV-2 Never by color alone.** Every status is shown with a text label and a
glyph whose *shape* differs between statuses in the same family. Tones meet
WCAG 2.2 AA: text at least 4.5:1, glyphs and chip borders at least 3:1, in light
and dark themes.

**SV-3 Vocabulary.** One label per concept, in sentence case, identical on every
screen. "Task" is always "task" (never issue or ticket). "Run" is always "run"
(never job, session, or heartbeat).

| Family | Value | Label | Tone |
|---|---|---|---|
| Task state (CONTRACT-001) | `proposed` | Proposed | neutral |
| | `approved` | Approved | neutral |
| | `in_progress` | In progress | live |
| | `in_review` | In review | review |
| | `completed` | Completed | success |
| | `cancelled` | Cancelled | neutral |
| Task condition (badge on top of the state, never a state) | `blocked` | Blocked | danger |
| | effectively blocked (parent blocked) | Blocked by parent | danger |
| | `paused` | Paused | attention |
| Review sub-status (shown only with In review) | no review on latest attempt, none running | Awaiting agent review | review |
| | reviewer run live | Agent review running | live |
| | review recorded, or split parent ready | Awaiting decision | review |
| | accept in progress | Merging | live |
| Run status (see Q1) | `starting` | Starting | live |
| | `running` | Running | live |
| | `running` with an open pause | Paused | attention |
| | `stopping` | Stopping | neutral |
| | `finished`, handed off | Handed off | success |
| | `finished`, review recorded | Review recorded | success |
| | `finished`, no handoff | Ended without handoff | neutral |
| | `failed` | Failed | danger |
| | `stopped` | Stopped | neutral |
| | no report from the runner within the liveness window (Q2) | Not responding | attention |
| Pause | open | Waiting for answer | attention |
| | answered | Answered | success |
| | superseded (claim released or ended) | Superseded | neutral |
| | cancelled (task cancelled) | Cancelled | neutral |
| Agent review verdict (review-report template) | Pass | Pass | success |
| | Changes required | Changes required | attention |
| | Human decision required | Human decision required | attention |
| | none recorded | Not reviewed | neutral |
| | waived at acceptance | Review waived | neutral |
| Check result | passed | Passed | success |
| | failed | Failed | danger |
| | running | Running | live |
| | not run | Not run | neutral |
| Check source qualifier (Q3) | reported in the handoff only | Reported by agent | neutral |
| | run and recorded by Moonbeam | Verified by Moonbeam | neutral |
| Scope check | every changed file covered | Within declared paths | success |
| | at least one file not covered | N outside declared paths | danger |
| | declared path with no change | Not changed | neutral |
| | task has no declared paths | Paths not declared | attention |
| Branch (CONTRACT-004) | up to date with main | Up to date | neutral |
| | accepted, merge not yet complete (only if CONTRACT-001 Q17 allows it) | Merge pending | attention |
| | main moved since the branch started | Behind main | attention |
| | cannot merge cleanly | Merge conflict | danger |
| | merged at acceptance | Merged | success |
| Warning | same-model review | Same model as implementer | attention |

The vocabulary for run statuses, branch statuses, and pause statuses must be
confirmed against the runs, pauses, and branches contracts when they are
written. If those contracts name a value differently, this table changes to
match them, not the other way round.

**SV-4 Headline status and precedence.** Where only one status fits (a list
row, a tab title, a compact card), show the one that most needs a human, in
this order:

1. Paused (a question is waiting)
2. Blocked or Blocked by parent
3. Failed or Not responding (latest run)
4. Merge conflict (task in review)
5. In review, with its sub-status
6. Running or Starting
7. The lifecycle state

The full set of states and conditions is always available one step away (on
hover, focus, or in the detail header).

**SV-5 Machine values look machine-made.** Run IDs, task IDs, branch names,
commit hashes, file paths, token counts, costs, durations, and timestamps use
the monospace token and one shared formatter per kind. Timestamps show relative
time with the absolute local time available on hover and focus and to screen
readers. Costs show the currency and a fixed number of decimals (Q7).

### RV — Run view

**RV-1 Purpose and entry points.** The run view shows one run. It is reachable
from the task's detail, the review surface's run list, the dashboard, and the
decision queue. Every run has a stable, shareable address on the LAN.

**RV-2 Layers.** The run view is built in three layers, in this order from top
to bottom. Higher layers never require reading lower ones.

1. **Summary** — what the run is, what it is doing or did, whether it needs
   someone, and what it cost.
2. **Artifacts** — what the run produced: changed files, documents, validation
   results, previews, the handoff or review it recorded.
3. **Raw logs** — the transcript, tool calls, and runner output.

**RV-3 Header (always visible at the top).**

- Task: ID, title, project, and the task's headline status. Links to the task.
  For a subtask, also the parent task, labelled "Subtask of".
- Run: run ID, run status badge (SV-3), and the run's purpose (Implementing,
  Reviewing, or another role).
- Agent: specialist role (for example Implementer, Reviewer, UX), **model**, and
  **model endpoint** (for example "Claude Code on dev-box-1" or
  "DeepSeek-Coder-V2-Lite Q4 at 192.168.203.117:8080"). The model and endpoint
  are never hidden behind a disclosure.
- Started by: the board member who started the run, and when (I14 in
  CONTRACT-001: no run is self-starting, so this is always present).
- Branch: the run branch name (CONTRACT-004), copyable.
- Duration: live elapsed time, or total duration once ended.
- Actions: Stop run (live runs only, A-6). Cancel task is available from a
  secondary menu (A-5).

**RV-4 "Needs you" region.** When the run has one or more open pauses, a region
directly under the header shows each open pause as a pause card (RV-8), before
anything else. It stays above the summary until every open pause is answered or
closed. On a narrow screen it is the first thing after the header.

**RV-5 Summary layer — live run.**

- **Now:** one line saying what the agent is doing now, taken from the most
  recent meaningful event (for example "Editing `server/src/tasks.ts`" or
  "Running `pnpm test`"). It is derived from the event stream, not written by
  the UI. If nothing has happened for a while, it says how long since the last
  event.
- **Progress:** if the agent reported a plan or checklist, show it with each
  item's state. If not, omit this block. Never invent progress percentages.
- **Changed so far:** the count of files changed on the branch so far, and the
  count outside declared paths, shown in danger tone when non-zero. This makes
  scope drift visible while the run is still going, not only at review.
- **Cost so far:** see RV-7.
- **Claim:** the agent claim's lease deadline (CONTRACT-001 claim expiry), shown
  as time remaining. While paused or blocked, it reads "Lease suspended".
- **Liveness:** "Updated Ns ago". When the view has not received an update
  within the liveness window, it shows "Not responding" (SV-3) with the time of
  the last update. This is a display state only. Whether the server acts on it
  belongs to the runs contract.

**RV-6 Summary layer — ended run.** The summary leads with one outcome sentence
and the next step for the human:

| Run ended as | Outcome sentence and next step |
|---|---|
| Handed off | "Handed off for review." Link: Open review (to the review surface). Shows the handoff's first paragraph. |
| Review recorded | "Recorded a review: <verdict>." Shows the finding count by severity. Link: Open review. |
| Ended without handoff | "Ended without a handoff. The claim ended and the task is back in Approved." Shows the agent's last message, if any. |
| Failed | "Failed: <reason>." Shows the failure reason, the step where it failed, and the runner's error excerpt. States that the claim ended and the task is back in Approved (CONTRACT-001 T5). |
| Stopped | "Stopped by <person> at <time>." States why (stopped from this view, claim released or broken, task cancelled) with the reason given. |

The progress checklist, if any, remains visible with its final item states.

**RV-7 Cost.** The summary shows, per run:

- cost, with its **source**: metered (reported by the provider), estimated
  (computed from token counts and a configured price), local (no metered cost),
  or unknown (Q7, Q8)
- input, output, and cached tokens where the endpoint reports them
- duration

Live runs update these as the run proceeds. Cost is never shown as `0` when it
is actually unknown. A missing value reads "Unknown", and a local endpoint reads
"Local, not metered". There are no budgets, limits, or warnings about spend
(PROJECT.md: V1 shows costs only).

**RV-8 Pause card.** Each pause is shown as a card with the fields from
`TEMPLATE/docs/workflow/pauses.md`, in this order:

1. Status (SV-3) and category (for example "Scope question").
2. **Question** — prominent, in full.
3. **Effect** — what is waiting on the answer.
4. **Options** — each option with its consequence, as selectable choices.
5. **Recommendation** — labelled "Agent's recommendation", visually subordinate
   to the options, never preselected.
6. **Context** — what the agent was doing and the sources it checked, collapsed
   to its first lines with a "Show all" control.
7. Asked by (role, model, run), asked at, and time open.

The answer interaction for an open pause:

- Choose one of the offered options, or choose "Other answer", or add a written
  answer to a chosen option. At least one of a chosen option or written text is
  required.
- An optional category correction (Q4).
- The answer is attributed before sending: "Answering as <selected user>".
- The primary button is "Send answer". It is disabled only while sending, and
  when neither an option nor text is given. The reason is shown next to it.
- For the **Scope question** category, the card states: "An answer cannot
  widen this task's scope envelope. To change scope, cancel the task and propose
  a new one." (CONTRACT-001 Q8/A8). This is informative. The UI does not try to
  detect scope widening in free text.
- After sending, the card changes to Answered in place, shows the answer and
  who gave it, and the run's status changes when the server reports that the
  run resumed. No toast is shown for a change already visible on the screen.
- If the pause was closed by something else while the user was answering
  (superseded, cancelled, or answered by another board member), sending is
  rejected with `conflict`. The card refreshes to the current state, shows who
  or what closed it, and keeps the unsent draft visible and copyable.

Whether multiple open pauses on one run are answered independently, and when
the run resumes, is defined by the pauses contract (Q5). This contract requires
that each open pause has its own card and can be answered on its own.

**RV-9 Artifacts layer.** Grouped, each group with a count, each group omitted
when empty in a live run and shown with its empty state in an ended run:

- **Changed files** — paths changed on the run branch so far (or at the end),
  each marked with the scope check (SV-3). Opening a file shows its diff. For a
  run whose task is in review, a link opens the full review surface.
- **Documents** — Markdown documents created or changed, each openable as
  rendered text (same renderer as RS-5).
- **Validation** — checks and their results (RS-7).
- **Previews** — screenshots and preview links attached by the run (RS-8).
- **Handoff** or **Review** — the record this run produced, rendered, when the
  run produced one.

**RV-10 Raw logs layer.**

- The transcript is collapsed by default on an ended run and expanded by default
  on a live run. The user's choice persists for the session.
- Two modes: **Readable** (messages, grouped tool calls with one-line summaries,
  expandable for inputs and outputs) and **Raw** (the runner's output as
  received). Readable is the default.
- Live: new entries append at the bottom. The view follows the latest entry
  until the user scrolls up. It then stops following and shows a "Jump to
  latest" control. It never pulls the user back while they are reading.
- Pauses and their answers appear as markers at their position in the
  transcript, linked to their pause cards.
- The runner's error output is shown in danger tone. The failing step in a
  failed run is marked, and the summary links to it.
- Long transcripts load in pages. Loading more never moves the user's reading
  position.
- Secrets and credentials are redacted before display (Q12).
- Copy and download of the raw log are available.

**RV-11 Context rail.** Beside the layers on wide screens, and as a collapsible
"Task context" section after the summary on narrow screens:

- the task's desired outcome, acceptance criteria, and declared paths
- linked contracts, each linking to its rendered document
- the task's other runs (status, role, model, cost, start time), with the
  current run highlighted
- return notes from earlier attempts, when the task was returned before (the
  next claimant's instructions)
- the run's pause history (every pause, all statuses)

**RV-12 Live updates.** A live run view updates without a manual reload.
Status, pauses, and the summary reflect server changes within 5 seconds. The
transcript streams as the runner reports. When the connection to the server is
lost, the view says so ("Connection lost. Retrying.") and keeps showing the last
known state, marked as stale. It never shows a live indicator for data it is not
receiving.

### RS — Review surface

**RS-1 Purpose and entry.** The review surface shows one task's actual result
for its latest attempt, and hosts the decision. It is reachable from the
decision queue, the task detail, and the "Open review" link of a run that
handed off. It is the pull request of ADR-005.

**RS-2 Layout.** In order from top to bottom:

1. **Header** — task ID and title, project, state and conditions, review
   sub-status (SV-3), attempt ("Attempt 2 of 2"), the run branch and review
   snapshot commit, and the decision actions (RS-12).
2. **Readiness summary** (RS-4) — one line per check, each linking to its
   section.
3. **Sections**, with a section navigator (sticky on wide screens, a jump menu
   on narrow screens), in this order:
   1. Outcome and acceptance criteria (RS-4a)
   2. Documents (RS-5)
   3. Code changes (RS-6)
   4. Validation (RS-7)
   5. Previews (RS-8)
   6. Handoff (RS-9)
   7. Agent review (RS-10)
   8. Scope check (RS-11)
   9. Pauses (RS-11a)
   10. Runs and cost (RS-11b)
   11. History (the task's audit records)

Output comes first: the documents, diff, validation, and previews come before
the agent's own descriptions of them (handoff, review). The board sees the
result before it reads anyone's summary of the result.

**RS-3 Review snapshot.** Documents, diff, scope check, and previews are shown
as of the commit named by the latest handoff, compared against the merge base
with the main branch. The snapshot commit is shown in the header. If the branch
has moved after the handoff, a notice says so and the surface keeps showing the
handed-off commit. If the main branch has moved, the branch status (SV-3) shows
"Behind main", and what that means for the merge is CONTRACT-004's.

**RS-4 Readiness summary.** A compact list that answers "can I decide, and what
should I look at first". Each line has a status (SV-3) and a link to its
section:

- **Agent review** — the verdict of the latest review on the latest attempt,
  with finding counts by severity. "Not reviewed" when there is none. "Agent
  review running" when a reviewer run is live.
- **Same-model review** — present only when it applies: "Reviewed by the same
  model as the implementer (<model>)". Attention tone. Always shown when it
  applies, including when the verdict is Pass.
- **Validation** — "N passed, N failed, N not run", with the source qualifier.
- **Scope** — "Within declared paths" or "N outside declared paths".
- **Pauses** — "N pauses during this attempt" (neutral), or "No pauses".
- **Branch** — Up to date, Behind main, or Merge conflict.
- **Blocked** — present only when the task is blocked, with the blockers.
- **Waiting on this task** — present only when other tasks have a path
  dependency on this one (CONTRACT-001 "Path dependencies"): "N tasks are
  waiting for this to merge", each linked. Informational: it tells the board
  that accepting unlocks them and returning delays them.
- **Split parent** — "N subtasks: N completed, N cancelled", and "N findings
  from subtask reviews" when any exist.

The readiness summary informs. Only the conditions listed in RS-12 disable an
action.

**RS-4a Outcome and acceptance criteria.** The task's desired outcome, then
each acceptance criterion with, side by side on wide screens and stacked on
narrow ones:

- the implementer's evidence for it (from the handoff's "Acceptance criteria
  evidence")
- the reviewer's assessment of it (from the review's "Contract and acceptance
  review"), when recorded

A criterion with no evidence is marked "No evidence given". The board member's
own judgment is not recorded per criterion (see Q10).

**RS-5 Documents.** Every Markdown document created or changed in the snapshot
is listed. Contracts and ADRs are listed first, then other `docs/` files, then
the rest (Q11).

- Each document is **rendered in full**, not as a diff, by default: headings,
  tables, lists, links, and code blocks. The board reads the whole document it
  is approving.
- A changed document has a toggle between **Rendered** and **Changes**. The
  Changes view shows the rendered document with added and removed passages
  marked (with text markers as well as color, see UX-3), or a source diff when
  a rendered comparison is not possible.
- A new document is labelled "New". A deleted document is labelled "Deleted"
  and shows its last version.
- Relative links between documents in the snapshot open the linked document at
  the same snapshot.
- If rendering fails, the document falls back to its source text with a notice.

**RS-6 Code changes.**

- A file list grouped by directory, with per-file added and removed line
  counts, the change type (added, modified, deleted, renamed), and the scope
  flag for files outside declared paths.
- Diffs per file, in unified view. Side-by-side view is available on wide
  screens only.
- Files that are large, generated, or lock files are collapsed by default and
  labelled why. Binary files show their type and size, and images show before
  and after.
- A filter "Only files outside declared paths" is available. The out-of-scope
  count in the readiness summary is never affected by filters.
- Documents appear in both Documents (rendered) and Code changes (source
  diff), and each links to the other.
- When there are no code changes, the section says "No code changes. This
  attempt changed only documents." (or "No changes on the branch." when nothing
  changed at all, which is itself flagged in attention tone).

**RS-7 Validation.** Each check (tests, typecheck, build, and any other the task
names) with result, duration, when it ran, the commit it ran against, and its
source qualifier (Q3). Each opens to its output, with failures expanded by
default. A check that ran against a commit other than the review snapshot is
labelled "Ran on an earlier commit". When nothing was reported: "No validation
results were reported for this attempt." in attention tone, since the task's
validation requirements usually expect some.

**RS-8 Previews.** Screenshots and images attached by the runs of the attempt,
as a gallery with captions, openable at full size, and keyboard navigable.
Preview links are listed with their description and open in a new tab. When
there are none: "No previews attached." Neutral, because many tasks have
nothing to preview.

**RS-9 Handoff.** The latest attempt's handoff rendered in full: what changed,
what was validated, acceptance evidence, assumptions and deviations, risks. The
implementing run(s), role, and model are named. Deviations and unresolved risks
are also surfaced in the readiness summary when the handoff lists any (as a
line "Handoff lists N deviations, N risks").

**RS-10 Agent review.**

- The latest review on the latest attempt rendered in full, with the verdict,
  reviewer role, **reviewer model and endpoint**, and reviewer run.
- Findings listed individually with severity, evidence, affected requirement,
  and required resolution, sorted by severity.
- Earlier reviews of the same attempt (if several were recorded) are listed
  below, collapsed.
- **Same-model warning:** when the review carries the same-model flag
  (CONTRACT-001 T7), the review section shows, above the verdict:
  "Same model as the implementer. This review was done by <model>, which also
  implemented the work. A review by a different model is recommended."
  (CONTRACT-001 A11: recommended, not required.) It does not block accepting.
- When no review is recorded: "No agent review for this attempt." with the
  action Start agent review (A-7) and an explanation that accepting now
  requires a waiver with a reason (A-2).

**RS-11 Scope check.** A table comparing declared paths with actually changed
files:

- one row per changed file: path, change type, the declared path that covers it
  or "Outside declared paths" in danger tone
- one row per declared path with no changes: "Not changed", neutral
- a summary line with the counts

The check is automatic and exact about coverage (path matching rules are
CONTRACT-001's and CONTRACT-004's). It is a flag, not a verdict: whether an
out-of-scope change is acceptable is the board member's call, and the accept
confirmation lists it (A-1). When the task has no declared paths (for example
created before paths existed): "This task declares no paths, so changes can't
be checked." in attention tone, with every changed file listed.

**RS-11a Pauses.** The pause history for every run of the task (all attempts,
latest first, with the latest attempt's pauses expanded): each pause card in its
read-only form, with its answer, who answered, and how long it was open. The
count per category is shown at the top. This feeds the board's sense of what
the task's planning missed. When none: "No pauses. The agent did not need to
ask anything."

**RS-11b Runs and cost.** Every run of the task, grouped by attempt: purpose,
status, role, model, endpoint, started by, duration, and cost with its source.
Totals per attempt and for the task. Each row links to its run view.

**RS-12 Decision actions and when they are available.** In the header, and in a
sticky action bar at the bottom on narrow screens:

| Action | Shown when | Disabled when (reason shown next to it) |
|---|---|---|
| **Accept and merge** (A-1) | Top-level task in `in_review` | Blocked ("Accept is unavailable while the task is blocked"); a subtask is not done; merge conflict (CONTRACT-004); an accept is already in progress |
| **Accept without review** (A-2) | Top-level leaf task in `in_review` with no review on the latest attempt. Replaces Accept and merge in that case. | Same as Accept and merge |
| **Return** (A-3) | Top-level task in `in_review` | Never disabled while shown, except while another action is in progress |
| **Start agent review** (A-7) | Leaf task in `in_review` with no reviewer run live | While a reviewer run is live |
| **Cancel task** (A-5) | Any non-terminal task, in a secondary menu | Never disabled while shown |

Rules:

- Human decision actions are never offered for a subtask. A subtask's review
  surface is read-only and says: "Subtasks aren't accepted individually. The
  board decides on the parent task." with a link to the parent.
- An action that is not available is shown disabled with its reason, not
  hidden, so the board member knows what stands in the way. Actions that do not
  apply to the task's kind or state at all (for example Accept on a completed
  task) are not shown.
- The acting user is shown next to the actions: "Deciding as <selected user>".

**RS-13 Split parent in review.** The review surface for a split parent adds:

- a **Subtasks** section directly after the readiness summary: one row per
  subtask with its state (Completed or Cancelled), review verdict, finding
  count, out-of-scope count, same-model warning if any, cost, and a link to its
  own read-only review surface
- **Findings from subtask reviews**, collected in one list, grouped by subtask,
  so the board sees every finding carried forward (CONTRACT-001 T8) without
  opening each subtask
- the combined result: documents, code changes, validation, previews, and scope
  check across the parent's result as it would merge. How subtask branches
  combine into the parent's result is CONTRACT-004's (Q13). Each file shows
  which subtask changed it.
- no parent-level review requirement (CONTRACT-001 T9). An optional integration
  review, if recorded, is shown in Agent review. If the parent was returned
  earlier and then worked directly by a claimant, that claimant's handoff is
  shown as the parent's own attempt. Whether it needs its own agent review is
  open (CONTRACT-001 Q16). Until decided, the surface shows it like a leaf's
  handoff, with its review status, and does not require the waiver step.

Returning a split parent follows CONTRACT-001 T10: subtasks are never reopened.
The Return dialog lets the board member add new subtasks (A-3).

**RS-14 After the decision.** The review surface remains available for every
attempt as a read-only record:

- **Completed:** the header shows "Accepted by <person> at <time>" and "Merged
  into main at <commit>", or the review waiver and its reason. No actions.
- **Returned attempt:** shown when browsing earlier attempts: "Returned by
  <person> at <time>" with the return notes. The task's current state is linked.
- **Cancelled:** "Cancelled by <person>: <reason>". States that the branch was
  not merged.
- A task that is not in review and has no attempt yet shows: "This task hasn't
  been handed off yet." with its current state and a link to its live run, if
  any.

### A — Actions

Every action below:

- is attributed to the selected user, shown before the action is performed
- is sent to the server, which decides (the screen never assumes success)
- on success, updates the screen in place, with no toast for changes already
  visible on the screen
- on rejection, shows the CONTRACT-001 failure category and reason next to the
  action and keeps any text the user entered. On `conflict`, it refreshes to the
  current state and says what changed ("Another board member returned this task
  at 14:02.")
- moves keyboard focus predictably: into a dialog on open, back to the
  triggering control on close, and to the result message on completion

**A-1 Accept and merge** (CONTRACT-001 T9, merge per CONTRACT-004).

1. The user chooses Accept and merge.
2. A confirmation dialog states what will happen: "Accept <task> and merge
   branch <branch> into <main branch> of <project>." It lists any open warnings
   from the readiness summary: review verdict other than Pass, same-model
   review, failed or missing validation, out-of-scope files, handoff deviations
   or risks, branch behind main. If warnings are present, the user confirms
   they have seen them (Q6) before the final button is enabled.
3. The final button reads "Accept and merge".
4. While the merge runs, the header shows "Merging" (live tone), and all
   decision actions are disabled.
5. Success: the surface switches to its Completed form (RS-14).
6. Failure: the surface shows what failed and what to do, using CONTRACT-004's
   outcomes (for example a merge conflict and the next step that contract
   defines). Whether the task stays in review or becomes completed with the
   merge pending is open (CONTRACT-001 Q17). The surface shows the state the
   server reports, and in the second case shows "Accepted, merge pending" in
   attention tone until the merge completes. The UI does not attempt recovery
   on its own.

**A-2 Accept without review** (CONTRACT-001 T9 review waiver, A5).

As A-1, but the dialog is titled "Accept without an agent review", explains
that the task has no agent review for its latest attempt, and requires a
**reason** (non-empty after trimming whitespace). The reason is shown in the
task's history and on the completed review surface as "Review waived: <reason>".

**A-3 Return** (CONTRACT-001 T10).

1. A dialog titled "Return <task>" with a required **Return notes** field. The
   notes are what the next claimant reads first.
2. Helpers insert references into the notes: selected review findings,
   out-of-scope files, failed checks. They only insert text. The user edits the
   result.
3. For a split parent: an **Add subtasks** area where the user defines new
   subtasks (title, desired outcome, acceptance criteria, envelope narrowing
   the parent's, including paths). Envelope validation rejections are shown
   per field. The dialog says what each choice does (CONTRACT-001 T10): with
   new subtasks, the parent goes to In progress and the new subtasks to
   Approved; without them, the parent goes to Approved and its next claimant
   may add subtasks or do the fix-up work. It never offers to reopen a
   completed subtask.
4. The final button reads "Return task".
5. Success: the header shows the new state (Approved, or In progress for a
   split parent with new subtasks) and "Returned by <person>". The notes appear
   in the task context of the next run (RV-11). The branch is kept (ADR-005:
   a returned task continues on its branch).

**A-4 Answer a pause** — see RV-8.

**A-5 Cancel task** (CONTRACT-001 T15).

A destructive action in a secondary menu. The dialog requires a **reason** and
states the consequences: live runs on the task are stopped, open pauses are
closed, subtasks that are not done are cancelled, and the branch is never
merged. The final button reads "Cancel task". The dismiss button reads "Keep
task", never "Cancel", to avoid ambiguity.

**A-6 Stop run** (runs contract).

Available in the run view of a live run. The dialog states the consequence: the
run stops, its claim ends, the task returns to Approved, and the work so far
stays on the branch (CONTRACT-001 T5, ADR-005). An optional reason. While
stopping, the run shows "Stopping". The stop itself, and whether it is
immediate, is the runs contract's.

**A-7 Start agent review** (runs contract).

Opens the start-run interaction with the Reviewer role preselected. When the
chosen model equals the model of an implementing run of the latest attempt, the
dialog shows the same-model warning before the run starts: "This model also
implemented the work. A different model is recommended." The user may proceed
(A11: recommended, not required). The start-run interaction itself belongs to
the runs contract and the runs UI.

## Postconditions and invariants

These hold on every render of these screens.

- **UI-I1 Server truth.** Displayed task state, conditions, run status, and
  available actions come from the server. No action is offered as available
  that the server would reject for the task's state or kind.
- **UI-I2 Human gates visible.** Accept, accept without review, and return are
  only ever offered for a top-level task in `in_review`, and never for a
  subtask.
- **UI-I3 Attribution.** Every action and every answered pause shows who
  performed it. Every run shows who started it and which model and endpoint it
  used.
- **UI-I4 Pauses first.** An open pause is never below the fold in the run
  view on load, and it is visible in the headline status everywhere the run or
  task appears.
- **UI-I5 Scope flags cannot be hidden.** The count of files outside declared
  paths is always shown in the readiness summary and in the accept
  confirmation, whatever filters are applied.
- **UI-I6 Same-model warning is always shown when it applies,** in the
  readiness summary, the Agent review section, the subtasks table (split
  parent), and before starting a reviewer run.
- **UI-I7 Snapshot consistency.** Every part of the review surface refers to
  the same review snapshot commit, and the header names it.
- **UI-I8 Output before narrative.** On the review surface, the actual result
  sections come before the handoff and the agent review.
- **UI-I9 No invented values.** Unknown cost, missing validation, missing
  evidence, and missing reviews are shown as unknown or missing, never as zero,
  passing, or empty success.
- **UI-I10 One vocabulary.** Every status on these screens uses a label and
  tone from SV-3.

## Failure behavior

| Situation | What the user sees |
|---|---|
| Loading | A skeleton of the page layout with the header fields that are already known. No spinner-only page. |
| Run or task not found | "This run doesn't exist or was removed." / "This task doesn't exist." with a link to the project's task list. |
| Transcript not yet available (run starting) | "Waiting for the first output from the runner." |
| Transcript unavailable (ended run, log missing) | "The transcript for this run isn't available." The summary and artifacts still show. |
| Runner not reachable or not responding | "Not responding" status (SV-3), the time of the last update, and the reminder that the run may still be working. No automatic action from the UI. |
| Lost connection to Moonbeam | "Connection lost. Retrying." Data is marked stale. Actions are disabled until reconnected, with that reason. |
| Branch or commit missing | "The branch for this run can't be found in the project repository." Documents, diff, and scope check show that error. Other sections still show. Accept is disabled with this reason. |
| Diff too large | The file list still shows. Individual diffs load on request. A file too large to show says so and offers the raw file. |
| Document fails to render | Source text fallback with a notice (RS-5). |
| Action rejected | The CONTRACT-001 category and reason, next to the action, with the user's input kept. `conflict` refreshes the view. |
| Merge failure at acceptance | CONTRACT-004's outcome, shown in the header and readiness summary, with the next step. The task's state is whatever the server reports. |
| No user selected | Actions are disabled with the reason "Choose who you are to take this action", linking to the user select. |

Empty states say what is missing and what to do first, and are specific to the
section (see RS-6, RS-7, RS-8, RS-10, RS-11, RS-11a). An ended run with no
artifacts says "This run produced no files, documents, or results."

## Interfaces

### Shared pieces other screens are expected to reuse

- **Status badge** — renders any SV-3 value with its label, glyph, and tone.
- **Run summary** — compact form of RV-3 and RV-5/RV-6: task, run status,
  role, model, endpoint, started by, duration, cost, and "Now" or outcome
  sentence. Intended for the dashboard's active runs and the task detail.
- **Pause card** — RV-8, answerable anywhere it is shown, with identical
  behavior (Q16 for the decision queue).
- **Readiness summary** — RS-4 in compact form, intended for the decision
  queue's in-review rows.

### Data each view needs (requirements, not API design)

**Run view**

- Run: ID, task, purpose, role, model identifier, model endpoint (name and
  address), runner machine, started by (user) and at, status and outcome, ended
  at, failure reason and failing step, stop reason and actor, branch name.
- Live signal: the latest event time and a way to receive new events and status
  changes without reloading.
- Task context: ID, title, project, state, conditions, parent (for subtasks),
  desired outcome, acceptance criteria, declared paths, linked contracts,
  earlier return notes.
- Claim: claimant, lease deadline, whether the lease is suspended.
- Progress: the agent's reported plan or checklist items and their states, if
  any.
- Changed files so far with the scope check result per file.
- Artifacts: documents, previews, validation results, the handoff or review
  produced.
- Cost: amount, currency, source (metered, estimated, local, unknown), tokens
  in/out/cached.
- Pauses of this run: every field in RV-8, status, answer, answering user,
  times.
- Transcript: ordered events with types (message, tool call, tool result,
  runner output, error, pause marker), paged, in readable and raw forms, with
  redaction applied.
- The task's other runs, in summary form.
- Which actions the server allows for the selected user, with reasons for
  those it does not.

**Review surface**

- Everything in "Task context" above, plus state, conditions, open blockers,
  and subtasks with their states.
- Attempts: each handoff with its time, implementing runs, and the snapshot
  commit it refers to. Which attempt is latest.
- The snapshot: the branch, the snapshot commit, the merge base with main, and
  the branch status (up to date, behind main, conflict) from CONTRACT-004.
- The changes in the snapshot: per file, path, change type, line counts,
  binary or generated or large flags, the diff, and the full content before and
  after (for rendering documents).
- The scope check: per changed file, the declared path covering it or none;
  per declared path, whether anything under it changed.
- Validation results: check name, result, duration, time, commit, source, and
  output.
- Previews: images and links with captions and the run that attached them.
- The handoff and each review, as structured sections (so that acceptance
  evidence, findings, verdicts, deviations, and risks can be shown in place),
  with reviewer role, model, and endpoint.
- Each review's same-model flag as stored by the server (CONTRACT-001 T7), and
  the implementing and reviewer models it compared.
- Path dependencies: tasks waiting on this one.
- For a split parent: each subtask's state, latest verdict, findings, scope
  check counts, same-model flag, cost, and which files each subtask changed.
- Pauses for all runs of the task.
- Runs of the task with cost, grouped by attempt, and totals.
- The audit history.
- Which decision actions the server allows for the selected user now, with
  reasons for those it does not.
- After a decision: acceptor or returner, time, notes or waiver reason, merge
  commit.

## UX expectations

**UX-1 Responsive behavior.** Desktop-first on the LAN.

- **Wide (about 1280 px and up):** main column with the context rail (run view)
  or the sticky section navigator (review surface). Side-by-side diffs
  available.
- **Medium (about 768 to 1279 px):** single column. The context rail becomes a
  collapsible section after the summary. The section navigator becomes a
  compact bar.
- **Narrow (under about 768 px):** single column in this order: header, needs
  you, summary (or readiness), sections. Section navigation is a jump menu.
  Diffs are unified only. Wide content (code, tables, logs) scrolls
  horizontally inside its own box, never the page. Decision actions sit in a
  sticky bar at the bottom. Nothing is removed at narrow widths, only
  rearranged.
- Text stays readable at 200% zoom without loss of content or function.

**UX-2 Keyboard and focus.**

- Every action, disclosure, tab, gallery, and diff file is reachable and
  operable by keyboard in a logical order that follows the visual order.
- The section navigator moves focus to the section heading.
- Dialogs trap focus, close with Escape (without losing entered text until the
  user confirms discarding it), and return focus to their trigger.
- Pause cards arriving in a live view do not steal focus (see UX-4).
- Visible focus indicators meet 3:1 contrast.
- Keyboard shortcuts, if added, are optional accelerators, never the only way.

**UX-3 Semantics and assistive technology.**

- Pages use one `h1` (the task or run title) and ordered headings per section.
- Status badges expose their full label as text (for example "Run status:
  Paused").
- Diffs identify added and removed lines to screen readers as well as by color
  and by `+`/`-` markers. Document change views mark insertions and deletions
  with semantic markup and a visible text cue.
- The transcript is a log region. It is not announced line by line.
- Images in previews carry their captions as text alternatives. Missing
  captions fall back to the file name.
- Tables (scope check, runs, subtasks, criteria) are real tables with headers.

**UX-4 Live announcements.** Status changes that need a person (a pause opens,
a run fails, a run finishes, a merge completes or fails) are announced through
a polite live region, once each. Routine progress is not announced.

**UX-5 Motion.** The live indicator may pulse. With reduced motion requested,
it is static. No motion carries meaning on its own.

**UX-6 Words.** Buttons name the action ("Accept and merge", "Return task",
"Send answer", "Stop run", "Cancel task", "Keep task"). Errors say what
happened and what to do. Empty states say what is missing and what to do first.
The agent's recommendation is always labelled as a recommendation.

**UX-7 Consistency.** These screens follow Moonbeam's single token source and
shared components (ADR-002). Paperclip patterns adapted from its code keep
attribution (`THIRD_PARTY_NOTICES`).

## Validation requirements

The implementation is accepted against this contract when:

1. **State walkthrough.** With seeded data, every row of the state coverage
   table below renders with the specified status, sections, actions, and empty
   or error text. Screenshots at wide and narrow widths are attached to the
   handoff.
2. **Actions.** Accept and merge, accept without review (reason required),
   return (notes required; split parent with new subtasks), cancel (reason
   required), answer pause, and stop run each work end to end against the
   server, show their result in place, and show rejections with the
   CONTRACT-001 category. A `conflict` refreshes the view.
3. **Gates.** No human decision action is offered on a subtask or on a task not
   in `in_review` (automated UI test).
4. **Flags.** Out-of-scope files and same-model reviews are flagged in every
   place UI-I5 and UI-I6 require (automated UI test with fixtures).
5. **Live.** A live run's status, pauses, and summary update within 5 seconds
   without reload, and follow-mode behaves as RV-10 describes.
6. **Accessibility.** An automated accessibility check (for example axe) reports
   no serious or critical violations on each screen in each main state. A manual
   keyboard-only pass completes each action. A screen reader pass confirms the
   status labels, live announcements, and diff markers. Visual inspection alone
   does not count as accessibility evidence.
7. **Responsive.** Each screen is usable at 1440, 1024, and 390 px widths and
   at 200% zoom, with no page-level horizontal scroll.

### State coverage

| Screen | State | Must show |
|---|---|---|
| Run view | Starting | Starting, header complete, "Waiting for the first output from the runner." |
| Run view | Running | Running, Now line, progress (if reported), changed so far with scope flags, cost so far, lease, live transcript |
| Run view | Running, paused | Paused headline, pause card(s) above the summary, lease suspended, pause marker in transcript |
| Run view | Running, task blocked | Blocked condition badge with blockers, lease suspended |
| Run view | Not responding | Not responding, last update time |
| Run view | Stopping | Stopping, actions disabled |
| Run view | Handed off | Outcome sentence, Open review link, artifacts, transcript collapsed |
| Run view | Review recorded | Verdict, finding counts, same-model warning if it applies |
| Run view | Ended without handoff | Outcome sentence, task back in Approved |
| Run view | Failed | Failure reason, failing step linked, error excerpt, task back in Approved |
| Run view | Stopped (by user, release, break, or cancel) | Who, why, when |
| Review | In review, awaiting agent review | Not reviewed, Start agent review, Accept without review in place of Accept and merge |
| Review | In review, agent review running | Agent review running, link to that run |
| Review | In review, awaiting decision, verdict Pass | Readiness summary, all sections, Accept and merge enabled |
| Review | Verdict Changes required or Human decision required | Attention tone, findings, warnings listed in the accept confirmation |
| Review | Same-model review | Warning in readiness, Agent review, and accept confirmation |
| Review | Out-of-scope changes | Danger count in readiness, flagged rows, listed in accept confirmation |
| Review | Paths not declared | Attention notice, all files listed |
| Review | No validation reported | Attention empty state |
| Review | Blocked while in review | Blocked in readiness, Accept disabled with reason, Return enabled |
| Review | Behind main / merge conflict | Branch status, and for conflict Accept disabled with CONTRACT-004's next step |
| Review | Merging | Merging, actions disabled |
| Review | Split parent in review | Subtasks section, collected findings, combined result, Return with Add subtasks |
| Review | Subtask (any state) | Read-only, "Subtasks aren't accepted individually", link to parent |
| Review | Completed | Accepted by, merge commit or waiver reason, no actions |
| Review | Earlier returned attempt | Returned by, notes, link to current state |
| Review | Cancelled | Cancelled by, reason, branch not merged |
| Review | Not yet handed off | "This task hasn't been handed off yet." |
| Both | Loading, not found, connection lost, rejection | As in "Failure behavior" |

Board review of this contract is the validation for TASK-009 itself.

## Open questions

Each item states the default this contract proposes. The board may accept or
change it before approving.

- **Q1 — Run status names.** Proposed: `starting`, `running`, `stopping`,
  `finished` (with outcome handed off, review recorded, or no handoff),
  `failed`, `stopped`, with Paused shown when a running run has an open pause.
  "Finished" is used instead of "completed" so a run is never confused with a
  completed task. CONTRACT-001 says a run ends "completed, failed, or stopped".
  The runs contract should adopt these names, or this table follows it.
- **Q2 — "Not responding".** Proposed: the UI shows Not responding when no event
  or status report has arrived for 2 minutes during a live run. This is display
  only. Should the value differ for local models, which can be slow to produce
  a first token? Whether the server ends such runs is the runs contract's.
- **Q3 — Who runs validation.** Proposed: V1 shows agent-reported validation
  from the handoff, labelled "Reported by agent", and shows "Verified by
  Moonbeam" results only if a later runs contract has Moonbeam run the task's
  checks on the snapshot itself. Should Moonbeam run tests, typecheck, and
  build on the review snapshot before review? That would make the validation
  section evidence rather than testimony, at the cost of runner work.
- **Q4 — Correcting a pause's category.** Proposed: the person answering may
  change the category, and both the agent's and the corrected category are
  kept for pause review. Alternative: the category is fixed as asked, and
  correction happens only in pause review.
- **Q5 — Several open pauses on one run.** Proposed: each is answered on its
  own, and the run resumes when all are answered. Belongs to the pauses
  contract, which also decides whether a run may keep working while a pause is
  open (`pauses.md` open question).
- **Q6 — Accepting with warnings.** Proposed: warnings never block accepting
  (only blocked, unfinished subtasks, and merge conflicts do). When warnings
  exist, the accept dialog lists them and requires one "I've reviewed these"
  confirmation, which is recorded with the acceptance. Alternatives: no
  confirmation, or a written reason for accepting over specific warnings (for
  example out-of-scope files), as the review waiver does.
- **Q7 — Currency and precision.** Proposed: USD, shown with 2 decimals for
  totals and 4 for single runs under $1.
- **Q8 — Cost of local models and subscription CLIs.** Proposed: local
  llama.cpp endpoints show tokens and "Local, not metered". Frontier CLIs on a
  subscription show the CLI's reported equivalent cost labelled "Estimated".
  Alternatives: a configured price per endpoint for local models (for example
  to compare with frontier cost in track records).
- **Q9 — What counts as "same model".** CONTRACT-001 T7 has the server flag
  same-model reviews but does not define model identity. Proposed: the same
  model identifier (for example the same Claude model version or the same GGUF
  model), regardless of endpoint or runner. Different quantizations of one
  local model count as the same model. Different versions of a frontier model
  family count as different. The server decides, so every screen agrees.
- **Q10 — Per-criterion human judgment.** Proposed: not in V1. The board member
  reads evidence per criterion but decides once for the task. Alternative: let
  the board member tick criteria while reviewing, recorded with the acceptance.
- **Q11 — Which files are "documents".** Proposed: every Markdown file in the
  snapshot is rendered in full. Contracts and ADRs are listed first, then
  `docs/`, then other Markdown files. Should other formats (for example
  diagrams or HTML) render too?
- **Q12 — Redaction in transcripts.** Proposed: known credential patterns and
  configured secret values are redacted before display and storage. Should
  local user names and home paths also be masked (Paperclip offers this)?
- **Q13 — A split parent's combined result.** The review surface needs one
  combined diff for the parent. How subtask branches combine (a parent
  integration branch, or merging subtask branches in order at acceptance) is
  CONTRACT-004's. The review surface shows whatever that contract defines as
  "what will merge".
- **Q14 — Noticing pauses without notifications.** V1 has no notifications, so
  an open pause waits until someone looks. Proposed: while any open pause
  exists, every Moonbeam tab shows it in the page title (for example
  "(1 paused) Moonbeam"). Alternative: nothing beyond the decision queue and
  dashboard.
- **Q15 — Reading without a selected user.** Proposed: all screens are readable
  before choosing a user. Actions require a selected user. CONTRACT-002 may
  decide otherwise.
- **Q16 — Answering pauses from the decision queue.** Proposed: yes, with the
  same pause card, so a board member doesn't have to open the run. This affects
  TASK-007's scope.
- **Q17 — Stop run authority.** Proposed: any board member can stop any run
  (ADR-003 full authority), with an optional reason. Confirm for the runs
  contract.
