import { describe, expect, it } from "vitest";
import { createStory, HERO_H, HERO_W, parseStoryProgress, restartStory, stepStory, STORY_LEVELS, storyCoins, trapPhase } from "../storyEngine";

const tick = 1 / 120;
describe("Story Mode", () => {
  it("each authored gap can be cleared with one jump, including uphill landings", () => {
    for (const level of STORY_LEVELS) {
      for (let i = 0; i < level.platforms.length - 1; i++) {
        const from = level.platforms[i]; const to = level.platforms[i + 1];
        const state = createStory(); state.x = from.x + from.w - HERO_W - 5; state.y = from.y - HERO_H;
        let landed = false;
        for (let frame = 0; frame < 150; frame++) {
          stepStory(state, level, tick, 1, frame === 0);
          if (state.grounded && state.x + HERO_W > to.x && state.y + HERO_H === to.y) { landed = true; break; }
        }
        expect(landed, `${level.title}: gap ${i + 1}`).toBe(true);
      }
    }
  });
  it("all three chapters are completable using movement and jumps", () => {
    for (const level of STORY_LEVELS) {
      const s = createStory();
      for (let frame = 0; frame < 6000 && s.status === "playing"; frame++) {
        const platform = level.platforms.find(p => s.x + HERO_W > p.x && s.x < p.x + p.w && Math.abs(s.y + HERO_H - p.y) < 2);
        const hazardAhead = level.traps.some(trap => trap.x > s.x && trap.x - s.x < 85);
        const edgeAhead = platform && platform.x + platform.w - (s.x + HERO_W) < 8;
        stepStory(s, level, tick, 1, s.grounded && Boolean(hazardAhead || edgeAhead));
      }
      expect(s.status, `${level.title}: ${s.reason}, x=${s.x}`).toBe("won");
      expect(s.shard).toBe(true);
      expect(s.checkpoint).toBe(true);
    }
  });
  it("shows a warning before timed thorns activate and only active thorns hurt", () => {
    const level = STORY_LEVELS[1]; const trap = level.traps[0];
    expect(trapPhase(trap, 0)).toBe("safe"); expect(trapPhase(trap, 1.5)).toBe("warning"); expect(trapPhase(trap, 2)).toBe("active");
    for (const t of [0, 1.5, 2]) {
      const s = createStory(); s.x = trap.x; s.y = 320 - HERO_H; s.t = t;
      stepStory(s, level, tick, 0, false);
      expect(s.status).toBe(t === 2 ? "dead" : "playing");
    }
  });
  it("collapsing platforms drop after the warning window and restore on retry", () => {
    const level = STORY_LEVELS[1]; const i = level.platforms.findIndex(p => p.crumble); const p = level.platforms[i];
    const s = createStory(); s.x = p.x + 40; s.y = p.y - HERO_H;
    for (let frame = 0; frame < 240; frame++) stepStory(s, level, tick, 0, false);
    expect(s.status).toBe("dead");
    expect(restartStory(s, level).crumbling).toEqual({});
  });
  it("checkpoint retries preserve collected items without awarding duplicates", () => {
    const level = STORY_LEVELS[0]; const s = createStory();
    s.x = level.checkpoint; stepStory(s, level, tick, 0, false);
    expect(s.checkpoint).toBe(true);
    s.coins = [0, 1]; s.shard = true;
    const retry = restartStory(s, level);
    expect(retry.x).toBe(level.checkpoint); expect(retry.coins).toEqual([0, 1]); expect(retry.shard).toBe(true);
    const coin = storyCoins(level)[0]; retry.x = coin.x - HERO_W / 2; retry.y = coin.y - HERO_H / 2;
    stepStory(retry, level, tick, 0, false);
    expect(retry.coins).toEqual([0, 1]);
  });
  it("requires a fragment and a safe landing to finish", () => {
    const level = STORY_LEVELS[0]; const s = createStory(); s.x = level.length - 100;
    stepStory(s, level, tick, 0, false); expect(s.status).toBe("playing");
    s.shard = true; stepStory(s, level, tick, 0, false); expect(s.status).toBe("won");
  });
  it("remembers an early jump press until landing after using both jumps", () => {
    const s = createStory(); s.y = 350 - HERO_H - 2; s.grounded = false; s.coyote = 0; s.jumps = 2; s.vy = 100;
    stepStory(s, STORY_LEVELS[0], tick, 0, true);
    for (let i = 0; i < 6; i++) stepStory(s, STORY_LEVELS[0], tick, 0, false);
    expect(s.vy).toBeLessThan(0); expect(s.jumps).toBe(1);
  });
  it("recovers malformed saves and rejects skipped chapters and invalid coin counts", () => {
    expect(parseStoryProgress("broken").completed).toEqual([]);
    expect(parseStoryProgress('{"completed":[2]}').completed).toEqual([]);
    expect(parseStoryProgress('{"completed":[0,1],"bestCoins":[999,-5,"3"]}')).toEqual({ completed: [0, 1], bestCoins: [15, 0, 0] });
  });
});
