import { beforeEach, describe, expect, it, vi } from "vitest";
import * as outbox from "../outbox";

/** Minimal localStorage so the module under test can run outside a browser. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

const TODAY = "2026-09-02";
const entry = (over: Partial<outbox.OutboxEntry> = {}): outbox.OutboxEntry => ({
  userId: 18,
  taskId: 1,
  day: TODAY,
  done: true,
  ts: 1000,
  ...over,
});

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
});

describe("outbox", () => {
  it("remembers an intent and gives it back", () => {
    outbox.remember(entry());
    expect(outbox.pending()).toEqual([entry()]);
  });

  it("collapses repeated toggles of one task to the latest intent", () => {
    outbox.remember(entry({ done: true, ts: 1 }));
    outbox.remember(entry({ done: false, ts: 2 }));
    outbox.remember(entry({ done: true, ts: 3 }));
    const p = outbox.pending();
    expect(p).toHaveLength(1);
    expect(p[0].done).toBe(true);
    expect(p[0].ts).toBe(3);
  });

  it("keeps separate tasks and separate days apart", () => {
    outbox.remember(entry({ taskId: 1 }));
    outbox.remember(entry({ taskId: 2 }));
    outbox.remember(entry({ taskId: 1, day: "2026-09-01" }));
    expect(outbox.pending()).toHaveLength(3);
  });

  it("replays oldest tap first and clears what the server accepts", async () => {
    outbox.remember(entry({ taskId: 2, ts: 200 }));
    outbox.remember(entry({ taskId: 1, ts: 100 }));

    const seen: number[] = [];
    const flushed = await outbox.replay(
      async (e) => {
        seen.push(e.taskId);
      },
      { today: TODAY }
    );

    expect(seen).toEqual([1, 2]);
    expect(flushed).toBe(2);
    expect(outbox.pending()).toEqual([]);
  });

  it("keeps the intent when delivery fails, so a later launch retries", async () => {
    outbox.remember(entry());
    const flushed = await outbox.replay(
      () => Promise.reject(new TypeError("Failed to fetch")),
      { today: TODAY, isPermanentFailure: () => false }
    );
    expect(flushed).toBe(0);
    expect(outbox.pending()).toHaveLength(1);
  });

  it("drops the intent when the server refuses it outright", async () => {
    outbox.remember(entry());
    const flushed = await outbox.replay(() => Promise.reject(new Error("bad task")), {
      today: TODAY,
      isPermanentFailure: () => true,
    });
    expect(flushed).toBe(0);
    expect(outbox.pending()).toEqual([]);
  });

  it("drops entries from an earlier day without sending them", async () => {
    // The server seals a finished day, so these can never be accepted --
    // retrying forever would block everything behind them.
    outbox.remember(entry({ day: "2026-09-01", taskId: 9 }));
    const send = vi.fn();
    await outbox.replay(send, { today: TODAY });
    expect(send).not.toHaveBeenCalled();
    expect(outbox.pending()).toEqual([]);
  });

  it("stops on the first delivery failure instead of firing the rest at it", async () => {
    outbox.remember(entry({ taskId: 1, ts: 1 }));
    outbox.remember(entry({ taskId: 2, ts: 2 }));
    outbox.remember(entry({ taskId: 3, ts: 3 }));

    const send = vi.fn(async (e: outbox.OutboxEntry) => {
      if (e.taskId === 2) throw new TypeError("offline");
    });
    await outbox.replay(send, { today: TODAY, isPermanentFailure: () => false });

    expect(send).toHaveBeenCalledTimes(2);
    expect(outbox.pending().map((e) => e.taskId)).toEqual([2, 3]);
  });

  it("skips a task whose write is already in flight this session", async () => {
    outbox.remember(entry({ taskId: 1 }));
    outbox.remember(entry({ taskId: 2 }));
    const send = vi.fn();
    await outbox.replay(send, { today: TODAY, skip: (e) => e.taskId === 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox.pending().map((e) => e.taskId)).toEqual([1]);
  });

  it("survives corrupt storage rather than throwing on boot", () => {
    localStorage.setItem("75hard.outbox.v1", "{not json");
    expect(outbox.pending()).toEqual([]);
    outbox.remember(entry());
    expect(outbox.pending()).toHaveLength(1);
  });

  it("discards malformed rows but keeps the good ones", () => {
    localStorage.setItem(
      "75hard.outbox.v1",
      JSON.stringify({ bad: { userId: "nope" }, "18:1:2026-09-02": entry() })
    );
    expect(outbox.pending()).toEqual([entry()]);
  });

  it("never throws when storage is unavailable", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(() => outbox.remember(entry())).not.toThrow();
    expect(outbox.pending()).toEqual([]);
  });
});
