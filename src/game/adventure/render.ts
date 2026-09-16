import { WIDTH, HEIGHT, HERO_H, HERO_W, bossVulnerable, hazardPhase, platformAt, platformSolid, type State } from "./engine";
import { CHAPTER_ENEMIES, WORLDS, type Level } from "./content";
import type { Settings } from "./save";
import { BOSS_SPRITES, EFFECT_SPRITES, ENEMY_SPRITES, drawBossSprite, drawEnemySprite, drawEffect, type EffectName } from "./sprites";
import { CHARACTER_EYES, CHARACTER_FUR, CHARACTER_SPRITE, type CharacterId } from "../characters";
import { CHARACTER_RUN_ATLAS, characterRunFrame } from "../characterRunAtlas";
import { drawCoin } from "../coinArt";
import { createNearBiteTracker, drawPlant, PLANT_SPRITE_ASPECT, type NearBiteTracker } from "../plantJaw";

export type Art = {
  character: CharacterId;
  forest: HTMLImageElement;
  panda: HTMLImageElement;
  run: HTMLImageElement;
  bush: HTMLImageElement;
  grass: HTMLImageElement;
  plantHead: HTMLImageElement;
  plantJaw: HTMLImageElement;
  boss: HTMLImageElement;
  effects: HTMLImageElement;
  shade?: HTMLImageElement;
  moth?: HTMLImageElement;
  armored?: HTMLImageElement;
  // One reaction-bite tracker per "rootling" enemy (game/plantJaw.ts),
  // keyed by its index in level.enemies/s.enemies (stable for a level's
  // whole lifetime, since enemies are a fixed array, not spawned/despawned
  // like PandaRunner's hazards). Lives on Art rather than threaded through
  // render()'s own parameters since Art is already the one object Adventure.tsx
  // creates once per session and keeps passing back in.
  plantNearTrackers: Map<number, NearBiteTracker>;
};
const imageCache = new Map<string, HTMLImageElement>();
export function loadImage(path: string) {
  const cached = imageCache.get(path);
  if (cached && !(cached.complete && !cached.naturalWidth)) return cached;
  const image = new Image(); image.decoding = "async"; image.src = path;
  imageCache.set(path, image); return image;
}
export function loadArt(world?: number, character: CharacterId = "panda"): Art {
  const enemies = Object.fromEntries((world === undefined ? [] : CHAPTER_ENEMIES[world]).flatMap(kind => {
    const spec = ENEMY_SPRITES[kind]; return spec ? [[kind, loadImage(spec.src)]] : [];
  }));
  return { character, forest: loadImage("/assets/story/forest-journey.webp"), panda: loadImage(CHARACTER_SPRITE[character]), run: loadImage(CHARACTER_RUN_ATLAS.characters[character].src), bush: loadImage("/assets/bush.webp"), grass: loadImage("/assets/grass-mid.webp"), plantHead: loadImage("/assets/zombie-plant-head.webp"), plantJaw: loadImage("/assets/zombie-plant-jaw.webp"), boss: loadImage(world !== undefined && BOSS_SPRITES[world] ? BOSS_SPRITES[world].src : CHARACTER_SPRITE[character]), effects: loadImage(EFFECT_SPRITES.src), ...enemies, plantNearTrackers: new Map() };
}
export const artImages = (art: Art) => Object.values(art).filter((v): v is HTMLImageElement => v instanceof HTMLImageElement);
export const prepareArt = (art: Art) => Promise.all(artImages(art).map(image => image.decode()));
export type Camera = { x: number; zoom: number };
export const newCamera = (): Camera => ({ x: 0, zoom: 1 });
const oval = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
const ready = (image: HTMLImageElement) => image.complete && image.naturalWidth > 0;

