import { describe, expect, it, vi } from "vitest";
import { CHAPTER_ENEMIES, FINAL_LEVEL_ID, LEVELS_PER_WORLD, MAIN_LEVELS, STORY_WORLD_UNLOCK_DAYS, WORLDS, finalLevelForWorld, firstLevelForWorld, makeLevel, storyWorldUnlockDay, unlockedStoryWorldCount } from "./content";
import { bossVulnerable, createState, damage, HERO_H, HERO_W, idleInput, platformAt, platformSolid, snapshot, step, type State } from "./engine";
import { canPlay, completeLevel, emptySave, parseSave, recordAttempt, recordFailure, resumeLevelForWorld, saveKey, type Save } from "./save";
import { Controls, PerformanceGovernor } from "./controls";
import { viewportSize } from "./viewport";

function through(id: number): Save {
  let save = emptySave();
  for (let i = 0; i < id; i++) save = completeLevel(save, i, { ...snapshot(createState(makeLevel(i), save)), elapsed: 90 });
  return save;
}
const frames = (s: State, id: number, n: number, input = idleInput()) => { for (let i = 0; i < n; i++) step(s, makeLevel(id), input); };

describe("campaign progression and saves", () => {
  it("resumes the latest attempt in the chosen world before older reflection screens", () => {
    const save = through(14);
    const latest = recordAttempt(save, 14, snapshot(createState(makeLevel(14), save)));
    expect(latest.attempts[0].scene).toBe("reflection");
    expect(resumeLevelForWorld(latest, 0)).toBe(14);
    expect(resumeLevelForWorld(latest, 1)).toBe(15);
  });
  it("unlocks each world and power only after its boss, never before", () => {
    let save = emptySave();
    for (let id = 0; id < MAIN_LEVELS; id++) {
      const level = makeLevel(id); const reward = WORLDS[level.world].reward;
      expect(canPlay(save, id)).toBe(true);
      expect(canPlay(save, id + 1)).toBe(false);
      if (reward) expect(save.powers).not.toContain(reward);
      save = completeLevel(save, id, { ...snapshot(createState(level, save)), elapsed: 60 });
      if (level.boss && reward) expect(save.powers).toContain(reward);
      save = parseSave(JSON.stringify(save));
    }
    expect(save.bosses).toHaveLength(WORLDS.length); expect(save.powers).toHaveLength(WORLDS.filter(w => w.reward).length);
    expect(canPlay(save, MAIN_LEVELS)).toBe(false);
  });
  it("restores the lantern, collected items and cleared obstacles after a serialized reload", () => {
    const id = LEVELS_PER_WORLD + 1; const level = makeLevel(id); let save = through(id); const state = createState(level, save);
    state.checkpoint = 1; state.coins.add(level.things.find(t => t.kind === "coin")!.id); state.lore.add(level.things.find(t => t.kind === "lore")!.id);
    state.defeated.add(level.enemies[0].id); state.opened.add(level.objects[0].id); state.elapsed = 43.5;
    save = parseSave(JSON.stringify(recordAttempt(save, level.id, snapshot(state))));
    const restored = createState(level, save, save.attempts[level.id]);
    expect(restored.x).toBe(level.checkpoints[1]); expect(restored.grounded).toBe(true); expect(restored.health).toBe(5);
    expect([...restored.coins]).toEqual([...state.coins]); expect([...restored.lore]).toEqual([...state.lore]); expect(restored.elapsed).toBe(43.5);
    expect(restored.enemies.find(e => e.id === level.enemies[0].id)?.hp).toBe(0);
    expect(restored.opened.has(level.objects[0].id)).toBe(true); expect(save.lastLevel).toBe(id);
    expect(restored.powers.has("dash")).toBe(true); expect(restored.powers.has("second")).toBe(false);
  });
  it("does not duplicate collectibles or completion rewards on replay", () => {
    const level = makeLevel(0); const state = createState(level, emptySave()); state.coins.add(level.things[0].id);
    let save = recordAttempt(emptySave(), 0, snapshot(state));
    save = recordAttempt(save, 0, snapshot(state)); save = completeLevel(save, 0, { ...snapshot(state), elapsed: 80 });
    save = completeLevel(save, 0, { ...snapshot(state), elapsed: 100 });
    expect(save.collectibles[0]).toHaveLength(1); expect(save.completed).toEqual([0]); expect(save.bestTimes[0]).toBe(80);
  });
  it("preserves cutscene pages, settings and remapped controls", () => {
    let save = emptySave(); save.settings.music = .15; save.settings.buttonSize = 70; save.settings.keys.attack = "k";
    save = recordAttempt(save, 0, { ...snapshot(createState(makeLevel(0), save)), scene: "intro", page: 2 });
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.attempts[0].page).toBe(2); expect(loaded.attempts[0].scene).toBe("intro");
    expect(loaded.settings.music).toBe(.15); expect(loaded.settings.buttonSize).toBe(70); expect(loaded.settings.keys.attack).toBe("k");
    expect(saveKey(1)).not.toBe(saveKey(2)); expect(saveKey(null)).not.toBe(saveKey(0));
  });
  it("rejects malformed, locked and invalid save data without granting powers", () => {
    expect(parseSave("bad")).toEqual(emptySave());
    const loaded = parseSave(JSON.stringify({ version: 3, completed: [0, 20], bosses: [7], powers: ["hope"], attempts: { 20: { scene: "play", checkpoint: 999 }, 0: { scene: "play", checkpoint: 999, coins: [1, 1, -9, 999], elapsed: "bad" } }, settings: { music: 5, buttonSize: -5 } }));
    expect(loaded.completed).toEqual([0]); expect(loaded.powers).toEqual([]); expect(loaded.attempts[20]).toBeUndefined();
    expect(loaded.attempts[0].checkpoint).toBeLessThan(makeLevel(0).checkpoints.length);
    expect(loaded.attempts[0].coins).toEqual([]); expect(loaded.settings.music).toBe(1); expect(loaded.settings.buttonSize).toBe(44);
  });
  it("rejects completion scenes that do not belong to the saved level", () => {
    const save = through(3);
    save.attempts[0].scene = "reward";
    save.attempts[2].scene = "ending";
    const loaded = parseSave(JSON.stringify(save));
    expect(loaded.attempts[0]).toBeUndefined(); expect(loaded.attempts[2]).toBeUndefined();
  });
});

