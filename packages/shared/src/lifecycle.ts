import { z } from "zod";

// ---------------------------------------------------------------------------
// Vocabulary (CONTRACT-005)
// ---------------------------------------------------------------------------

export const taskStateSchema = z.enum([
  "proposed",
  "approved",
  "in_progress",
  "in_review",
  "completed",
  "cancelled",
]);
export type TaskState = z.infer<typeof taskStateSchema>;

export const TERMINAL_STATES: readonly TaskState[] = ["completed", "cancelled"];

export const auditActorKindSchema = z.enum(["human", "agent", "system", "setup"]);

export const reviewVerdictSchema = z.enum(["pass", "changes_required", "human_decision_required"]);
export type ReviewVerdict = z.infer<typeof reviewVerdictSchema>;

// ---------------------------------------------------------------------------
// Scope envelope
// ---------------------------------------------------------------------------

const nonEmpty = z.string().trim().min(1);

export const inclusionSchema = z.object({
  key: z.string(),
  text: z.string(),
  derivedFrom: z.string().nullable(),
});

export const scopeEnvelopeSchema = z.object({
  inclusions: z.array(inclusionSchema),
  exclusions: z.array(z.string()),
  constraints: z.array(z.string()),
  contracts: z.array(z.string()),
  paths: z.array(z.string()),
});
export type ScopeEnvelope = z.infer<typeof scopeEnvelopeSchema>;

/**
 * Envelope of a top-level task at creation. Inclusions are plain texts; the
 * server keys them `I1`, `I2`, ... so that subtasks can name the inclusion
 * they narrow. Paths are validated by the server (plain relative paths, no
 * globs; CONTRACT-005 Definitions).
 */
export const envelopeInputSchema = z.object({
  inclusions: z.array(nonEmpty).default([]),
  exclusions: z.array(nonEmpty).default([]),
  constraints: z.array(nonEmpty).default([]),
  contracts: z.array(nonEmpty).default([]),
  paths: z.array(z.string()).default([]),
});
export type EnvelopeInput = z.input<typeof envelopeInputSchema>;

/**
 * Envelope of a subtask. It must repeat every parent exclusion, constraint and
 * contract, derive each inclusion from a named parent inclusion, and keep its
 * paths within the parent's paths (CONTRACT-005 "Scope envelope").
 */
export const subtaskEnvelopeInputSchema = z.object({
  inclusions: z
    .array(z.object({ text: nonEmpty, derivedFrom: nonEmpty }))
    .min(1, "A subtask needs at least one inclusion"),
  exclusions: z.array(nonEmpty).default([]),
  constraints: z.array(nonEmpty).default([]),
  contracts: z.array(nonEmpty).default([]),
  paths: z.array(z.string()),
});

export const subtaskInputSchema = z.object({
  title: nonEmpty,
  desiredOutcome: nonEmpty,
  acceptanceCriteria: z.array(nonEmpty).min(1, "A subtask needs at least one acceptance criterion"),
  envelope: subtaskEnvelopeInputSchema,
});
export type SubtaskInput = z.input<typeof subtaskInputSchema>;

// ---------------------------------------------------------------------------
// Action inputs (one per transition)
// ---------------------------------------------------------------------------

/** T1 */
export const createTaskInputSchema = z.object({
  title: nonEmpty,
  desiredOutcome: nonEmpty,
  acceptanceCriteria: z.array(nonEmpty).default([]),
  envelope: envelopeInputSchema.default({
    inclusions: [],
    exclusions: [],
    constraints: [],
    contracts: [],
    paths: [],
  }),
});
export type CreateTaskInput = z.input<typeof createTaskInputSchema>;

/** T17: omitted fields stay unchanged; a supplied envelope replaces the envelope. */
export const editTaskInputSchema = z.object({
  title: nonEmpty.optional(),
  desiredOutcome: nonEmpty.optional(),
  acceptanceCriteria: z.array(nonEmpty).optional(),
  envelope: envelopeInputSchema.strict().optional(),
}).strict();
export type EditTaskInput = z.input<typeof editTaskInputSchema>;

/** Availability of starting an action; submitted input and repository checks still apply. */
export const actionAvailabilitySchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(true) }),
  z.object({ enabled: z.literal(false), reason: z.string().min(1) }),
]);
export type ActionAvailability = z.infer<typeof actionAvailabilitySchema>;
export const taskActionKeySchema = z.enum([
  "edit", "approve", "claim", "release", "renew", "handoff", "recordReview",
  "accept", "return", "addSubtasks", "cancel", "addBlocker", "resolveBlocker", "move",
]);
export type TaskActionKey = z.infer<typeof taskActionKeySchema>;
export const allowedActionsSchema = z.record(taskActionKeySchema, actionAvailabilitySchema);
export type AllowedActions = z.infer<typeof allowedActionsSchema>;

