# model-eval

A standalone CLI that scores an OpenAI-compatible endpoint (llama.cpp server
first, anything that speaks `/v1/models` and `/v1/chat/completions` should work)
on Moonbeam-shaped jobs. It answers: **can model X do job Y acceptably on our
hardware?** (TASK-011, ADR-002).

It has no dependencies. It needs Node 24 (global `fetch`, `node:test`,
`util.parseArgs`). It is not part of the pnpm workspace.

## Run it

```sh
# all jobs, model id taken from the first entry of /v1/models
node tools/model-eval/eval.mjs --endpoint http://192.168.203.117:8080

# or via environment
MODEL_EVAL_ENDPOINT=http://192.168.203.117:8080 node tools/model-eval/eval.mjs

# one job, one case, three repeats to check stability
node tools/model-eval/eval.mjs --endpoint http://host:8080 --jobs scope --case prefix --repeat 3
```

| Flag | Env | Default | Meaning |
| --- | --- | --- | --- |
| `--endpoint` | `MODEL_EVAL_ENDPOINT` | required | Base URL. A trailing `/v1` is stripped. |
| `--model` | `MODEL_EVAL_MODEL` | first `/v1/models` id | Model id sent with each request. |
| `--api-key` | `MODEL_EVAL_API_KEY` | none | Sent as `Authorization: Bearer`. |
| `--jobs` | | all | Comma list of `summarize,categorize,handoff,scope`. |
| `--case` | | all | Only case ids containing this substring. |
| `--timeout` | | 180 | Per-request timeout, seconds. A timeout scores 0 and is counted separately. |
| `--seed` | | 42 | Sampling seed. |
| `--repeat` | | 1 | Run each case n times. The summary lists cases whose score changed. |
| `--no-llamacpp-extras` | | off | Do not send `cache_prompt: false` (for strict OpenAI servers). |
| `--out` | | `tools/model-eval/results/` | Results directory. |
| `--label` | | none | Free text stored in the results file (hardware, quant, notes). |
| `--no-save` | | off | Console summary only. |

Offline tests of the scorers and fixtures (no endpoint needed):

```sh
node --test tools/model-eval/test/*.test.mjs
```

## What it records

Each run writes `results/<ISO timestamp>_<model>.json` containing:

