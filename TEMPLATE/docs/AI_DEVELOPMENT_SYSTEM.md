# AI Development System

## Purpose

This repository uses a collaborative, human-led AI development process, governed
through Moonbeam.

The objective is **not** to maximize AI autonomy.

The objective is to create a disciplined engineering workflow where specialized AI agents contribute expertise while the humans on the board remain the project owners, product managers, and final decision makers.

The system is intentionally designed to resemble a well-functioning engineering team rather than a single autonomous coding agent.

---

# Guiding Principles

## Human First

The board is the orchestrator.

AI agents advise, design, implement, review, and document, but they do not own the project.

The board decides:

* project goals
* priorities
* architecture
* tradeoffs
* implementation order
* acceptance of completed work

Agents never approve tasks and never accept work. Moonbeam enforces this: it
rejects approval and acceptance actions from agents.

No agent should silently continue work beyond its assigned responsibility.
Agents do not run on unattended schedules; every run is started against a task.

---

## Specialists over Generalists

Each AI agent has a narrowly defined role.

Agents should become better within their specialty rather than attempting to solve every problem.

Examples include:

* architecture
* implementation
* contracts
* UX
* review
* documentation

The system should evolve by improving specialists, not by making one agent increasingly autonomous.

---

## Design Before Code

Implementation is never the first step.

Every meaningful feature should begin with understanding:

* the problem
* the desired outcome
* constraints
* architecture
* tradeoffs

Only after those are understood should implementation begin.

---

## Contract-Driven Development, Inspired by Design by Contract

Bertrand Meyer's Design by Contract specifies reciprocal obligations between
software clients and suppliers through precise preconditions, postconditions,
and invariants. This development system adapts that discipline to collaboration
between humans and AI agents; it does not reproduce Eiffel's programming-language
mechanism or claim that the surrounding governance workflow is part of Meyer's
method.

Implementation should follow approved behavioral contracts.

The implementation agent is responsible for satisfying the contract—not inventing it.

Contracts define observable behavior rather than implementation details.

In this adaptation, the board supplies approved scope and the conditions under
which work is authorized. The implementation agent guarantees the required
behavior and preserves stated invariants at the handoff boundary. Independent
review checks those claims, while human acceptance remains a governance decision
rather than a postcondition.

Where practical, contracts should describe:

* purpose
* scope
* actors
* inputs
* outputs
* preconditions
* postconditions
* invariants
* failure behavior
* interfaces
* UX expectations
* validation requirements

Large or cross-cutting work should have explicit contract documents.

Small changes may use acceptance criteria embedded directly in task descriptions.

---

## Ask, Don't Guess

When an agent cannot continue without a human answer, it pauses and asks rather
than guessing. Every pause is recorded in Moonbeam with a category and a
resolution.

Pauses are reviewed periodically to find what could have been answered before
the run started. Recurring gaps are closed up front, in task templates,
contracts, and project guidance. Fewer pauses per task over time is a sign the
project's written knowledge is improving.

See `docs/workflow/pauses.md`.

---

## Living Knowledge

Project knowledge should not disappear into chat history.

Important architectural decisions should become project documentation.

The repository—not the conversation—is the long-term memory.

Whenever significant knowledge is created, it should eventually become part of the project documentation after board approval.

---

# Where Knowledge and State Live

## Moonbeam

Moonbeam is the single source of truth for workflow state: task status, claims,
splits, runs, pauses, reviews, approvals, and acceptance, including who acted
and when.

Moonbeam links to the contracts and ADRs in this repository rather than copying
them.

## This repository

The repository is the source of truth for durable knowledge. It should remain
understandable, and workable by hand, without Moonbeam.

### CLAUDE.md

The operational handbook.

Contains information every agent should understand before working.

Examples:

* coding conventions
* technology stack
* testing philosophy
* repository layout
* project rules
* references to deeper documentation

---

### docs/

Project knowledge.

Typical contents include:

* project goals
* architecture
* domain knowledge
* UX guidance
* conventions
* contracts
* architectural decision records

The exact structure will evolve with the project.

---

### Task records

When a board member accepts a task, Moonbeam writes the task file, with its
handoff, review, and acceptance, into the repository as the permanent record.

A task file that appears in a working checkout while a run is in progress is a
read-only snapshot of the assignment. It is not the task's live state.

