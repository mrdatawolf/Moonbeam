// Task detail (CONTRACT-001 "Interfaces": every task view exposes state and
// conditions, blockers, claimant and lease, parent and subtasks, envelope,
// queue position and path dependencies both ways, reviews with the
// same-model flag, and the full audit history). Order follows "what is
// happening, does it need me, what do I do about it".
import type { AuditRecordView, PathDependency, TaskDetail } from "@moonbeam/shared";
import { Link, useParams } from "react-router";
import { useConnectionLost } from "../api/connection";
import { useProjects, useTask, useTaskAction, useUsers } from "../api/queries";
import { EmptyState, LoadError, Mono, Refusal, SectionHeading, Skeleton, TaskRef, Time } from "../components/common";
import { MoveControl } from "../components/MoveControl";
import { StatusBadge } from "../components/StatusBadge";
import { TaskActions } from "../components/TaskActions";
import { Claimant } from "../components/TaskCard";
import { blockerAvailability, CHOOSE_USER, dependencyKindLabel } from "../lib/actions";
import { focusUserPicker, useCurrentUser } from "../lib/currentUser";
import { actorLabel, auditLabel } from "../lib/format";
import { conditionsOf, INTEGRATION, latestHandoff, REVIEW_VERDICT, reviewSubstatus, TASK_STATE, WARNING } from "../lib/status";

function List({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm">
      {items.map((i, n) => (
        <li key={n}>{i}</li>
      ))}
    </ul>
  );
}