/** T2, T3, renew: no body. */
export const emptyInputSchema = z.object({}).strict();

/** T4. A reason is required when breaking someone else's claim. */
export const releaseClaimInputSchema = z.object({ reason: nonEmpty.optional() });

export const handoffRecordSchema = z.object({
  changes: nonEmpty,
  validation: nonEmpty,
  deviations: nonEmpty,
  risks: nonEmpty,
});

/** T6 */
export const handoffInputSchema = z.object({
  record: handoffRecordSchema,
  /** The handoff commit, once task branches exist (phase 3). */
  commit: nonEmpty.optional(),
});

export const findingSchema = z.object({ severity: nonEmpty, text: nonEmpty });

/** T7 (optionally with T11 additions to the parent) */
export const recordReviewInputSchema = z.object({
  verdict: reviewVerdictSchema,
  findings: z.array(findingSchema).default([]),
  addSubtasks: z.array(subtaskInputSchema).optional(),
});

/** T9 */
export const acceptInputSchema = z.object({
  /** Waive the agent review requirement (A5); requires a reason. */
  waiveReviewReason: nonEmpty.optional(),
  /** Reason for changed files outside the task's paths (Board C4). */
  outOfScopeReason: nonEmpty.optional(),
  /** Whether the human confirmed the warnings shown at acceptance (CONTRACT-003 A-1). */
  warningsConfirmed: z.boolean().default(false),
  /** "Accept anyway" override for a known conflict with main (Q25, ADR-007). */
  acceptAnyway: z.boolean().default(false),
  acceptAnywayReason: nonEmpty.optional(),
});

/** T10 */
export const returnInputSchema = z.object({
  reason: nonEmpty,
  /** Split parent only: new subtasks added as part of the return. */
  subtasks: z.array(subtaskInputSchema).optional(),
});

/** T11 */
export const addSubtasksInputSchema = z.object({
  subtasks: z.array(subtaskInputSchema).min(1, "At least one subtask is required"),
});

/** T15 */
export const cancelInputSchema = z.object({ reason: nonEmpty });

/** C1 */
export const addBlockerInputSchema = z.object({
  whatIsNeeded: nonEmpty,
  whoCanResolve: nonEmpty,
  effect: nonEmpty,
});

/** D1: 1-based position in the project queue, or among the subtask's siblings. */
export const moveInputSchema = z.object({ position: z.number().int().min(1) });

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const iso = z.iso.datetime();

export const actorRefSchema = z.object({
  kind: auditActorKindSchema,
  userId: z.uuid().nullable(),
  /** Current display name (Board B1: renamed users show their current name). */
  displayName: z.string().nullable(),
  userActive: z.boolean().nullable(),
  identityMode: z.string().nullable(),
  runId: z.uuid().nullable(),
  role: z.string().nullable(),
  model: z.string().nullable(),
  systemTrigger: z.string().nullable(),
});
export type ActorRef = z.infer<typeof actorRefSchema>;

export const claimViewSchema = z.object({
  id: z.uuid(),
  claimantKind: z.enum(["human", "agent"]),
  userId: z.uuid().nullable(),
  displayName: z.string().nullable(),
  userActive: z.boolean().nullable(),
  runId: z.uuid().nullable(),
  model: z.string().nullable(),
  startedAt: iso,
  leaseDeadline: iso.nullable(),
  leaseSuspended: z.boolean(),
  lastRenewedAt: iso.nullable(),
});
export type ClaimView = z.infer<typeof claimViewSchema>;

export const blockerViewSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["manual", "integration"]),
  whatIsNeeded: z.string(),
  whoCanResolve: z.string(),
  effect: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
  addedBy: actorRefSchema,
  addedAt: iso,
  resolvedAt: iso.nullable(),
  resolution: z.enum(["resolved", "moot"]).nullable(),
});
export type BlockerView = z.infer<typeof blockerViewSchema>;

export const pauseViewSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  question: z.string(),
  openedAt: iso,
  closedAt: iso.nullable(),
  closeReason: z.enum(["answered", "superseded", "cancelled"]).nullable(),
});

export const handoffViewSchema = z.object({
  id: z.uuid(),
  claimantKind: z.enum(["human", "agent"]),
  userId: z.uuid().nullable(),
  runId: z.uuid().nullable(),
  model: z.string().nullable(),
  record: handoffRecordSchema,
  commit: z.string().nullable(),
  createdAt: iso,
});

