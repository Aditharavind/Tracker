// Port of frontend/src/game/platformGenerator.ts -- see there for rationale.
import { createSeededRandom } from "./seededRandom";

export type Point = { x: number; y: number };

export type Platform = Point & {
  id: string;
  taskIndex: number;
};

export function generatePlatforms(dayNumber: number, taskCount: number, seed: string): Platform[] {
  if (taskCount <= 0) return [];

  const random = createSeededRandom(`${seed}:${dayNumber}:${taskCount}`);
  const spacing = 1 / (taskCount + 1);
  const jitterMax = spacing * 0.3;

  return Array.from({ length: taskCount }, (_, index) => {
    const baseX = spacing * (index + 1);
    const baseY = spacing * (index + 1);
    const jitterX = (random() - 0.5) * 2 * jitterMax;
    const jitterY = (random() - 0.5) * 2 * jitterMax;
    return {
      id: `day-${dayNumber}-platform-${index}`,
      taskIndex: index,
      x: clamp01(baseX + jitterX),
      y: clamp01(baseY + jitterY),
    };
  });
}

export function startPoint(): Point {
  return { x: 0.02, y: 0.04 };
}

export function goalPoint(taskCount: number): Point {
  if (taskCount <= 0) return { x: 0.98, y: 0.92 };
  const spacing = 1 / (taskCount + 1);
  return { x: clamp01(spacing * (taskCount + 1)), y: clamp01(spacing * (taskCount + 1)) };
}

function clamp01(n: number): number {
  return Math.max(0.03, Math.min(0.97, n));
}
