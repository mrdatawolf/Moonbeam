#!/usr/bin/env node
// Moonbeam local model eval harness (TASK-011).
// Scores an OpenAI-compatible endpoint on Moonbeam-shaped jobs with fixed fixtures
// and mechanical scoring. See README.md for usage and the rubric.

import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

import { ChatClient } from './lib/client.mjs';
import { summarizePrompt, categorizePrompt, handoffPrompt, scopePrompt } from './lib/prompts.mjs';
import { scoreSummary, scoreCategory, scoreHandoff, scoreScope } from './lib/scoring.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const ALL_JOBS = ['summarize', 'categorize', 'handoff', 'scope'];
const PASS_THRESHOLD = 1; // a case "passes" only with a perfect score; the score itself is reported too

const HELP = `Usage: node eval.mjs [options]

Options:
  --endpoint <url>    OpenAI-compatible base URL (env MODEL_EVAL_ENDPOINT). Required.
  --model <id>        Model id to send (env MODEL_EVAL_MODEL). Default: first id from /v1/models.
  --api-key <key>     Bearer token, if the server needs one (env MODEL_EVAL_API_KEY).
  --jobs <list>       Comma-separated subset of: ${ALL_JOBS.join(', ')}. Default: all.
  --case <substr>     Only run cases whose id contains this substring.
  --timeout <sec>     Per-request timeout in seconds (default 180).
  --seed <n>          Sampling seed sent with every request (default 42).
  --out <dir>         Results directory (default: ./results next to this script).
  --repeat <n>        Run every case n times (default 1) to measure run-to-run variance.
  --no-llamacpp-extras  Do not send llama.cpp-only fields (cache_prompt:false). Use for
                      strict OpenAI-compatible servers; output may then vary between runs.
  --label <text>      Free-text label stored in the results file (e.g. hardware notes).
  --no-save           Print the summary but do not write a results file.
  -h, --help          Show this help.`;

// ---------------------------------------------------------------------------
// Job definitions: build the prompt and score the output for one case.

const JOBS = {
  async summarize(c) {
    const log = await readFile(join(FIXTURES, 'summarize', c.input), 'utf8');
    return {
      messages: summarizePrompt(log),
      score: (text) => scoreSummary(text, c.rubric),
    };
  },
  async categorize(c) {
    return {
      messages: categorizePrompt(c.pause),
      score: (text) => scoreCategory(text, c.expected),
    };
  },
  async handoff(c) {
    const diff = await readFile(join(FIXTURES, 'handoff', c.diff), 'utf8');
    return {
      messages: handoffPrompt({ taskId: c.taskId, taskTitle: c.taskTitle, diff, validation: c.validation }),
      score: (text) => scoreHandoff(text, { ...c.rubric, taskId: c.taskId }),
    };
  },
  async scope(c) {
    const diff = await readFile(join(FIXTURES, 'scope', c.diff), 'utf8');
    return {
      messages: scopePrompt({ taskId: c.taskId, envelope: c.envelope, diff }),
      score: (text) => scoreScope(text, c.expected),
    };
  },
};

async function loadJob(job) {
  return JSON.parse(await readFile(join(FIXTURES, job, 'cases.json'), 'utf8'));
}

// ---------------------------------------------------------------------------

function fmtMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function summarizeJob(job, cases) {
  const scores = cases.map((c) => c.score);
  // Cases whose score differed between attempts (only meaningful with --repeat > 1).
  const byId = new Map();
  for (const c of cases) byId.set(c.id, [...(byId.get(c.id) ?? []), c.score]);
  const unstable = [...byId].filter(([, s]) => new Set(s).size > 1).map(([id]) => id);
  const ok = cases.filter((c) => !c.error);
  return {
    job,
    cases: cases.length,
    meanScore: Number(mean(scores).toFixed(3)),
    passed: cases.filter((c) => c.pass).length,
    errors: cases.filter((c) => c.error && !c.timedOut).length,
    timeouts: cases.filter((c) => c.timedOut).length,
    meanLatencyMs: Math.round(mean(ok.map((c) => c.latencyMs))),
    promptTokens: ok.reduce((a, c) => a + (c.usage?.prompt_tokens ?? 0), 0),
    completionTokens: ok.reduce((a, c) => a + (c.usage?.completion_tokens ?? 0), 0),
    unstableCases: unstable,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      endpoint: { type: 'string' },
      model: { type: 'string' },
      'api-key': { type: 'string' },
      jobs: { type: 'string' },
      case: { type: 'string' },
      timeout: { type: 'string' },
      seed: { type: 'string' },
      out: { type: 'string' },
      label: { type: 'string' },
      repeat: { type: 'string' },
      'no-llamacpp-extras': { type: 'boolean', default: false },
      'no-save': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }

  const endpoint = values.endpoint ?? process.env.MODEL_EVAL_ENDPOINT;
  if (!endpoint) {
    console.error('error: --endpoint (or MODEL_EVAL_ENDPOINT) is required\n');
    console.error(HELP);
    return 2;
  }
  const jobs = values.jobs ? values.jobs.split(',').map((j) => j.trim()).filter(Boolean) : ALL_JOBS;
  const unknown = jobs.filter((j) => !ALL_JOBS.includes(j));
  if (unknown.length) {
    console.error(`error: unknown job(s): ${unknown.join(', ')}. Known: ${ALL_JOBS.join(', ')}`);
    return 2;
  }
  const timeoutMs = Math.round(Number(values.timeout ?? 180) * 1000);
  const seed = Number(values.seed ?? 42);
  const repeat = Math.max(1, Math.floor(Number(values.repeat ?? 1)));
  const llamaCppExtras = !values['no-llamacpp-extras'];

  const client = new ChatClient({
    endpoint,
    apiKey: values['api-key'] ?? process.env.MODEL_EVAL_API_KEY ?? '',
    timeoutMs,
    seed,
    llamaCppExtras,
  });

  let models;
  try {
    models = await client.listModels();
  } catch (err) {
    console.error(`error: cannot list models at ${client.endpoint}: ${err?.cause?.message ?? err.message}`);
    return 1;
  }
  const requested = values.model ?? process.env.MODEL_EVAL_MODEL;
  const modelEntry = requested ? models.find((m) => m.id === requested) : models[0];
  if (!modelEntry && !requested) {
    console.error(`error: ${client.endpoint}/v1/models returned no models`);
    return 1;
  }
  client.model = modelEntry?.id ?? requested;

  const startedAt = new Date();
  console.log(`model-eval: ${client.endpoint}  model=${client.model}  jobs=${jobs.join(',')}`);
  if (modelEntry?.meta?.n_ctx) console.log(`  n_ctx=${modelEntry.meta.n_ctx}  n_params=${modelEntry.meta.n_params ?? '?'}`);

  const results = [];
  for (const job of jobs) {
    const spec = await loadJob(job);
    const cases = spec.cases.filter((c) => !values.case || c.id.includes(values.case));
    for (const c of cases) for (let attempt = 1; attempt <= repeat; attempt++) {
      const { messages, score } = await JOBS[job](c);
      const res = await client.chat(messages, { maxTokens: spec.maxTokens });
      const record = {
        job,
        id: c.id,
        attempt,
        latencyMs: res.latencyMs,
        usage: res.usage ?? null,
        timings: res.timings ?? null,
        finishReason: res.finishReason ?? null,
        score: 0,
        pass: false,
        checks: [],
        rawOutput: res.text ?? null,
      };
      if (res.error) {
        record.error = res.error;
        record.timedOut = res.timedOut;
      } else {
        const s = score(res.text);
        record.score = Number(s.score.toFixed(3));
        record.pass = s.score >= PASS_THRESHOLD;
        record.checks = s.checks;
        if ('parsed' in s) record.parsed = s.parsed;
        if ('lenientMatch' in s) record.lenientMatch = s.lenientMatch;
      }
      results.push(record);
      const status = record.error ? (record.timedOut ? 'TIMEOUT' : 'ERROR') : record.pass ? 'pass' : 'FAIL';
      const toks = record.usage ? `${record.usage.prompt_tokens}+${record.usage.completion_tokens} tok` : '- tok';
      console.log(
        `  [${job}] ${(repeat > 1 ? `${c.id}#${attempt}` : c.id).padEnd(30)} ${status.padEnd(7)} score=${record.score.toFixed(2)}  ${fmtMs(record.latencyMs).padStart(6)}  ${toks}` +
          (record.error ? `  (${record.error})` : ''),
      );
    }
  }

  const summary = jobs.map((job) => summarizeJob(job, results.filter((r) => r.job === job)));
  const finishedAt = new Date();

  console.log('\nSummary');
  if (repeat > 1) console.log(`  (each case run ${repeat} times; "cases" and "pass" count attempts)`);
  console.log('  job         cases  pass  mean score  errors  timeouts  mean latency  tokens (prompt+completion)');
  for (const s of summary) {
    console.log(
      `  ${s.job.padEnd(11)} ${String(s.cases).padStart(5)}  ${String(s.passed).padStart(4)}  ${s.meanScore.toFixed(2).padStart(10)}  ` +
        `${String(s.errors).padStart(6)}  ${String(s.timeouts).padStart(8)}  ${fmtMs(s.meanLatencyMs).padStart(12)}  ${s.promptTokens}+${s.completionTokens}`,
    );
  }

  const output = {
    tool: 'moonbeam-model-eval',
    version: 1,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    endpoint: client.endpoint,
    model: client.model,
    modelMeta: modelEntry?.meta ?? null,
    label: values.label ?? null,
    settings: { temperature: 0, top_p: 1, seed, timeoutMs, repeat, cachePrompt: llamaCppExtras ? false : 'server default', passThreshold: PASS_THRESHOLD },
    host: os.hostname(),
    summary,
    results,
  };

  if (!values['no-save']) {
    const outDir = values.out ?? join(HERE, 'results');
    await mkdir(outDir, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
    const safeModel = String(client.model).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60);
    const file = join(outDir, `${stamp}_${safeModel}.json`);
    await writeFile(file, JSON.stringify(output, null, 2) + '\n');
    console.log(`\nResults written to ${file}`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
