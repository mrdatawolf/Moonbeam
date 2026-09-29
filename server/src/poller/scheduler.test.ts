import { afterEach, expect, it, vi } from "vitest";
import type { Database } from "@moonbeam/db";
import type { SourceView } from "@moonbeam/shared";
import type { Poller } from "./poll.js";
import { PollScheduler } from "./scheduler.js";

afterEach(() => { vi.useRealTimers(); });
it("polls at startup and at the configured interval, then removes the timer", async () => {
  vi.useFakeTimers();
  const poll = vi.fn().mockResolvedValue({ status: "ok" } as SourceView);
  const db = { select: () => ({ from: () => ({ where: async () => [{ id: "one" }, { id: "two" }] }) }) } as unknown as Database;
  const scheduler = new PollScheduler({ db, poller: { poll } as unknown as Poller, intervalMs: 12_000 });
  try {
    await scheduler.start();
    expect(poll).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(11_999);
    expect(poll).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledTimes(4);
    poll.mockRejectedValueOnce(new Error("one project's database failed"));
    await vi.advanceTimersByTimeAsync(12_000);
    expect(poll).toHaveBeenCalledTimes(6);
  } finally { await scheduler.stop(); }
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(24_000);
  expect(poll).toHaveBeenCalledTimes(6);
});
