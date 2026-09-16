import { describe, expect, it } from "vitest";
import { LEVELS_PER_WORLD, WORLDS, firstLevelForWorld, makeLevel } from "./content";
import { createState, snapshot } from "./engine";
import { canPlay, completeLevel, emptySave, recordAttempt, recordFailure, resumeLevelForWorld } from "./save";
import { TRAIL_ART, TRAIL_STONES, nextWorldForTrail, trailLevels } from "./trail";

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

  it("unlocks the next mission only on completion and retains replay progress", () => {
    let save = emptySave();
    expect(trailLevels(save, 0, 1).filter(level => level.playable).map(level => level.id)).toEqual([0]);
    for (let id = 0; id < 15; id++) {
      const level = makeLevel(id);
      const attempt = { ...snapshot(createState(level, save)), coins: level.things.filter(thing => thing.kind === "coin").map(thing => thing.id) };
      save = completeLevel(save, id, attempt);
      delete save.attempts[id];
      save.lastLevel = null;
      const missions = trailLevels(save, 0, 1);
      expect(missions.filter(mission => mission.done)).toHaveLength(id + 1);
      expect(missions.filter(mission => mission.playable)).toHaveLength(Math.min(15, id + 2));
      expect(missions[id].coins).toBe(missions[id].totalCoins);
    }
    expect(trailLevels(save, 1, 1)[0].playable).toBe(true);
    expect(trailLevels(save, 1, 1)[1].playable).toBe(false);
  });

  it("locates a saved checkpoint and keeps its mission ready after a failure", () => {
    const initial = emptySave();
    const attempt = { ...snapshot(createState(makeLevel(0), initial)), checkpoint: 1 };
    const save = recordAttempt(initial, 0, attempt);
    expect(resumeLevelForWorld(save, 0)).toBe(0);
    expect(trailLevels(save, 0, 12)[0].attempt?.checkpoint).toBe(1);
    expect(trailLevels(save, 1, 12).every(level => !level.playable)).toBe(true);
    const failed = recordFailure(save, 12);
    expect(resumeLevelForWorld(failed, 0)).toBe(0);
    expect(trailLevels(failed, 0, 12)[0]).toMatchObject({ playable: true, done: false, attempt: { checkpoint: 1 } });
    expect(trailLevels(failed, 1, 12).every(level => !level.playable)).toBe(true);
  });

  it("opens cleared adventure worlds immediately unless an explicit world cap is supplied", () => {
    const nextLevel = firstLevelForWorld(1);
    const save = { ...emptySave(), completed: Array.from({ length: nextLevel }, (_, id) => id) };

    expect(canPlay(save, nextLevel, 1)).toBe(true);
    expect(trailLevels(save, 1, 1)[0].playable).toBe(true);
    expect(canPlay(save, nextLevel, 999, 1)).toBe(false);
    expect(trailLevels(save, 1, 999, 1).every(level => !level.playable)).toBe(true);

    expect(canPlay(save, nextLevel, 16, 2)).toBe(true);
    expect(trailLevels(save, 1, 16, 2).filter(level => level.playable).map(level => level.id)).toEqual([nextLevel]);
    expect(canPlay(emptySave(), nextLevel, 16, 2)).toBe(false);
  });

  it("blocks saved checkpoints and completed replays above an explicit world cap", () => {
    const resumeId = firstLevelForWorld(1) + 3;
    const completed = { ...emptySave(), completed: Array.from({ length: resumeId }, (_, id) => id) };
    const attempt = { ...snapshot(createState(makeLevel(resumeId), completed)), checkpoint: 1 };
    const save = recordAttempt(completed, resumeId, attempt);

    expect(save.lastLevel).toBe(resumeId);
    expect(canPlay(save, resumeId - 1, 999, 1)).toBe(false);
    expect(canPlay(save, resumeId, 999, 1)).toBe(false);
    const lockedTrail = trailLevels(save, 1, 999, 1);
    expect(lockedTrail.every(level => !level.playable)).toBe(true);
    expect(lockedTrail[2].done).toBe(true);
    expect(lockedTrail[3].attempt?.checkpoint).toBe(1);

    expect(canPlay(save, resumeId - 1, 30, 2)).toBe(true);
    expect(canPlay(save, resumeId, 30, 2)).toBe(true);
    expect(trailLevels(save, 1, 30, 2)[3].playable).toBe(true);
  });

  it("lets an explicit cap restrict the sixth adventure world", () => {
    const bonusLevel = firstLevelForWorld(5);
    const save = { ...emptySave(), completed: Array.from({ length: bonusLevel }, (_, id) => id) };

    expect(canPlay(save, bonusLevel, 75, 5)).toBe(false);
    expect(trailLevels(save, 5, 75, 5).every(level => !level.playable)).toBe(true);
    expect(canPlay(save, bonusLevel, 75, 6)).toBe(true);
    expect(trailLevels(save, 5, 75, 6).filter(level => level.playable).map(level => level.id)).toEqual([bonusLevel]);
  });
});

describe("world exit portal", () => {
  const clearedThrough = (count: number) => ({ ...emptySave(), completed: Array.from({ length: count }, (_, id) => id) });

  it("appears after the fifteenth mission is completed, never after just fourteen", () => {
    let save = clearedThrough(LEVELS_PER_WORLD - 1);
    expect(nextWorldForTrail(save, 0)).toBeNull();
    const boss = makeLevel(LEVELS_PER_WORLD - 1);
    save = completeLevel(save, boss.id, snapshot(createState(boss, save)));

    expect(nextWorldForTrail(save, 0)).toBe(1);
    expect(canPlay(save, firstLevelForWorld(1), 1)).toBe(true);
    expect(nextWorldForTrail(save, 1)).toBeNull();
  });

  it("rejects gaps even when the boss and later missions are marked complete", () => {
    const save = clearedThrough(firstLevelForWorld(3));
    save.completed = save.completed.filter(id => id !== firstLevelForWorld(2) + 6);
    expect(canPlay(save, firstLevelForWorld(3))).toBe(true);
    expect(nextWorldForTrail(save, 2)).toBeNull();

    save.completed.push(firstLevelForWorld(2) + 6);
    expect(nextWorldForTrail(save, 2)).toBe(3);
  });

  it("honors an optional destination cap without a habit-day waiting period", () => {
    const save = clearedThrough(firstLevelForWorld(1));
    expect(nextWorldForTrail(save, 0, 1)).toBeNull();
    expect(nextWorldForTrail(save, 0, 2)).toBe(1);
    expect(nextWorldForTrail(save, 0)).toBe(1);

    const beforeLastWorld = clearedThrough(firstLevelForWorld(WORLDS.length - 1));
    expect(nextWorldForTrail(beforeLastWorld, WORLDS.length - 2, WORLDS.length - 1)).toBeNull();
    expect(nextWorldForTrail(beforeLastWorld, WORLDS.length - 2)).toBe(WORLDS.length - 1);
  });

  it("has no outgoing portal beyond the final world", () => {
    const save = clearedThrough(WORLDS.length * LEVELS_PER_WORLD);
    expect(nextWorldForTrail(save, WORLDS.length - 1)).toBeNull();
    expect(nextWorldForTrail(save, WORLDS.length - 1, 999)).toBeNull();
  });

  it("rejects invalid source worlds instead of opening an unrelated destination", () => {
    const save = clearedThrough(WORLDS.length * LEVELS_PER_WORLD);
    for (const world of [-1, .5, WORLDS.length, NaN, Infinity, -Infinity]) {
      expect(nextWorldForTrail(save, world)).toBeNull();
    }
  });
});
