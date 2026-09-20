import { describe, expect, it } from "vitest";
import { ARC_COUNT, arcDayRange, currentWorldIndex, isArcConsistent, journeyProgress, STORY_ARC_LIMIT, unlockedArcCount, unlockedDayCount, worldPuzzlePieces } from "./weekSystem";
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

describe("journeyProgress", () => {
  it.each([
    [0, 0, 0, 1, false, 1],
    [14, 0, 14, 15, false, 1],
    [15, 1, 0, 1, false, 2],
    [29, 1, 14, 15, false, 2],
    [30, 2, 0, 1, false, 3],
    [44, 2, 14, 15, false, 3],
    [45, 3, 0, 1, false, 4],
    [59, 3, 14, 15, false, 4],
    [60, 4, 0, 1, false, null],
    [74, 4, 14, 15, false, null],
    [75, 4, 15, 15, true, null],
  ])("%i completed days gives the right world and local day", (completedDays, worldIndex, worldCompletedDays, dayInWorld, complete, nextWorldIndex) => {
    expect(journeyProgress(calendarWith(completedDays as number))).toEqual({
      completedDays, worldIndex, worldCompletedDays, dayInWorld, complete, nextWorldIndex,
    });
  });

  it.each(["partial", "missed", "today", "future"] as const)("a %s day prevents skipping into a later world", (status) => {
    const calendar = calendarWith(75);
    calendar[14] = cell(status);
    expect(journeyProgress(calendar)).toMatchObject({ completedDays: 14, worldIndex: 0, worldCompletedDays: 14, complete: false });
    expect(unlockedArcCount(calendar)).toBe(1);
    expect(unlockedDayCount(calendar)).toBe(15);
  });

  it("derives the same progress from a reloaded calendar without separate unlock storage", () => {
    const saved = JSON.stringify(calendarWith(30));
    expect(journeyProgress(JSON.parse(saved))).toEqual(journeyProgress(calendarWith(30)));
    expect(currentWorldIndex(JSON.parse(saved))).toBe(2);
  });

  it("keeps an empty or truncated calendar in its earned world", () => {
    expect(journeyProgress([])).toMatchObject({ worldIndex: 0, dayInWorld: 1, completedDays: 0 });
    expect(journeyProgress(calendarWith(15).slice(0, 15))).toMatchObject({ worldIndex: 1, dayInWorld: 1, completedDays: 15 });
  });

  it("caps the journey at 75 even if extra completed days are supplied", () => {
    expect(journeyProgress(Array.from({ length: 90 }, () => cell("done")))).toMatchObject({
      worldIndex: 4, completedDays: 75, worldCompletedDays: 15, complete: true, nextWorldIndex: null,
    });
    expect(unlockedDayCount(calendarWith(75))).toBe(75);
  });
});

describe("worldPuzzlePieces", () => {
  it("collects every done day in the world, not just a leading streak", () => {
    const calendar = calendarWith(15);
    expect(worldPuzzlePieces(calendar, 0)).toEqual(Array.from({ length: 15 }, (_, i) => i));
  });

  it("a missed day elsewhere in the world never hides a piece already earned", () => {
    const calendar = calendarWith(15);
    calendar[3] = cell("missed");
    // Day 4 (index 3) no longer counts, but every other day this world
    // completed still does -- this is the guarantee CLAUDE.md's life/penalty
    // rules require: a failure costs a life, it must never undo a piece.
    expect(worldPuzzlePieces(calendar, 0)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("only looks at the requested world's own 15-day slice", () => {
    const calendar = calendarWith(20);
    expect(worldPuzzlePieces(calendar, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(worldPuzzlePieces(calendar, 2)).toEqual([]);
  });
});
