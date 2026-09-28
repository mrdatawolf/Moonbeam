// CONTRACT-005 validation item 14: invariants checked after every step of a
// randomized (seeded) sequence of actions by humans and agent runs.
import { asc } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { schema } from "@moonbeam/db";
import { approvedTask, handoffBody, startRun, subtask, world, type As, type World } from "./harness.js";

let w: World;
afterEach(async () => w?.h.close());

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HUMAN_GATED = new Set(["approved", "accepted", "returned", "queue_reordered"]);

async function checkInvariants(previous: Map<string, string>, fixedContent: Map<string, unknown>) {
  const db = w.h.db;
  const tasks = await db.select().from(schema.tasks);
  const claims = (await db.select().from(schema.claims)).filter((c) => c.endedAt === null);
  const audit = await db.select().from(schema.auditRecords).orderBy(asc(schema.auditRecords.id));
  const reviews = await db.select().from(schema.reviews);
  const handoffs = await db.select().from(schema.handoffs);
  const done = (s: string) => s === "completed" || s === "cancelled";

  for (const t of tasks) {
    const subs = tasks.filter((s) => s.parentId === t.id);
    const tc = claims.filter((c) => c.taskId === t.id);
    // I23: once approved, content is immutable; every edit is proposed -> proposed.
    const content = { title: t.title, desiredOutcome: t.desiredOutcome, acceptanceCriteria: t.acceptanceCriteria, envelope: t.envelope };
    if (fixedContent.has(t.id)) expect(content, `I23 #${t.number}`).toEqual(fixedContent.get(t.id));
    if (t.approvedAt && !fixedContent.has(t.id)) fixedContent.set(t.id, content);
    for (const a of audit.filter((a) => a.taskId === t.id && a.action === "edited")) {
      expect(a).toMatchObject({ fromState: "proposed", toState: "proposed", rejected: false });
      expect(Object.keys((a.details as { changes: object }).changes).length).toBeGreaterThan(0);
    }
    // I4 claim exclusivity
    expect(tc.length, `I4 at most one claim #${t.number}`).toBeLessThanOrEqual(1);
    if (subs.length === 0) {
      expect(t.state === "in_progress", `I4 leaf #${t.number}`).toBe(tc.length === 1);
    } else if (t.state === "in_progress") {
      const ok = (tc.length === 0 && subs.some((s) => !done(s.state))) || (tc.length === 1 && subs.every((s) => done(s.state)));
      expect(ok, `I4 split parent #${t.number}`).toBe(true);
    } else {
      expect(tc.length, `I4 no claim outside in_progress #${t.number}`).toBe(0);
    }
    // I8 subtasks are born approved
    if (t.parentId) expect(t.state).not.toBe("proposed");
    // I9: by subtasks requires a completion; by handoff requires all cancelled.
    if (subs.length && t.state === "in_review") {
      expect(subs.every((s) => done(s.state)), `I9 #${t.number}`).toBe(true);
      if (t.enteredReviewBy === "subtasks") expect(subs.some((s) => s.state === "completed")).toBe(true);
      else expect(subs.every((s) => s.state === "cancelled")).toBe(true);
    }
    // I10 parent completion
    if (done(t.state)) expect(subs.every((s) => done(s.state)), `I10 #${t.number}`).toBe(true);
    // I12 terminal finality
    const prev = previous.get(t.id);
    if (prev && done(prev)) expect(t.state, `I12 #${t.number}`).toBe(prev);
    previous.set(t.id, t.state);
    // I15 state equals the to-state of the latest state-changing record
    const changes = audit.filter((a) => a.taskId === t.id && !a.rejected && a.toState !== null && a.fromState !== a.toState);
    expect(changes.at(-1)?.toState, `I15 #${t.number}`).toBe(t.state);
    // I3 approval lineage
    if (t.state !== "proposed" && !(t.state === "cancelled" && t.approvedAt === null)) {
      const lineage = audit.some(
        (a) => a.taskId === t.id && !a.rejected && ((a.action === "approved" && a.actorKind === "human") || a.action === "auto_approved"),
      );
      expect(lineage, `I3 #${t.number}`).toBe(true);
    }
    // I6 acceptance
    if (t.state === "completed" && t.parentId === null) {
      expect(audit.some((a) => a.taskId === t.id && a.action === "accepted" && a.actorKind === "human")).toBe(true);
    }
    if (t.parentId) expect(audit.some((a) => a.taskId === t.id && a.action === "accepted")).toBe(false);
    // I7 subtask review by someone other than the implementing run
    if (t.parentId && t.state === "completed") {
      const h = handoffs.find((x) => x.id === t.latestHandoffId);
      const r = reviews.filter((x) => x.taskId === t.id && x.handoffId === t.latestHandoffId);
      expect(r.length, `I7 #${t.number}`).toBeGreaterThan(0);
      for (const x of r) expect(x.reviewerRunId).not.toBe(h?.runId);
    }
  }
  // I5 one task per run
  const runs = claims.filter((c) => c.runId).map((c) => c.runId);
  expect(new Set(runs).size).toBe(runs.length);
  // I2 human gates
  for (const a of audit) if (HUMAN_GATED.has(a.action) && !a.rejected) expect(a.actorKind).toBe("human");
  // I19 queue and sibling order are total orders
  const queue = tasks.filter((t) => t.parentId === null && t.queuePosition !== null).map((t) => t.queuePosition);
  expect(new Set(queue).size).toBe(queue.length);
  for (const p of tasks) {
    const sib = tasks.filter((t) => t.parentId === p.id).map((t) => t.siblingPosition);
    expect(new Set(sib).size).toBe(sib.length);
  }
}

