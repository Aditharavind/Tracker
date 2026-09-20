import { LEVELS_PER_WORLD } from "./content";
import type { Save } from "./save";

// Every edge is symmetric. The adjacent piece traverses it in reverse with
// the opposite tab, so all fifteen silhouettes fit without gaps or overlap.
// Shared by AdventurePuzzle (the minigame's full board) and DayPuzzlePiece
// (the daily-task run's compact reveal) so both draw from one source of
// jigsaw geometry instead of two copies drifting apart.
function edge(x: number, y: number, dx: number, dy: number, tab: number, depth: number) {
  const length = Math.hypot(dx, dy);
  const point = (along: number, out: number) => `${x + dx * along + dy / length * out * depth * tab},${y + dy * along - dx / length * out * depth * tab}`;
  if (!tab) return `L${point(1, 0)}`;
  return `L${point(.38, 0)} C${point(.46, 0)} ${point(.44, .35)} ${point(.42, .45)} C${point(.30, 1.15)} ${point(.70, 1.15)} ${point(.58, .45)} C${point(.56, .35)} ${point(.54, 0)} ${point(.62, 0)} L${point(1, 0)}`;
}

export function piecePath(piece: number, width: number, height: number) {
  const col = piece % 3; const row = Math.floor(piece / 3);
  const w = width / 3; const h = height / 5; const x = col * w; const y = row * h;
  const depth = Math.min(w, h) * .21;
  const horizontal = (r: number, c: number) => (r + c) % 2 ? 1 : -1;
  const vertical = (r: number, c: number) => (r + c) % 2 ? -1 : 1;
  return `M${x},${y}`
    + edge(x, y, w, 0, row === 0 ? 0 : -horizontal(row - 1, col), depth)
    + edge(x + w, y, 0, h, col === 2 ? 0 : vertical(row, col), depth)
    + edge(x + w, y + h, -w, 0, row === 4 ? 0 : horizontal(row, col), depth)
    + edge(x, y + h, 0, -h, col === 0 ? 0 : -vertical(row, col - 1), depth) + "Z";
}

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

/** Same art/shape as getWorldPuzzle, for the *main* 75-day journey instead of
 * the Adventure minigame's Save. `pieceIds` should come from
 * weekSystem.ts's worldPuzzlePieces -- every day ever completed in this
 * world, not a consecutive streak, so a missed day elsewhere never hides a
 * piece already earned. */
export function getMainJourneyPuzzle(pieceIds: number[], worldIndex: number): WorldPuzzle | null {
  if (!Number.isInteger(worldIndex) || worldIndex < 0 || worldIndex >= WORLD_PUZZLES.length) return null;
  return { ...WORLD_PUZZLES[worldIndex], worldIndex, pieceIds, complete: pieceIds.length === LEVELS_PER_WORLD };
}