- `endpoint`, `model`, and `modelMeta` (llama.cpp's `/v1/models` `meta`: n_ctx, n_params, size)
- `settings` (temperature 0, top_p 1, seed, timeout, repeat, cache_prompt)
- `summary`: per job, the case count, passes, mean score, errors, timeouts, mean
  latency, prompt and completion tokens, and `unstableCases`
- `results`: per case attempt, the `latencyMs` (wall clock for the whole request),
  `usage` (from the response), `timings` (llama.cpp's prefill/decode ms and
  tokens/s, when present), `finishReason`, `score` (0 to 1), `pass`, every
  individual `checks` entry with pass/fail, `rawOutput`, and `error`/`timedOut`

The console prints one line per case and a summary table.

## Determinism

Every request uses `temperature: 0`, `top_p: 1`, and a fixed seed. **That alone
is not enough on llama.cpp.** With the server's default prompt cache on,
repeated identical requests gave different outputs (during validation, 4 of
22 case scores changed between two back-to-back runs). Sending `cache_prompt: false` made
repeated requests identical in testing, so the harness sends it by default. The
cost is that every request does a full prefill, so the latency figures are
cold-prefill latencies. Use `--repeat` to check stability for a new model or
server.

## The jobs and the rubric

All scoring is mechanical: substring, regex, markdown structure, JSON parsing,
and exact set comparison. No model grades another model. The scorers live in
`lib/scoring.mjs`, the prompts in `lib/prompts.mjs`, and the fixtures in
`fixtures/<job>/`. A case **passes** only with a score of 1.0. The job's mean
score is also reported, because partial credit is informative for rubric jobs.

Text matching is case-insensitive. A rubric "fact" is a list of alternatives,
and it is met if any alternative matches. An alternative is a substring or, if
prefixed `re:`, a regex.

### 1. summarize: summarize a run log (rubric)

Input: a run log (`fixtures/summarize/*.log`). The prompt asks for at most 100
words stating the task id, outcome, key events, and anything needing a human.

Checks for each case (score = passed / total):

- **Facts**: 5 per case. For example: the task id, the outcome (failed, paused,
  succeeded, errored), the key cause (the time limit, the scope question, three
  refused connections), and case-specific details (the failing test, the cost,
  whether a review happened).
- **Forbidden claims**: pass if absent. These catch the summary contradicting
  the log, such as "all tests passed" on a failed run or "succeeded" on a
  paused run. Simple negations like "not completed" are excluded by
  lookbehind.
- **Length**: word count is between 1 and `maxWords` (120 or 150). The limit is
  deliberately looser than the 100 the prompt asks for.

Known limits: keyword checks reward mentioning a fact, not stating it
correctly. Forbidden-claim checks can also fire on a borderline phrasing. For
example, "the agent completed the dashboard components" on a paused run counts
as a completion claim. A summary can hit the keywords and still be muddled. They cannot
catch invented events that the forbidden list does not anticipate.

### 2. categorize: categorize a pause (exact match)

Input: a pause question in the `TEMPLATE/docs/workflow/pauses.md` format
(question, context, options, effect), without the category. There are ten
cases, two per category. The prompt gives the five categories with their
"use when" and "usually closed by" text.

Scoring: take the first non-empty line and strip markdown emphasis, quotes, a
trailing period, and an optional `Category:` prefix. It must equal a category
name (case-insensitive, spacing around `/` and `-` ignored). The score is 1 if
it is the expected category, else 0. Also recorded, but not scored:
`lenientMatch`, which is true if exactly one category name appears anywhere in
the output and it is the right one. This separates format failures from wrong
answers.

### 3. handoff: draft a handoff from a diff (rubric)

Input: a diff and validation notes. The prompt asks for the four body headings
of `docs/templates/implementation-report.md` as `##` headings.

Checks (score = passed / total):

- Each of `Changes made`, `Validation performed`, `Assumptions and deviations`,
  and `Unresolved risks` appears as a markdown heading line (`#`..`######`).
- Every file in the diff is mentioned by its full repository path. The fixture
  test asserts that the rubric's file list equals the diff's file list.
- The task id (for example `TASK-006`) is mentioned.
- Two case-specific facts, such as the 403/human-only accept rule, the
  untested-backfill risk, and ADR-005.

Known limits: the rubric checks presence, not truth. A handoff can include
every required element and still claim a false deviation. The validation run
has one example of this.

### 4. scope: check a diff against a scope envelope (exact match)

Input: a task's envelope paths and a diff. The rules match the harness's own
`pathInEnvelope`: a path ending in `/` is a directory prefix, and any other
path is an exact file. Every touched file counts, including new files,
deletions, and both sides of a rename. The model must reply with JSON
`{"in_scope": bool, "out_of_scope": [paths]}`. Code fences and surrounding
prose are tolerated.

Scoring: 1 only if `in_scope` matches **and** the set of out-of-scope paths
matches exactly. Order does not matter, and `a/`, `b/`, and `./` prefixes are
stripped. Anything else, including invalid JSON, scores 0. The expected
answers are not hand-maintained guesses: the fixture test recomputes them from
the diff with `computeScope`. The cases cover all-in-scope, one file out, the
prefix trap (`tools/model-eval-extras/` vs `tools/model-eval/`), a rename out of
the envelope plus an in-envelope deletion, and root files (`package.json`,
lockfile) next to an exact-file envelope entry.

## Adding cases

Add an entry to `fixtures/<job>/cases.json` (plus any `.log`/`.diff` file it
names), then run the offline tests. They check that scope expectations match
the mechanical path check, that handoff file lists match their diffs, and that
the reference answers still score 1.0. Changing a prompt or fixture makes
earlier results incomparable. Note it in `--label`.