describe("story worlds unlock through 15-level clears, with failure penalties", () => {
  it("keeps legacy day floors open while completion controls world access", () => {
    expect(STORY_WORLD_UNLOCK_DAYS).toEqual(WORLDS.map(() => 1));
    for (let w = 0; w < WORLDS.length; w++) expect(storyWorldUnlockDay(w)).toBe(1);
  });
  it("clamps to the first and last world for out-of-range indices", () => {
    expect(storyWorldUnlockDay(-1)).toBe(storyWorldUnlockDay(0));
    expect(storyWorldUnlockDay(99)).toBe(storyWorldUnlockDay(WORLDS.length - 1));
  });
  it("counts how many worlds a given day has opened", () => {
    expect(unlockedStoryWorldCount(0)).toBe(0);
    expect(unlockedStoryWorldCount(1)).toBe(WORLDS.length);
    expect(unlockedStoryWorldCount(75)).toBe(WORLDS.length);
  });
  it("opens the next world only after all 15 levels in the previous world are clear", () => {
    const almost = through(LEVELS_PER_WORLD - 1);
    expect(canPlay(almost, LEVELS_PER_WORLD - 1, 1)).toBe(true);
    expect(canPlay(almost, LEVELS_PER_WORLD, 999)).toBe(false);
    const cleared = through(LEVELS_PER_WORLD);
    expect(canPlay(cleared, LEVELS_PER_WORLD, 1)).toBe(true);
  });
  it("a failure blocks Story Mode for 7 habit days", () => {
    const penalized = recordFailure(emptySave(), 12);
    expect(penalized.penaltyUntilDay).toBe(19);
    expect(canPlay(penalized, 0, 18)).toBe(false);
    expect(canPlay(penalized, 0, 19)).toBe(true);
  });
});

