import { describe, expect, it } from "vitest";
import { LEVELS_PER_WORLD, WORLDS, makeLevel } from "./content";
import { createState, snapshot } from "./engine";
import { completeLevel, emptySave, recordAttempt, recordFailure, resumeLevelForWorld } from "./save";
import { TRAIL_ART, TRAIL_STONES, trailLevels } from "./trail";

describe("stone level trails", () => {
  it("assigns exactly 15 distinct painted stones to each world's 15 levels", () => {
    expect(TRAIL_STONES).toHaveLength(LEVELS_PER_WORLD);
    expect(new Set(TRAIL_STONES.map(stone => `${stone.x},${stone.y}`)).size).toBe(15);
    for (const [world] of WORLDS.entries()) {
      const levels = trailLevels(emptySave(), world, 1);
      expect(levels).toHaveLength(15);
      expect(levels.map(level => level.id)).toEqual(Array.from({ length: 15 }, (_, stage) => world * 15 + stage));
      expect(levels.filter(level => level.boss).map(level => level.stage)).toEqual([14]);
      expect(levels.map(level => level.stone)).toEqual(TRAIL_STONES);
    }
  });

  it("keeps every anchor inside the illustration in ascending trail order", () => {
    TRAIL_STONES.forEach((stone, index) => {
      expect(stone.x).toBeGreaterThan(0);
      expect(stone.x).toBeLessThan(TRAIL_ART.width);
      expect(stone.y).toBeGreaterThan(0);
      expect(stone.y).toBeLessThan(TRAIL_ART.height);
      if (index) expect(stone.y).toBeLessThan(TRAIL_STONES[index - 1].y);
    });
  });

  it("unlocks the next portal only on completion and retains replay progress", () => {
    let save = emptySave();
    expect(trailLevels(save, 0, 1).filter(level => level.playable).map(level => level.id)).toEqual([0]);
    for (let id = 0; id < 15; id++) {
      const level = makeLevel(id);
      const attempt = { ...snapshot(createState(level, save)), coins: level.things.filter(thing => thing.kind === "coin").map(thing => thing.id) };
      save = completeLevel(save, id, attempt);
      delete save.attempts[id];
      save.lastLevel = null;
      const portals = trailLevels(save, 0, 1);
      expect(portals.filter(portal => portal.done)).toHaveLength(id + 1);
      expect(portals.filter(portal => portal.playable)).toHaveLength(Math.min(15, id + 2));
      expect(portals[id].coins).toBe(portals[id].totalCoins);
    }
    expect(trailLevels(save, 1, 1)[0].playable).toBe(true);
    expect(trailLevels(save, 1, 1)[1].playable).toBe(false);
  });

  it("locates a saved checkpoint in its own world and respects the failure lock", () => {
    const initial = emptySave();
    const attempt = { ...snapshot(createState(makeLevel(0), initial)), checkpoint: 1 };
    const save = recordAttempt(initial, 0, attempt);
    expect(resumeLevelForWorld(save, 0)).toBe(0);
    expect(trailLevels(save, 0, 12)[0].attempt?.checkpoint).toBe(1);
    expect(trailLevels(save, 1, 12).every(level => !level.playable)).toBe(true);
    const penalized = recordFailure(save, 12);
    expect(trailLevels(penalized, 0, 18).every(level => !level.playable)).toBe(true);
    expect(trailLevels(penalized, 0, 19)[0].playable).toBe(true);
  });
});
