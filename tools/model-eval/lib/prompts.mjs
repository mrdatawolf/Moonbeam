// Prompt builders. Each returns an OpenAI-style messages array.
// Prompts state the output format explicitly so the mechanical scorers are fair.

import { PAUSE_CATEGORIES, HANDOFF_SECTIONS } from './scoring.mjs';

const SYSTEM =
  'You are an assistant working inside Moonbeam, a control plane for a software team that ' +
  'develops with AI agents under human governance. Follow the requested output format exactly.';

export function summarizePrompt(log) {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        'Summarize the following agent run log for a board member who did not watch the run. ' +
        'In at most 100 words, state: the task id (for example TASK-123), the final outcome, the key events, ' +
        'and anything that needs a human. Do not invent events that are not in the log.\n\n' +
        'Run log:\n```\n' + log.trimEnd() + '\n```',
    },
  ];
}

export function categorizePrompt(pause) {
  const table = [
    '- Missing requirement: required behavior or an acceptance criterion is absent. Usually closed by improving the task\'s desired outcome and acceptance criteria.',
    '- Ambiguous contract: a linked contract allows more than one reasonable reading, or contradicts another source. Usually closed by improving the contract.',
    '- Environment / access: the agent lacks a tool, credential, service, data, or environment needed to do or validate the work. Usually closed by improving docs/DEVELOPMENT.md and runner setup.',
    '- Human-judgment decision: the answer is a product, architecture, priority, or tradeoff decision reserved for the board. Usually closed by an ADR, docs/PROJECT.md, or the task\'s context.',
    '- Scope question: the agent cannot tell whether something is inside the task\'s scope envelope. Usually closed by improving the task\'s scope envelope.',
  ].join('\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        'An agent paused its run to ask the board a question. Classify the pause into exactly one ' +
        'of these five categories:\n\n' + table + '\n\n' +
        'If a question fits more than one category, choose the one whose fix would have prevented the pause.\n\n' +
        'Pause:\n"""\n' + pause + '\n"""\n\n' +
        'Answer with only the category name, exactly as written in this list, and nothing else:\n' +
        PAUSE_CATEGORIES.join('\n'),
    },
  ];
}

export function handoffPrompt({ taskId, taskTitle, diff, validation }) {
  const skeleton = HANDOFF_SECTIONS.map((s) => `## ${s}`).join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        `Draft the implementation handoff for ${taskId} (${taskTitle}) from the diff and validation notes below.\n\n` +
        'Use exactly these markdown headings, in this order:\n\n' + skeleton + '\n\n' +
        'Under "Changes made", list every changed file by its full path and say what changed in it. ' +
        'Under "Validation performed", report only the validation given below; do not claim anything else was run. ' +
        'Mention the task id. Be concise.\n\n' +
        'Validation notes:\n```\n' + validation + '\n```\n\n' +
        'Diff:\n```diff\n' + diff.trimEnd() + '\n```',
    },
  ];
}

export function scopePrompt({ taskId, envelope, diff }) {
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        `Task ${taskId} may only change files inside its scope envelope. The envelope paths are:\n` +
        envelope.map((p) => `- ${p}`).join('\n') + '\n\n' +
        'Rules: a path ending in "/" covers every file beneath that directory (and nothing else: ' +
        '"tools/a/" does not cover "tools/ab/x"). A path without a trailing "/" covers only that exact file. ' +
        'Every file the diff touches counts, including new, deleted, and renamed files (both the old and the new name of a rename).\n\n' +
        'Diff:\n```diff\n' + diff.trimEnd() + '\n```\n\n' +
        'Reply with only a JSON object, no prose, in this form:\n' +
        '{"in_scope": true or false, "out_of_scope": ["path/of/each/file/outside/the/envelope"]}\n' +
        'Use repository-relative paths without "a/" or "b/" prefixes. If every file is inside the envelope, ' +
        'use "in_scope": true and an empty list.',
    },
  ];
}
