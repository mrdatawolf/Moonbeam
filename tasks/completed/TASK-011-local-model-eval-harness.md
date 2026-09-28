# TASK-011: Local model evaluation harness (optional, early)

Owner role: Implementer
Assigned agent: implementer (Claude)
Proposed by: Claude (planning session)
Proposed date: 2026-09-24
Approved by: Patrick
Approved date: 2026-09-24
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

Task: TASK-011
Implementer: implementer (Claude)
Date: 2026-09-24

### Changes made

All new, all under `tools/model-eval/`. No root files, workspace config,
`packages/`, `server/`, `ui/`, or `docs/` were touched.

- `tools/model-eval/eval.mjs`: the CLI. It reads the model id from
  `/v1/models`, runs the four jobs at temperature 0 with a fixed seed, and
  writes `results/<timestamp>_<model>.json`. It also prints per-case lines and
  a summary table. The endpoint comes from `--endpoint` or
  `MODEL_EVAL_ENDPOINT`. Other flags: `--model`, `--api-key`, `--jobs`,
  `--case`, `--timeout`, `--seed`, `--repeat`, `--no-llamacpp-extras`,
  `--out`, `--label`, `--no-save`.
- `tools/model-eval/lib/client.mjs`: a minimal OpenAI-compatible client using
  global fetch. It records latency, `usage`, llama.cpp `timings`, and
  `finish_reason`. Errors and timeouts are returned, not thrown.
- `tools/model-eval/lib/prompts.mjs`: prompts for the four jobs.
- `tools/model-eval/lib/scoring.mjs`: the mechanical scorers and the diff and
  scope-envelope helpers.
- `tools/model-eval/fixtures/{summarize,categorize,handoff,scope}/`: the
  `cases.json` files plus the `.log`/`.diff` inputs. There are 4 summarize
  cases, 10 categorize cases (two per pause category), 3 handoff cases, and 5
  scope cases.
- `tools/model-eval/test/scoring.test.mjs`: offline `node:test` tests. They
  cover fixture integrity (scope expectations are recomputed from the diffs,
  and handoff file lists equal the diff file lists), confirm that reference
  answers score 1.0, and check the parser edge cases.
- `tools/model-eval/README.md`: usage, the results format, the determinism
  note, and the full rubric.
- `tools/model-eval/results/2026-09-24T20-19-01-116Z_sugatoray_DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M-GGUF.json`:
  the example validation run, ready to commit.

### Validation performed

- `node --test tools/model-eval/test/*.test.mjs`: 8/8 pass.
- CLI error paths: a missing endpoint exits 2 with usage, and an unreachable
  endpoint exits 1 with a message. A forced 2 s timeout was reported as
  `TIMEOUT` and counted in the summary's `timeouts` column.
- Full run against `http://192.168.203.117:8080`
  (`sugatoray/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M-GGUF`, n_ctx 18944) with
  `--repeat 2`. Every case produced byte-identical output on both attempts.

| Job | Cases | Pass | Mean score | Mean latency | Errors / timeouts |
| --- | --- | --- | --- | --- | --- |
| summarize | 4 | 1 | 0.75 | 9.2 s | 0 / 0 |
| categorize | 10 | 10 | 1.00 | 2.3 s | 0 / 0 |
| handoff | 3 | 0 | 0.82 | 19.3 s | 0 / 0 |
| scope | 5 | 1 | 0.20 | 3.9 s | 0 / 0 |

Observations:

- **Scope:** the model answered `{"in_scope": true, "out_of_scope": []}` for
  every case. It passes only the all-in-scope case, so it cannot do this job.
- **Handoff:** the model never mentioned the task id and sometimes missed a
  case fact. It also invented a deviation in `handoff-run-branches`, which
  the rubric cannot detect.
- **Summarize:** the model tends to omit concrete details such as the cost,
  the endpoint, and the attempt count.
- **Categorize:** 10/10 with the cache disabled. With llama.cpp's prompt cache
  on, it scored 8/10 and 9/10 on earlier runs.

### Acceptance criteria evidence

- [x] Runs against the test endpoint and produces a results file with a score
  per job. See the results file above: `summary[]` has a per-job score, and
  `results[]` has a per-case score, checks, latency, tokens, and raw output.

### Assumptions and deviations

- **Determinism:** temperature 0 alone was not reproducible on llama.cpp. With
  the default prompt cache, 4 of 22 case scores changed between two
  back-to-back runs. The harness therefore sends `cache_prompt: false` by
  default, which is llama.cpp-only. `--no-llamacpp-extras` omits it for strict
  servers. As a result, the latencies are cold-prefill numbers.
- **Added flag:** `--repeat` was added to measure variance. It was not in the
  brief.
- **Pass threshold:** a case "passes" only at score 1.0. Mean scores are
  reported alongside.
- **Prompt change:** before the recorded run, the summarize prompt was changed
  to ask explicitly for the task id. The earlier "which task it was" wording
  did not match the rubric. Earlier exploratory results were deleted.
- **Summarize length limit:** the prompt asks for at most 100 words, while the
  rubric allows 120 or 150. The rubric is intentionally lenient.

### Unresolved risks

- The rubric is keyword-based. It rewards mentioning facts, not stating them
  correctly, and it cannot catch invented content outside the forbidden list.
  Forbidden-phrase checks can fire on borderline wording. For example,
  "completed the dashboard components" on a paused run cost
  `summarize-paused-scope` one check.
- The fixture set is small (22 cases). A single case moves a job's score
  substantially.
- Latency depends on whatever else the LAN host is doing. Earlier runs with
  the cache on showed handoff latency between 20 s and 44 s.
- Fixture or prompt edits make results incomparable with earlier files.
  Nothing versions the fixture set yet beyond `--label`.

### Documentation updated

- `tools/model-eval/README.md` (new).

## Review

Not reviewed.