/** Animate the original Forest Dash sprite, keeping its face and proportions intact. */
export function drawPanda(ctx: CanvasRenderingContext2D, sprite: HTMLImageElement, x: number, y: number, t: number, pose: string, facing = 1, scale = 1, dark = false, character: CharacterId = "panda", run?: HTMLImageElement) {
  if (!ready(sprite)) return;
  ctx.save(); ctx.translate(x, y + 20 * scale); ctx.scale(facing * scale, scale);
  const moving = pose === "run" || pose === "walk";
  const stride = moving ? Math.sin(t * (pose === "run" ? 19 : 10)) : 0;
  const breathing = pose === "idle" || pose === "peace" ? Math.sin(t * 2.6) * .6 : 0;
  ctx.translate(0, -Math.abs(stride) * 1.8 - Math.abs(breathing));
  if (moving) ctx.rotate(stride * .025);
  if (pose === "dash") { ctx.rotate(.18); ctx.scale(1.12, .9); }
  if (pose === "land") ctx.scale(1.1, .9);
  if (pose === "crouch") ctx.scale(1.08, .7);
  if (pose === "jump") ctx.rotate(-.12);
  if (pose === "fall") ctx.rotate(.1);
  if (pose === "attack") { ctx.translate(4, 0); ctx.rotate(.12); }
  if (pose === "hurt") ctx.rotate(-.14);
  // Match Forest Dash's sprite aspect and compensate for transparent space
  // below its feet -- 0.98, not the visually-round 0.9, because
  // panda-sprite.webp's actual content now runs to ~98% of the canvas
  // height (it was recropped to fill the frame the same way koala/redpanda
  // already did; the old crop's feet landed at ~90%, which is where 0.9 came from).
  const height = 64, width = height, left = -width / 2, top = -height * .98;
  ctx.imageSmoothingEnabled = false;
  if (dark) ctx.filter = "brightness(.5) saturate(.45)";
  const running = moving && t > 0 && run && ready(run);
  if (running) {
    const frame = characterRunFrame(t * (pose === "walk" ? 650 : 1000));
    const { frameWidth, frameHeight } = CHARACTER_RUN_ATLAS;
    ctx.drawImage(run, frame * frameWidth, 0, frameWidth, frameHeight, left, top, width, height);
  } else ctx.drawImage(sprite, left, top, width, height);
  const blinking = t % 4.2 > 4.2 * .935 && t % 4.2 < 4.2 * .96;
  if (blinking && !running) {
    const eye = CHARACTER_EYES[character]; const ew = width * eye.w / 100, eh = height * eye.h / 100;
    const ey = top + height * eye.y / 100 - eh / 2;
    for (const center of [eye.lx, eye.rx]) {
      const ex = left + width * center / 100 - ew / 2;
      ctx.fillStyle = CHARACTER_FUR[character]; ctx.fillRect(ex, ey, ew, eh);
      ctx.fillStyle = "rgba(0,0,0,.42)"; ctx.fillRect(ex + ew * .1, ey + eh * .82, ew * .8, eh * .16);
    }
  }
  ctx.restore();
}
function bossArt(ctx: CanvasRenderingContext2D, s: State, level: Level, reduced: boolean, art: Art) {
  const b = s.boss; if (!b || b.stage === "waiting") return;
  const spec = BOSS_SPRITES[level.world]; const height = spec?.height ?? 112;
  ctx.save(); ctx.translate(b.x, b.y);
  oval(ctx, 0, -3, level.world === 3 ? 76 : 48, 9, "#06171a88");
  const creature = () => {
    if (level.world === 7) {
      drawPanda(ctx, art.panda, 0, -40, reduced ? 0 : s.t, b.stage === "attack" ? "attack" : b.stage === "windup" ? "crouch" : "idle", b.direction, 2, true);
    } else if (!drawBossSprite(ctx, art.boss, spec, b, reduced)) {
      // Visible collision silhouette until the local sprite finishes loading.
      ctx.fillStyle = WORLDS[level.world].color; ctx.globalAlpha *= .5;
      ctx.fillRect(-35, -height, 70, height);
    }
  };
  if (b.pattern === 4 && b.stage === "windup") {
    for (const offset of [-200, 200]) {
      ctx.save(); ctx.translate(offset, 0); ctx.globalAlpha = s.focus > 0 ? .08 : .24; creature(); ctx.restore();
    }
  }
  ctx.save();
  if (b.stage === "defeated") ctx.globalAlpha = reduced ? .3 : Math.max(0, 1 - b.animationTime / .85);
  if (b.hit > 0) ctx.globalAlpha *= .72;
  creature(); ctx.restore();
  if (!reduced && b.hit > 0) drawEffect(ctx, art.effects, "impact", -b.direction * 30, -height * .45, 88, .32 - b.hit, .32);
  if (!reduced && b.stage === "attack") {
    if (b.pattern === 0) drawEffect(ctx, art.effects, "dust", 0, -10, 160, b.animationTime, .45);
    else if (b.pattern === 4) drawEffect(ctx, art.effects, "magic", 0, -height / 2, 175, b.animationTime, .45);
    else if (b.pattern === 2) drawEffect(ctx, art.effects, "poison", b.direction * 54, -45, 78, b.animationTime, .45);
    else if (b.pattern === 1) drawEffect(ctx, art.effects, "dust", -b.direction * 65, -6, 90, b.animationTime, .7);
  }
  if (b.stage === "sleep") { ctx.fillStyle = "#e7dfb1"; ctx.font = "22px Georgia"; ctx.fillText("z Z", 50, -height - 15); }
  if (b.stage === "windup") {
    ctx.strokeStyle = "#f9c76f"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -height * .5, height * .64, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.font = "bold 24px monospace"; ctx.fillStyle = "#ffe2a0"; ctx.fillText("!", -7, -height - 28);
    ctx.fillStyle = "#ffcf6655"; ctx.strokeStyle = "#ffdc84"; ctx.lineWidth = 2;
    if (b.pattern === 3) {
      for (const offset of [-95, 0, 95]) {
        const x = b.targetX + offset - b.x;
        ctx.fillRect(x - 20, -6, 40, 6); ctx.strokeRect(x - 20, -6, 40, 6);
      }
    } else if (b.pattern === 1) {
      const reach = (290 + b.phase * 30) * .7;
      const end = Math.max(level.arena + 120, Math.min(level.arena + 900, b.x + b.direction * reach));
      ctx.fillRect(Math.min(0, end - b.x) - 32, -6, Math.abs(end - b.x) + 64, 6);
    }
  }
  if (bossVulnerable(b)) { ctx.fillStyle = "#b8f4c8"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.fillText(b.stage === "sleep" ? "RING THE BELL" : "OPENING", 0, -height - 28); }
  ctx.restore();
}
export function render(ctx: CanvasRenderingContext2D, s: State, level: Level, art: Art, camera: Camera, settings: Settings, viewWidth = WIDTH, quality = 2, dt = 1 / 60) {
  const world = WORLDS[level.world]; const reduced = settings.reducedMotion;
  const explorationZoom = Math.max(1, Math.min(1.45, viewWidth / 1100));
  const fighting = s.boss?.active && s.boss.hp > 0;
  const duelWidth = s.boss ? Math.max(720, Math.abs(s.x + HERO_W / 2 - s.boss.x) + 300) : 1120;
  const desiredZoom = fighting ? Math.min(explorationZoom, viewWidth / duelWidth) : explorationZoom;
  camera.zoom += (desiredZoom - camera.zoom) * (1 - Math.exp(-4 * dt));
  const visible = viewWidth / camera.zoom;
  const desired = s.boss?.active
    ? Math.max(level.arena - 30, Math.min(level.arena + 1080 - visible, (s.x + HERO_W / 2 + s.boss.x) / 2 - visible / 2))
    : Math.max(0, Math.min(level.length - visible, s.x - visible * .32 + s.vx * .23));
  camera.x += (desired - camera.x) * (1 - Math.exp(-6 * dt));
  ctx.clearRect(0, 0, viewWidth, HEIGHT);
  ctx.fillStyle = world.sky; ctx.fillRect(0, 0, viewWidth, HEIGHT);
  if (ready(art.forest)) {
    const w = HEIGHT * art.forest.naturalWidth / art.forest.naturalHeight;
    for (let x = -(camera.x * .19) % w; x < viewWidth; x += w) ctx.drawImage(art.forest, x, 0, w, HEIGHT);
  }
  ctx.fillStyle = world.tint; ctx.globalAlpha = .14; ctx.fillRect(0, 0, viewWidth, HEIGHT); ctx.globalAlpha = 1;
  const wash = ctx.createLinearGradient(0, 0, 0, HEIGHT); wash.addColorStop(0, `${world.sky}80`); wash.addColorStop(.6, "#071d1b15"); wash.addColorStop(1, "#081b1acc"); ctx.fillStyle = wash; ctx.fillRect(0, 0, viewWidth, HEIGHT);
  if (quality > 0) {
    for (let i = 0; i < quality * 10; i++) {
      const x = (i * 113 + viewWidth - camera.x * .07 % viewWidth) % viewWidth;
      const y = 50 + i * 47 % 360 + (reduced ? 0 : Math.sin(s.worldTime + i) * 10);
      oval(ctx, x, y, 1.5, 1.5, i % 3 ? "#f4dca09a" : "#cbeac9a0");
    }
    if (level.world === 1) { ctx.fillStyle = "#b0b4d515"; for (let i = 0; i < 3; i++) ctx.fillRect(0, 140 + i * 100 + Math.sin(s.worldTime * .3 + i) * 15, viewWidth, 42); }
    if (level.world === 3) { ctx.strokeStyle = "#cadfee30"; ctx.beginPath(); for (let i = 0; i < 40; i++) { const x = (i * 91 + s.worldTime * 80) % viewWidth; const y = (i * 51 + s.worldTime * 230) % HEIGHT; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 15); } ctx.stroke(); }
  }
  ctx.save(); ctx.translate(0, HEIGHT * (1 - camera.zoom)); ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, 0);
  if (settings.shake && !reduced && s.shake > 0) ctx.translate(Math.sin(s.t * 90) * Math.min(4, s.shake), Math.cos(s.t * 73) * Math.min(2, s.shake));
  const onscreen = (x: number, w = 80) => x + w > camera.x - 80 && x < camera.x + visible + 80;
  for (const p of level.platforms) {
    if (!onscreen(p.x, p.w)) continue; const pos = platformAt(p, s.worldTime);
    const solid = platformSolid(s, p); const cracking = s.crumbling.has(p.id);
    ctx.globalAlpha = solid ? 1 : .12;
    ctx.fillStyle = "#293d36"; ctx.fillRect(pos.x, pos.y, pos.w, 42);
    ctx.fillStyle = cracking ? "#c5a679" : world.color; ctx.fillRect(pos.x, pos.y, pos.w, 5);
    ctx.fillStyle = "#608464"; ctx.fillRect(pos.x, pos.y + 5, pos.w, 5);
    for (let x = pos.x + 8; x < pos.x + pos.w - 5; x += 28) {
      const n = Math.abs(Math.sin(x * 37 + p.id));
      ctx.fillStyle = n > .5 ? "#6c776144" : "#131f2580"; ctx.fillRect(x, pos.y + 16 + n * 12, 17, 5);
      ctx.fillStyle = "#acc790"; ctx.fillRect(x, pos.y - 3 - n * 4, 2, 5 + n * 4);
      if (quality > 0 && n > .78) { oval(ctx, x, pos.y - 9, 3, 2, level.world === 7 ? "#f7dcad" : "#d3b3d0"); }
    }
    if (ready(art.grass)) {
      ctx.imageSmoothingEnabled = false;
      for (let x = pos.x; x < pos.x + pos.w; x += art.grass.naturalWidth) {
        const width = Math.min(art.grass.naturalWidth, pos.x + pos.w - x);
        ctx.drawImage(art.grass, 0, 0, width, art.grass.naturalHeight, x, pos.y - 2, width, 27);
      }
    }
    if (p.kind === "crumble") { ctx.strokeStyle = "#17271c"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pos.x + pos.w * .45, pos.y + 4); ctx.lineTo(pos.x + pos.w * .5, pos.y + 23); ctx.lineTo(pos.x + pos.w * .42, pos.y + 40); ctx.stroke(); }
    if (p.kind === "moving") { ctx.fillStyle = "#d1dff1"; ctx.font = "12px monospace"; ctx.fillText("↔", pos.x + 10, pos.y + 28); }
    ctx.globalAlpha = 1;
    if (quality > 0 && ready(art.bush) && p.kind === "stone") { ctx.globalAlpha = .75; ctx.drawImage(art.bush, pos.x + pos.w - 68, pos.y - 33, 60, 37); ctx.globalAlpha = 1; }
  }
  for (const obj of level.objects) {
    if (s.opened.has(obj.id) || !onscreen(obj.x)) continue;
    if (obj.kind === "bell") { ctx.fillStyle = "#d2be87"; ctx.fillRect(obj.x - 3, obj.y - 65, 6, 65); oval(ctx, obj.x, obj.y - 48, 13, 15, "#e2c787"); ctx.fillStyle = "#273a32"; ctx.font = "10px monospace"; ctx.fillText("♪", obj.x - 5, obj.y - 43); }
    else {
      ctx.globalAlpha = obj.kind === "gate" && s.bell > 0 ? .2 : 1;
      const h = obj.kind === "gate" ? 86 : 55; ctx.fillStyle = obj.kind === "strength" ? "#83758c" : "#826847"; ctx.fillRect(obj.x - 18, obj.y - h, 36, h);
      ctx.strokeStyle = "#c6ac77"; ctx.lineWidth = 3; ctx.strokeRect(obj.x - 14, obj.y - h + 4, 28, h - 8);
      ctx.fillStyle = "#f2dca2"; ctx.font = "18px monospace"; ctx.fillText(obj.kind === "dash" ? "↠" : obj.kind === "strength" ? "✹" : obj.kind === "gate" ? "♪" : "×", obj.x - 8, obj.y - 20); ctx.globalAlpha = 1;
    }
  }
  level.checkpoints.forEach((x, i) => {
    if (i === 0 || !onscreen(x)) return;
    const y = level.platforms.find(p => p.kind === "stone" && x >= p.x && x < p.x + p.w)?.y ?? 430;
    ctx.fillStyle = "#617b70"; ctx.fillRect(x + 14, y - 70, 4, 70);
    oval(ctx, x + 16, y - 65, 12, 15, i <= s.checkpoint ? "#c6ffdc" : "#96bcbd");
    if (quality > 1) { ctx.save(); ctx.shadowColor = "#adffdc"; ctx.shadowBlur = 15; oval(ctx, x + 16, y - 65, 5, 7, "#f3ffd8"); ctx.restore(); }
  });
  for (const thing of level.things) {
    if (!onscreen(thing.x) || s.coins.has(thing.id) || s.lore.has(thing.id) || s.opened.has(thing.id)) continue;
    const y = thing.y + (reduced ? 0 : Math.sin(s.t * 2 + thing.id) * 3);
    if (thing.kind === "coin") drawCoin(ctx, thing.x, y, 8);
    else if (thing.kind === "decoy") { ctx.strokeStyle = s.focus > 0 ? "#9a94b730" : "#d6b5d9"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(thing.x, y, 7, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.fillStyle = thing.power && !s.powers.has(thing.power) ? "#a6b6b0" : "#f3dea1"; ctx.font = "20px Georgia"; ctx.fillText(thing.kind === "lore" ? "✧" : "♥", thing.x - 8, y + 5); }
  }
  for (const h of level.hazards) {
    if (!onscreen(h.x)) continue; const phase = h.kind === "thorn" ? "active" : hazardPhase(s.worldTime, h.phase);
    ctx.fillStyle = phase === "active" ? "#d79f9f" : phase === "warning" ? "#ffe08c" : "#639a86";
    ctx.fillRect(h.x, h.y - 3, h.w, 3);
    if (h.kind === "beam" && phase === "active") { ctx.fillStyle = "#c1aaf5"; ctx.fillRect(h.x, h.y - 62, h.w, 7); }
    else if (phase === "active" && h.kind !== "rock") for (let x = h.x; x < h.x + h.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, h.y); ctx.lineTo(x + 6, h.y - 25); ctx.lineTo(x + 12, h.y); ctx.fill(); }
    if (phase === "warning") { ctx.font = "bold 17px monospace"; ctx.fillText("!", h.x + h.w / 2, h.y - 18); }
  }
  for (let i = 0; i < s.enemies.length; i++) {
    const enemy = s.enemies[i]; if ((enemy.hp <= 0 && enemy.hit <= 0) || !onscreen(enemy.x)) continue;
    ctx.save(); if (enemy.hit > 0) ctx.globalAlpha = .5;
    const kind = level.enemies[i].kind;
    const enemySprite = ENEMY_SPRITES[kind];
    const image = kind === "rootling" ? undefined : art[kind];
    if (enemySprite && image && drawEnemySprite(ctx, image, enemySprite, enemy, s.worldTime + i * .21, reduced)) {
      if (enemy.hp > 0 && enemy.hit > 0) {
        const max = kind === "armored" ? 3 : 2;
        ctx.fillStyle = "#152520"; ctx.fillRect(enemy.x - 17, enemy.y - 65, 34, 4);
        ctx.fillStyle = "#ffcf83"; ctx.fillRect(enemy.x - 17, enemy.y - 65, 34 * enemy.hp / max, 4);
      }
    } else if (kind === "rootling" && ready(art.plantHead) && ready(art.plantJaw)) {
      const w = 40, h = w * PLANT_SPRITE_ASPECT; // bottom edge matches the old 46x46 square's
      let tracker = art.plantNearTrackers.get(i);
      if (!tracker) { tracker = createNearBiteTracker(); art.plantNearTrackers.set(i, tracker); }
      const near = Math.abs(enemy.x - s.x) < HERO_W * 2;
      drawPlant(ctx, art.plantHead, art.plantJaw, enemy.x - w / 2, enemy.y + 4 - h, w, s.worldTime * 1000, i * 211, near, tracker);
    }
    else {
      const sway = reduced ? 0 : Math.sin(s.worldTime * 7 + i) * 3;
      oval(ctx, enemy.x, enemy.y - 18, 22, 21, kind === "armored" ? "#797487" : world.tint);
      if (kind === "moth") { oval(ctx, enemy.x - 21, enemy.y - 22, 15, 10 + sway, "#cfafd2"); oval(ctx, enemy.x + 21, enemy.y - 22, 15, 10 - sway, "#cfafd2"); }
      oval(ctx, enemy.x - 7, enemy.y - 23, 3, 4, "#ffe7be"); oval(ctx, enemy.x + 7, enemy.y - 23, 3, 4, "#ffe7be");
      if (kind === "armored") { ctx.strokeStyle = "#c2b8ce"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(enemy.x, enemy.y - 18, 21, Math.PI, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }
  for (const p of s.projectiles) if (p.active && onscreen(p.x)) {
    if (p.delay > 0) { oval(ctx, p.x, 429, p.radius * 1.5, 5, "#f2c68699"); ctx.fillStyle = "#ffe6a0"; ctx.font = "20px monospace"; ctx.fillText("!", p.x - 4, 391); }
    else {
      oval(ctx, p.x, p.y, p.radius, p.radius, p.friendly ? "#b2ffcd" : p.kind === "rock" ? "#a29183" : "#e6b0ba");
      if (!reduced && quality > 0 && p.kind !== "rock") {
        const effect: EffectName = p.kind === "wave" ? "dust" : p.friendly || level.world === 1 ? "poison" : "magic";
        drawEffect(ctx, art.effects, effect, p.x, p.y, p.radius * (p.kind === "wave" ? 3.8 : 3.1), s.worldTime, .55, true);
      }
    }
  }
  bossArt(ctx, s, level, reduced, art);
  if (!s.boss) { ctx.fillStyle = "#b7c8a0"; ctx.fillRect(level.length - 80, 345, 4, 85); ctx.fillStyle = "#f2d38c"; ctx.beginPath(); ctx.moveTo(level.length - 76, 345); ctx.lineTo(level.length - 35, 359); ctx.lineTo(level.length - 76, 374); ctx.fill(); }
  const px = s.x + HERO_W / 2, py = s.y + HERO_H - 20;
  oval(ctx, px, s.y + HERO_H + 1, 19, 5, "#071a2060");
  if (s.hope > 0 || s.rush > 0 || s.power > 0) { ctx.save(); ctx.globalAlpha = .17; oval(ctx, px, py - 6, 35, 48, "#ffe0a3"); ctx.restore(); }
  if (s.dash > 0 && !reduced) { ctx.save(); ctx.globalAlpha = .18; drawPanda(ctx, art.panda, px - s.facing * 25, py, s.t, "dash", s.facing, 1, false, art.character); ctx.restore(); }
  const pose = s.health <= 0 ? "hurt" : s.dash > 0 ? "dash" : s.attack > 0 ? "attack" : s.landing > 0 ? "land" : s.crouched ? "crouch" : !s.grounded ? s.vy > 0 ? "fall" : "jump" : Math.abs(s.vx) > 160 ? "run" : Math.abs(s.vx) > 12 ? "walk" : "idle";
  ctx.save(); if (s.immune > 0 && !reduced) ctx.globalAlpha = .65 + Math.sin(s.t * 20) * .25; drawPanda(ctx, art.panda, px, py, reduced ? 0 : s.t, pose, s.facing, 1, false, art.character, art.run); ctx.restore();
  if (s.attack > 0 && !reduced) drawEffect(ctx, art.effects, "impact", px + s.facing * 39, py - 7, 65, .22 - s.attack, .22);
  if (s.power > 0 && !reduced) drawEffect(ctx, art.effects, "burst", px, py, 170, 5 - s.power, .7);
  if (s.attack > 0) { ctx.strokeStyle = "#fff0c9"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(px + s.facing * 22, py - 9, 32, s.facing > 0 ? -.9 : 2.2, s.facing > 0 ? .9 : 4.1); ctx.stroke(); }
  if (s.shield > 0) { ctx.strokeStyle = "#a3ede6"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(px, py - 8, 34, 42, 0, 0, Math.PI * 2); ctx.stroke(); }
  let drawn = 0;
  for (const p of s.particles) if (p.active && drawn++ < (reduced ? 0 : [12, 30, 60, 96][quality])) { ctx.globalAlpha = Math.min(1, p.life * 3); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size); }
  ctx.globalAlpha = 1; ctx.restore();
  if (s.focus > 0) { ctx.strokeStyle = "#b6e7d855"; ctx.lineWidth = 12; ctx.strokeRect(6, 6, viewWidth - 12, HEIGHT - 12); }
  // Near-camera silhouettes, kept below the playable feet line.
  if (quality > 1) {
    ctx.fillStyle = "#061b1b99";
    for (let i = 0; i < 9; i++) { const x = (i * 175 - camera.x * .5 + viewWidth * 20) % viewWidth; ctx.beginPath(); ctx.moveTo(x - 35, HEIGHT); ctx.quadraticCurveTo(x, HEIGHT - 38 - i % 3 * 9, x + 30, HEIGHT); ctx.fill(); }
  }
}
