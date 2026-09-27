import { describe, expect, it } from "vitest";
import { BREAK_MS, WORK_MS, initialPomodoro, resolvePomodoro, startOrResume, stop } from "../pomodoro";

/** Local-time timestamp, same convention as alarm.test.ts's `at`. */
const at = (y: number, m: number, d: number, hh = 0, mm = 0) => new Date(y, m, d, hh, mm, 0, 0).getTime();

describe("resolvePomodoro / completedToday", () => {
  it("stays at 0 while nothing has finished yet", () => {
    const start = at(2026, 8, 1, 9, 0);
    const state = startOrResume(initialPomodoro(start), start);
    const resolved = resolvePomodoro(state, start + WORK_MS / 2);
    expect(resolved.completedToday).toBe(0);
    expect(resolved.phase).toBe("work");
  });

  it("increments once a work phase finishes, on transition to break", () => {
    const start = at(2026, 8, 1, 9, 0);
    const state = startOrResume(initialPomodoro(start), start);
    const resolved = resolvePomodoro(state, start + WORK_MS + 1);
    expect(resolved.phase).toBe("break");
    expect(resolved.completedToday).toBe(1);
  });

  it("does not double-count the break->work transition", () => {
    const start = at(2026, 8, 1, 9, 0);
    let state = startOrResume(initialPomodoro(start), start);
    state = resolvePomodoro(state, start + WORK_MS + 1); // -> break, completedToday 1
    state = resolvePomodoro(state, start + WORK_MS + BREAK_MS + 1); // -> work again
    expect(state.phase).toBe("work");
    expect(state.cycle).toBe(2);
    expect(state.completedToday).toBe(1);
  });

  it("accumulates across several full cycles caught up at once (tab closed for a while)", () => {
    const start = at(2026, 8, 1, 9, 0);
    const state = startOrResume(initialPomodoro(start), start);
    // Three full work+break cycles elapsed while the tab was closed.
    const later = start + 3 * (WORK_MS + BREAK_MS) + 1;
    const resolved = resolvePomodoro(state, later);
    expect(resolved.completedToday).toBe(3);
  });

  it("rolls over to 0 when the finished session lands on a new local day", () => {
    // 23:50 start -> the 25min work phase finishes at 00:15 the next day.
    const start = at(2026, 8, 1, 23, 50);
    const state = startOrResume(initialPomodoro(start), start);
    const resolved = resolvePomodoro(state, start + WORK_MS + 1);
    expect(resolved.phase).toBe("break");
    expect(resolved.completedToday).toBe(1);
    expect(resolved.completedDay).toBe("2026-09-02");
  });

  it("resets a stale count when reopened on a later day without ever running", () => {
    const yesterday = at(2026, 8, 1, 10, 0);
    const paused = { ...initialPomodoro(yesterday), completedDay: "2026-09-01", completedToday: 4 };
    const today = at(2026, 8, 2, 8, 0);
    const resolved = resolvePomodoro(paused, today);
    expect(resolved.completedToday).toBe(0);
    expect(resolved.completedDay).toBe("2026-09-02");
  });
});

describe("stop", () => {
  it("resets the running timer but keeps today's completed count", () => {
    const start = at(2026, 8, 1, 9, 0);
    let state = startOrResume(initialPomodoro(start), start);
    state = resolvePomodoro(state, start + WORK_MS + 1); // one session done, now on break
    const reset = stop(state, start + WORK_MS + 2);
    expect(reset.phase).toBe("work");
    expect(reset.cycle).toBe(1);
    expect(reset.phaseEndAt).toBeNull();
    expect(reset.completedToday).toBe(1);
  });

  it("rolls the count over if Reset happens on a new day", () => {
    const start = at(2026, 8, 1, 9, 0);
    let state = startOrResume(initialPomodoro(start), start);
    state = resolvePomodoro(state, start + WORK_MS + 1);
    const nextDay = at(2026, 8, 2, 9, 0);
    const reset = stop(state, nextDay);
    expect(reset.completedToday).toBe(0);
  });
});
