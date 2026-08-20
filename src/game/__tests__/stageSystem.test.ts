import { describe, expect, it } from "vitest";
import { getStage } from "../stageSystem";

describe("getStage", () => {
  const cases: [number, number][] = [
    [1, 1],
    [12, 1],
    [13, 2],
    [25, 2],
    [26, 3],
    [38, 3],
    [39, 4],
    [50, 4],
    [51, 5],
    [63, 5],
    [64, 6],
    [75, 6],
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
    expect(getStage(76).id).toBe(6);
    expect(getStage(200).id).toBe(6);
  });
});
