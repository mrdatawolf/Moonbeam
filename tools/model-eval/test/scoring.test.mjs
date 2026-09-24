// Offline tests for the scorers and fixture integrity. Run: node --test tools/model-eval/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PAUSE_CATEGORIES,
  scoreSummary,
  scoreCategory,
  scoreHandoff,
  scoreScope,
  diffFiles,
  computeScope,
} from '../lib/scoring.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const load = async (job) => JSON.parse(await readFile(join(FIX, job, 'cases.json'), 'utf8'));
const byId = (spec, id) => spec.cases.find((c) => c.id === id);

// --- Fixture integrity -----------------------------------------------------

test('scope fixtures: expected answers match the mechanical path check', async () => {
  const spec = await load('scope');
  for (const c of spec.cases) {
    const diff = await readFile(join(FIX, 'scope', c.diff), 'utf8');
    assert.deepEqual(computeScope(diff, c.envelope), c.expected, c.id);
  }
});

test('handoff fixtures: rubric files are exactly the files in the diff', async () => {
  const spec = await load('handoff');
  for (const c of spec.cases) {
    const diff = await readFile(join(FIX, 'handoff', c.diff), 'utf8');
    assert.deepEqual([...c.rubric.files].sort(), diffFiles(diff), c.id);
  }
});

test('categorize fixtures: every expected value is a real category, all five covered', async () => {
  const spec = await load('categorize');
  for (const c of spec.cases) assert.ok(PAUSE_CATEGORIES.includes(c.expected), c.id);
  assert.equal(new Set(spec.cases.map((c) => c.expected)).size, 5);
});

// --- Reference answers: a correct output must be able to score 1.0 ---------

const REFERENCE_SUMMARIES = {
  'summarize-tests-failed':
    'TASK-006 implementer run r-4f1a failed: it hit the 15-minute wall-clock limit. It added task routes, transitions, and migration 0003_task_state.sql. Lint was clean. One test still fails: "claim is exclusive under concurrent requests" (409 expected). The agent was adding a partial unique index when time ran out. Needs a human to decide whether to rerun.',
  'summarize-paused-scope':
    'TASK-008 run r-77c2 is paused on a Scope question. It built DashboardPage and ProjectCard, then found the dashboard needs openPauseCount from GET /api/projects, which means editing server/src/routes/projects.ts outside its envelope. The board must answer whether that edit is allowed or the UI should fetch pauses separately.',
  'summarize-completed':
    'TASK-005 contract-architect run r-9b30 succeeded in 10m39s. It wrote CONTRACT-002 (identity) and indexed it in the contracts README; markdownlint was clean. The handoff is written and the task moved to in_review. Cost $0.92. Next: board review.',
  'summarize-endpoint-down':
    'TASK-012 QA run r-a1d4 errored before doing any work: the local model endpoint 192.168.203.118:8080 refused connections (ECONNREFUSED) and the runner gave up after 3 attempts. No review was performed; the task remains in in_review awaiting a reviewer. Someone should check the llama.cpp host.',
};

test('summarize: reference summaries score 1.0', async () => {
  const spec = await load('summarize');
  for (const c of spec.cases) {
    const r = scoreSummary(REFERENCE_SUMMARIES[c.id], c.rubric);
    assert.equal(r.score, 1, `${c.id}: ${JSON.stringify(r.checks.filter((x) => !x.pass))}`);
  }
});

test('summarize: forbidden claim and length are enforced', async () => {
  const spec = await load('summarize');
  const c = byId(spec, 'summarize-tests-failed');
  const r = scoreSummary('TASK-006 finished and all tests passed.', c.rubric);
  assert.equal(r.checks.find((x) => x.check === 'absent:claims-all-tests-pass').pass, false);
  const negated = scoreSummary('TASK-006: not all tests passed.', c.rubric);
  assert.equal(negated.checks.find((x) => x.check === 'absent:claims-all-tests-pass').pass, true);
  const long = scoreSummary('word '.repeat(200), c.rubric);
  assert.equal(long.checks.find((x) => x.check.startsWith('length')).pass, false);
});

test('categorize: strict parsing', () => {
  assert.equal(scoreCategory('Scope question', 'Scope question').score, 1);
  assert.equal(scoreCategory('**Environment/Access**', 'Environment / access').score, 1);
  assert.equal(scoreCategory('Category: Ambiguous contract.', 'Ambiguous contract').score, 1);
  assert.equal(scoreCategory('Human-judgment decision\nbecause it is architecture', 'Human-judgment decision').score, 1);
  assert.equal(scoreCategory('Missing requirement', 'Scope question').score, 0);
  const verbose = scoreCategory('This is a Scope question because...', 'Scope question');
  assert.equal(verbose.score, 0);
  assert.equal(verbose.lenientMatch, true);
});

test('handoff: reference handoff scores 1.0, missing heading loses a check', async () => {
  const spec = await load('handoff');
  const c = byId(spec, 'handoff-run-branches');
  const good = `# TASK-010 handoff

## Changes made
- packages/db/migrations/0004_run_branches.sql: adds branch_name, base_commit, merged_commit to runs (ADR-005) and backfills branch_name.
- packages/db/src/schema.ts: matching columns.

## Validation performed
Migrations applied on an empty database.

## Assumptions and deviations
None.

## Unresolved risks
Not run against a database with existing runs rows; the backfill is untested.`;
  assert.equal(scoreHandoff(good, { ...c.rubric, taskId: c.taskId }).score, 1);
  const noHeading = good.replace('## Unresolved risks', 'Unresolved risks:');
  assert.ok(scoreHandoff(noHeading, { ...c.rubric, taskId: c.taskId }).score < 1);
});

test('scope: JSON parsing and exact set match', () => {
  const expected = { in_scope: false, out_of_scope: ['package.json', 'pnpm-lock.yaml'] };
  assert.equal(scoreScope('```json\n{"in_scope": false, "out_of_scope": ["pnpm-lock.yaml", "b/package.json"]}\n```', expected).score, 1);
  assert.equal(scoreScope('{"in_scope": false, "out_of_scope": ["package.json"]}', expected).score, 0);
  assert.equal(scoreScope('{"in_scope": true, "out_of_scope": ["package.json", "pnpm-lock.yaml"]}', expected).score, 0);
  assert.equal(scoreScope('not json', expected).score, 0);
});
