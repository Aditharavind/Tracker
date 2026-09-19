import { LEVELS_PER_WORLD } from "./content";
import type { Save } from "./save";

export const WORLD_PUZZLES = [
  { src: "/assets/puzzles/world1_puzzle.webp", title: "Whispering Forest", width: 600, height: 600 },
  { src: "/assets/puzzles/world2_puzzle.webp", title: "Snowy Peaks", width: 600, height: 900 },
  { src: "/assets/puzzles/world_3_puzzle.webp", title: "Desert Ruins", width: 600, height: 900 },
  { src: "/assets/puzzles/world_4_puzzle.webp", title: "Enchanted Ocean", width: 600, height: 900 },
  { src: "/assets/puzzles/world_5_puzzle.webp", title: "Celestial Sky", width: 600, height: 900 },
  { src: "/assets/puzzles/world_6_puzzle.webp", title: "Shadow Realm", width: 600, height: 900 },
] as const;

export type WorldPuzzle = {
  src: string; title: string; width: number; height: number;
  worldIndex: number; pieceIds: number[]; complete: boolean;
};

/** Each world's fifteen first clears reveal its fifteen permanent pieces.
 * Deriving them from completion keeps old saves and replays consistent.
 */
export function getWorldPuzzle(save: Pick<Save, "completed">, worldIndex: number): WorldPuzzle | null {
  if (!Number.isInteger(worldIndex) || worldIndex < 0 || worldIndex >= WORLD_PUZZLES.length) return null;
  const firstLevel = worldIndex * LEVELS_PER_WORLD;
  const completed = new Set(save.completed);
  const pieceIds = Array.from({ length: LEVELS_PER_WORLD }, (_, piece) => piece)
    .filter(piece => completed.has(firstLevel + piece));
  return { ...WORLD_PUZZLES[worldIndex], worldIndex, pieceIds, complete: pieceIds.length === LEVELS_PER_WORLD };
}
