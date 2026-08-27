import { createSeededRandom } from "./seededRandom";

export type Point = {
  x: number; // 0..1, normalized -- convert to viewport coords at render time
  y: number; // 0..1, 0 = ground, 1 = summit
};

export type Platform = Point & {
  id: string;
  taskIndex: number; // 0-based index into today's task list
};

// Height (y) sampled across the level's left-to-right span. This is terrain,
// not a climb: it wanders low/mid/high with no directional trend, which is
// what makes the level read as a Mario-style side view instead of a
// staircase. y is clamped well under 1.0 (see clampY) so no platform ever
// gets tall enough to crowd the HUD.
const TERRAIN: Point[] = [
  { x: 0.0, y: 0.1 },
  { x: 0.16, y: 0.34 },
  { x: 0.3, y: 0.16 },
  { x: 0.46, y: 0.46 },
  { x: 0.6, y: 0.24 },
  { x: 0.74, y: 0.48 },
  { x: 0.88, y: 0.18 },
  { x: 1.0, y: 0.12 },
];

// Deterministic layout: same seed + task count always produces the same
// path. Platforms are spread left to right, evenly by task order (x is
// monotonic -- task 1 is always left of task 2), so the level reads as
// forward progress through a horizontal side-scroller. Height comes from
// TERRAIN, sampled at each platform's x, plus jitter -- varied but never a
// directional climb.
export function generatePlatforms(
  dayNumber: number,
  taskCount: number,
  seed: string,
): Platform[] {
  if (taskCount <= 0) return [];

  const random = createSeededRandom(`${seed}:${dayNumber}:${taskCount}`);
  // Even spacing between consecutive platforms. Jitter is capped at a
  // fraction of this gap so it can never push platforms out of task order,
  // regardless of how many tasks the day has.
  const gap = 1 / (taskCount + 1);
  const jitterXAmp = gap * 0.15;

  return Array.from({ length: taskCount }, (_, index) => {
    const t = (index + 1) * gap;
    const jitterX = (random() - 0.5) * 2 * jitterXAmp;
    const terrainY = sampleTerrain(t).y;
    const jitterY = (random() - 0.5) * 0.1;
    return {
      id: `day-${dayNumber}-platform-${index}`,
      taskIndex: index,
      x: clampX(t + jitterX),
      y: clampY(terrainY + jitterY),
    };
  });
}

export function startPoint(): Point {
  // Sits in the clear stretch of ground to the RIGHT of the START sign (the
  // sign renders at the far-left of the scene), with a run-up gap still left
  // before the first platform. y ~ 0: on the ground strip, not floating.
  return { x: 0.2, y: 0.0 };
}

export function goalPoint(_taskCount: number): Point {
  return { x: 0.97, y: 0.0 };
}

function sampleTerrain(t: number): Point {
  const scaled = t * (TERRAIN.length - 1);
  const index = Math.min(TERRAIN.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = TERRAIN[index];
  const to = TERRAIN[index + 1];
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function clampX(n: number): number {
  return Math.max(0.03, Math.min(0.97, n));
}

// Upper bound well under 1.0 so the tallest platform still leaves clearance
// under the topbar/HUD.
function clampY(n: number): number {
  return Math.max(0.05, Math.min(0.52, n));
}
