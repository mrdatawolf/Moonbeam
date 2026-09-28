# TASK-020: ADR-008, Moonbeam observes DbC projects through GitHub

Owner role: Architect
Assigned agent: jarvis (drafting); Claude (writing the file)
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
Related contracts: CONTRACT-002, CONTRACT-003, CONTRACT-004, CONTRACT-005 (all
affected)
Related ADRs: ADR-001, ADR-004, ADR-005, ADR-006, ADR-007 (affected)
Dependencies: None

## Desired outcome

A Proposed ADR-008 records the board's change of direction from the planning
session of 2026-09-28. Moonbeam stops being the per-task engine. It becomes a
top-down, read-only view of every project. DbC runs locally in each project,
and GitHub is the shared reference point. The board can approve or change the
ADR before any code or contract work follows.

## Context

The board (Patrick, 2026-09-28) reconsidered the direction set by ADR-001.
Under ADR-001, Moonbeam had to re-specify DbC's whole task lifecycle, runs,
branches, and merges. That produced about 4,500 lines of contracts before any
agent ran.

The new direction, as agreed in the planning session:

- **Lead developer.** A board member takes a project and becomes its lead
  developer and primary stakeholder. They clone it from GitHub and work it
  locally with their AI tools under folder-based DbC. The lead developer,
  stakeholder, and board member are all board members. Concurrent work on one
  project by several board members is out of scope for now. Sub-projects
  within a project may be added later.
- **DbC stays authoritative for its project.** Moonbeam reads DbC's files in
  the repository. Its format is Moonbeam's interface ("DbC is the API").
- **What is committed to main:**
  - proposals: a new task in `tasks/proposed/`, pushed so the board can
    discuss it from Moonbeam
  - approval: the task moved to `tasks/approved/`
- **Branches.** The lead developer branches from main to work the task.
  `in-progress/` and `review/` exist only on that branch, and Moonbeam does not
  track them.
- **Acceptance is the merge.** The task reaches `tasks/completed/` on the
  branch, and the branch is merged into main and pushed. This restores
  ADR-005's original "merging is acceptance".
- **GitHub is the common reference.** Work happens locally, and signalling
  happens through GitHub. Moonbeam polls GitHub with a read-only token, because
  webhooks cannot reach the LAN.
- **Detection is enough.** Moonbeam doesn't enforce gates. It flags
  violations it can see in main's history (ADR-007's "record and review"
  principle).
- **Moonbeam is read-only for now.** It never commits, pushes, approves, or
  accepts. Board members act in the repository.
- **Deferred.** Pauses are deferred and may be dropped. Agent runs in Moonbeam
  (the phase 3 plan) are on hold.

## Scope

### Included

- `docs/decisions/ADR-008-moonbeam-observes-dbc-through-github.md`, status
  Proposed, following `docs/decisions/ADR-TEMPLATE.md`. It covers:
  - **Decision:** the points in "Context", stated as decisions.
  - **Relationship to earlier ADRs.** For each ADR, say which decisions are
    superseded, amended, or kept:
    - ADR-001: the database owning the lifecycle is superseded.
    - ADR-004: the Moonbeam variant is reshaped.
    - ADR-005: merging is acceptance again, and there is no Moonbeam review
      surface.
    - ADR-006: the local projects root and single host are replaced by
      GitHub.
    - ADR-002 and ADR-007 are kept.
    - ADR-003: the honor-system identity stays, but agent credentials are no
      longer needed.
  - **Contracts affected:** CONTRACT-003, 004, and 005 become superseded or
    shelved. CONTRACT-002 keeps only the user registry and user select.
  - **Detectable violations**, as the initial list for the observation
    contract:
    - a task reaches `completed/` on main without first being in `approved/`
      on main
    - required header fields are missing or empty
    - code changes on main that no completed task accounts for
    - a completed task changed files outside its declared paths
    - an approved task goes stale (no merge within N days)
  - **Where the DbC changes live (a decision for the board).** Two
    alternatives, with a recommendation:
    - **A (recommended):** change the upstream `Project Template DbC`
      directly, and retire Moonbeam's `TEMPLATE/`. The new rules are good
      practice without Moonbeam: commit proposals and approvals to main,
      merge only from `completed/`, and a fixed, parseable header. The
      Moonbeam-held-state variant no longer applies, because state is back
      in folders. There is then one DbC, and Moonbeam declares which
      template version it reads.
    - **B:** keep `TEMPLATE/` in Moonbeam as "DbC plus Moonbeam
      conventions". This is ADR-004's original arrangement. It leaves
      upstream untouched, but the two templates drift and have to be ported
      by hand.
  - **What is kept, shelved, or removed** in the current code:
    - kept: the stack, users and user select, project discovery and
      registration (to be re-pointed at GitHub), the dashboard shell, and
      audit
    - shelved: the lifecycle service, claims, leases, splits, agent
      credentials, and the dev routes
  - **Alternatives considered:**
    - continue the ADR-001 direction
    - approving from Moonbeam, rejected for now because it would need write
      tokens and give two places to approve
    - webhooks
    - tracking branches
  - **Consequences and follow-up work:** the list under "Follow-up work
    (not in this task)" below.