describe("gamepad input", () => {
  it("keeps an action held until every finger or key using it releases", () => {
    const controls = new Controls();
    controls.press("jump", "keyboard", "Space");
    controls.press("jump", "touch", "finger-2");
    expect(controls.input("focus")).toMatchObject({ jump: true, jumpHeld: true });
    controls.release("jump", "finger-2");
    expect(controls.input("focus")).toMatchObject({ jump: false, jumpHeld: true });
    controls.press("jump", "keyboard", "ArrowUp");
    controls.release("jump", "Space");
    expect(controls.input("focus").jumpHeld).toBe(true);
    controls.release("jump", "ArrowUp");
    expect(controls.input("focus").jumpHeld).toBe(false);
    controls.press("attack", "touch", "finger-1"); controls.clear();
    expect(controls.input("focus").attack).toBe(false);
  });
  it("reads the first connected controller even when the first slot is empty", () => {
    vi.stubGlobal("navigator", { getGamepads: () => [null, { connected: true, axes: [.6], buttons: [] }] });
    try {
      const controls = new Controls(); controls.pollGamepad();
      expect(controls.input("focus").move).toBe(.6);
    } finally { vi.unstubAllGlobals(); }
  });
  it("pauses once per Start press across mode changes, and clears disconnected movement", () => {
    const pad = { axes: [.8], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
    let connected = true;
    vi.stubGlobal("navigator", { getGamepads: () => connected ? [pad] : [] });
    try {
      const controls = new Controls(); pad.buttons[9].pressed = true; pad.buttons[0].pressed = true;
      controls.pollGamepad(); expect(controls.consumePause()).toBe(true);
      expect(controls.input("focus")).toMatchObject({ move: .8, jump: true, jumpHeld: true });
      controls.clear(); controls.pollGamepad(); expect(controls.consumePause()).toBe(false);
      pad.buttons[9].pressed = false; controls.pollGamepad(); pad.buttons[9].pressed = true; controls.pollGamepad();
      expect(controls.consumePause()).toBe(true);
      connected = false; controls.pollGamepad();
      expect(controls.input("focus")).toMatchObject({ move: 0, jumpHeld: false });
    } finally { vi.unstubAllGlobals(); }
  });
});

describe("responsive rendering budget", () => {
  it("keeps phone, landscape and desktop backing buffers within their displayed pixel budget", () => {
    const settings = emptySave().settings;
    for (const [width, height, dpr] of [[390, 620, 3], [844, 250, 3], [1440, 800, 1], [320, 330, 2]]) {
      const size = viewportSize(width, height, dpr, settings, 1);
      expect(size.width).toBeLessThanOrEqual(width * Math.min(dpr, 2) + 1);
      expect(size.height).toBeLessThanOrEqual(height * Math.min(dpr, 2) + 1);
      expect(size.width / size.height).toBeCloseTo(size.viewWidth / 540, 1);
      const battery = viewportSize(width, height, dpr, { ...settings, performance: true }, 1);
      expect(battery.width).toBeLessThanOrEqual(width + 1);
      expect(battery.height).toBeLessThanOrEqual(height + 1);
    }
  });
});

describe("movement, combat and powers", () => {
  it("starts with movement, jumping and smash but no dash or double jump", () => {
    const s = createState(makeLevel(0), emptySave()); const input = { ...idleInput(), move: 1, jump: true, jumpHeld: true, dash: true, attack: true };
    step(s, makeLevel(0), input); expect(s.vx).toBeGreaterThan(0); expect(s.vy).toBeLessThan(0); expect(s.attack).toBeGreaterThan(0); expect(s.dash).toBe(0);
    step(s, makeLevel(0), { ...input, move: 0 }); expect(s.jumps).toBe(1);
  });
  it("smash breaks wood, knocks enemies back, and allows repeat attacks after recovery", () => {
    const level = makeLevel(0); const s = createState(level, emptySave()); s.x = level.objects[0].x - 58;
    step(s, level, { ...idleInput(), attack: true }); expect(s.opened.has(level.objects[0].id)).toBe(true);
    const enemy = s.enemies[0]; s.x = enemy.x - 45; s.y = enemy.y - HERO_H; s.attackCooldown = 0;
    step(s, level, { ...idleInput(), attack: true }); expect(enemy.hp).toBe(1);
    frames(s, 0, 50); s.x = enemy.x - 45;
    step(s, level, { ...idleInput(), attack: true }); expect(s.defeated.has(enemy.id)).toBe(true);
  });
  it("focus slows the environment while preserving player responsiveness", () => {
    const level = makeLevel(9); const save = through(9); const a = createState(level, save); const b = createState(level, save);
    a.focus = 3;
    for (let i = 0; i < 60; i++) { step(a, level, { ...idleInput(), move: 1 }); step(b, level, { ...idleInput(), move: 1 }); }
    expect(a.x).toBeCloseTo(b.x, 4); expect(a.worldTime).toBeLessThan(b.worldTime * .4);
  });
  it("shield blocks damage; health cannot be lost repeatedly during invulnerability", () => {
    const s = createState(makeLevel(12), through(12)); s.immune = 0; s.shield = 1;
    expect(damage(s, "test")).toBe(false); expect(s.health).toBe(5);
    s.shield = 0; s.immune = 0; expect(damage(s, "test")).toBe(true); expect(damage(s, "test")).toBe(false); expect(s.health).toBe(4);
  });
  it("strength consumes earned resolve and hope requires its boss unlock", () => {
    const level = makeLevel(FINAL_LEVEL_ID); const s = createState(level, through(MAIN_LEVELS)); s.resolve = 59;
    step(s, level, { ...idleInput(), ability: true, selected: "strength" }); expect(s.power).toBe(0);
    s.resolve = 60; step(s, level, { ...idleInput(), ability: true, selected: "strength" }); expect(s.power).toBeGreaterThan(0); expect(s.resolve).toBe(0);
    s.abilityCooldown = 0; s.resolve = 100; step(s, level, { ...idleInput(), ability: true, selected: "hope" }); expect(s.hope).toBe(0);
  });
  it("low frame rates reduce graphics, never the simulation rate", () => {
    const g = new PerformanceGovernor(); for (let i = 0; i < 300; i++) g.sample(.04, true);
    expect(g.resolution).toBe(.7); expect(g.level).toBeLessThan(2);
    for (let i = 0; i < 5000; i++) g.sample(.016, true);
    expect(g.level).toBe(2); expect(g.resolution).toBe(1);
  });
});

describe("authored routes and boss openings", () => {
  it("encounters every advertised enemy type during its world's fifteen levels", () => {
    for (let world = 0; world < WORLDS.length; world++) {
      const encountered = new Set(Array.from({ length: LEVELS_PER_WORLD }, (_, stage) => makeLevel(firstLevelForWorld(world) + stage)).flatMap(level => level.enemies.map(enemy => enemy.kind)));
      expect([...encountered].sort(), WORLDS[world].name).toEqual([...CHAPTER_ENEMIES[world]].sort());
    }
  });
  it("all main-route gaps are jumpable with the powers available at that world", () => {
    for (let id = 0; id < MAIN_LEVELS; id++) {
      const level = makeLevel(id); const save = through(firstLevelForWorld(level.world));
      const route = level.platforms.filter(p => p.y >= 360 && p.y <= 430).sort((a, b) => a.x - b.x);
      for (let k = 0; k < route.length - 1; k++) {
        const from = route[k]; const to = route[k + 1]; if (to.x <= from.x + from.w) continue;
        const safeLevel = { ...level, platforms: level.platforms.map(p => ({ ...p, kind: p.kind === "vanish" ? "stone" as const : p.kind })), enemies: [], hazards: [], objects: [], boss: false };
        const s = createState(safeLevel, save); s.x = from.x + from.w - HERO_W - 6; s.y = from.y - HERO_H; s.vx = 235; s.groundId = from.id;
        let landed = false;
        for (let frame = 0; frame < 180 && s.status === "playing"; frame++) {
          step(s, safeLevel, { ...idleInput(), move: 1, jumpHeld: true, jump: frame === 0 });
          const dest = platformAt(to, s.worldTime);
          if (s.grounded && s.x + HERO_W > dest.x && s.x < dest.x + dest.w && Math.abs(s.y + HERO_H - dest.y) < 2) { landed = true; break; }
        }
        expect(landed, `${id}: ${from.x} -> ${to.x}`).toBe(true);
      }
    }
  });
  it("bosses telegraph, recover, and can be damaged by starting Smash without their reward", () => {
    for (let world = 0; world < WORLDS.length; world++) {
      const id = finalLevelForWorld(world); const level = makeLevel(id); const s = createState(level, through(firstLevelForWorld(world)));
      s.x = level.arena + 110; s.y = 430 - HERO_H; s.enemies.forEach(e => e.hp = 0);
      for (let i = 0; i < 700 && !bossVulnerable(s.boss!); i++) step(s, level, idleInput());
      expect(bossVulnerable(s.boss!), WORLDS[world].boss).toBe(true);
      const hp = s.boss!.hp; s.x = s.boss!.x - 75; s.y = 430 - HERO_H; s.facing = 1;
      step(s, level, { ...idleInput(), attack: true }); expect(s.boss!.hp).toBeLessThan(hp);
      const reward = WORLDS[world].reward; if (reward) expect(s.powers.has(reward)).toBe(false);
    }
  });
  it("the giant's sleeping phase can be punished with the environmental bell", () => {
    const level = makeLevel(finalLevelForWorld(0)); const s = createState(level, through(firstLevelForWorld(0)));
    s.boss!.active = true; s.boss!.stage = "sleep"; s.boss!.timer = 4; s.boss!.hp = 5;
    const bell = level.objects.find(o => o.kind === "bell")!; s.x = bell.x - 45; s.y = bell.y - HERO_H;
    step(s, level, { ...idleInput(), attack: true }); expect(s.boss!.hp).toBe(3);
  });
  it("all bosses can be defeated with earned powers, five hearts, and normal inputs", () => {
    for (let world = 0; world < WORLDS.length; world++) {
      const level = makeLevel(finalLevelForWorld(world)); const save = through(firstLevelForWorld(world));
      const s = createState(level, save, { ...snapshot(createState(level, save)), checkpoint: 2 });
      for (let frame = 0; frame < 30000 && s.status === "playing"; frame++) {
        const b = s.boss!; const dx = b.x - (s.x + 17); const vulnerable = bossVulnerable(b);
        const closeProjectile = s.projectiles.some(p => p.active && p.delay <= 0 && Math.abs(p.x - s.x - 17) < 95 && p.y > 365);
        const input = idleInput(); input.jumpHeld = true;
        if (!b.active) input.move = 1;
        else if (vulnerable) input.move = Math.abs(dx) > 65 ? Math.sign(dx) : Math.sign(dx) * .08;
        else input.move = Math.abs(dx) < 220 ? -Math.sign(dx) : 0;
        input.attack = vulnerable && Math.abs(dx) < 100 && s.attackCooldown === 0;
        input.jump = s.grounded && (closeProjectile || (b.stage === "attack" && b.pattern === 1 && Math.abs(dx) < 200));
        input.selected = "shield"; input.ability = save.powers.includes("shield") && closeProjectile && s.abilityCooldown === 0;
        step(s, level, input);
      }
      expect(s.status, `${WORLDS[world].boss}: hp=${s.boss?.hp} health=${s.health} x=${s.x} ${s.reason}`).toBe("won");
    }
  });
  it("collapsing and moving platforms recover safely at a checkpoint", () => {
    const id = firstLevelForWorld(5) + 1; const level = makeLevel(id); const save = through(id); const s = createState(level, save); const platform = level.platforms.find(p => p.kind === "crumble")!;
    s.crumbling.set(platform.id, 0); s.worldTime = 2;
    expect(platformSolid(s, platform)).toBe(false);
    const restored = createState(level, save, { ...snapshot(s), checkpoint: 1 });
    expect(platformSolid(restored, platform)).toBe(true); expect(restored.grounded).toBe(true);
  });
});
