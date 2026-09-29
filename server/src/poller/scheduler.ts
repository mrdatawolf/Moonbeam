import { schema, type Database } from "@moonbeam/db";
import { isNull } from "drizzle-orm";
import type { SourceView } from "@moonbeam/shared";
import { Poller } from "./poll.js";

export function pollIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  const seconds = Number(env.MOONBEAM_POLL_INTERVAL_SECONDS ?? 300);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds * 1000 > 2_147_483_647) {
    throw new Error("MOONBEAM_POLL_INTERVAL_SECONDS must be positive and fit a timer");
  }
  return seconds * 1000;
}

export class PollScheduler {
  private readonly running = new Map<string, Promise<SourceView>>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private sweep: Promise<void> | undefined;
  constructor(private readonly options: { db: Database; poller: Poller; intervalMs?: number }) {}

  /** Manual refresh joins this instance's in-flight poll, including a scheduled one. */
  refresh(projectId: string): Promise<SourceView> { return this.run(projectId, true); }
  private run(projectId: string, manual: boolean): Promise<SourceView> {
    const existing = this.running.get(projectId);
    if (existing) return existing;
    if (this.stopped) return Promise.reject(new Error("Poll scheduler stopped"));
    const promise = this.options.poller.poll(projectId, manual).finally(() => { this.running.delete(projectId); });
    this.running.set(projectId, promise);
    return promise;
  }
  /** Public for deterministic harness/startup checks; individual failures are isolated. */
  pollAll(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.sweep) return this.sweep;
    this.sweep = (async () => {
      const projects = await this.options.db.select({ id: schema.projects.id }).from(schema.projects).where(isNull(schema.projects.removedAt));
      if (!this.stopped) await Promise.allSettled(projects.map((project) => this.run(project.id, false)));
    })().finally(() => { this.sweep = undefined; });
    return this.sweep;
  }
  start(): Promise<void> {
    if (this.stopped) throw new Error("Poll scheduler stopped");
    if (!this.timer) {
      this.timer = setInterval(() => { void this.pollAll().catch(() => {}); }, this.options.intervalMs ?? pollIntervalMs());
      this.timer.unref();
    }
    return this.pollAll();
  }
  async stop(): Promise<void> {
    this.stopped = true;
    clearInterval(this.timer);
    this.timer = undefined;
    await this.sweep?.catch(() => {});
    await Promise.allSettled(this.running.values());
  }
}
