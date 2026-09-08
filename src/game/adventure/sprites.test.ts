import { describe, expect, it } from 'vitest';
import { createState, idleInput, step } from './engine';
import { makeLevel } from './content';
import { emptySave } from './save';
import { BOSS_SPRITES, bossAnimation, clipFrame } from './sprites';

describe('boss sprite timing', () => {
  it('restarts animation at the attack transition and finishes within its damaging window', () => {
    const level = makeLevel(2), state = createState(level, emptySave());
    const boss = state.boss!;
    state.x = level.arena + 110; boss.active = true; boss.stage = 'windup'; boss.timer = .001; boss.animationTime = 1;
    step(state, level, idleInput());
    expect(boss.stage).toBe('attack'); expect(boss.animationTime).toBe(0);
    expect(bossAnimation(boss, BOSS_SPRITES[0], false).frame).toBe(0);
    boss.animationTime = .449;
    const end = bossAnimation(boss, BOSS_SPRITES[0], false);
    expect(end.frame).toBe(end.clip.frames - 1);
    expect(clipFrame(end.clip, 50, .45)).toBe(end.clip.frames - 1);
  });
  it('uses death frames even if the final hit is still active, and keeps reduced-motion attacks readable', () => {
    const boss = createState(makeLevel(5), emptySave()).boss!;
    const spec = BOSS_SPRITES[1];
    boss.stage = 'defeated'; boss.hit = .32; boss.animationTime = .79;
    expect(bossAnimation(boss, spec, false).clip).toBe(spec.clips.death);
    expect(bossAnimation(boss, spec, false).frame).toBe(spec.clips.death!.frames - 1);
    boss.stage = 'attack'; boss.hit = 0;
    expect(bossAnimation(boss, spec, true).frame).toBe(Math.floor(spec.clips.attack!.frames / 2));
  });
  it('assigns seven different source creatures with complete combat animations', () => {
    expect(new Set(BOSS_SPRITES.map(s => s.src)).size).toBe(7);
    for (const sprite of BOSS_SPRITES) {
      for (const action of ['idle', 'windup', 'attack', 'hurt', 'death']) {
        expect(sprite.clips[action]?.frames, `${sprite.name}/${action}`).toBeGreaterThan(1);
      }
    }
  });
});
