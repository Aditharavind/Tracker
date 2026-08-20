import { describe, expect, it } from "vitest";
import { dayProgressPercent, pandaPlatformIndex } from "../progress";

describe("dayProgressPercent", () => {
  it("is 0% with no tasks done", () => {
    expect(dayProgressPercent(0, 4)).toBe(0);
  });

  it("computes partial progress", () => {
    expect(dayProgressPercent(3, 4)).toBe(75);
    expect(dayProgressPercent(1, 3)).toBe(33);
  });

  it("is 100% when everything is done", () => {
    expect(dayProgressPercent(4, 4)).toBe(100);
  });

  it("is 0% for a day with zero tasks, never divides by zero", () => {
    expect(dayProgressPercent(0, 0)).toBe(0);
  });

  it("clamps rather than exceeding 100% if done > total", () => {
    expect(dayProgressPercent(6, 4)).toBe(100);
  });
});

describe("pandaPlatformIndex", () => {
  it("never advances further than tasks completed", () => {
    expect(pandaPlatformIndex(2, 4)).toBe(2);
    expect(pandaPlatformIndex(0, 4)).toBe(0);
    expect(pandaPlatformIndex(4, 4)).toBe(4);
  });

  it("clamps to the platform count even if completed overshoots", () => {
    expect(pandaPlatformIndex(9, 4)).toBe(4);
  });

  it("never goes negative", () => {
    expect(pandaPlatformIndex(-3, 4)).toBe(0);
  });
});
