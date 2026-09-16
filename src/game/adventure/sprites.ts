import manifest from './sprite-manifest.json';
import type { Boss, Enemy } from './engine';
import type { EnemyKind } from './content';

export type Clip = { row: number; frames: number };
export type SpriteSheet = { src: string; w: number; h: number; clips: Record<string, Clip | undefined> };
export type BossSprite = SpriteSheet & { name: string; anchorX: number; anchorY: number; scale: number; height: number };
export const BOSS_SPRITES: readonly BossSprite[] = manifest.bosses;
export const EFFECT_SPRITES: SpriteSheet = manifest.effects;
// Smaller creatures share the shipped atlases and their combat animations.
export const ENEMY_SPRITES: Partial<Record<EnemyKind, BossSprite>> = {
  shade: BOSS_SPRITES[2], moth: BOSS_SPRITES[3], armored: BOSS_SPRITES[6],
};
export type EffectName = 'impact' | 'dust' | 'magic' | 'poison' | 'burst';

export function clipFrame(clip: Clip, time: number, duration: number, loop = false) {
  const progress = Math.max(0, time) / Math.max(.001, duration);
  return loop ? Math.floor(progress * clip.frames) % clip.frames : Math.min(clip.frames - 1, Math.floor(progress * clip.frames));
}

/** Attacks play once over the exact damaging window, regardless of display FPS. */
export function bossAnimation(boss: Boss, spec: BossSprite, reduced: boolean) {
  let name = 'idle', duration = .9, time = boss.animationTime, loop = true;
  if (boss.stage === 'defeated') { name = 'death'; duration = .8; loop = false; }
  else if (boss.hit > 0) { name = 'hurt'; time = .32 - boss.hit; duration = .32; loop = false; }
  else if (boss.stage === 'attack') {
    const variant = `attack${boss.pattern % 4 + 1}`;
    name = spec.clips[variant] ? variant : 'attack'; duration = boss.pattern === 1 ? .7 : .45; loop = false;
  } else if (boss.stage === 'windup') { name = 'windup'; duration = 1.3; }
  else if (boss.stage === 'sleep') { time = 0; }
  const clip = spec.clips[name] ?? spec.clips.idle!;
  return { clip, frame: reduced ? (boss.stage === 'attack' ? Math.floor(clip.frames / 2) : 0) : clipFrame(clip, time, duration, loop) };
}

export function drawBossSprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, spec: BossSprite, boss: Boss, reduced: boolean) {
  if (!image.complete || !image.naturalWidth) return false;
  const { clip, frame } = bossAnimation(boss, spec, reduced);
  const nativeFacing = spec.name === 'turtle' || spec.name === 'centipede' ? -1 : 1;
  ctx.save(); ctx.scale(boss.direction * nativeFacing * spec.scale, spec.scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame * spec.w, clip.row * spec.h, spec.w, spec.h, -spec.anchorX, -spec.anchorY, spec.w, spec.h);
  ctx.restore(); return true;
}

export function drawEnemySprite(ctx: CanvasRenderingContext2D, image: HTMLImageElement, spec: BossSprite, enemy: Enemy, time: number, reduced: boolean) {
  if (!image.complete || !image.naturalWidth) return false;
  const defeated = enemy.hp <= 0;
  const clip = spec.clips[defeated ? 'death' : enemy.hit > 0 ? 'hurt' : 'walk'] ?? spec.clips.idle!;
  const frame = reduced ? 0 : clipFrame(clip, enemy.hit > 0 ? .3 - enemy.hit : time, enemy.hit > 0 ? .3 : .8, enemy.hit === 0);
  const scale = spec.scale * 52 / spec.height;
  ctx.save(); ctx.translate(enemy.x, enemy.y); ctx.scale(enemy.direction * scale, scale);
  ctx.imageSmoothingEnabled = false;
  if (defeated) ctx.globalAlpha *= enemy.hit / .3;
  ctx.drawImage(image, frame * spec.w, clip.row * spec.h, spec.w, spec.h, -spec.anchorX, -spec.anchorY, spec.w, spec.h);
  ctx.restore(); return true;
}

export function drawEffect(ctx: CanvasRenderingContext2D, image: HTMLImageElement, name: EffectName, x: number, y: number, size: number, elapsed: number, duration = .4, loop = false) {
  if (!image.complete || !image.naturalWidth || (!loop && elapsed >= duration)) return;
  const clip = EFFECT_SPRITES.clips[name]!;
  const frame = clipFrame(clip, elapsed, duration, loop);
  ctx.drawImage(image, frame * 96, clip.row * 96, 96, 96, x - size / 2, y - size / 2, size, size);
}
