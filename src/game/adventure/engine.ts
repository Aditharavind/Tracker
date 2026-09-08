import { type Level, type Platform, type Power, WORLDS } from "./content";
import type { Attempt, Save } from "./save";

export const WIDTH = 960, HEIGHT = 540, HERO_W = 34, HERO_H = 46, FIXED_STEP = 1 / 120;
export type Input = { move: number; jump: boolean; jumpHeld: boolean; attack: boolean; dash: boolean; ability: boolean; crouch: boolean; walk: boolean; selected: Power };
export const idleInput = (): Input => ({ move: 0, jump: false, jumpHeld: false, attack: false, dash: false, ability: false, crouch: false, walk: false, selected: "focus" });
export type Particle = { active: boolean; x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };
export type Projectile = { active: boolean; x: number; y: number; vx: number; vy: number; life: number; delay: number; radius: number; friendly: boolean; kind: "wave" | "rock" | "orb" };
export type Enemy = { id: number; x: number; y: number; hp: number; direction: number; hit: number };
export type Boss = { x: number; y: number; hp: number; maxHp: number; phase: number; stage: "waiting" | "windup" | "attack" | "recover" | "sleep" | "defeated"; timer: number; cycle: number; pattern: number; direction: number; hit: number; targetX: number; active: boolean };
export type Event = { kind: "jump" | "land" | "attack" | "hit" | "dash" | "coin" | "checkpoint" | "power" | "boss" | "win" | "block" | "lore" | "break"; text?: string };
export type State = {
  x: number; y: number; vx: number; vy: number; facing: number; grounded: boolean; groundId: number; jumps: number;
  coyote: number; buffer: number; health: number; immune: number; crouched: boolean;
  attack: number; attackCooldown: number; attackSerial: number; hitTargets: Set<number>;
  dash: number; dashCooldown: number; focus: number; shield: number; abilityCooldown: number; power: number; hope: number;
  momentum: number; rush: number; resolve: number; lastAction: number; landing: number; shake: number;
  t: number; worldTime: number; checkpoint: number; elapsed: number; status: "playing" | "dead" | "won"; reason: string;
  coins: Set<number>; lore: Set<number>; defeated: Set<number>; opened: Set<number>; crumbling: Map<number, number>; bell: number;
  enemies: Enemy[]; boss: Boss | null; particles: Particle[]; projectiles: Projectile[]; events: Event[]; revision: number;
  powers: Set<Power>; upgrades: Set<string>;
};
export function platformAt(p: Platform, time: number) {
  return { x: p.x + (p.kind === "moving" ? Math.sin(time * 1.2 + p.id) * (p.amplitude ?? 20) : 0), y: p.y, w: p.w };
}
export function platformSolid(s: State, p: Platform) {
  if (p.kind === "crumble" && s.crumbling.has(p.id) && s.worldTime - s.crumbling.get(p.id)! > 1.35) return false;
  return p.kind !== "vanish" || (s.worldTime + p.id * .2) % 4 < 2.9;
}
export function hazardPhase(time: number, phase: number) { const t = (time + phase) % 3.8; return t < 1.8 ? "safe" : t < 2.5 ? "warning" : "active"; }
export function createState(level: Level, save: Pick<Save, "powers" | "upgrades">, attempt?: Attempt): State {
  const checkpoint = Math.max(0, Math.min(level.checkpoints.length - 1, attempt?.checkpoint ?? 0));
  const x = level.checkpoints[checkpoint];
  const platform = level.platforms.find(p => p.kind === "stone" && x >= p.x && x + HERO_W <= p.x + p.w);
  const maxHp = level.world === 7 ? 20 : 8 + level.world;
  return {
    x, y: (platform?.y ?? 430) - HERO_H, vx: 0, vy: 0, facing: 1, grounded: true, groundId: platform?.id ?? -1, jumps: 0,
    coyote: .1, buffer: 0, health: 5, immune: .8, crouched: false, attack: 0, attackCooldown: 0, attackSerial: 0, hitTargets: new Set(),
    dash: 0, dashCooldown: 0, focus: 0, shield: 0, abilityCooldown: 0, power: 0, hope: 0, momentum: 0, rush: 0, resolve: 0, lastAction: 0, landing: 0, shake: 0,
    t: 0, worldTime: 0, elapsed: attempt?.elapsed ?? 0, checkpoint, status: "playing", reason: "",
    coins: new Set(attempt?.coins), lore: new Set(attempt?.lore), defeated: new Set(attempt?.defeated), opened: new Set(attempt?.opened), crumbling: new Map(), bell: 0,
    enemies: level.enemies.map(e => ({ id: e.id, x: e.x, y: e.y, hp: attempt?.defeated.includes(e.id) ? 0 : e.kind === "armored" ? 3 : 2, direction: -1, hit: 0 })),
    boss: level.boss ? { x: level.arena + 680, y: 430, hp: maxHp, maxHp, phase: 1, stage: "waiting", timer: 1, cycle: 0, pattern: 0, direction: -1, hit: 0, targetX: x, active: false } : null,
    particles: Array.from({ length: 96 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: "", size: 0 })),
    projectiles: Array.from({ length: 36 }, () => ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, delay: 0, radius: 0, friendly: false, kind: "orb" as const })),
    events: [], revision: 0, powers: new Set(save.powers), upgrades: new Set(save.upgrades),
  };
}
export function snapshot(s: State, scene: Attempt["scene"] = "play", page = 0): Attempt {
  return { checkpoint: s.checkpoint, coins: [...s.coins], lore: [...s.lore], defeated: [...s.defeated], opened: [...s.opened], elapsed: s.elapsed, scene, page };
}
function emit(s: State, kind: Event["kind"], text?: string) { if (s.events.length < 24) s.events.push({ kind, text }); }
function particles(s: State, x: number, y: number, color: string, count = 8) {
  let n = 0;
  for (const p of s.particles) {
    if (p.active) continue;
    const angle = (n * 2.4 + s.t) % (Math.PI * 2);
    Object.assign(p, { active: true, x, y, vx: Math.cos(angle) * (45 + n * 8), vy: Math.sin(angle) * 75 - 45, life: .35 + n * .025, color, size: 2 + n % 3 });
    if (++n >= count) break;
  }
}
function rewardAction(s: State, amount: number) {
  s.resolve = Math.min(100, s.resolve + amount);
  if (s.powers.has("momentum")) s.momentum = Math.min(100, s.momentum + amount * (s.hope > 0 ? 2.2 : 1.5));
  s.lastAction = s.t;
}
export function damage(s: State, reason: string, direction = -s.facing) {
  if (s.status !== "playing" || s.immune > 0 || s.dash > 0 || s.hope > 0) return false;
  if (s.shield > 0) { rewardAction(s, 12); s.immune = .25; emit(s, "block", "Blocked. Stay steady."); return false; }
  s.health--; s.immune = 1.25; s.vx = direction * 170; s.vy = -160; s.grounded = false; s.momentum *= .35; s.shake = 6;
  particles(s, s.x + 17, s.y + 23, "#e9a89f"); emit(s, "hit");
  if (s.health <= 0) { s.status = "dead"; s.reason = reason; }
  return true;
}
function projectile(s: State, x: number, y: number, vx: number, vy: number, kind: Projectile["kind"], delay = 0) {
  const p = s.projectiles.find(p => !p.active); if (!p) return;
  Object.assign(p, { active: true, x, y, vx, vy, kind, life: 5, radius: kind === "rock" ? 16 : kind === "wave" ? 13 : 10, delay, friendly: false });
}
export function bossVulnerable(b: Boss) { return b.stage === "recover" || b.stage === "sleep"; }
function hitBoss(s: State, amount: number) {
  const b = s.boss;
  if (!b || b.hp <= 0 || b.hit > 0 || !bossVulnerable(b)) return;
  b.hp = Math.max(0, b.hp - amount); b.hit = .32; rewardAction(s, 10); s.shake = 4;
  particles(s, b.x, b.y - 60, "#f6dca0", 14); emit(s, "attack");
  if (b.hp <= 0) { b.stage = "defeated"; s.projectiles.forEach(p => p.active = false); s.status = "won"; emit(s, "win", "You found your opening. The path is clear."); s.revision++; }
}
export function bossPattern(world: number, phase: number, cycle: number) {
  if (world === 7) return phase === 1 ? cycle % 2 : phase === 2 ? 2 : phase === 3 ? 3 : phase === 4 ? 4 : cycle % 5;
  return world === 0 ? cycle % 2 : world === 1 ? 2 : world === 2 ? 4 : world === 3 ? 3 : world === 4 ? 1 : cycle % 5;
}
function stepBoss(s: State, level: Level, dt: number, move: number) {
  const b = s.boss; if (!b || b.stage === "defeated") return;
  if (!b.active) {
    if (s.x < level.arena + 90) return;
    b.active = true; b.stage = "windup"; b.timer = 1.3; emit(s, "boss", `${WORLDS[level.world].boss}: watch, dodge, then strike.`);
  }
  // Keep the fight on its checkpoint platform; the entrance remains safe before activation.
  s.x = Math.max(level.arena + 10, Math.min(level.arena + 980, s.x));
  b.phase = Math.min(level.world === 7 ? 5 : 3, 1 + Math.floor((1 - b.hp / b.maxHp) * (level.world === 7 ? 5 : 3)));
  b.hit = Math.max(0, b.hit - dt); b.timer -= dt;
  if (b.stage === "windup") {
    if (b.pattern === 2) b.x = Math.max(level.arena + 290, Math.min(level.arena + 850, b.x - move * 60 * dt));
    if (b.timer <= 0) {
      b.stage = "attack"; b.timer = b.pattern === 1 ? .7 : .45; b.direction = s.x < b.x ? -1 : 1;
      emit(s, "boss"); s.shake = 5;
      if (b.pattern === 0) {
        projectile(s, b.x, 417, -220 - b.phase * 15, 0, "wave"); projectile(s, b.x, 417, 220 + b.phase * 15, 0, "wave");
      } else if (b.pattern === 3) {
        for (let i = -1; i <= 1; i++) projectile(s, b.targetX + i * 95, 90, 0, 210, "rock", .2 + (i + 1) * .12);
      } else if (b.pattern === 4) {
        b.x = s.x < level.arena + 500 ? level.arena + 740 : level.arena + 280;
        for (let i = 0; i < b.phase; i++) projectile(s, b.x, 375 - i * 35, b.direction * 185, 0, "orb", .15 * i);
      } else if (b.pattern === 2) projectile(s, b.x, 402, b.direction * 250, 0, "orb");
    }
  } else if (b.stage === "attack") {
    if (b.pattern === 1) b.x = Math.max(level.arena + 120, Math.min(level.arena + 900, b.x + b.direction * (290 + b.phase * 30) * dt));
    if (b.timer <= 0) {
      b.stage = level.world === 0 && b.phase >= 2 && b.cycle % 2 === 0 ? "sleep" : "recover";
      b.timer = b.stage === "sleep" ? 4.8 : level.world === 4 ? 2 : 2.5;
      emit(s, "boss", b.stage === "sleep" ? "He's asleep! Smash the bell to drop a seed pod." : "Opening! Panda Smash now.");
    }
  } else if (b.stage === "recover" || b.stage === "sleep") {
    if (level.world === 4 && b.hit > 0) b.x = Math.max(level.arena + 170, Math.min(level.arena + 850, b.x - b.direction * 85 * dt));
    if (b.timer <= 0) {
      b.cycle++; b.pattern = bossPattern(level.world, b.phase, b.cycle); b.stage = "windup";
      b.timer = Math.max(.8, 1.5 - b.phase * .1); b.targetX = s.x + HERO_W / 2;
      if (level.world === 4 && s.t - s.lastAction > 4) b.hp = Math.min(b.maxHp, b.hp + 1);
      if (level.world === 5 || level.world === 6) projectile(s, level.arena + 220 + (b.cycle % 3) * 260, 70, 0, 160, "rock", 1.2);
      emit(s, "boss", ["Ground slam — jump!", "Charge — jump or dodge!", "Your shadow is watching.", "Falling stones — watch the shadows!", "Look for the real shadow."][b.pattern]);
    }
  }
  if (b.stage === "attack" && Math.abs(s.x + HERO_W / 2 - b.x) < 64 && s.y + HERO_H > b.y - 90) damage(s, "Watch the windup, dodge the attack, and strike during recovery.", s.x < b.x ? -1 : 1);
}

