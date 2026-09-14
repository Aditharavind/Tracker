import { describe, expect, it } from "vitest";
import { ARC_COUNT, arcDayRange, currentWorldIndex, isArcConsistent, STORY_ARC_LIMIT, unlockedArcCount } from "./weekSystem";
import type { DayCell } from "../types";

const cell = (status: DayCell["status"]): DayCell => ({ day: "", index: 0, status, done: status === "done" ? 1 : 0, total: 1 });

/** 75 DayCells, all "future" except the first `doneDays` which are "done". */
function calendarWith(doneDays: number): DayCell[] {
  return Array.from({ length: 75 }, (_, i) => cell(i < doneDays ? "done" : "future"));
}

describe("arcDayRange", () => {
  it("covers 15-day blocks, clamped to the map's range", () => {
    expect(arcDayRange(1)).toEqual({ start: 1, end: 15 });
    expect(arcDayRange(2)).toEqual({ start: 16, end: 30 });
    expect(arcDayRange(0)).toEqual(arcDayRange(1));
    expect(arcDayRange(99)).toEqual(arcDayRange(ARC_COUNT));
  });
});

describe("isArcConsistent", () => {
  it("requires every day in the arc to be done, not just most of them", () => {
    const calendar = calendarWith(14);
    expect(isArcConsistent(calendar, 1)).toBe(false);
    expect(isArcConsistent(calendarWith(15), 1)).toBe(true);
  });
  it("a partial or missed day breaks consistency even mid-arc", () => {
    const calendar = calendarWith(15);
    calendar[3] = cell("partial");
    expect(isArcConsistent(calendar, 1)).toBe(false);
  });
});

describe("unlockedArcCount", () => {
  it("arc 1 is always open, even with zero progress", () => {
    expect(unlockedArcCount(calendarWith(0))).toBe(1);
  });
  it("advances one stone (the wormhole) per fully consistent arc, in order", () => {
    expect(unlockedArcCount(calendarWith(15))).toBe(2);
    expect(unlockedArcCount(calendarWith(30))).toBe(3);
  });
  it("a broken arc stops the count there even if later days exist", () => {
    const calendar = calendarWith(45);
    calendar[16] = cell("missed"); // breaks arc 2 (days 16-30)
    expect(unlockedArcCount(calendar)).toBe(2);
  });
  it("never exceeds the number of arcs the 75-day calendar has", () => {
    expect(unlockedArcCount(calendarWith(75))).toBe(ARC_COUNT);
  });
});

describe("currentWorldIndex", () => {
  it("starts at world 0 (the same forest the game already opens in)", () => {
    expect(currentWorldIndex(calendarWith(0))).toBe(0);
  });
  it("advances one world per fully consistent arc", () => {
    expect(currentWorldIndex(calendarWith(15))).toBe(1);
    expect(currentWorldIndex(calendarWith(30))).toBe(2);
  });
  it("clamps to the last reachable world once arcs run past STORY_ARC_LIMIT", () => {
    expect(currentWorldIndex(calendarWith(75))).toBe(STORY_ARC_LIMIT - 1);
  });
});
