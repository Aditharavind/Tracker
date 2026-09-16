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
    character: "panda", calendar, onClose: () => {}, onOpenWorld: () => {}, onOpenGoals: () => {},
  }));
}

describe("WeekMap", () => {
  it.each([0, 14])("shows no portal before the first 15 days are complete (%i days)", doneDays => {
    const html = renderMap(doneDays);
    expect(html).not.toContain('class="weekmap-wormhole');
    expect(html).toContain(">Enter story</button>");
    expect(html).toContain("Today&#x27;s goals");
  });

  it.each([
    [15, ["Self-Doubt Caves"]],
    [30, ["Self-Doubt Caves", "Distraction Grove"]],
    [75, ["Self-Doubt Caves", "Distraction Grove", "Fear Mountains", "Inconsistency Valley", "Frustration Lands"]],
  ] as const)("shows only earned exit portals after %i completed days", (doneDays, destinations) => {
    const html = renderMap(doneDays);
    const portals = html.match(/<button[^>]*class="weekmap-wormhole open"[^>]*>/g) ?? [];
    expect(portals).toHaveLength(destinations.length);
    destinations.forEach((destination, index) => {
      expect(portals[index]).toContain(`aria-label="Enter ${destination} story"`);
      expect(portals[index]).not.toContain("disabled");
    });
    expect(html).not.toContain('class="weekmap-wormhole locked');
    expect(html).not.toContain('aria-label="Enter The Sleeping Forest story"');
  });

  it("shows the active world, its 15-day progress, and the daily goals action", () => {
    const html = renderMap(29);
    expect(html).toContain('data-world="1"');
    expect(html).toContain('<h1 id="weekmap-title">Self-Doubt Caves</h1>');
    expect(html).toContain("14 / 15 days complete");
    expect(html).toContain("Day 15 in this world");
    expect(html).toContain("Today&#x27;s goals");
    expect(html).toContain('aria-label="Day 30, world 2: next daily goals"');
    expect(html).toContain('aria-label="Day 31, world 3: locked"');
  });

  it("marks the last day complete and offers the bonus only after 75 completed days", () => {
    expect(renderMap(74)).not.toContain("Bonus story");
    const complete = renderMap(75);
    expect(complete).toContain("15 / 15 days complete");
    expect(complete).toContain('aria-label="Day 75, world 5: complete"');
    expect(complete).toContain("Bonus story");
    expect(complete).toContain('aria-label="Enter Frustration Lands story"');
    expect(complete).not.toContain('aria-current="step"');
  });
});