describe("Invariants under a randomized action sequence", () => {
  it.each([1, 2, 3, 4, 5])("seed %i", async (seed) => {
    w = await world();
    const rand = rng(seed);
    const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
    const paths = ["src", "src/a", "src/b", "docs/x.md", "lib", "test", "ui", "api"];
    const runs = new Map<string, As>();
    const tokens = new Map<string, As>();
    for (let i = 0; i < 3; i++) await approvedTask(w, { paths: [pick(paths)] });
    const previous = new Map<string, string>();
    const fixedContent = new Map<string, unknown>();
    const statuses: number[] = [];
    const runFor = async (taskId: string, model: string, role = "implementer") => {
      const r = await startRun(w, taskId, model, role);
      tokens.set(r.runId, r.as);
      return r.as;
    };

    for (let step = 0; step < 150; step++) {
      const all = await w.h.db.select().from(schema.tasks);
      const live = all.filter((x) => x.state !== "completed" && x.state !== "cancelled");
      const t = live.length && rand() < 0.85 ? pick(live) : pick(all);
      const top = t.parentId === null;
      const claim = (await w.h.db.select().from(schema.claims)).find((c) => c.taskId === t.id && c.endedAt === null);
      const claimant: As | undefined = claim ? (claim.userId ? { user: claim.userId } : tokens.get(claim.runId!)) : undefined;
      let actor: As = pick([w.A, w.B, undefined]);
      if (actor === undefined) {
        if (!runs.has(t.id) && t.state !== "completed" && t.state !== "cancelled") runs.set(t.id, await runFor(t.id, pick(["m1", "m2"])));
        actor = runs.get(t.id) ?? w.A;
      }
      // Mostly pick an action that fits the state (by a fitting actor), sometimes anything.
      const fitting: Record<string, string[]> = {
        proposed: ["edit", "approve", "approve", "cancel"],
        approved: ["claim", "claim", "claim", "split", "cancel", "move", "block"],
        in_progress: ["handoff", "handoff", "handoff", "release", "split", "block", "resolve"],
        in_review: ["review", "review", "accept", "return", "cancel", "resolve"],
        completed: ["move", "create"],
        cancelled: ["create", "claim"],
      };
      const sensible = rand() < 0.75;
      const action = sensible
        ? pick(fitting[t.state]!)
        : pick(["create", "edit", "approve", "claim", "release", "handoff", "review", "accept", "return", "split", "cancel", "block", "resolve", "move", "endrun"]);
      if (sensible && (action === "handoff" || action === "release") && claimant) actor = claimant;
      if (sensible && ["approve", "accept", "return", "move", "cancel"].includes(action)) actor = pick([w.A, w.B]);
      let res;
      switch (action) {
        case "create":
          res = await w.h.req("POST", `/projects/${w.projectId}/tasks`, {
            as: actor,
            body: { title: "R", desiredOutcome: "o", acceptanceCriteria: ["c"], envelope: { inclusions: ["i"], paths: [pick(paths)] } },
          });
          break;
        case "edit":
          res = await w.h.req("PATCH", `/tasks/${t.id}`, { as: actor, body: { title: `Edited at step ${step}` } });
          break;
        case "approve":
          res = await w.h.req("POST", `/tasks/${t.id}/approve`, { as: actor });
          break;
        case "claim":
          res = await w.h.req("POST", `/tasks/${t.id}/claim`, { as: actor });
          break;
        case "release":
          res = await w.h.req("POST", `/tasks/${t.id}/release`, { as: actor, body: { reason: "r" } });
          break;
        case "handoff":
          res = await w.h.req("POST", `/tasks/${t.id}/handoff`, { as: actor, body: handoffBody() });
          break;
        case "review": {
          const reviewer = t.state === "completed" || t.state === "cancelled" ? undefined : { as: await runFor(t.id, pick(["m1", "m2", "m3"]), "reviewer") };
          const withFix = !top && rand() < 0.3;
          res = await w.h.req("POST", `/tasks/${t.id}/reviews`, {
            as: reviewer?.as ?? actor,
            body: withFix
              ? { verdict: "changes_required", findings: [{ severity: "major", text: "f" }], addSubtasks: [subtask(t.envelope.paths, "Fix")] }
              : { verdict: pick(["pass", "changes_required"]) },
          });
          break;
        }
        case "accept":
          res = await w.h.req("POST", `/tasks/${t.id}/accept`, { as: actor, body: { waiveReviewReason: rand() < 0.8 ? "w" : undefined } });
          break;
        case "return":
          res = await w.h.req("POST", `/tasks/${t.id}/return`, { as: actor, body: { reason: "again" } });
          break;
        case "split":
          res = await w.h.req("POST", `/tasks/${t.id}/subtasks`, {
            as: actor,
            body: { subtasks: [subtask(t.envelope.paths, "S1"), subtask(t.envelope.paths, "S2")] },
          });
          break;
        case "cancel":
          res = await w.h.req("POST", `/tasks/${t.id}/cancel`, { as: actor, body: { reason: "stop" } });
          break;
        case "block":
          res = await w.h.req("POST", `/tasks/${t.id}/blockers`, { as: actor, body: { whatIsNeeded: "a", whoCanResolve: "b", effect: "c" } });
          break;
        case "resolve": {
          const open = (await w.h.req("GET", `/tasks/${t.id}`)).body.blockers.filter((b: { resolvedAt: string | null }) => !b.resolvedAt);
          res = open.length ? await w.h.req("POST", `/tasks/${t.id}/blockers/${open[0].id}/resolve`, { as: actor }) : { status: 0, body: null };
          break;
        }
        case "move":
          res = await w.h.req("POST", `/tasks/${t.id}/move`, { as: actor, body: { position: 1 + Math.floor(rand() * 3) } });
          break;
        default: {
          const run = await w.h.db.select().from(schema.agentRuns);
          const active = run.filter((r) => r.status === "active");
          res = active.length
            ? await w.h.req("POST", `/dev/runs/${pick(active).id}/end`, { as: w.A, body: { status: pick(["finished", "failed", "stopped"]) } })
            : { status: 0, body: null };
        }
      }
      expect(res.status, `step ${step} ${action}: ${JSON.stringify(res.body)}`).toBeLessThan(500);
      statuses.push(res.status);
      if (action === "endrun") runs.clear();
      await checkInvariants(previous, fixedContent);
    }
    // The sequence exercised both successes and rejections.
    expect(statuses.some((s) => s >= 200 && s < 300)).toBe(true);
    expect(statuses.some((s) => s >= 400)).toBe(true);
  });
});
