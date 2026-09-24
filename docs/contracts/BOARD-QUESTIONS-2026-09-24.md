# Board questions: contract round 1

Date: 2026-09-24
Covers the open questions in CONTRACT-001 (Q14–Q21), CONTRACT-002 (Q1–Q8),
CONTRACT-003 (Q1–Q17), and CONTRACT-004 (Q1–Q16). Duplicates are merged and
the questions are grouped by topic. Each item names its source questions, so
the answers can be applied back to each contract (TASK-012).

**How to answer:** write on each `Answer:` line. `ok` accepts the
recommendation. Anything else overrides it. You can also write
"all recommendations ok except …" at the top.

Overall answer:

---

## Group A: needed before TASK-006 (lifecycle data and API)

### A1. Paths at approval and overlap
Source: 001-Q21

- Must a task declare at least one path to be approved?
- How is a task with no paths treated?
- What counts as overlap?
- Are globs allowed?

**Recommendation:**
- Every task that changes files must declare paths to be approved. A task with
  no paths, such as a pure planning or review task, never overlaps.
- Overlap means the same file, or one path containing the other.
- V1 allows plain file and directory paths only, with no globs, so overlap
  stays simple and exact.

Answer: follow the recommendation

### A2. Path dependencies inside a split
Source: 001-Q14, 004-Q3

- Do subtasks inherit their parent's dependencies?
- Do sibling subtasks with overlapping paths wait for each other?

**Recommendation:**
- Yes, subtasks inherit: if the parent is waiting on an earlier task, its
  subtasks wait too.
- Yes, overlapping siblings run in creation order. The dependency is satisfied
  when the earlier sibling is completed, because by then its work is merged
  into the parent's branch (CONTRACT-004).

Answer: follow the recommendation

### A3. Reordering dependencies
Source: 001-Q15

- Can a reorder make a task that is already in progress wait?
- How are cycles among three or more tasks prevented?

**Recommendation:** treat overlap order as a **per-project queue position**
(your queue idea). Reordering moves a task's position in the queue, which
cannot create cycles. A task already `in_progress` or later cannot be moved
behind an unfinished task.

Answer: follow the recommendation

### A4. When merging fails
Source: 001-Q17, 004-Q4, 004-Q5, 004-Q8

**Recommendation:**
- **At handoff (004-Q5):** a handoff is refused unless the branch merges
  cleanly into its target: main, or the parent branch for a subtask. You never
  receive work that cannot merge.
- **At acceptance (001-Q17):** if the merge still fails, for example because
  main moved, the accept is rejected. The task stays `in_review` with the
  conflict shown, and you return it.
- **Merge and record together (004-Q8):** the merge and the permanent task
  record succeed or fail together.
- **Subtask won't integrate into the parent branch (004-Q4):** Moonbeam raises
  a system blocker on the parent. This allows "system" as an actor that can
  raise blockers. A fix subtask then resolves it.

Answer: follow the recommendation

### A5. Returned split parent: direct work or subtasks only?
Source: 001-Q16

**Recommendation:** subtasks only, matching your A2 and A3 answers. A returned
split parent goes to `approved`. Whoever claims it may only add subtasks,
following your return notes, and may not change files directly. No separate
parent-level review is needed, because each fix subtask gets its own review.

Answer: follow the recommendation

### A6. Which agent runs may add or cancel subtasks
Source: 001-Q18, 001-Q19

**Recommendation:**
- **Add:** the run that has claimed the parent or a sibling subtask, and also
  a reviewer run. A reviewer that finds problems is the natural source of a fix
  subtask. A review that has findings and adds a fix subtask is recorded in the
  same step, so the parent can't slip into review in between.
- **Cancel:** only the run that created the subtask, and only while no one has
  claimed it.

Answer: follow the recommendation

### A7. Unblocking a parent
Source: 001-Q20

**Recommendation:** unblocking the parent clears the "blocked because the
parent is blocked" state on its subtasks. Blockers recorded on a subtask
itself stay open until someone resolves them.

Answer: follow the recommendation

### A8. Identity basics
Source: 002-Q2, 002-Q4, 002-Q5, 002-Q7

