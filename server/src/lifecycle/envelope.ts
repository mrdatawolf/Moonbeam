// Scope envelopes and the narrowing rules the server can check
// (CONTRACT-001 "Scope envelope").
import type { ScopeEnvelopeRecord } from "@moonbeam/db";
import { checkPath, checkPaths, pathWithin } from "./paths.js";

export interface EnvelopeTexts {
  inclusions: string[];
  exclusions: string[];
  constraints: string[];
  contracts: string[];
  paths: string[];
}

/** Build a top-level envelope. Inclusions are keyed I1, I2, ... */
export function buildTopLevelEnvelope(input: EnvelopeTexts): { ok: true; envelope: ScopeEnvelopeRecord } | { ok: false; reasons: string[] } {
  const paths = checkPaths(input.paths);
  if (!paths.ok) return { ok: false, reasons: paths.reasons.map((r) => `envelope.paths: ${r}`) };
  return {
    ok: true,
    envelope: {
      inclusions: input.inclusions.map((text, i) => ({ key: `I${i + 1}`, text, derivedFrom: null })),
      exclusions: [...input.exclusions],
      constraints: [...input.constraints],
      contracts: [...input.contracts],
      paths: paths.paths,
    },
  };
}

export interface SubtaskEnvelopeInput {
  inclusions: { text: string; derivedFrom: string }[];
  exclusions: string[];
  constraints: string[];
  contracts: string[];
  paths: string[];
}

/**
 * Check a subtask envelope against its parent's and build it. The structural
 * rules: every parent exclusion, constraint and contract present; no contract
 * added; every inclusion derived from a named parent inclusion; every path
 * within a parent path; no globs.
 */
export function buildSubtaskEnvelope(
  parent: ScopeEnvelopeRecord,
  input: SubtaskEnvelopeInput,
  label: string,
): { ok: true; envelope: ScopeEnvelopeRecord } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  for (const e of parent.exclusions) {
    if (!input.exclusions.includes(e)) reasons.push(`${label}: missing parent exclusion "${e}"`);
  }
  for (const c of parent.constraints) {
    if (!input.constraints.includes(c)) reasons.push(`${label}: missing parent constraint "${c}"`);
  }
  for (const c of parent.contracts) {
    if (!input.contracts.includes(c)) reasons.push(`${label}: missing parent contract "${c}"`);
  }
  for (const c of input.contracts) {
    if (!parent.contracts.includes(c)) reasons.push(`${label}: adds contract "${c}", which the parent does not link`);
  }
  const parentKeys = new Set(parent.inclusions.map((i) => i.key));
  for (const inc of input.inclusions) {
    if (!parentKeys.has(inc.derivedFrom)) {
      reasons.push(`${label}: inclusion "${inc.text}" does not derive from a parent inclusion (got "${inc.derivedFrom}")`);
    }
  }
  const paths: string[] = [];
  for (const raw of input.paths) {
    const r = checkPath(raw);
    if (!r.ok) reasons.push(`${label}: ${r.reason}`);
    else if (!parent.paths.some((pp) => pathWithin(r.path, pp))) {
      reasons.push(`${label}: path "${r.path}" is outside the parent's paths`);
    } else if (!paths.includes(r.path)) paths.push(r.path);
  }
  if (reasons.length) return { ok: false, reasons };
  return {
    ok: true,
    envelope: {
      inclusions: input.inclusions.map((inc, i) => ({ key: `I${i + 1}`, text: inc.text, derivedFrom: inc.derivedFrom })),
      exclusions: [...input.exclusions],
      constraints: [...input.constraints],
      contracts: [...input.contracts],
      paths,
    },
  };
}
