import { describe, expect, it } from "vitest";
import { isWeekConsistent, unlockedWeekCount, weekDayRange, WEEK_COUNT } from "./weekSystem";
import type { DayCell } from "../types";

const cell = (status: DayCell["status"]): DayCell => ({ day: "", index: 0, status, done: status === "done" ? 1 : 0, total: 1 });

/** 75 DayCells, all "future" except the first `doneDays` which are "done". */
function calendarWith(doneDays: number): DayCell[] {
  return Array.from({ length: 75 }, (_, i) => cell(i < doneDays ? "done" : "future"));
}

describe("weekDayRange", () => {
  it("covers 7-day blocks, clamped to the map's range", () => {
    expect(weekDayRange(1)).toEqual({ start: 1, end: 7 });
    expect(weekDayRange(2)).toEqual({ start: 8, end: 14 });
    expect(weekDayRange(0)).toEqual(weekDayRange(1));
    expect(weekDayRange(99)).toEqual(weekDayRange(WEEK_COUNT));
  });
});

describe("isWeekConsistent", () => {
  it("requires every day in the week to be done, not just most of them", () => {
    const calendar = calendarWith(6);
    expect(isWeekConsistent(calendar, 1)).toBe(false);
    expect(isWeekConsistent(calendarWith(7), 1)).toBe(true);
  });
  it("a partial or missed day breaks consistency even mid-week", () => {
    const calendar = calendarWith(7);
    calendar[3] = cell("partial");
    expect(isWeekConsistent(calendar, 1)).toBe(false);
  });
});

describe("unlockedWeekCount", () => {
  it("week 1 is always open, even with zero progress", () => {
    expect(unlockedWeekCount(calendarWith(0))).toBe(1);
  });
  it("advances one stone per fully consistent week, in order", () => {
    expect(unlockedWeekCount(calendarWith(7))).toBe(2);
    expect(unlockedWeekCount(calendarWith(14))).toBe(3);
  });
  it("a broken week stops the count there even if later days exist", () => {
    const calendar = calendarWith(21);
    calendar[8] = cell("missed"); // breaks week 2 (days 8-14)
    expect(unlockedWeekCount(calendar)).toBe(2);
  });
  it("never exceeds the number of worlds", () => {
    expect(unlockedWeekCount(calendarWith(75))).toBe(WEEK_COUNT);
  });
});