**Recommendation:**
- **002-Q2:** (A) accept that an agent can impersonate the UI as a known V1
  limit. Global login is the real fix.
- **002-Q4:** an agent may read its whole project, and no other project.
- **002-Q5:** yes, audit records note that the identity was "selected".
- **002-Q7:** just apply it in TASK-012; it keeps the contracts consistent.

Answer: follow the recommendation

---

## Group B: needed before TASK-007 and TASK-008 (board UI and dashboard)

### B1. Users
Source: 002-Q1, 002-Q6, 002-Q8

- Display names for the six users. **Only you can answer this.**
- Should a renamed user show their current name in past records?
  **Recommendation:** yes.
- Can anyone manage users? **Recommendation:** yes (full authority in V1).

Answer (names):  follow the recommendation

### B2. Viewing without choosing a user
Source: 002-Q3, 003-Q15

**Recommendation:** yes, anyone can view. Every action requires choosing a
user.

Answer: follow the recommendation

### B3. Small display choices
Source: 003-Q7, 003-Q8, 003-Q14, 003-Q16

**Recommendation:**
- USD.
- Local models show "Local, not metered"; subscription CLIs show "Estimated".
- While any pause is open, the tab title shows it.
- Pauses can be answered from the decision queue, but only once pauses exist
  (phase 4). This is out of TASK-007's scope.

Answer: follow the recommendation

---

## Group C: needed before phase 3 (runs and review). Defaults are fine for now

### C1. Branches
Source: 004-Q1, 004-Q2, 004-Q6, 004-Q12

**Recommendation:**
- One branch per task. ADR-005's "per run" wording gets corrected.
- The branch is named `moonbeam/TASK-NNN`.
- Merge commits, not squash.
- Cancelled branches are kept for 30 days.

Answer: follow the recommendation

### C2. Where project repositories live
Source: 004-Q15

Moonbeam needs a canonical copy of each project to merge accepted work into.
Do your project repositories already live somewhere central on the LAN (a file
share or Gitea), or only on developers' machines and GitHub?

**Recommendation:** Moonbeam hosts a bare canonical repository per project on
its own machine. GitHub or Gitea can be a mirror. **Only you can answer the
current setup.**

Answer: follow the recommendation (GitHub)

### C3. Authorship and records
Source: 004-Q7, 004-Q9, 004-Q14

**Recommendation:**
- Add an email address to each user. The person who accepts is the merge
  author.
- Moonbeam's git identity is configured once for all projects.
- Records go to `tasks/TASK-NNN-slug.md`.
- Commits made on main by hand are allowed and shown as a warning.

Answer: follow the recommendation

### C4. Review evidence
Source: 003-Q3, 003-Q6, 003-Q10, 004-Q10

**Recommendation:**
- **Moonbeam runs tests, typecheck, and build itself** on the reviewed commit
  in phase 3. Until then, agent-reported results are labelled as such. This
  matches the idea that the work happens out of sight and the evidence is
  checked at the end.
- Warnings never block accepting, but you confirm once. Out-of-scope files
  need a written reason.
- There is no ticking of individual criteria in V1.
- If main has moved since review, you can still accept, with a warning.

Answer: follow the recommendation

### C5. Runs and pauses
Source: 003-Q1, 003-Q2, 003-Q4, 003-Q5, 003-Q17, 004-Q11, 004-Q13, 004-Q16

**Recommendation:**
- Runs end as "finished", never "completed".
- The UI shows "Not responding" after 2 minutes, or 5 minutes for local models.
- The person answering a pause may correct its category, and both categories
  are kept.
- Each pause is answered separately, and the run resumes when all are answered.
- Any board member can stop any run.
- Uncommitted work is not published when a run ends.
- Detecting rewritten branch history is enough for V1.
- No special rules for local models until they get writing roles.

Answer: follow the recommendation

### C6. Review display details
Source: 003-Q9, 003-Q11, 003-Q12, 003-Q13

**Recommendation:**
- Same model means the same model identifier. Two quantizations of one model
  count as the same model.
- All Markdown files render as documents.
- Only credentials are redacted in V1.
- A split parent's combined diff is its branch compared with main.

Answer: follow the recommendation
