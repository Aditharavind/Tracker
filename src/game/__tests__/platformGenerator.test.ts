import { describe, expect, it } from "vitest";
import { generatePlatforms, goalPoint, startPoint } from "../platformGenerator";

describe("generatePlatforms", () => {
  it("returns one platform per task", () => {
    expect(generatePlatforms(12, 4, "user-1")).toHaveLength(4);
    expect(generatePlatforms(12, 1, "user-1")).toHaveLength(1);
    expect(generatePlatforms(12, 0, "user-1")).toHaveLength(0);
  });

  it("is deterministic for the same seed, day and task count", () => {
    const a = generatePlatforms(12, 6, "user-1");
    const b = generatePlatforms(12, 6, "user-1");
    expect(a).toEqual(b);
  });

  it("differs across days so the same user's path varies day to day", () => {
    const day12 = generatePlatforms(12, 6, "user-1");
    const day13 = generatePlatforms(13, 6, "user-1");
    expect(day12).not.toEqual(day13);
  });

  it("differs across users for the same day", () => {
    const userA = generatePlatforms(12, 6, "user-a");
    const userB = generatePlatforms(12, 6, "user-b");
    expect(userA).not.toEqual(userB);
  });

  it("keeps every platform within the normalized 0..1 viewport", () => {
    const platforms = generatePlatforms(40, 12, "user-1");
    for (const p of platforms) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("progresses left to right, task by task, like a side-scrolling level", () => {
    const platforms = generatePlatforms(40, 8, "user-1");
    for (let i = 1; i < platforms.length; i++) {
      expect(platforms[i].x).toBeGreaterThan(platforms[i - 1].x);
    }
  });

  it("varies height instead of climbing in a straight diagonal", () => {
    const platforms = generatePlatforms(40, 8, "user-1");
    // Not a staircase: height must NOT be monotonic across the level.
    const everDecreases = platforms.some((p, i) => i > 0 && p.y < platforms[i - 1].y);
    expect(everDecreases).toBe(true);
    // But it should still read as varied terrain, not a flat line.
    const ys = platforms.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.1);
  });
});

describe("startPoint / goalPoint", () => {
  it("start sits before the first platform and goal sits after the last", () => {
    const platforms = generatePlatforms(5, 4, "user-1");
    const start = startPoint();
    const goal = goalPoint(4);
    expect(start.x).toBeLessThan(platforms[0].x);
    expect(goal.x).toBeGreaterThan(platforms[platforms.length - 1].x);
  });
});
