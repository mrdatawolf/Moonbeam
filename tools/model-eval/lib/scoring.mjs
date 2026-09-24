// Mechanical scorers for the model-eval jobs. No model judges another model here:
// every score is computed from keyword, regex, structure, or exact-match checks.
// The rubric is documented in ../README.md; keep the two in sync.

export const PAUSE_CATEGORIES = [
  'Missing requirement',
  'Ambiguous contract',
  'Environment / access',
  'Human-judgment decision',
  'Scope question',
];

// ---------------------------------------------------------------------------
// Shared helpers

/** Remove <think>...</think> reasoning blocks some models emit. */
export function stripThink(text) {
  return String(text ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

export function wordCount(text) {
  const t = String(text ?? '').trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * A "fact" is a list of alternatives. Each alternative is either a plain string
 * (case-insensitive substring match) or "re:<pattern>" (case-insensitive regex).
 */
export function matchAlternative(text, alt) {
  if (alt.startsWith('re:')) return new RegExp(alt.slice(3), 'i').test(text);
  return text.toLowerCase().includes(alt.toLowerCase());
}

export function matchFact(text, alternatives) {
  return alternatives.some((alt) => matchAlternative(text, alt));
}

function ratio(checks) {
  if (checks.length === 0) return 0;
  return checks.filter((c) => c.pass).length / checks.length;
}

// ---------------------------------------------------------------------------
// Job 1: summarize a run log (rubric)

/**
 * rubric: { facts: [{ id, any: [alt...] }], forbidden: [{ id, any: [alt...] }], maxWords }
 * Score = passed checks / total checks, where checks are one per fact, one per
 * forbidden claim (pass = absent), and one length check.
 */
export function scoreSummary(output, rubric) {
  const text = stripThink(output);
  const checks = [];
  for (const fact of rubric.facts) {
    checks.push({ check: `mentions:${fact.id}`, pass: matchFact(text, fact.any) });
  }
  for (const bad of rubric.forbidden ?? []) {
    checks.push({ check: `absent:${bad.id}`, pass: !matchFact(text, bad.any) });
  }
  const words = wordCount(text);
  checks.push({ check: `length<=${rubric.maxWords}w`, pass: words > 0 && words <= rubric.maxWords, detail: `${words} words` });
  return { score: ratio(checks), checks };
}

// ---------------------------------------------------------------------------
// Job 2: categorize a pause (exact match)

function normCategory(s) {
  return String(s)
    .toLowerCase()
    .replace(/[`*_"'.:]/g, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strict: the first non-empty line of the output, after stripping markdown
 * emphasis, quotes, a trailing period, and an optional "Category:" prefix, must
 * equal a category name (case-insensitive, whitespace around "/" and "-"
 * ignored). Score is 1 if that category is the expected one, else 0.
 * Lenient (informational only, not scored): exactly one category name appears
 * anywhere in the output and it is the expected one.
 */
export function scoreCategory(output, expected) {
  const text = stripThink(output);
  const firstLine = (text.split('\n').find((l) => l.trim()) ?? '')
    .replace(/^\s*(?:[-*#>]+\s*)?/, '')
    .replace(/^\**\s*category\s*\**\s*:\s*/i, '');
  const answer = normCategory(firstLine);
  const byNorm = new Map(PAUSE_CATEGORIES.map((c) => [normCategory(c), c]));
  const parsed = byNorm.get(answer) ?? null;

  const lowered = normCategory(text);
  const mentioned = PAUSE_CATEGORIES.filter((c) => lowered.includes(normCategory(c)));
  const lenient = mentioned.length === 1 && mentioned[0] === expected;

  const pass = parsed === expected;
  return {
    score: pass ? 1 : 0,
    checks: [{ check: 'exact-category', pass, detail: `parsed=${parsed ?? 'unparseable'} expected=${expected}` }],
    parsed,
    lenientMatch: lenient,
  };
}

// ---------------------------------------------------------------------------
// Diff helpers (used by jobs 3 and 4 and by the fixture self-check)

/**
 * Return every file path a unified git diff touches. For renames both the old
 * and the new path are returned; /dev/null is ignored.
 */
export function diffFiles(diff) {
  const files = new Set();
  for (const line of String(diff).split('\n')) {
    let m;
    if ((m = line.match(/^diff --git a\/(\S+) b\/(\S+)$/))) {
      files.add(m[1]);
      files.add(m[2]);
    } else if ((m = line.match(/^(?:---|\+\+\+) (?:a|b)\/(\S+)/))) {
      files.add(m[1]);
    } else if ((m = line.match(/^rename (?:from|to) (\S+)$/))) {
      files.add(m[1]);
    }
  }
  return [...files].sort();
}

/**
 * A scope envelope path is either a directory prefix ending in "/" (matches
 * anything beneath it) or an exact file path.
 */
export function pathInEnvelope(file, envelope) {
  return envelope.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));
}

export function computeScope(diff, envelope) {
  const outOfScope = diffFiles(diff).filter((f) => !pathInEnvelope(f, envelope));
  return { in_scope: outOfScope.length === 0, out_of_scope: outOfScope };
}

// ---------------------------------------------------------------------------
// Job 3: draft a handoff from a diff (rubric)

export const HANDOFF_SECTIONS = [
  'Changes made',
  'Validation performed',
  'Assumptions and deviations',
  'Unresolved risks',
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * rubric: { files: [path...], taskId, facts?: [{id, any}] }
 * Checks: each required section present as a markdown heading line
 * ("#".."######" then the section name, case-insensitive); each changed file
 * mentioned by full path; the task id mentioned; plus optional case facts.
 * Score = passed checks / total checks.
 */
export function scoreHandoff(output, rubric) {
  const text = stripThink(output);
  const checks = [];
  for (const section of HANDOFF_SECTIONS) {
    const re = new RegExp(`^\\s*#{1,6}\\s*${escapeRe(section)}\\b`, 'im');
    checks.push({ check: `section:${section}`, pass: re.test(text) });
  }
  for (const file of rubric.files) {
    checks.push({ check: `file:${file}`, pass: text.includes(file) });
  }
  if (rubric.taskId) {
    checks.push({ check: `task-id:${rubric.taskId}`, pass: text.includes(rubric.taskId) });
  }
  for (const fact of rubric.facts ?? []) {
    checks.push({ check: `mentions:${fact.id}`, pass: matchFact(text, fact.any) });
  }
  return { score: ratio(checks), checks };
}

// ---------------------------------------------------------------------------
// Job 4: check a diff against a scope envelope (exact match)

function normPath(p) {
  return String(p).trim().replace(/^["'`]|["'`]$/g, '').replace(/^(?:a|b)\//, '').replace(/^\.\//, '');
}

/** Pull the first JSON object out of the output (tolerates code fences and prose). */
export function extractJson(text) {
  const t = stripThink(text);
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end > start) candidates.push(t.slice(start, end + 1));
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Expected answer: { in_scope: bool, out_of_scope: [path...] }.
 * The model must return JSON { "in_scope": bool, "out_of_scope": [paths] }.
 * Score is 1 only if in_scope matches AND the out_of_scope set matches exactly
 * (order-insensitive, "a/"/"b/"/"./" prefixes stripped). Otherwise 0.
 */
export function scoreScope(output, expected) {
  const parsed = extractJson(output);
  if (!parsed || typeof parsed !== 'object') {
    return { score: 0, checks: [{ check: 'valid-json', pass: false }], parsed: null };
  }
  const gotList = Array.isArray(parsed.out_of_scope) ? [...new Set(parsed.out_of_scope.map(normPath))].sort() : null;
  const expList = [...expected.out_of_scope].sort();
  const flagPass = parsed.in_scope === expected.in_scope;
  const listPass = gotList !== null && JSON.stringify(gotList) === JSON.stringify(expList);
  const checks = [
    { check: 'valid-json', pass: true },
    { check: 'in_scope', pass: flagPass, detail: `got=${parsed.in_scope} expected=${expected.in_scope}` },
    { check: 'out_of_scope-set', pass: listPass, detail: `got=${JSON.stringify(gotList)} expected=${JSON.stringify(expList)}` },
  ];
  return { score: flagPass && listPass ? 1 : 0, checks, parsed };
}
