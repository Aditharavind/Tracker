import { describe, expect, it } from "vitest";
import {
  createRunner,
  HAZARD_W,
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

/** Auto-player: hop the instant the current ledge's right edge arrives (every
    gap is sized to be cleared from the edge), and hop hazards on the way. */
const play = (s: RunnerState) => {
  if (!s.grounded) return false;
  const feetR = PANDA_X + PANDA_W;
  const hz = s.hazards.find((h) => h.x > PANDA_X - 2 && h.x < feetR + s.speed * 0.26);
  if (hz) return true;
  const cur = s.platforms.find(
    (p) => p.x <= PANDA_X + 2 && p.x + p.w >= feetR - 2 && Math.abs(p.y - s.y) < 2
  );
  if (!cur) return false;
  return cur.x + cur.w - feetR < s.speed * 0.1; // ~2 frames from the edge
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

  it("coins sit on the real jump arc -- hopping the gaps sweeps up most of them", () => {
    const seen = new Set<number>();
    const track = (s: RunnerState) => {
      for (const c of s.coins) seen.add(c.id);
      return play(s);
    };
    const s = run(createRunner("arc"), 10000, track);
    expect(s.over).toBe(false);
    expect(s.coinsTaken / seen.size).toBeGreaterThan(0.6);
  });

  it("every gap between ledges stays within jumping distance", () => {
    const s = createRunner("reach");
    for (let i = 0; i < 4000 && !s.over; i++) {
      step(s, 16, play(s));
      const sorted = [...s.platforms].sort((p, q) => p.x - q.x);
      for (let k = 1; k < sorted.length; k++) {
        const gap = sorted[k].x - (sorted[k - 1].x + sorted[k - 1].w);
        // downhill hops carry further than the flat reach, so allow headroom
        if (gap > 0) expect(gap).toBeLessThan(jumpReach(s.speed) * 1.7);
      }
    }
  });

  it("a hazard always leaves a full hop of runway after it -- never a hop into the void", () => {
    const s = createRunner("hz");
    for (let i = 0; i < 3500 && !s.over; i++) {
      step(s, 16, play(s));
      for (const h of s.hazards) {
        const ledge = s.platforms.find((p) => p.x <= h.x + 1 && p.x + p.w >= h.x + HAZARD_W - 1);
        if (!ledge) continue;
        const runwayAfter = ledge.x + ledge.w - (h.x + HAZARD_W);
        expect(runwayAfter).toBeGreaterThan(PANDA_W * 2);
      }
    }
  });

  it("the hop is modest, not a moon jump", () => {
    expect(jumpPeak()).toBeGreaterThan(9);
    expect(jumpPeak()).toBeLessThan(20);
    expect(LANE).toBeGreaterThan(0);
  });

  it("a no-gap double press launches roughly twice as high as a single hop", () => {
    const single = createRunner("s");
    step(single, 16, 1);
    let peakSingle = single.y;
    for (let i = 0; i < 120 && !single.grounded; i++) {
      step(single, 16, 0);
      peakSingle = Math.max(peakSingle, single.y);
    }

    const dbl = createRunner("s");
    step(dbl, 16, 2); // two presses, same frame
    let peakDbl = dbl.y;
    for (let i = 0; i < 200 && !dbl.grounded; i++) {
      step(dbl, 16, 0);
      peakDbl = Math.max(peakDbl, dbl.y);
    }

    const riseSingle = peakSingle - createRunner("s").y;
    const riseDbl = peakDbl - createRunner("s").y;
    expect(riseDbl).toBeGreaterThan(riseSingle * 1.7);
  });
});
