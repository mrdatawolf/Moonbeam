# ADR-001: Database owns the lifecycle; repositories own durable knowledge

Status: Approved
Date: 2026-09-24
Decision owners: Board
Related tasks and contracts: none yet

## Context

In the DbC template, the directory holding a task file (`tasks/proposed/`,
`tasks/approved/`, and so on) is that task's authoritative state. That works for
a single repository worked by one person, but Moonbeam must:

- show live state across many projects to six people at once
- enforce the gates (an agent must not be able to "approve" work by moving a
  file)
- track claims, runs, pauses, costs, and track records, none of which fit
  naturally in markdown files

At the same time, DbC's principle that "the repository is the long-term memory"
remains valuable: projects should stay understandable without Moonbeam.

## Decision

1. **Moonbeam's PostgreSQL database is the single source of truth for workflow
   state**: task lifecycle status, claims, splits, runs, pauses, reviews,
   approvals, and acceptance, including who acted and when.
2. **Project repositories are the source of truth for durable knowledge**:
   CLAUDE.md and AGENTS.md, architecture docs, contracts, ADRs, and the record
   of accepted tasks.
3. In Moonbeam-managed projects, the lifecycle directories are removed. Moonbeam
   writes the task file into the repository in two places:
   - into the working checkout when a run starts, so the agent can read its
     assignment
   - as the permanent record, with its handoff, review, and acceptance, when a
     board member accepts the task
4. Moonbeam links to contracts and ADRs in the repository rather than copying
   them into the database.

## Alternatives considered

- **Repository files as the source of truth, with Moonbeam as an index.**
  Truest to DbC, but concurrent claims, live run state, and enforced gates
  become race-prone file operations, and anyone with repository access can
  bypass the gates.
- **Both, kept in sync both ways.** Rejected. Two authorities drift, and every
  conflict needs a resolution rule.
- **Database only.** Loses DbC's durable, tool-independent project memory.

## Consequences

### Benefits

- Gates are enforceable server-side.
- The cross-project dashboard, pause analytics, and track records become
  straightforward queries.
- Projects still carry their own contracts, decisions, and history.

### Costs and risks

- The DbC workflow docs must be adapted for managed projects (ADR-004).
- A task file in a working checkout is a snapshot, not live state. Agents must
  be told not to treat edits to it as state changes.
- The write-back to the repository needs a defined commit policy (branch,
  author, message) and handling for write failures.

## Follow-up work

- A contract for the task lifecycle and its transition authority.
- A contract for repository write-back.
