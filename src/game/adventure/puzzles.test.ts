import { describe, expect, it } from "vitest";
import { LEVEL_COUNT, LEVELS_PER_WORLD, makeLevel, WORLDS } from "./content";
import { createState, snapshot } from "./engine";
import { getWorldPuzzle, WORLD_PUZZLES } from "./puzzles";
import { completeLevel, emptySave, parseSave } from "./save";

describe("world puzzle collection", () => {
  it("pairs all six story worlds with their supplied artwork and fifteen pieces", () => {
    const completed = Array.from({ length: LEVEL_COUNT }, (_, id) => id);
    expect(WORLD_PUZZLES).toHaveLength(WORLDS.length);
    expect(new Set(WORLD_PUZZLES.map(puzzle => puzzle.src)).size).toBe(6);
    for (let world = 0; world < WORLDS.length; world++) {
      const puzzle = getWorldPuzzle({ completed }, world)!;
      expect(puzzle).toMatchObject({ worldIndex: world, complete: true, ...WORLD_PUZZLES[world] });
      expect(puzzle.pieceIds).toEqual(Array.from({ length: 15 }, (_, piece) => piece));
    }
  });

  it("grants the first piece only after the first level is cleared", () => {
    const save = emptySave();
    expect(getWorldPuzzle(save, 0)?.pieceIds).toEqual([]);
    const attempt = snapshot(createState(makeLevel(0), save));
    const cleared = completeLevel(save, 0, attempt);
    expect(getWorldPuzzle(cleared, 0)).toMatchObject({ pieceIds: [0], complete: false });
    expect(getWorldPuzzle(cleared, 1)?.pieceIds).toEqual([]);
    expect(getWorldPuzzle(save, 0)?.pieceIds).toEqual([]);
  });

  it("starts a fresh puzzle at each world boundary and joins it on the fifteenth clear", () => {
    for (let world = 0; world < WORLDS.length; world++) {
      const start = world * LEVELS_PER_WORLD;
      const completed = Array.from({ length: start + 14 }, (_, id) => id);
      expect(getWorldPuzzle({ completed }, world)).toMatchObject({ complete: false, pieceIds: Array.from({ length: 14 }, (_, id) => id) });
      completed.push(start + 14);
      expect(getWorldPuzzle({ completed }, world)?.complete).toBe(true);
      if (world + 1 < WORLDS.length) expect(getWorldPuzzle({ completed }, world + 1)?.pieceIds).toEqual([]);
    }
  });

  it("does not add pieces for repeated clears or duplicate completion records", () => {
    const initial = emptySave();
    const attempt = snapshot(createState(makeLevel(0), initial));
    const cleared = completeLevel(initial, 0, attempt);
    const replay = completeLevel(cleared, 0, attempt);
    expect(getWorldPuzzle(replay, 0)?.pieceIds).toEqual([0]);
    expect(getWorldPuzzle({ completed: [0, 0, 1, 1, 14, 14] }, 0)?.pieceIds).toEqual([0, 1, 14]);
  });

  it("restores pieces from existing version-three saves without a new storage field", () => {
    const legacy = { version: 3, completed: Array.from({ length: 18 }, (_, id) => id) };
    const loaded = parseSave(JSON.stringify(legacy));
    expect(getWorldPuzzle(loaded, 0)?.complete).toBe(true);
    expect(getWorldPuzzle(loaded, 1)?.pieceIds).toEqual([0, 1, 2]);
    const reloaded = parseSave(JSON.stringify(loaded));
    expect(getWorldPuzzle(reloaded, 1)).toEqual(getWorldPuzzle(loaded, 1));
  });

  it("counts only valid levels belonging to that world, capped at fifteen", () => {
    const completed = [-1, .5, NaN, Infinity, ...Array.from({ length: LEVEL_COUNT + 40 }, (_, id) => id)];
    expect(getWorldPuzzle({ completed }, 0)?.pieceIds).toHaveLength(15);
    expect(getWorldPuzzle({ completed }, 5)?.pieceIds).toHaveLength(15);
    expect(getWorldPuzzle({ completed: [14, 15, 29, 30] }, 1)?.pieceIds).toEqual([0, 14]);
  });

  it("returns null for indices that do not identify one of the six worlds", () => {
    for (const world of [-1, .5, 6, 100, NaN, Infinity]) expect(getWorldPuzzle(emptySave(), world)).toBeNull();
  });
});
