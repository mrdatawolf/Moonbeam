# TASK-009: CONTRACT-003: run view and review surface

Owner role: UX specialist
Assigned agent: interface-designer
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
Related contracts: CONTRACT-003 (produced, Proposed); depends on CONTRACT-001,
CONTRACT-002, CONTRACT-004, and the future runs and pauses contracts
Related ADRs: ADR-005
Dependencies: None

## Desired outcome

An approved UI contract for:

- the run view: live progress, summary first, then artifacts, then raw logs;
  pauses; cost
- the review surface from ADR-005: rendered documents, the diff, validation
  results, previews, the handoff, the agent review, the pause history, and a
  paths-versus-changes check
- the accept, return, and waive-review actions

## Context

The board named the run view a top-priority screen. Study Paperclip's run view
and related pages in `/home/patrick/Documents/Github/paperclip/ui` as prior
art.

## Scope

### Included

- Screens and states, the information hierarchy, and the status vocabulary.
- The data each view needs, named as requirements rather than API design.

### Excluded

- Implementation.

### Paths

- `docs/contracts/CONTRACT-003-run-and-review-views.md`

## Plan

## Acceptance criteria

- [ ] Covers every state a run and a review can be in, including paused,
      failed, and same-model-reviewer warnings.

## Validation requirements

Board review.

## Risks and assumptions

Paperclip's views assume autonomy. Adapt them, don't copy them.

## Blocker

None.

## Implementation handoff

Implementer: interface-designer (UX specialist), 2026-09-24. Design only.

### Changes made

- Created `docs/contracts/CONTRACT-003-run-and-review-views.md`, Status
  Proposed, following `docs/contracts/TEMPLATE.md`. It defines:
  - SV: a shared status vocabulary (six tones; labels for task states,
    conditions, review sub-statuses, run statuses, pause statuses, review
    verdicts, check results, scope-check results, branch statuses, and the
    same-model warning) and a headline-status precedence.
  - RV: the run view in three layers (summary, artifacts, raw logs), with a
    "Needs you" region for open pauses, the pause card and answer interaction,
    cost with its source, and the role, model, endpoint, and starter always
    visible. Live and ended forms.
  - RS: the review surface (ADR-005): readiness summary, then output first
    (documents rendered in full, code diff, validation, previews), then the
    handoff, agent review with the same-model warning, scope check (declared
    paths against changed files), pause history, runs and cost, and history.
    Split-parent form, subtask read-only form, and read-only records after the
    decision.
  - A: accept and merge, accept without review (reason), return with notes
    (split parent: add subtasks, never reopen), cancel (reason), answer pause,
    stop run, start agent review.
  - Invariants UI-I1 to UI-I10, failure and empty states, data requirements
    per view, reusable pieces for TASK-007 and TASK-008, accessibility and
    responsive requirements, and a state coverage table for validation.

### Validation performed

- Checked against `docs/PROJECT.md` domain language, ADR-005, ADR-003,
  `TEMPLATE/docs/workflow/pauses.md` and `splits.md`, and CONTRACT-001 as
  revised under TASK-004 (same-model flag stored by the server, T10 return
  without reopening, path dependencies, merge failure open as Q17).
- Prior art reviewed in Paperclip: `DESIGN.md`, `doc/PRODUCT.md` design goals,
  `AgentDetail.tsx` run detail and log viewer, `ApprovalDetail.tsx`,
  `DecisionQueuePage.tsx`, `Dashboard.tsx`, `StatusBadge.tsx`,
  `lib/status-colors.ts`, `IssueOutputSection.tsx`. Adapted, not copied: no
  heartbeats, no agent approvals, one human acceptance on the parent.
- Validation for this task is board review.

### Acceptance criteria evidence

- "Covers every state a run and a review can be in, including paused, failed,
  and same-model-reviewer warnings": SV-3 lists every state, and the "State
  coverage" table under "Validation requirements" names what each run view and
  review surface state must show, including Paused, Failed, Not responding,
  Same-model review, Blocked in review, Merge conflict, split parent, subtask,
  and the read-only records.

### Assumptions and deviations

- Run statuses, "Not responding", pause resolution mechanics, validation
  sources, merge-failure outcomes, and the split parent's combined diff depend
  on contracts not yet written (runs, pauses) or in progress (CONTRACT-004).
  The contract presents their outcomes and flags each dependency as an open
  question rather than deciding it.
- Stop run and Start agent review are included as entry points because the run
  view and review surface need them. Their behavior belongs to the runs
  contract.

### Unresolved risks

- Open questions Q1 to Q17 in the contract need board answers. Q3 (whether
  Moonbeam runs validation itself), Q6 (accepting with warnings), and Q13 (the
  split parent's combined result) most affect implementation.
- If CONTRACT-001 or CONTRACT-004 change further before approval, SV-3 and
  A-1/A-3 may need a follow-up edit.

## Review

Not reviewed.
