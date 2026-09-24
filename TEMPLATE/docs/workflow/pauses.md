# Pauses

A pause is a run stopping to ask a human a question. Moonbeam records every
pause with a category and a resolution, and the task carries the `paused`
condition until the question is answered.

Pausing is the correct response to material uncertainty. Guessing, silently
choosing an interpretation, or widening scope to get around a gap are not.

## When to pause

Pause when you cannot continue correctly without a human answer, for example
when:

- the task, contract, or project documentation does not say what is required
- two approved sources conflict
- the work needs a decision reserved for the board (architecture, product
  behavior, tradeoffs, priorities)
- you lack access or an environment you need
- you are unsure whether something is inside the scope envelope

Do not pause for questions you can answer from the repository, the task, or its
linked contracts and ADRs. Read first.

If the problem is something outside the task that must be resolved before work
can continue (an unfinished dependency, for example), the task is blocked rather
than paused. See `lifecycle.md`.

## How to ask

1. **Stop** at the point of uncertainty. Do not continue work that depends on
   the answer.
2. **Choose one category** from the list below.
3. **Write the question** so a board member can answer it without reading your
   transcript:
   - **Category:** one of the categories below.
   - **Question:** one clear question. Ask separate questions separately.
   - **Context:** what you were doing, and the sources you checked (file and
     section) that did not answer it.
   - **Options:** the reasonable answers you see and the consequence of each.
   - **Recommendation:** your preferred option, if any, labelled as a
     recommendation, not a decision.
   - **Effect:** what is waiting on the answer.
4. **Submit it** through the pause mechanism Moonbeam provides for your run. If
   no such mechanism is available to you, stop and put the question, in the
   format above, in your final output so a human sees it.
5. **Resume** only when the pause is resolved. Record in your handoff any
   pause resolution that changed how you interpreted the task.

## Pause categories

Each category points to where the missing knowledge should have been, so that
pause review can close the gap up front.

| Category | Use when | Usually closed by improving |
| --- | --- | --- |
| Missing requirement | Required behavior or an acceptance criterion is absent. | The task's desired outcome and acceptance criteria. |
| Ambiguous contract | A linked contract allows more than one reasonable reading, or contradicts another source. | The contract. |
| Environment / access | You lack a tool, credential, service, data, or environment needed to do or validate the work. | `docs/DEVELOPMENT.md` and runner setup. |
| Human-judgment decision | The answer is a product, architecture, priority, or tradeoff decision reserved for the board. | An ADR, `docs/PROJECT.md`, or the task's context. |
| Scope question | You cannot tell whether something is inside the task's scope envelope. | The task's scope envelope. |

If a question fits more than one category, choose the one whose fix would have
prevented the pause.

## Pause review

The board periodically reviews pauses to find questions that could have been
answered before the run started, and updates templates, contracts, and project
guidance so the same gap does not recur. Fewer pauses per task over time is the
goal.

## Open questions

These are not yet decided by the Moonbeam board.

- The exact mechanism by which an agent raises a pause and receives the answer.
- Whether a run may continue with work that does not depend on the answer while
  a pause is open.
- Whether a pause resolution may widen a task's scope envelope. Until decided,
  treat work outside the envelope as requiring a new or amended task approved by
  the board.
- Whether the pause category list above is final.
