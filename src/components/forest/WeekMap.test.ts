import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DayCell } from "../../types";
import WeekMap from "./WeekMap";

function renderMap(doneDays: number) {
  const calendar: DayCell[] = Array.from({ length: 75 }, (_, index) => ({
    day: "", index, status: index < doneDays ? "done" : "future", done: index < doneDays ? 1 : 0, total: 1,
  }));
  return renderToStaticMarkup(createElement(WeekMap, {
    character: "panda", calendar, onClose: () => {},
  }));
}

describe("WeekMap", () => {
  it("shows only the current world's 15 numbered day-stones, not the whole 75-day journey or any story link", () => {
    const html = renderMap(0);
    expect(html.match(/class="adventure-level-stone/g) ?? []).toHaveLength(15);
    expect(html.match(/class="adventure-level-number"[^>]*>(\d+)</g) ?? []).toHaveLength(15);
    expect(html).not.toContain("weekmap-wormhole");
    expect(html).not.toContain("Enter story");
    expect(html).not.toContain("Today&#x27;s goals");
    expect(html).not.toContain("Bonus story");
    expect(html).not.toContain("Begin");
  });

  it("shows the active world and its 15-day progress", () => {
    const html = renderMap(29);
    expect(html).toContain('data-world="1"');
    expect(html).toContain('<h1 id="weekmap-title">Self-Doubt Caves</h1>');
    expect(html).toContain("14 / 15 days complete");
    expect(html).toContain("Day 15 in this world");
  });

  it("every day-stone is a button that returns to the forest scene", () => {
    const html = renderMap(29);
    const stones = html.match(/<button type="button" class="adventure-level-stone[^>]*>/g) ?? [];
    expect(stones).toHaveLength(15);
    expect(html).toContain('aria-label="Day 30: today. Return to your forest."');
  });

  it("marks the last day of a fresh world as day 1 in world 5 once the journey completes", () => {
    const complete = renderMap(75);
    expect(complete).toContain('data-world="4"');
    expect(complete).toContain("15 / 15 days complete");
    expect(complete).toContain("Journey complete");
  });
});
