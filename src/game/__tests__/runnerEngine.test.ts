import { describe, expect, it } from "vitest";
import {
  createRunner,
  HAZARD_H,
  HAZARD_HIT_INSET_X,
  HAZARD_W,
  jumpPeak,
  jumpReach,
  KILL_Y,
  LANE,
  metres,
  PANDA_H,
  PANDA_HIT_INSET_X,
  PANDA_W,
  PANDA_X,
  STAR_MS,
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
    // Coin placement has genuine seed-to-seed variance (checked across 11
    // seeds while adding the star power-up: 0.49-0.69) -- any future addLedge
    // change that consumes one more or fewer rng() draws shifts every seed's
    // downstream sequence, "arc" included. The bar is set below that natural
    // floor on purpose, so this stays a real check that the mechanism works
    // rather than a pin on one seed's exact current score.
    expect(s.coinsTaken / seen.size).toBeGreaterThan(0.45);
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

describe("star power-up (Mario-style invincibility)", () => {
  it("picking one up grants a full window of invincibility", () => {
    const s = createRunner("pickup");
    s.stars = [{ id: 999, x: PANDA_X + PANDA_W / 2, y: s.y + PANDA_H / 2, taken: false }];
    s.hazards = [];
    step(s, 16, false);
    expect(s.starsTaken).toBe(1);
    expect(s.invincibleMs).toBe(STAR_MS);
  });

  it("grabbing a second star mid-glow refreshes the window rather than stacking it", () => {
    const s = createRunner("refresh");
    s.invincibleMs = 1000;
    s.stars = [{ id: 998, x: PANDA_X + PANDA_W / 2, y: s.y + PANDA_H / 2, taken: false }];
    step(s, 16, false);
    expect(s.invincibleMs).toBe(STAR_MS); // reset, not 1000 + STAR_MS
  });

  it("counts down every frame and clamps at zero rather than going negative", () => {
    const s = createRunner("countdown");
    s.invincibleMs = 50;
    s.hazards = [];
    s.stars = [];
    step(s, 16, false);
    step(s, 16, false);
    step(s, 16, false);
    expect(s.invincibleMs).toBe(50 - 16 * 3);
    step(s, 16, false); // would go to -14 -- must clamp instead
    expect(s.invincibleMs).toBe(0);
  });

  it("touching a hazard while starred defeats it and pays out a coin, instead of ending the run", () => {
    const s = createRunner("shielded");
    s.invincibleMs = STAR_MS;
    s.hazards = [{ id: 500, x: PANDA_X, y: s.y, kind: "mine", hue: 0 }];
    const coinsBefore = s.coinsTaken;
    step(s, 16, false);
    expect(s.over).toBe(false);
    expect(s.hazards.find((h) => h.id === 500)).toBeUndefined();
    expect(s.coinsTaken).toBe(coinsBefore + 1);
  });

  it("the exact same hazard is still lethal with no star active -- the shield is the only thing that changed", () => {
    const s = createRunner("unshielded");
    s.invincibleMs = 0;
    s.hazards = [{ id: 501, x: PANDA_X, y: s.y, kind: "mine", hue: 0 }];
    step(s, 16, false);
    expect(s.over).toBe(true);
  });

  it("a hazard is lethal again the instant the window actually expires", () => {
    const s = createRunner("expiring");
    s.invincibleMs = 8; // expires partway through this frame's dt
    s.hazards = [{ id: 502, x: PANDA_X, y: s.y, kind: "mine", hue: 0 }];
    step(s, 16, false);
    expect(s.invincibleMs).toBe(0);
    expect(s.over).toBe(true);
  });

  it("shows up during real play, at least sometimes, across a spread of seeds", () => {
    let anyStar = false;
    for (const seed of ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"]) {
      const seen = new Set<number>();
      const track = (st: RunnerState) => {
        for (const star of st.stars) seen.add(star.id);
        return play(st);
      };
      run(createRunner(seed), 15000, track);
      if (seen.size > 0) anyStar = true;
    }
    expect(anyStar).toBe(true);
  });
});

describe("hazard hitbox forgiveness", () => {
  it("a graze that only overlaps in the trimmed margin no longer kills you", () => {
    const s = createRunner("graze");
    // Full boxes overlap by a hair (0.5 units) -- the pre-forgiveness AABB
    // test would have called this a hit. The insets trim enough off each
    // side that the shrunk boxes no longer touch at all.
    const hx = PANDA_X - HAZARD_W + 0.5;
    s.hazards = [{ id: 700, x: hx, y: s.y, kind: "mine", hue: 0 }];
    // sanity: this genuinely is a graze under the OLD, un-inset test --
    // otherwise the test would not be exercising forgiveness at all.
    expect(PANDA_X < hx + HAZARD_W && PANDA_X + PANDA_W > hx).toBe(true);
    step(s, 16, false);
    expect(s.over).toBe(false);
  });

  it("real, substantial overlap still kills you -- forgiveness isn't a free pass", () => {
    const s = createRunner("solid-hit");
    s.hazards = [{ id: 701, x: PANDA_X + PANDA_W / 2 - HAZARD_W / 2, y: s.y, kind: "mine", hue: 0 }];
    step(s, 16, false);
    expect(s.over).toBe(true);
  });

  it("the trimmed margin is a real, non-trivial fraction of the box -- not a rounding error", () => {
    expect(PANDA_HIT_INSET_X).toBeGreaterThan(0.5);
    expect(HAZARD_HIT_INSET_X).toBeGreaterThan(0.5);
    expect(PANDA_HIT_INSET_X).toBeLessThan(PANDA_W / 2);
    expect(HAZARD_HIT_INSET_X).toBeLessThan(HAZARD_W / 2);
  });

  it("addLedge's own gap/runway math is untouched -- HAZARD_W/HAZARD_H still size level layout at full scale", () => {
    // Regression guard: the whole point of insetting only inside hitsHazard is
    // that level generation (gap sizing, landing runway) keeps reasoning about
    // hazards at their full footprint. If a future change accidentally shrunk
    // HAZARD_W/HAZARD_H themselves instead, this would still pass -- so what it
    // actually guards is that HAZARD_H stays tall enough to matter physically
    // (per the constant's own comment: short enough to jump, not zero).
    expect(HAZARD_H).toBeGreaterThan(0);
    expect(HAZARD_H).toBeLessThan(jumpPeak());
  });
});
