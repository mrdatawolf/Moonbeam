# TASK-009: CONTRACT-003: run view and review surface

Owner role: UX specialist
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by:
Approved date:
Related contracts: CONTRACT-003 (to be produced)
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

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
