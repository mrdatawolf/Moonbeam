# TASK-011: Local model evaluation harness (optional, early)

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by:
Approved date:
Related contracts: 
Related ADRs: ADR-002
Dependencies: None

## Desired outcome

A small CLI tool that scores a llama.cpp endpoint on Moonbeam-shaped jobs and
stores the results. It answers: can model X do job Y acceptably on our
hardware?

## Context

Phase 5 needs capability data, not just speed. project-brain
(`/home/patrick/Documents/Github/Personal/project-brain`) benchmarks speed and
has provider code worth reading. The test endpoint is
`http://192.168.203.117:8080`.

## Scope

### Included

- A job set:
  - summarize a run log
  - categorize a pause into the five categories
  - draft a handoff from a diff
  - check a diff against a scope envelope
- Fixed test fixtures, scoring (exact match or rubric), and latency and token
  stats.
- JSON results output.

### Excluded

- Integration into the server or UI.
- Frontier-model runs.

### Paths

- `tools/model-eval/`

## Plan

## Acceptance criteria

- [ ] Runs against the test endpoint and produces a results file with a score
      per job.

## Validation requirements

Run it against the LAN endpoint and report the results.

## Risks and assumptions

The scoring rubric is a judgment call. Report it clearly.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.
