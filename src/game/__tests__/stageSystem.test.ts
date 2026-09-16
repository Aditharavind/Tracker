import { describe, expect, it } from "vitest";
import { getJourneyStage, getStage, STAGES } from "../stageSystem";
import { WORLDS } from "../adventure/content";
import type { DayCell } from "../../types";

describe("getStage", () => {
  const cases: [number, number][] = [
    [1, 1],
    [15, 1],
    [16, 2],
    [30, 2],
    [31, 3],
    [45, 3],
    [46, 4],
    [60, 4],
    [61, 5],
    [75, 5],
  ];

  for (const [day, expected] of cases) {
    it(`day ${day} -> stage ${expected}`, () => {
      expect(getStage(day).id).toBe(expected);
    });
  }

  it("clamps below day 1", () => {
    expect(getStage(0).id).toBe(1);
    expect(getStage(-5).id).toBe(1);
  });

  it("clamps above day 75", () => {
    expect(getStage(76).id).toBe(5);
    expect(getStage(200).id).toBe(5);
  });

  it("uses five distinct Story environments with fifteen days each", () => {
    expect(STAGES.map((stage) => stage.name)).toEqual(WORLDS.slice(0, 5).map((world) => world.name));
    expect(STAGES.map((stage) => stage.theme)).toEqual(["entrance", "caves", "grove", "mountains", "valley"]);
    expect(STAGES.every((stage) => stage.maxDay - stage.minDay + 1 === 15)).toBe(true);
  });
});

describe("getJourneyStage", () => {
  const calendar = (count: number): DayCell[] => Array.from({ length: 75 }, (_, index) => ({
    day: "2026-01-01", index, status: index < count ? "done" : "future", done: index < count ? 1 : 0, total: 1,
  }));

  it.each([[14, 1], [15, 2], [29, 2], [30, 3], [74, 5], [75, 5]])("after %i completed days uses world %i", (done, world) => {
    expect(getJourneyStage(calendar(done)).id).toBe(world);
  });

  it("does not change environments just because later calendar days exist", () => {
    const days = calendar(60);
    days[10].status = "missed";
    expect(getJourneyStage(days).id).toBe(1);
  });
});
