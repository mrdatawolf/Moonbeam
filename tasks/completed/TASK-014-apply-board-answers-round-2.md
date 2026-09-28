# TASK-014: Apply board answers round 2 (merge and override edge cases), fix stale text

Owner role: Contract designer
Assigned agent: contract-architect
Proposed by: Claude (planning session)
Proposed date: 2026-09-25
Approved by: Patrick (instructed in planning session)
Approved date: 2026-09-25
Related contracts: CONTRACT-001, CONTRACT-002, CONTRACT-003, CONTRACT-004
Related ADRs: ADR-005, ADR-007 (Proposed)
Dependencies: TASK-013 (in review)

## Desired outcome

The board's 2026-09-25 answers to the questions TASK-013 raised are applied.
Stale text is fixed, and all contracts use the status word "Approved".

## Context

Board answers, 2026-09-25. The principle behind them is written up as ADR-007:
gates bind agents, humans may override, and every override is recorded.

- **004 Q19 (a merge requested after acceptance conflicts):**
  - A hand merge is always accepted as fact.
  - If a hand merge happens before acceptance, the task is treated as
    accepted, with the note "accepted by early merge; review skipped".
- **004 Q20 (the record after a hand merge):** the hand merge stands. The task
  record is written or updated, with a note, in the next merge Moonbeam
  performs.
- **001 Q24:** accepted but unmerged tasks appear in the decision queue as
  their own group ("Accepted, not merged"), with refused merges first.
- **001 Q25:** a conflict already known at acceptance refuses the accept by
  default. A human may use an "accept anyway" override, which is recorded.
- **004 Q21:** the interim reading is confirmed. The safe-folder check applies
  only to the working tree that has main checked out.
- **004 Q22:** whoever performs the merge is its author. If that person is not
  the acceptor, this is noted.
- **004 Q23:** Moonbeam never fetches from remotes. Humans do.
- **004 Q24:** registering and relinking projects, and changing the projects
  root, are human-only actions. This also resolves 002 Q9. Relink verifies
  that the new path is the same repository before updating it.

## Scope

### Included

- Apply the answers above to the named contracts, and move each question to
  "Resolved questions".
- Add a dated revision note to each contract changed.
- Record overrides (who, when, what was bypassed, reason) as audit and task
  record notes, as ADR-007 point 4 describes.
- Set `Status: Approved` in CONTRACT-002, 003, and 004. They currently say
  "Accepted".
- ADR-005:
  - Add a short dated amendment saying that its first amendment's reference to
    a Moonbeam-held repository is superseded by ADR-006.
  - Reference ADR-007 for hand merges.
- `TEMPLATE/docs/AI_DEVELOPMENT_SYSTEM.md`: fix the "Task records" wording. The
  record is written with the merge, not at acceptance.

### Excluded

- New behavior beyond these answers.
- The override review screen (phase 4).

### Paths

- `docs/contracts/CONTRACT-001-task-lifecycle.md`
- `docs/contracts/CONTRACT-002-identity.md`
- `docs/contracts/CONTRACT-003-run-and-review-views.md`
- `docs/contracts/CONTRACT-004-run-branches.md`
- `docs/decisions/ADR-005-review-surface-and-merge-on-acceptance.md`
- `TEMPLATE/docs/AI_DEVELOPMENT_SYSTEM.md`
- `TEMPLATE/docs/workflow/`

## Plan

## Acceptance criteria

- [ ] Every answer above is traceable to the contract text it changed.
- [ ] Every contract says `Status: Approved`.
- [ ] No contract contradicts another on hand merges, overrides, or the
      decision queue.
- [ ] Any new question is flagged, not decided.

## Validation requirements

Board review of the diffs.

## Risks and assumptions

## Blocker

None.

## Implementation handoff

Contract-architect, 2026-09-25. All contracts now say `Status: Approved`; each
changed file has a dated 2026-09-25 TASK-014 revision note. IDs kept stable.

| Answer | Where applied |
|---|---|
| 004 Q19 (hand merge is fact; early merge = accepted) | 001 new M3, M1, M2, I6, I22, Audit "Overrides", validation 15; 004 B7, B14, B17, validation 15; 003 SV-3, RS-14, RS-15, A-8 |
| 004 Q20 (record in next Moonbeam merge, with note) | 001 M1, M2; 004 B7, B9, B17, R3, R8; 003 SV-3 "Record pending", RS-15; TEMPLATE AI_DEVELOPMENT_SYSTEM "Task records" |
| 001 Q24 ("Accepted, not merged" group) | 001 UX; 003 RS-15, shared pieces, validation table |
| 001 Q25 (refuse by default; "accept anyway") | 001 T9, table, Failure (`merge_conflict` on T9), Interfaces, validation 12, Overrides; 002 human-only list; 003 RS-4, RS-12, A-1; 004 UX |
| 004 Q21 (safe-folder check on main's worktree only) | 004 B15 |
| 004 Q22 (performer is author; noted if not acceptor) | 004 B8, B9, B17; 001 M2; 003 RS-14 |
| 004 Q23 (never fetch) | 004 B16; 003 RS-15 |
| 004 Q24 / 002 Q9 (root, register, relink human-only; relink verifies) | 004 B13, Failure, Interfaces, validation 16; 002 human-only list, Q9 resolved |
| ADR-007 point 4 (override recording) | 001 Audit record "Overrides"; 004 B9 notes in record |
| ADR-005 | new 2026-09-25 amendment (C2 bare-repo text superseded by ADR-006; hand merges under ADR-007; open points answered) |

`TEMPLATE/docs/workflow/` needed no change (no stale wording found).

Judgment calls for board review:

- M3 trigger is the "review commit" (latest handoff commit, or a split
  parent's branch head at T12). M3 fires even if the task is blocked or
  paused (interim, part of 001 Q26).
- Relink "same repository" uses the earlier proposed criterion: contains the
  last recorded main commit and needed task branch heads.
- "Accept anyway" reason is optional (ADR-007 "when one was given").
- Hand-merge "who" is taken from git author/committer, honor-system.

New open questions (flagged, not decided):

- CONTRACT-001 Q26: hand merge before acceptance outside `in_review`
  (approved/in_progress with active run, subtask branches, blocked/paused).
- CONTRACT-004 Q25: changing the projects root when projects would fall
  outside it.
- CONTRACT-004 Q26: marking an undetected hand squash/rebase/cherry-pick as
  merged.
- Minor, not recorded as a question: whether unknown mergeability at
  acceptance counts as a "known conflict" (text says only a known conflict
  refuses).

## Review

Not reviewed.

## Board notes

Accepted by Patrick, 2026-09-25 (instructed in planning session). Review waived.