function Deps({ deps, empty }: { deps: PathDependency[]; empty: string }) {
  if (deps.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1 text-sm">
      {deps.map((d) => (
        <li key={`${d.kind}-${d.taskId}`} className="flex flex-wrap items-center gap-2">
          <TaskRef id={d.taskId} number={d.number} title={d.title} />
          <StatusBadge status={TASK_STATE[d.state]} compact />
          <span className="text-xs text-muted-foreground">
            {dependencyKindLabel(d.kind)} · {d.finished ? "finished" : "unfinished"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Blockers({ task }: { task: TaskDetail }) {
  const { user } = useCurrentUser();
  const lost = useConnectionLost();
  const open = task.blockers.filter((b) => !b.resolvedAt);
  const closed = task.blockers.filter((b) => b.resolvedAt);
  if (task.blockers.length === 0 && !task.effectivelyBlocked) return null;
  const avail = blockerAvailability({ userId: user?.id ?? null, connectionLost: lost });
  return (
    <section aria-labelledby="blockers-h" className="card space-y-3 border-tone-danger-border p-4">
      <SectionHeading id="blockers-h" count={open.length}>
        Blockers
      </SectionHeading>
      {task.effectivelyBlocked && !task.blocked ? <p className="text-sm">The parent task is blocked, so this subtask is blocked by its parent.</p> : null}
      <ul className="space-y-3">
        {open.map((b) => (
          <BlockerItem key={b.id} taskId={task.id} blocker={b} avail={avail} />
        ))}
      </ul>
      {closed.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Resolved blockers ({closed.length})</summary>
          <ul className="mt-2 space-y-1">
            {closed.map((b) => (
              <li key={b.id}>
                {b.whatIsNeeded} <span className="text-muted-foreground">({b.resolution === "moot" ? "closed as moot" : "resolved"} <Time iso={b.resolvedAt!} />)</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function BlockerItem({ taskId, blocker: b, avail }: { taskId: string; blocker: TaskDetail["blockers"][number]; avail: ReturnType<typeof blockerAvailability> }) {
  const resolve = useTaskAction(taskId, `blockers/${b.id}/resolve`);
  return (
    <li className="space-y-1 rounded-control border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={{ family: "Blocker", label: b.kind === "integration" ? "Integration blocker" : "Blocker", tone: "danger", glyph: "octagon" }} compact />
        <span className="text-xs text-muted-foreground">
          Added by {actorLabel(b.addedBy)} <Time iso={b.addedAt} />
        </span>
      </div>
      <dl className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[max-content_1fr]">
        <dt className="text-muted-foreground">Needed</dt>
        <dd>{b.whatIsNeeded}</dd>
        <dt className="text-muted-foreground">Who can resolve</dt>
        <dd>{b.whoCanResolve}</dd>
        <dt className="text-muted-foreground">Effect</dt>
        <dd>{b.effect}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="button" className="btn-secondary" aria-disabled={!avail.enabled || resolve.isPending} onClick={() => avail.enabled && resolve.mutate({})}>
          Resolve blocker
        </button>
        {!avail.enabled ? (
          avail.reason === CHOOSE_USER ? (
            <button type="button" className="text-xs text-primary underline" onClick={focusUserPicker}>
              {CHOOSE_USER}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">{avail.reason}</span>
          )
        ) : null}
      </div>
      <Refusal error={resolve.error} />
    </li>
  );
}

function History({ audit }: { audit: AuditRecordView[] }) {
  const rows = [...audit].sort((a, b) => b.id - a.id);
  return (
    <section aria-labelledby="history-h" className="space-y-2">
      <SectionHeading id="history-h" count={rows.length}>
        History
      </SectionHeading>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">When</th>
              <th scope="col" className="py-2 pr-3 font-medium">What</th>
              <th scope="col" className="py-2 pr-3 font-medium">Who</th>
              <th scope="col" className="py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-border align-top">
                <td className="py-2 pr-3 whitespace-nowrap">
                  <Time iso={a.occurredAt} />
                </td>
                <td className="py-2 pr-3">
                  {auditLabel(a.action, a.rejected)}
                  {a.fromState && a.toState && a.fromState !== a.toState ? (
                    <span className="text-muted-foreground">
                      {" "}
                      ({TASK_STATE[a.fromState as keyof typeof TASK_STATE]?.label ?? a.fromState} → {TASK_STATE[a.toState as keyof typeof TASK_STATE]?.label ?? a.toState})
                    </span>
                  ) : null}
                  {a.details && typeof a.details.override === "object" && a.details.override ? <span className="text-tone-attention-fg"> · Accept anyway override</span> : null}
                </td>
                <td className="py-2 pr-3">
                  {actorLabel(a.actor)}
                  {a.actor.identityMode ? <span className="text-xs text-muted-foreground"> ({a.actor.identityMode})</span> : null}
                </td>
                <td className="py-2">{a.reason ?? <span className="text-muted-foreground">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskBody({ task }: { task: TaskDetail }) {
  const projects = useProjects();
  const users = useUsers();
  const userName = (id: string | null) => users.data?.find((u) => u.id === id)?.displayName ?? "a board member";
  const project = projects.data?.find((p) => p.id === task.projectId);
  const sub = reviewSubstatus(task);
  const handoff = latestHandoff(task);
  const waiting = task.dependsOn.filter((d) => !d.finished);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {project ? (
            <Link to={`/projects/${project.id}`} className="underline-offset-2 hover:underline">
              {project.name}
            </Link>
          ) : (
            "Project"
          )}
          {task.parent ? (
            <>
              {" "}
              · Subtask of <TaskRef id={task.parent.id} number={task.parent.number} title={task.parent.title} />
            </>
          ) : null}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          <span className="font-mono text-muted-foreground">#{task.number}</span> {task.title}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={TASK_STATE[task.state]} />
          {sub ? <StatusBadge status={sub} /> : null}
          {conditionsOf(task).map((c) => (
            <StatusBadge key={c.label} status={c} />
          ))}
          {task.state === "completed" && task.parentId === null && !task.workOnMain ? <StatusBadge status={INTEGRATION.notMerged} /> : null}
          {task.queuePosition !== null ? <span className="text-xs text-muted-foreground">Queue position <span className="font-mono">{task.queuePosition}</span></span> : null}
        </div>
        <Claimant task={task} />
      </header>

      {task.parentId !== null && (task.state === "in_review" || task.state === "completed") ? (
        <p className="rounded-control border border-border bg-muted px-3 py-2 text-sm">
          Subtasks aren't accepted individually. The decision is made on the parent task
          {task.parent ? (
            <>
              {" "}
              <TaskRef id={task.parent.id} number={task.parent.number} />
            </>
          ) : null}
          .
        </p>
      ) : null}
      {task.state === "completed" && task.parentId === null && !task.workOnMain ? (
        <p className="rounded-control border border-tone-attention-border bg-tone-attention-bg px-3 py-2 text-sm text-tone-attention-fg">
          Accepted, not merged. This task's work is not on main yet. Merging into main comes with the review surface (phase 3).
        </p>
      ) : null}
      {task.returnNotes && task.state !== "completed" && task.state !== "cancelled" ? (
        <section aria-labelledby="return-h" className="card border-tone-attention-border p-4">
          <SectionHeading id="return-h">Return notes</SectionHeading>
          <p className="mt-1 text-sm whitespace-pre-wrap">{task.returnNotes}</p>
        </section>
      ) : null}
      {waiting.length && task.state === "approved" ? (
        <p className="rounded-control border border-border bg-muted px-3 py-2 text-sm">
          Waiting for {waiting.map((d) => `#${d.number}`).join(", ")} to finish before it can be claimed (overlapping paths).
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Blockers task={task} />

          <section aria-labelledby="outcome-h" className="space-y-2">
            <SectionHeading id="outcome-h">Desired outcome</SectionHeading>
            <p className="text-sm whitespace-pre-wrap">{task.desiredOutcome}</p>
            <h3 className="pt-2 text-sm font-semibold">Acceptance criteria</h3>
            <List items={task.acceptanceCriteria} empty="No acceptance criteria. A task needs at least one to be approved." />
          </section>

          <section aria-labelledby="scope-h" className="space-y-2">
            <SectionHeading id="scope-h">Scope envelope</SectionHeading>
            <h3 className="text-sm font-semibold">Included</h3>
            {task.envelope.inclusions.length ? (
              <ul className="space-y-0.5 text-sm">
                {task.envelope.inclusions.map((i) => (
                  <li key={i.key}>
                    <span className="font-mono text-xs text-muted-foreground">{i.key}</span> {i.text}
                    {i.derivedFrom ? <span className="text-xs text-muted-foreground"> (from parent {i.derivedFrom})</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No inclusions. A task needs at least one to be approved.</p>
            )}
            <h3 className="text-sm font-semibold">Excluded</h3>
            <List items={task.envelope.exclusions} empty="None." />
            <h3 className="text-sm font-semibold">Constraints</h3>
            <List items={task.envelope.constraints} empty="None." />
            <h3 className="text-sm font-semibold">Linked contracts</h3>
            <List items={task.envelope.contracts} empty="None." />
            <h3 className="text-sm font-semibold">Paths</h3>
            {task.envelope.paths.length ? (
              <ul className="space-y-0.5">
                {task.envelope.paths.map((p) => (
                  <li key={p}>
                    <Mono>{p}</Mono>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No paths: approved as a task that changes no files.</p>
            )}
          </section>

          {task.subtasks.length ? (
            <section aria-labelledby="subtasks-h" className="space-y-2">
              <SectionHeading id="subtasks-h" count={task.subtasks.length}>
                Subtasks
              </SectionHeading>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-3 font-medium">Order</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Subtask</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                      <th scope="col" className="py-2 font-medium">Move</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...task.subtasks]
                      .sort((a, b) => (a.siblingPosition ?? 0) - (b.siblingPosition ?? 0))
                      .map((s) => (
                        <tr key={s.id} className="border-b border-border align-top">
                          <td className="py-2 pr-3 font-mono">{s.siblingPosition}</td>
                          <td className="py-2 pr-3">
                            <TaskRef id={s.id} number={s.number} title={s.title} />
                            <div>
                              <Claimant task={s} />
                            </div>
                          </td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-1">
                              <StatusBadge status={TASK_STATE[s.state]} compact />
                              {conditionsOf(s).map((c) => (
                                <StatusBadge key={c.label} status={c} compact />
                              ))}
                            </div>
                          </td>
                          <td className="py-2">
                            <MoveControl task={s} count={task.subtasks.length} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Splitting and adding subtasks from the board comes later; agents and claimants add them through the API.</p>
            </section>
          ) : null}

          <section aria-labelledby="handoffs-h" className="space-y-2">
            <SectionHeading id="handoffs-h" count={task.handoffs.length}>
              Handoffs
            </SectionHeading>
            {task.handoffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">This task hasn't been handed off yet.</p>
            ) : (
              <ol className="space-y-3">
                {[...task.handoffs]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((h) => (
                    <li key={h.id} className="card space-y-1 p-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {h.id === handoff?.id ? "Latest attempt · " : "Earlier attempt · "}
                        by {h.claimantKind === "agent" ? `agent run (${h.model ?? "unknown model"})` : userName(h.userId)} <Time iso={h.createdAt} />
                        {h.commit ? (
                          <>
                            {" "}
                            · commit <Mono>{h.commit}</Mono>
                          </>
                        ) : null}
                      </p>
                      <dl className="grid gap-x-3 gap-y-1 sm:grid-cols-[max-content_1fr]">
                        <dt className="text-muted-foreground">What changed</dt>
                        <dd className="whitespace-pre-wrap">{h.record.changes}</dd>
                        <dt className="text-muted-foreground">Validated</dt>
                        <dd className="whitespace-pre-wrap">{h.record.validation}</dd>
                        <dt className="text-muted-foreground">Deviations</dt>
                        <dd className="whitespace-pre-wrap">{h.record.deviations}</dd>
                        <dt className="text-muted-foreground">Risks</dt>
                        <dd className="whitespace-pre-wrap">{h.record.risks}</dd>
                      </dl>
                    </li>
                  ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="reviews-h" className="space-y-2">
            <SectionHeading id="reviews-h" count={task.reviews.length}>
              Agent reviews
            </SectionHeading>
            {task.reviewWaiverReason ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={REVIEW_VERDICT.waived} compact /> Review waived: {task.reviewWaiverReason}
              </p>
            ) : null}
            {task.reviews.length === 0 ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge status={REVIEW_VERDICT.none} compact />
                <span className="text-muted-foreground">No agent review recorded.</span>
              </p>
            ) : (
              <ol className="space-y-3">
                {[...task.reviews]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((r) => (
                    <li key={r.id} className="card space-y-1.5 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={REVIEW_VERDICT[r.verdict]} compact />
                        {r.sameModel ? <StatusBadge status={WARNING.sameModel} compact /> : null}
                        <span className="text-xs text-muted-foreground">
                          Reviewer model <Mono>{r.reviewerModel}</Mono> · <Time iso={r.createdAt} />
                          {handoff && r.handoffId !== handoff.id ? " · earlier attempt" : ""}
                        </span>
                      </div>
                      {r.findings.length ? (
                        <ul className="list-disc space-y-0.5 pl-5">
                          {r.findings.map((f, i) => (
                            <li key={i}>
                              <span className="font-medium">{f.severity}:</span> {f.text}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">No findings.</p>
                      )}
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="Actions and relationships">
          <TaskActions task={task} />
          <section aria-labelledby="deps-h" className="card space-y-3 p-4">
            <SectionHeading id="deps-h">Path dependencies</SectionHeading>
            <h3 className="text-sm font-semibold">Waits for</h3>
            <Deps deps={task.dependsOn} empty="Nothing: no earlier task has overlapping paths." />
            <h3 className="text-sm font-semibold">Waited on by</h3>
            <Deps deps={task.dependedOnBy} empty="No task waits for this one." />
          </section>
          <section aria-labelledby="record-h" className="card space-y-2 p-4 text-sm">
            <SectionHeading id="record-h">Record</SectionHeading>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Proposed by</dt>
              <dd>
                {actorLabel(task.author)} <Time iso={task.createdAt} />
              </dd>
              {task.approvedAt ? (
                <>
                  <dt className="text-muted-foreground">Approved by</dt>
                  <dd>
                    {actorLabel(task.approvedBy)} <Time iso={task.approvedAt} />
                  </dd>
                </>
              ) : null}
              {task.acceptedAt ? (
                <>
                  <dt className="text-muted-foreground">Accepted by</dt>
                  <dd>
                    {actorLabel(task.acceptedBy)} <Time iso={task.acceptedAt} />
                  </dd>
                </>
              ) : null}
              {task.acceptedCommit ? (
                <>
                  <dt className="text-muted-foreground">Accepted commit</dt>
                  <dd>
                    <Mono>{task.acceptedCommit}</Mono>
                  </dd>
                </>
              ) : null}
              {task.enteredReviewBy ? (
                <>
                  <dt className="text-muted-foreground">Entered review</dt>
                  <dd>{task.enteredReviewBy === "handoff" ? "by handoff" : "when all subtasks were done"}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Task id</dt>
              <dd>
                <Mono>{task.id}</Mono>
              </dd>
            </dl>
          </section>
        </aside>
      </div>

      {task.audit.length ? <History audit={task.audit} /> : <EmptyState title="No history yet." />}
    </div>
  );
}

export function TaskPage() {
  const { taskId = "" } = useParams();
  const task = useTask(taskId);
  if (task.isPending) return <Skeleton lines={8} label="Loading task" />;
  if (task.isError) return <LoadError error={task.error} notFound="This task doesn't exist." back={{ to: "/projects", label: "Go to the project list" }} />;
  return <TaskBody task={task.data} />;
}