---

### Contracts

Contracts define required behavior.

They are the bridge between architecture and implementation.

Contracts should avoid prescribing unnecessary implementation details.

They exist so implementation can be objectively reviewed.

---

### Architectural Decision Records

Major technical decisions should be recorded.

An ADR explains:

* the decision
* why it was made
* alternatives considered
* consequences

This reduces repeated discussion and prevents architectural drift.

---

# AI Team

Roles are defined by responsibility, not by the model that fills them. Moonbeam
records which model worked each run and measures each model's outcomes per role,
so a role may be filled by different models over time. Role details are in
`docs/roles/`.

## Board

Responsibilities:

* owns the project
* defines priorities
* approves tasks
* approves architecture
* approves contracts
* chooses implementation order
* accepts or returns completed work

The board remains the orchestrator.

---

## Architect (Jarvis)

Primary role:

Senior software architect and planning partner.

Responsibilities:

* understand goals
* clarify requirements
* inspect repository context
* evaluate tradeoffs
* propose architecture
* identify risks
* decompose work
* recommend specialist agents
* prepare task proposals
* review specialist results with the board

The architect is primarily a design partner.

The architect does **not** automatically coordinate specialists or begin implementation.

---

## Contract Designer

Primary role:

Translate approved designs into precise behavioral contracts.

Responsibilities:

* define behavior
* identify ambiguities
* define invariants
* define interfaces
* define failure behavior
* prepare implementation contracts

The contract designer does not implement code.

---

## Implementer

Primary role:

Implementation specialist.

Responsibilities:

* implement approved contracts
* remain within the task's scope envelope
* preserve unrelated behavior
* pause rather than guess
* report changes
* report validation
* identify assumptions

The implementation agent should avoid making architectural decisions unless necessary and should report those decisions back to the board.

---

## UX Specialist

Primary role:

Frontend and user experience specialist.

Responsibilities:

* interaction design
* accessibility
* responsive behavior
* frontend implementation
* interface validation

The UX agent focuses on user-facing behavior rather than general backend implementation.

---

## Reviewer

Primary role:

Independent reviewer.

Responsibilities:

* verify contract compliance
* review implementation quality
* identify regressions
* identify security issues
* assess testing
* verify acceptance criteria

The reviewer does not implement fixes and does not accept work. Review findings
always go to a human.

---

# Development Workflow

A typical feature follows this lifecycle. Task states and transition authority
are defined in `docs/workflow/lifecycle.md`.

## Phase 1

The board and the architect explore the problem.

Outputs:

* clarified goals
* architectural direction
* implementation strategy

---

## Phase 2

The architect divides work into independently reviewable tasks and proposes
them in Moonbeam.

Outputs:

* task descriptions
* scope envelopes
* dependencies
* acceptance criteria
* recommended specialist

A board member approves each task before it can be worked.

---

## Phase 3

Where appropriate, the Contract Designer produces a behavioral contract.

The board reviews and approves the contract.

---

## Phase 4

A specialist claims and implements the approved task.

Implementation remains within the task's scope envelope. The specialist may
split the task into subtasks within that envelope and pauses to ask when it
needs a human answer.

---

## Phase 5

The reviewer evaluates:

* correctness
* contract compliance
* regressions
* testing
* maintainability

Each subtask receives its own independent review.

---

## Phase 6

A board member decides whether:

* work is accepted
* revisions are needed
* architecture should change
* documentation should be updated

---

# Philosophy

The system intentionally favors:

* explicit decisions
* small focused tasks
* measurable acceptance criteria
* independent review
* maintainable architecture
* human oversight

over:

* autonomous execution
* hidden assumptions
* oversized implementation tasks
* undocumented architectural changes

The goal is not to remove the human from software development.

The goal is to give the board an engineering team whose members are highly specialized, predictable, and continuously improving.

---

# Long-Term Vision

This development system should become increasingly capable without becoming increasingly autonomous.

New specialist agents may be added over time, including areas such as:

* database design
* security
* DevOps
* documentation
* testing
* performance
* API design

Each new specialist should have a single, clearly defined responsibility.

Project knowledge should continue to accumulate in documentation rather than conversations.

The repository should become the authoritative record of why the system exists, how it is designed, and how future work should proceed.
