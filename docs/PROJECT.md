# Project Definition

Status: Draft — pending board approval of this document (ADR-001 to ADR-004 approved 2026-09-24).

## Purpose

Moonbeam is a LAN-hosted control plane for a small software team that develops
with specialist AI agents under human governance.

It keeps the discipline of the DbC development system (design before code,
behavioral contracts, independent review, human approval and acceptance) and
adds the operational surface that system lacks: one place to see every
project's work, who or what is doing it, what it costs, and what needs a human
decision.

Moonbeam deliberately does **not** pursue agent autonomy. Agents never run on
unattended schedules, never approve work, and never accept work. The board
decides; agents propose, implement, review, and report.

## Users and stakeholders

- **Board members** — the whole team: the owner, the office manager, two primary
  developers, and two part-time developers. In V1 every board member has full
  authority (see ADR-003); roles and abilities will be formalized later.
- **Agents** — specialist AI workers (Jarvis, contract designer, implementer, UX,
  reviewer) running on frontier models (Claude Code, Codex) on a dev box, or on
  local models served by llama.cpp on LAN machines.
- **Managed projects** — the software repositories Moonbeam governs. Each one
  carries the Moonbeam variant of DbC from `TEMPLATE/`.

## Desired outcomes

1. Every managed project's tasks, runs, pauses, and decisions are visible from
   one dashboard.
2. The gates are enforced by the server, not by convention: work runs only when
   the task is approved, and only a human accepts work.
3. Mid-run agent questions (pauses) are captured, categorized, and reviewed so
   that recurring gaps are closed up front in templates, contracts, and project
   guidance. Success is measured as fewer pauses per task over time.
4. Each model's actual capability per specialist role is measured from real
   outcomes (accepted versus returned work), so local models can take on work
   as they earn a track record.
5. The durable knowledge (contracts, ADRs, accepted task records) stays in each
   project's repository and remains useful without Moonbeam.

## Scope

### Included (V1)

- Multi-project control plane: projects, tasks, splits, claims, runs, pauses,
  reviews, approvals, and acceptance, stored in PostgreSQL.
- Task lifecycle enforced by the server:
  `proposed → approved → in_progress → in_review → completed`.
- Claiming: an approved task is picked up by one claimant (a person or an agent
  run) at a time.
- Splitting: agents may split a task into subtasks bounded by the parent's
  scope envelope. Splits of an approved task are approved automatically.
- Runners that launch Claude Code or Codex on a dev box, and that call local
  models over llama.cpp's OpenAI-compatible API.
- A pause log with categories, resolutions, and a periodic pause review surface.
- Track records per model and role, derived from review and acceptance outcomes.
- UI focused first on the **dashboard** and the **run view**, following
  Paperclip's layered disclosure (summary → artifacts → raw logs).
- Simple user select to set who is acting. No login in V1 (ADR-003).
- Cost visibility per run, task, project, and model. There are no budgets and
  no enforcement in V1.
- Writing durable artifacts (task records, contracts, ADRs) back into project
  repositories.
- `TEMPLATE/` — the drop-in files that make a new project follow Moonbeam
  principles (ADR-004).

### Excluded (V1)

- Scheduled or self-waking agents (Paperclip-style heartbeats).
- Agents approving tasks or accepting work.
- Authentication, RBAC, and roles. A global login system will be integrated
  through an API later.
- Access from outside the LAN, mobile-specific UI, and multi-tenant isolation.
- Hiring, org charts, and agent-to-agent delegation hierarchies.
- Cost budgets and spend enforcement.
- Replacing git hosting, pull-request review, or CI.

## Constraints

- Runs on the office LAN. Local models are reached at llama.cpp endpoints on
  various LAN machines (for example `192.168.203.117`, currently serving
  DeepSeek-Coder-V2-Lite Q4 on port 8080).
- Stack follows Paperclip's (ADR-002) so its UI patterns and components can be
  borrowed under its MIT license. PGlite is explicitly not used.
- Frontier-model agents (Claude Code, Codex) run on a dev box.
- Managed projects must stay workable by hand (plain markdown DbC docs) if
  Moonbeam is unavailable.

## Domain language

- **Board** — the humans who govern work. In V1, every user is a board member.
- **Project** — a governed repository registered in Moonbeam.
- **Task** — a unit of work with a desired outcome, scope, and acceptance
  criteria. Its lifecycle state lives in Moonbeam's database (ADR-001).
- **Scope envelope** — a task's inclusions, exclusions, linked contracts, and
  constraints. Subtasks inherit it and may only narrow it.
- **Split** — dividing a task into subtasks within its scope envelope.
  Subtasks are approved automatically and each gets an independent agent
  review. Human acceptance happens once, on the parent task.
- **Claim** — the exclusive right of one person or run to work an approved
  task.
- **Run** — one execution of an agent against a task, with its transcript,
  artifacts, cost, and outcome.
- **Runner** — the process that starts and observes runs on a machine (a dev
  box for frontier agents, or a caller to a llama.cpp endpoint).
- **Model endpoint** — a configured model an agent can use, for example a
  frontier CLI or a llama.cpp server on the LAN.
- **Pause** — a run stopping to ask a human a question. It is logged with a
  category and a resolution.
- **Pause review** — periodic analysis of pauses to find what could have been
  answered before the run started.
- **Handoff** — the implementer's report of what changed, what was validated,
  deviations, and risks.
- **Review** — the independent specialist assessment of a handoff. Findings
  always go to a human.
- **Acceptance** — a board member's decision that the work is complete.
- **Track record** — outcome statistics per model and specialist role.
- **Contract / ADR** — as defined by DbC; they live in the project repository.

## Delivery phases (proposed)

1. **Foundation** — the Moonbeam DbC variant and `TEMPLATE/`; the monorepo
   scaffold; the core data model and a lifecycle contract.
2. **Board surface** — projects, tasks, the decision queue, the dashboard, user
   select, and approval and acceptance actions.
3. **Runs** — the runner for Claude Code and Codex on a dev box, the run view,
   handoffs, review, and write-back to the repository.
4. **Pauses** — in-run questions, the pause log, and pause review.
5. **Local models** — llama.cpp endpoints, low-risk roles (summaries, pause
   triage, handoff drafts), and track records.
6. **Hardening** — roles and permissions, global login integration, and cost
   budgets.

## Resolved questions

- **Subtask acceptance (2026-09-24):** the parent task is the unit of human
  approval and acceptance. Subtasks are the means of getting it done. They are
  approved automatically and reviewed by an agent, but they are not accepted
  individually. The parent enters review when all its subtasks are done, and a
  board member accepts it or returns it, optionally reopening specific
  subtasks.
- **Budgets (2026-09-24):** V1 shows costs but does not budget or enforce them.
- **DbC presentation material (2026-09-24):** removed from this repository.
