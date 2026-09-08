import { LEVEL_COUNT, MAIN_LEVELS, makeLevel, WORLDS, type Power } from "./content";

export type Action = "left" | "right" | "jump" | "attack" | "dash" | "ability" | "cycle" | "crouch" | "walk";
export type Settings = {
  quality: "auto" | "low" | "medium" | "high" | "ultra";
  performance: boolean; reducedMotion: boolean; shake: boolean; vibration: boolean;
  music: number; effects: number; uiScale: number; buttonSize: number; buttonOffset: number; sensitivity: number;
  keys: Record<Action, string>;
};
export const DEFAULT_SETTINGS: Settings = {
  quality: "auto", performance: false, reducedMotion: false, shake: true, vibration: false,
  music: .28, effects: .55, uiScale: 1, buttonSize: 58, buttonOffset: 0, sensitivity: 1,
  keys: { left: "a", right: "d", jump: " ", attack: "j", dash: "shift", ability: "e", cycle: "q", crouch: "s", walk: "control" },
};
export type Attempt = {
  checkpoint: number; coins: number[]; lore: number[]; defeated: number[]; opened: number[];
  elapsed: number; scene: "intro" | "play" | "reflection" | "reward" | "ending"; page: number;
};
export type Save = {
  version: 2; completed: number[]; bosses: number[]; powers: Power[]; upgrades: string[];
  collectibles: Record<string, number[]>; lore: Record<string, number[]>;
  attempts: Record<string, Attempt>; bestTimes: Record<string, number>; lastLevel: number | null; settings: Settings;
};
export const saveKey = (userId: number | null) => `75hard.panda.adventure.v2:${userId ?? "guest"}`;
export const emptySave = (): Save => ({ version: 2, completed: [], bosses: [], powers: [], upgrades: [], collectibles: {}, lore: {}, attempts: {}, bestTimes: {}, lastLevel: null, settings: { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_SETTINGS.keys } } });
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const numbers = (v: unknown, allowed: number[]) => Array.isArray(v) ? [...new Set(v.filter((n): n is number => typeof n === "number" && allowed.includes(n)))] : [];
const bounded = (v: unknown, min: number, max: number, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
export const canPlay = (save: Save, id: number) => id >= 0 && id < LEVEL_COUNT && Number.isInteger(id) && (id >= MAIN_LEVELS ? save.completed.includes(MAIN_LEVELS - 1) : id === 0 || save.completed.includes(id - 1));
export function earnedPowers(bosses: number[]): Power[] {
  return WORLDS.flatMap((w, i) => w.reward && bosses.includes(i) ? [w.reward] : []);
}
export function earnedUpgrades(save: Pick<Save, "lore">): string[] {
  const count = Object.values(save.lore).reduce((n, ids) => n + ids.length, 0);
  return [count >= 2 ? "extended-dash" : "", count >= 4 ? "air-dash" : "", count >= 6 ? "reflect" : "", count >= 8 ? "wall-jump" : ""].filter(Boolean);
}
export function parseSave(raw: string | null): Save {
  const next = emptySave();
  try {
    const v = object(JSON.parse(raw ?? "null"));
    if (v.version !== 2) return next;
    for (let i = 0; i < MAIN_LEVELS; i++) {
      if (!Array.isArray(v.completed) || !v.completed.includes(i)) break;
      next.completed.push(i);
    }
    if (next.completed.includes(23)) next.completed.push(...numbers(v.completed, [24, 25, 26]));
    next.bosses = WORLDS.map((_, i) => i).filter(i => next.completed.includes(i * 3 + 2));
    next.powers = earnedPowers(next.bosses);
    for (let id = 0; id < LEVEL_COUNT; id++) {
      if (!canPlay(next, id)) continue;
      const level = makeLevel(id); const k = String(id);
      const coinIds = level.things.filter(t => t.kind === "coin").map(t => t.id);
      const loreIds = level.things.filter(t => t.kind === "lore").map(t => t.id);
      next.collectibles[k] = numbers(object(v.collectibles)[k], coinIds);
      next.lore[k] = numbers(object(v.lore)[k], loreIds);
      const best = object(v.bestTimes)[k];
      if (typeof best === "number" && best > 0 && Number.isFinite(best)) next.bestTimes[k] = best;
      const a = object(object(v.attempts)[k]);
      if (!["intro", "play", "reflection", "reward", "ending"].includes(String(a.scene))) continue;
      if (["reflection", "reward", "ending"].includes(String(a.scene)) && !next.completed.includes(id)) continue;
      if (a.scene === "ending" && id !== 23) continue;
      if (a.scene === "reward" && (!level.boss || !WORLDS[level.world].reward || id >= MAIN_LEVELS)) continue;
      next.attempts[k] = {
        checkpoint: Math.floor(bounded(a.checkpoint, 0, level.checkpoints.length - 1, 0)),
        coins: numbers(a.coins, coinIds), lore: numbers(a.lore, loreIds),
        defeated: numbers(a.defeated, level.enemies.map(e => e.id)), opened: numbers(a.opened, level.objects.filter(o => o.kind !== "gate").map(o => o.id)),
        elapsed: bounded(a.elapsed, 0, 86400, 0),
        scene: a.scene as Attempt["scene"], page: Math.floor(bounded(a.page, 0, a.scene === "ending" ? 3 : WORLDS[level.world].intro.length - 1, 0)),
      };
    }
    next.upgrades = earnedUpgrades(next);
    next.lastLevel = typeof v.lastLevel === "number" && canPlay(next, v.lastLevel) && next.attempts[v.lastLevel] ? v.lastLevel : null;
    const settings = object(v.settings);
    const quality = settings.quality;
    if (["auto", "low", "medium", "high", "ultra"].includes(String(quality))) next.settings.quality = quality as Settings["quality"];
    for (const key of ["performance", "reducedMotion", "shake", "vibration"] as const) if (typeof settings[key] === "boolean") next.settings[key] = settings[key];
    next.settings.music = bounded(settings.music, 0, 1, .28); next.settings.effects = bounded(settings.effects, 0, 1, .55);
    next.settings.uiScale = bounded(settings.uiScale, .85, 1.3, 1);
    next.settings.buttonSize = bounded(settings.buttonSize, 44, 76, 58); next.settings.buttonOffset = bounded(settings.buttonOffset, 0, 60, 0);
    next.settings.sensitivity = bounded(settings.sensitivity, .6, 1.8, 1);
    const bindings = object(settings.keys);
    const entries = Object.keys(DEFAULT_SETTINGS.keys) as Action[];
    // Reject the whole remap if ambiguous, keeping every action available.
    const remap = entries.map(action => bindings[action]);
    if (remap.every(key => typeof key === "string" && key.length > 0 && key.length < 24 && !["escape", "tab"].includes(key)) && new Set(remap).size === entries.length) {
      for (const action of entries) next.settings.keys[action] = bindings[action] as string;
    }
    return next;
  } catch { return next; }
}
export function completeLevel(save: Save, id: number, attempt: Attempt): Save {
  if (!canPlay(save, id)) return save;
  const level = makeLevel(id);
  const completed = [...new Set([...save.completed, id])].sort((a, b) => a - b);
  const bosses = [...new Set([...save.bosses, ...(level.boss && id < MAIN_LEVELS ? [level.world] : [])])];
  const next = recordAttempt(save, id, { ...attempt, scene: id === 23 ? "ending" : "reflection", page: 0 });
  const best = save.bestTimes[id];
  return { ...next, completed, bosses, powers: earnedPowers(bosses), bestTimes: { ...save.bestTimes, [id]: best ? Math.min(best, attempt.elapsed) : Math.max(.01, attempt.elapsed) } };
}
export function recordAttempt(save: Save, id: number, attempt: Attempt): Save {
  if (!canPlay(save, id)) return save;
  const next = { ...save, lastLevel: id, attempts: { ...save.attempts, [id]: attempt },
    collectibles: { ...save.collectibles, [id]: [...new Set([...(save.collectibles[id] ?? []), ...attempt.coins])] },
    lore: { ...save.lore, [id]: [...new Set([...(save.lore[id] ?? []), ...attempt.lore])] },
  };
  return { ...next, upgrades: earnedUpgrades(next) };
}