export const reviewViewSchema = z.object({
  id: z.uuid(),
  handoffId: z.uuid().nullable(),
  reviewerRunId: z.uuid(),
  reviewerModel: z.string(),
  verdict: reviewVerdictSchema,
  findings: z.array(findingSchema),
  sameModel: z.boolean(),
  createdAt: iso,
});
export type ReviewView = z.infer<typeof reviewViewSchema>;

export const dependencyKindSchema = z.enum(["queue", "inherited", "sibling"]);

export const pathDependencySchema = z.object({
  kind: dependencyKindSchema,
  taskId: z.uuid(),
  number: z.number().int(),
  title: z.string(),
  state: taskStateSchema,
  finished: z.boolean(),
});
export type PathDependency = z.infer<typeof pathDependencySchema>;

export const taskSummarySchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  number: z.number().int(),
  parentId: z.uuid().nullable(),
  title: z.string(),
  state: taskStateSchema,
  blocked: z.boolean(),
  effectivelyBlocked: z.boolean(),
  paused: z.boolean(),
  queuePosition: z.number().int().nullable(),
  siblingPosition: z.number().int().nullable(),
  claim: claimViewSchema.nullable(),
  paths: z.array(z.string()),
  isSplitParent: z.boolean(),
  fellBack: z.boolean(),
  workOnMain: z.boolean(),
  updatedAt: iso,
  allowedActions: allowedActionsSchema,
});
export type TaskSummary = z.infer<typeof taskSummarySchema>;

export const auditRecordViewSchema = z.object({
  id: z.number().int(),
  projectId: z.uuid().nullable(),
  taskId: z.uuid().nullable(),
  parentTaskId: z.uuid().nullable(),
  subjectUserId: z.uuid().nullable(),
  action: z.string(),
  fromState: z.string().nullable(),
  toState: z.string().nullable(),
  rejected: z.boolean(),
  actor: actorRefSchema,
  reason: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  occurredAt: iso,
  recordedAt: iso,
});
export type AuditRecordView = z.infer<typeof auditRecordViewSchema>;

export const taskDetailSchema = taskSummarySchema.extend({
  desiredOutcome: z.string(),
  acceptanceCriteria: z.array(z.string()),
  envelope: scopeEnvelopeSchema,
  author: actorRefSchema,
  originTaskId: z.uuid().nullable(),
  approvedAt: iso.nullable(),
  approvedBy: actorRefSchema.nullable(),
  enteredReviewBy: z.enum(["handoff", "subtasks"]).nullable(),
  returnNotes: z.string().nullable(),
  acceptedAt: iso.nullable(),
  acceptedBy: actorRefSchema.nullable(),
  acceptedCommit: z.string().nullable(),
  reviewWaiverReason: z.string().nullable(),
  parent: taskSummarySchema.nullable(),
  subtasks: z.array(taskSummarySchema),
  blockers: z.array(blockerViewSchema),
  blockerActions: z.record(z.string(), actionAvailabilitySchema),
  pauses: z.array(pauseViewSchema),
  handoffs: z.array(handoffViewSchema),
  reviews: z.array(reviewViewSchema),
  /** Tasks this one waits for (queue, inherited, sibling). */
  dependsOn: z.array(pathDependencySchema),
  /** Tasks that wait for this one. */
  dependedOnBy: z.array(pathDependencySchema),
  audit: z.array(auditRecordViewSchema),
  createdAt: iso,
});
export type TaskDetail = z.infer<typeof taskDetailSchema>;

export const taskListResponseSchema = z.object({ tasks: z.array(taskSummarySchema) });

/** Successful action response: the task after the action and the audit records it produced. */
export const actionResultSchema = z.object({
  task: taskDetailSchema,
  audit: z.array(auditRecordViewSchema),
});
export type ActionResult = z.infer<typeof actionResultSchema>;

export const queueEntrySchema = z.object({
  task: taskSummarySchema,
  /** Other queued tasks whose paths overlap this one. */
  overlapsWith: z.array(z.uuid()),
});

export const decisionQueueSchema = z.object({
  proposed: z.array(taskSummarySchema),
  inReview: z.array(taskSummarySchema),
  subtaskFindings: z.array(
    z.object({ task: taskSummarySchema, review: reviewViewSchema }),
  ),
  blocked: z.array(taskSummarySchema),
  fellBack: z.array(taskSummarySchema),
  authorityViolations: z.array(auditRecordViewSchema),
  acceptedNotMerged: z.array(taskSummarySchema),
});
export type DecisionQueue = z.infer<typeof decisionQueueSchema>;