export function step(s: State, level: Level, input: Input, dt = FIXED_STEP) {
  if (s.status !== "playing") return;
  dt = Math.max(0, Math.min(1 / 30, dt)); s.events.length = 0;
  s.t += dt; s.elapsed += dt;
  const worldDt = dt * (s.focus > 0 ? .32 : 1); const oldWorldTime = s.worldTime; s.worldTime += worldDt;
  for (const key of ["immune", "attack", "attackCooldown", "dash", "dashCooldown", "focus", "shield", "abilityCooldown", "power", "hope", "rush", "landing", "shake", "bell"] as const) s[key] = Math.max(0, s[key] - dt);
  s.buffer = input.jump ? .14 : Math.max(0, s.buffer - dt); s.coyote = s.grounded ? .11 : Math.max(0, s.coyote - dt);
  s.crouched = input.crouch && s.grounded;
  if (s.buffer > 0 && (s.coyote > 0 || (s.powers.has("second") && s.jumps < 2))) {
    s.vy = -(s.hope > 0 ? 505 : 480); s.jumps = s.coyote > 0 ? 1 : s.jumps + 1;
    s.grounded = false; s.coyote = 0; s.buffer = 0; emit(s, "jump"); rewardAction(s, 3); particles(s, s.x + 17, s.y + HERO_H, "#d3d1a6", 5);
  }
  if (!input.jumpHeld && s.vy < -220) s.vy += 850 * dt;
  if (input.dash && s.powers.has("dash") && s.dashCooldown === 0 && (s.grounded || s.upgrades.has("air-dash") || s.hope > 0)) {
    s.dash = s.upgrades.has("extended-dash") || s.hope > 0 ? .27 : .2; s.dashCooldown = .85; s.vy = Math.min(0, s.vy); emit(s, "dash"); rewardAction(s, 7);
  }
  if (input.attack && s.attackCooldown === 0) { s.attack = .22; s.attackCooldown = .38; s.attackSerial++; s.hitTargets.clear(); emit(s, "attack"); }
  if (input.ability && s.abilityCooldown === 0 && s.powers.has(input.selected)) {
    if (input.selected === "focus") { s.focus = s.hope > 0 ? 5 : 3; s.abilityCooldown = 7; emit(s, "power", "Focus. Find the steady path."); }
    if (input.selected === "shield") { s.shield = s.hope > 0 ? 2 : 1; s.abilityCooldown = 3.5; emit(s, "power", "Courage Shield"); }
    if ((input.selected === "strength" || input.selected === "hope") && s.resolve >= 60) {
      s.resolve -= 60; s.power = 5; s.abilityCooldown = 12; s.shake = 8;
      if (input.selected === "hope") s.hope = 10;
      for (const enemy of s.enemies) if (Math.abs(enemy.x - s.x) < 210) { enemy.hp = 0; s.defeated.add(enemy.id); s.revision++; }
      for (const obj of level.objects) if (["strength", "wood", "dash"].includes(obj.kind) && Math.abs(obj.x - s.x) < 210) { s.opened.add(obj.id); s.revision++; }
      if (s.boss && Math.abs(s.boss.x - s.x) < 220) hitBoss(s, 3);
      particles(s, s.x + 17, s.y + 40, "#ffe4a2", 24); emit(s, "power", input.selected === "hope" ? "Hope Awakening" : "Inner Strength");
    }
  }
  if (s.momentum >= 100 && !s.rush) { s.rush = 4; s.momentum = 0; emit(s, "power", "Panda Rush!"); }
  if (s.t - s.lastAction > 2.5) s.momentum = Math.max(0, s.momentum - 18 * dt);
  if (Math.abs(input.move) > .1) s.facing = input.move > 0 ? 1 : -1;
  const maxSpeed = (input.walk ? 125 : 235 + s.powers.size * 5) * (s.crouched ? .42 : s.rush > 0 ? 1.35 : 1);
  const targetV = input.move * maxSpeed;
  const accel = s.grounded ? (input.move ? 1600 : 2100) : 1000;
  s.vx += Math.max(-accel * dt, Math.min(accel * dt, targetV - s.vx));
  if (s.dash > 0) { s.vx = s.facing * (s.hope > 0 ? 780 : 650); if (Math.floor(s.t * 40) % 2 === 0) particles(s, s.x + 17, s.y + 24, "#c5efdf", 2); }
  if (s.grounded && s.groundId >= 0) {
    const riding = level.platforms.find(p => p.id === s.groundId);
    if (riding?.kind === "moving") s.x += platformAt(riding, s.worldTime).x - platformAt(riding, oldWorldTime).x;
  }
  const prevX = s.x; const prevFeet = s.y + HERO_H; const wasGrounded = s.grounded;
  s.x = Math.max(0, Math.min(level.length - HERO_W, s.x + s.vx * dt));
  s.vy += (s.dash > 0 ? 300 : 1350) * dt; s.y += s.vy * dt; s.grounded = false; s.groundId = -1;
  for (const p of level.platforms) {
    if (!platformSolid(s, p)) continue;
    const pos = platformAt(p, s.worldTime);
    if (s.vy >= 0 && s.x + HERO_W - 2 > pos.x && s.x + 2 < pos.x + pos.w && prevFeet <= pos.y + 3 && s.y + HERO_H >= pos.y) {
      s.y = pos.y - HERO_H; s.vy = 0; s.grounded = true; s.groundId = p.id; s.jumps = 0;
      if (p.kind === "crumble" && !s.crumbling.has(p.id)) s.crumbling.set(p.id, s.worldTime);
    }
  }
  if (s.grounded && !wasGrounded) { s.landing = .14; emit(s, "land"); particles(s, s.x + 17, s.y + HERO_H, "#c5c5a3", 5); }
  const attacking = (x: number, y: number, range = 65) => s.attack > 0 && Math.abs(x - (s.x + HERO_W / 2)) < range && Math.abs(y - (s.y + HERO_H / 2)) < 70 && (x - s.x - 17) * s.facing > -15;
  for (const obj of level.objects) {
    if (s.opened.has(obj.id)) continue;
    const close = Math.abs(s.x + 17 - obj.x) < 55 && s.y + HERO_H > obj.y - 65 && s.y < obj.y;
    if (obj.kind === "bell") {
      if (attacking(obj.x, obj.y - 30) && !s.hitTargets.has(obj.id)) {
        s.hitTargets.add(obj.id); s.bell = 5; emit(s, "checkpoint", "The bell opens a way.");
        if (s.boss?.stage === "sleep") { particles(s, s.boss.x, s.boss.y - 100, "#c7a87b", 15); hitBoss(s, 2); }
      }
      continue;
    }
    const breaks = (obj.kind === "wood" && attacking(obj.x, obj.y - 20)) || (obj.kind === "dash" && s.dash > 0 && close) || (obj.kind === "strength" && s.power > 0 && close);
    if (breaks) { s.opened.add(obj.id); s.revision++; emit(s, "break"); particles(s, obj.x, obj.y - 20, "#cbb18a", 12); rewardAction(s, 5); continue; }
    if (obj.kind === "gate" && s.bell > 0) continue;
    if (close && s.x + HERO_W > obj.x - 18 && s.x < obj.x + 18) {
      s.x = prevX + HERO_W / 2 < obj.x ? obj.x - 18 - HERO_W : obj.x + 18; s.vx = 0;
      if (input.jump && s.upgrades.has("wall-jump")) { s.vy = -470; s.vx = -s.facing * 240; s.jumps = 1; }
    }
  }
  for (let i = 0; i < s.enemies.length; i++) {
    const enemy = s.enemies[i]; const spec = level.enemies[i]; if (enemy.hp <= 0) continue;
    enemy.hit = Math.max(0, enemy.hit - dt);
    if (!enemy.hit) enemy.x += enemy.direction * (spec.kind === "moth" ? 95 : 48 + level.world * 4) * worldDt;
    if (enemy.x <= spec.min || enemy.x >= spec.max) { enemy.direction *= -1; enemy.x = Math.max(spec.min, Math.min(spec.max, enemy.x)); }
    enemy.y = spec.y + (spec.kind === "moth" ? Math.sin(s.worldTime * 3 + enemy.id) * 28 - 35 : 0);
    if ((attacking(enemy.x, enemy.y - 20) || (s.rush > 0 && Math.abs(enemy.x - s.x) < 45)) && !s.hitTargets.has(enemy.id) && !enemy.hit) {
      enemy.hp -= s.power > 0 || s.rush > 0 ? 3 : 1; enemy.hit = .3; enemy.x = Math.max(spec.min, Math.min(spec.max, enemy.x + s.facing * 25)); s.hitTargets.add(enemy.id);
      particles(s, enemy.x, enemy.y - 20, "#e6c6a0"); rewardAction(s, 8); emit(s, "attack");
      if (enemy.hp <= 0) { s.defeated.add(enemy.id); s.revision++; }
    }
    if (enemy.hp > 0 && Math.abs(s.x + 17 - enemy.x) < 29 && Math.abs(s.y + 25 - (enemy.y - 20)) < 34) {
      if (s.vy > 60 && prevFeet < enemy.y - 28) { enemy.hp--; s.vy = -300; enemy.hit = .3; rewardAction(s, 8); if (enemy.hp <= 0) { s.defeated.add(enemy.id); s.revision++; } }
      else damage(s, "Give the attack room to finish, then step in with Panda Smash.");
    }
  }
  for (const h of level.hazards) {
    const phase = h.kind === "thorn" ? "active" : hazardPhase(s.worldTime, h.phase);
    if (phase !== "active") continue;
    if (h.kind === "rock") {
      const previousPhase = hazardPhase(oldWorldTime, h.phase);
      if (previousPhase !== "active" && Math.abs(s.x - h.x) < 800) projectile(s, h.x + h.w / 2, 80, 0, 260, "rock", .3);
    } else if (s.x + HERO_W - 6 > h.x && s.x + 6 < h.x + h.w && s.y + HERO_H > h.y - (h.kind === "beam" ? 63 : 25) && s.y < h.y && !(h.kind === "beam" && s.crouched)) damage(s, h.kind === "beam" ? "Crouch beneath the beam, or wait for it to dim." : "The amber warning gives you time. Wait, jump, or use a power.");
  }
  stepBoss(s, level, worldDt, input.move);
  if (s.boss && attacking(s.boss.x, s.boss.y - 50, 110) && !s.hitTargets.has(-1) && bossVulnerable(s.boss)) { hitBoss(s, s.power > 0 ? 2 : 1); s.hitTargets.add(-1); }
  for (const p of s.projectiles) {
    if (!p.active) continue;
    if (p.delay > 0) { p.delay -= worldDt; continue; }
    p.x += p.vx * worldDt; p.y += p.vy * worldDt; p.life -= worldDt;
    if (p.life <= 0 || p.y > 460 || Math.abs(p.x - s.x) > 1400) { p.active = false; continue; }
    if (p.friendly && s.boss && Math.abs(p.x - s.boss.x) < 65 && Math.abs(p.y - (s.boss.y - 50)) < 75) { hitBoss(s, 2); p.active = false; continue; }
    if (!p.friendly && Math.abs(p.x - s.x - 17) < p.radius + 12 && Math.abs(p.y - s.y - (s.crouched ? 36 : 23)) < p.radius + (s.crouched ? 10 : 18)) {
      if (s.shield > .75 && s.upgrades.has("reflect")) { p.friendly = true; p.vx *= -1; p.vy = 0; rewardAction(s, 15); emit(s, "block", "Perfect reflection!"); }
      else { damage(s, "Watch the attack cue and move into the clear space."); p.active = false; }
    }
  }
  for (const thing of level.things) {
    if (s.coins.has(thing.id) || s.lore.has(thing.id)) continue;
    if (Math.abs(s.x + 17 - thing.x) > 28 || Math.abs(s.y + 23 - thing.y) > 36) continue;
    if (thing.kind === "decoy") { if (s.focus <= 0 && s.attackCooldown === 0) { s.attackCooldown = .5; emit(s, "lore", "Only an illusion. Choose the steady path."); } continue; }
    if (thing.power && !s.powers.has(thing.power)) { if (s.attackCooldown === 0) { emit(s, "lore", `A memory waits for ${thing.power === "second" ? "Second Chance" : thing.power}. You can revisit it.`); s.attackCooldown = .6; } continue; }
    if (thing.kind === "heart") { if (!s.opened.has(thing.id)) { s.health = Math.min(5, s.health + 1); s.opened.add(thing.id); } continue; }
    if (thing.kind === "lore") { s.lore.add(thing.id); emit(s, "lore", thing.text); }
    else { s.coins.add(thing.id); emit(s, "coin"); }
    particles(s, thing.x, thing.y, "#f6d68e", 5); s.revision++;
  }
  for (let i = s.checkpoint + 1; i < level.checkpoints.length; i++) {
    if (s.grounded && s.x >= level.checkpoints[i] && s.x < level.checkpoints[i] + 130) { s.checkpoint = i; s.health = 5; s.revision++; emit(s, "checkpoint", "Checkpoint lit. Your journey is saved here."); }
  }
  for (const p of s.particles) if (p.active) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 190 * dt; if (p.life <= 0) p.active = false; }
  if (s.y > HEIGHT + 100) { s.status = "dead"; s.reason = "The path is still here. Try again from your lantern."; emit(s, "hit"); }
  if (s.status === "playing" && s.grounded && s.x > level.length - 110 && (!s.boss || s.boss.hp <= 0)) { s.status = "won"; emit(s, "win"); }
}
