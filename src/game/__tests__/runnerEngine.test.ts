import { describe, expect, it } from "vitest";
import {
  createRunner,
  jumpPeak,
  jumpReach,
  KILL_Y,
  LANE,
  metres,
  PANDA_W,
  PANDA_X,
  step,
  type RunnerState,
} from "../runnerEngine";

function run(state: RunnerState, ms: number, onFrame?: (s: RunnerState) => boolean) {
  const FRAME = 16;
  for (let elapsed = 0; elapsed < ms && !state.over; elapsed += FRAME) {
    step(state, FRAME, onFrame ? onFrame(state) : false);
  }
  return state;
}

/** Auto-player: hop as the current ledge's right edge approaches. */
const play = (s: RunnerState) => {
  if (!s.grounded) return false;
  const feetR = PANDA_X + PANDA_W;
  const cur = s.platforms.find(
    (p) => p.x <= PANDA_X + 1 && p.x + p.w >= feetR - 1 && Math.abs(p.y - s.y) < 1.5
  );
  if (!cur) return true;
  const edgeAhead = cur.x + cur.w - feetR;
  const hazardNear = s.hazards.some((h) => h.x > PANDA_X && h.x < feetR + s.speed * 0.3);
  return edgeAhead < s.speed * 0.34 || hazardNear;
};

describe("runnerEngine (floating platformer)", () => {
  it("is deterministic for a given seed", () => {
    const a = run(createRunner("u1:2026-01-01"), 4000, play);
    const b = run(createRunner("u1:2026-01-01"), 4000, play);
    expect(metres(a)).toBe(metres(b));
    expect(a.coinsTaken).toBe(b.coinsTaken);
  });

  it("there is no ground -- running off the first ledge without jumping kills you", () => {
    const state = run(createRunner("fall"), 6000);
    expect(state.over).toBe(true);
    expect(state.y).toBeLessThan(KILL_Y + 1);
  });

  it("distance only ever increases until game over", () => {
    const state = createRunner("mono");
    let last = -1;
    for (let i = 0; i < 300 && !state.over; i++) {
      step(state, 16, play(state));
      expect(state.distance).toBeGreaterThanOrEqual(last);
      last = state.distance;
    }
  });

  it("hopping the gaps keeps the panda alive and collecting coins", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const s = run(createRunner(seed), 12000, play);
      expect(metres(s)).toBeGreaterThan(10);
      expect(s.coinsTaken).toBeGreaterThan(0);
    }
  });

  it("every gap between ledges is within a single jump's reach", () => {
    const s = createRunner("reach");
    for (let i = 0; i < 4000 && !s.over; i++) {
      step(s, 16, play(s));
      const sorted = [...s.platforms].sort((p, q) => p.x - q.x);
      for (let k = 1; k < sorted.length; k++) {
        const gap = sorted[k].x - (sorted[k - 1].x + sorted[k - 1].w);
        if (gap > 0) expect(gap).toBeLessThan(jumpReach(s.speed));
      }
    }
  });

  it("a jump clears a comfortable height", () => {
    expect(jumpPeak()).toBeGreaterThan(20);
    expect(LANE).toBeGreaterThan(0);
  });
});
