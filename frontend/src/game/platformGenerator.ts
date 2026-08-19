import { createSeededRandom } from "./seededRandom";

export type Point = {
  x: number; // 0..1, normalized -- convert to viewport coords at render time
  y: number; // 0..1, 0 = ground, 1 = summit
};

export type Platform = Point & {
  id: string;
  taskIndex: number; // 0-based index into today's task list
};

const ROUTE: Point[] = [
  { x: 0.26, y: 0.14 },
  { x: 0.58, y: 0.24 },
  { x: 0.78, y: 0.42 },
  { x: 0.52, y: 0.58 },
  { x: 0.72, y: 0.72 },
  { x: 0.88, y: 0.84 },
];

// Deterministic layout: same seed + task count always produces the same path.
// The route is intentionally Mario-like: it climbs vertically every step, but
// major landings drift left and right so it reads as platforms instead of a
// uniform diagonal staircase.
export function generatePlatforms(dayNumber: number, taskCount: number, seed: string): Platform[] {
  if (taskCount <= 0) return [];

  const random = createSeededRandom(`${seed}:${dayNumber}:${taskCount}`);

  return Array.from({ length: taskCount }, (_, index) => {
    const t = (index + 1) / (taskCount + 1);
    const base = sampleRoute(t);
    const verticalSpacing = 0.72 / Math.max(1, taskCount);
    const jitterX = (random() - 0.5) * 0.055;
    const jitterY = (random() - 0.5) * Math.min(0.02, verticalSpacing * 0.18);
    return {
      id: `day-${dayNumber}-platform-${index}`,
      taskIndex: index,
      x: clamp01(base.x + jitterX),
      y: clamp01(base.y + jitterY),
    };
  });
}

export function startPoint(): Point {
  return { x: 0.05, y: 0.05 };
}

export function goalPoint(taskCount: number): Point {
  return taskCount <= 1 ? { x: 0.78, y: 0.58 } : { x: 0.93, y: 0.88 };
}

function sampleRoute(t: number): Point {
  const scaled = t * (ROUTE.length - 1);
  const index = Math.min(ROUTE.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const from = ROUTE[index];
  const to = ROUTE[index + 1];
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function clamp01(n: number): number {
  return Math.max(0.03, Math.min(0.97, n));
}