### Excluded

- Changing any existing ADR, contract, or document, including their status
  lines. Those changes follow only if the board approves ADR-008.
- The observation contract (TASK-021).
- Changes to the upstream template or to `TEMPLATE/`.
- Any code change.

### Paths

- `docs/decisions/ADR-008-moonbeam-observes-dbc-through-github.md`

## Plan

1. Draft ADR-008 from this task's context and the planning session's
   decisions.
2. Check it against ADR-001 to ADR-007 and CONTRACT-002 to 005, so every
   superseded or kept point is named.
3. Hand off for board review.

## Acceptance criteria

- [ ] ADR-008 exists with status Proposed and follows the ADR template.
- [ ] Every decision listed under "Context" appears as a decision.
- [ ] Each earlier ADR and contract is named as superseded, amended, shelved,
      or kept, with the specific decisions affected.
- [ ] The template-location choice is presented as alternatives A and B, with
      a recommendation and left for the board to decide.
- [ ] No other file is changed.

## Validation requirements

Read-through by the dispatcher against ADR-001 to ADR-007 and the contract
status lines. No build or tests are needed, since only documents change.

## Risks and assumptions

- The ADR records decisions from chat. Anything misremembered is corrected at
  board review, before approval.
- The "N days" staleness threshold is left to the observation contract.

## Follow-up work (not in this task)

- TASK-021: the observation contract (what Moonbeam reads).
- After ADR-008 is approved:
  - update the status lines of the superseded ADRs and contracts
  - rewrite `README.md`, `docs/PROJECT.md`, and `docs/ARCHITECTURE.md` for
    the new direction
  - apply the template decision (A or B)
  - plan the code rework

## Blocker

None.

## Implementation handoff

**Changed:** `docs/decisions/ADR-008-moonbeam-observes-dbc-through-github.md`
(new, status Proposed). No other file changed.

**What it records:**

- Decisions 1–7 carry the planning-session direction:
  - the lead developer
  - DbC as the interface
  - proposals and approvals committed to main
  - the branch merge as acceptance
  - GitHub polling
  - a read-only Moonbeam
  - detection with an initial list of five flags
- Decision 8 presents the template location as alternatives A and B, and
  recommends A.
- Decision 9 lists what is deferred.
- Tables set out the effect on ADR-001 to ADR-007 and CONTRACT-001 to 005, and
  what happens to the current code.

**Validated:** read-through against ADR-001 to ADR-007, the contract status
lines, and the upstream DbC `docs/workflow/lifecycle.md`. Every point under
"Context" appears as a decision.

**Deviations:**

- Drafted by Claude directly, not dispatched to jarvis. The planning context
  was already in the session.
- The ADR also:
  - classifies ADR-003 as amended, because its decision 3 has no object once
    agents don't use Moonbeam
  - names CONTRACT-002 as superseded in part
  - adds a risk about duplicate task IDs allocated on main
  - defines "shelved" for contracts

**For the board to decide at review:**

- decision 8: template alternative A or B
- whether "shelved" is the right status for CONTRACT-003, 004, and 005, or
  whether they should be marked superseded by ADR-008

## Review

Not reviewed.

## Human acceptance

Pending.
