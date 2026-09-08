// Story Mode owns its progress and physics; it never mutates the habit challenge.
export const STORY_W = 960;
export const STORY_H = 440;
export const HERO_W = 32;
export const HERO_H = 44;
export const CRUMBLE_DELAY = 1.15;
export type StoryPlatform = { x: number; y: number; w: number; crumble?: boolean };
export type StoryTrap = { x: number; w: number; phase: number; timed: boolean };
export type StoryScene = { speaker: string; text: string; mood: "storm" | "guide" | "light" };
export type StoryLevel = {
  title: string; subtitle: string; color: string; length: number;
  platforms: StoryPlatform[]; traps: StoryTrap[];
  checkpoint: number; shard: { x: number; y: number };
  intro: StoryScene[]; outro: StoryScene[];
};

export const STORY_LEVELS: StoryLevel[] = [
  {
    title: "The Broken Beacon", subtitle: "01 · Forest Entrance", color: "#80c878", length: 2400,
    platforms: [
      { x: 0, y: 350, w: 530 }, { x: 625, y: 330, w: 390 },
      { x: 1100, y: 350, w: 450 }, { x: 1640, y: 320, w: 260 },
      { x: 1990, y: 350, w: 410 },
    ],
    traps: [{ x: 810, w: 42, phase: 0, timed: false }, { x: 1370, w: 46, phase: 0, timed: false }],
    checkpoint: 1170, shard: { x: 1770, y: 268 },
    intro: [
      { speaker: "The night the light went out", text: "A storm struck the Summit Beacon. Its three star fragments scattered across the forest, and hungry thorns swallowed the path home.", mood: "storm" },
      { speaker: "Wisp · keeper of the beacon", text: "You found me! I can guide you, but only the three fragments can relight the beacon. The first fell beyond the old forest bridge.", mood: "guide" },
      { speaker: "Your journey", text: "Find the glowing star fragment, then reach the lantern gate. Move with ← → or A / D. Press Space or ↑ to jump; press again for a double jump. Blue lanterns are checkpoints.", mood: "guide" },
    ],
    outro: [
      { speaker: "Wisp", text: "One fragment recovered! Its warmth has opened the trail to Moonlit Grove. The next fragment is there, where the roots wake and sleep with the moon.", mood: "light" },
    ],
  },
  {
    title: "Roots Under Moonlight", subtitle: "02 · Moonlit Grove", color: "#aaa2ed", length: 2550,
    platforms: [
      { x: 0, y: 350, w: 470 }, { x: 560, y: 320, w: 290 },
      { x: 930, y: 300, w: 170, crumble: true }, { x: 1190, y: 350, w: 480 },
      { x: 1760, y: 315, w: 220, crumble: true }, { x: 2070, y: 350, w: 480 },
    ],
    traps: [{ x: 680, w: 48, phase: 0, timed: true }, { x: 1430, w: 55, phase: 1.2, timed: true }, { x: 2240, w: 48, phase: 0.5, timed: true }],
    checkpoint: 1250, shard: { x: 1860, y: 263 },
    intro: [
      { speaker: "Wisp", text: "The second fragment is caught above the moon roots. Watch them: amber sparks mean the thorns are about to rise. Wait on safe stone, or jump over them.", mood: "guide" },
      { speaker: "The old trail", text: "Cracked platforms crumble a moment after you land. Keep moving and use your second jump to cross the broken bridge. Reach the blue checkpoint lantern to save your place for this attempt.", mood: "storm" },
    ],
    outro: [
      { speaker: "Wisp", text: "Two fragments! I remember the way now. The last one landed at the summit, but the storm's thorn gate stands between us and the beacon.", mood: "light" },
    ],
  },
  {
    title: "Light at the Summit", subtitle: "03 · Summit Sanctuary", color: "#efcc78", length: 2800,
    platforms: [
      { x: 0, y: 350, w: 440 }, { x: 530, y: 315, w: 240 },
      { x: 850, y: 280, w: 180, crumble: true }, { x: 1120, y: 350, w: 530 },
      { x: 1735, y: 310, w: 200, crumble: true }, { x: 2015, y: 280, w: 240 },
      { x: 2340, y: 350, w: 460 },
    ],
    traps: [{ x: 615, w: 48, phase: 0, timed: true }, { x: 1400, w: 58, phase: 0.6, timed: true }, { x: 2460, w: 65, phase: 1.4, timed: true }],
    checkpoint: 1190, shard: { x: 2140, y: 228 },
    intro: [
      { speaker: "At the summit", text: "Beyond the clouds, the beacon waits in darkness. One last fragment glows above the broken steps. Below it, the thorn gate pulses with the storm's last strength.", mood: "storm" },
      { speaker: "Wisp", text: "You've learned the forest's rhythm. Cross the cracked steps, recover the final fragment, then pass the last thorn gate. Bring all that light to the beacon. I'll be right beside you.", mood: "guide" },
    ],
    outro: [
      { speaker: "The Summit Beacon", text: "The three fragments rise together. A warm light spills down the mountainside. The thorns loosen, the bridges glow, and the forest finds its way home.", mood: "light" },
      { speaker: "Wisp", text: "You did it. Not in one leap, but one brave step at a time. As long as this beacon shines, no one has to walk the forest alone.", mood: "light" },
      { speaker: "The forest remembers", text: "The end. Your adventure is complete! Return to any chapter to collect more coins or take the journey again with another character.", mood: "light" },
    ],
  },
];

export type StoryState = {
  x: number; y: number; vy: number; facing: number; grounded: boolean; jumps: number;
  t: number; coyote: number; buffer: number; checkpoint: boolean; shard: boolean;
  coins: number[]; crumbling: Record<number, number>; status: "playing" | "dead" | "won";
  reason: string;
};
export const createStory = (): StoryState => ({
  x: 70, y: 350 - HERO_H, vy: 0, facing: 1, grounded: true, jumps: 0,
  t: 0, coyote: 0.1, buffer: 0, checkpoint: false, shard: false, coins: [], crumbling: {}, status: "playing", reason: "",
});
export function restartStory(s: StoryState, level: StoryLevel): StoryState {
  const next = createStory();
  if (s.checkpoint) {
    next.x = level.checkpoint;
    next.checkpoint = true;
    next.y = (level.platforms.find(p => next.x >= p.x && next.x + HERO_W <= p.x + p.w)?.y ?? 350) - HERO_H;
    next.coins = [...s.coins];
    next.shard = s.shard;
  }
  return next;
}
export function trapPhase(trap: StoryTrap, t: number): "safe" | "warning" | "active" {
  if (!trap.timed) return "active";
  const phase = (t + trap.phase) % 3;
  return phase < 1.3 ? "safe" : phase < 1.9 ? "warning" : "active";
}
export function storyCoins(level: StoryLevel) {
  return level.platforms.flatMap(p => [0.3, 0.55, 0.8].map(f => ({ x: p.x + p.w * f, y: p.y - 65 })));
}
export function stepStory(s: StoryState, level: StoryLevel, dt: number, direction: number, jump: boolean) {
  if (s.status !== "playing") return;
  // Caller uses a fixed step; guard public entry for accidental long frames.
  dt = Math.max(0, Math.min(dt, 1 / 30));
  s.t += dt;
  s.buffer = jump ? 0.14 : Math.max(0, s.buffer - dt);
  s.coyote = s.grounded ? 0.1 : Math.max(0, s.coyote - dt);
  if (s.buffer > 0 && (s.coyote > 0 || s.jumps < 2)) {
    s.vy = -470;
    s.jumps = s.coyote > 0 ? 1 : s.jumps + 1;
    s.grounded = false;
    s.coyote = 0;
    s.buffer = 0;
  }
  if (direction) s.facing = direction > 0 ? 1 : -1;
  s.x = Math.max(0, Math.min(level.length - HERO_W, s.x + Math.max(-1, Math.min(1, direction)) * 220 * dt));
  const prevFeet = s.y + HERO_H;
  s.vy += 1300 * dt;
  s.y += s.vy * dt;
  s.grounded = false;
  level.platforms.forEach((p, i) => {
    const fell = s.crumbling[i] !== undefined && s.t - s.crumbling[i] > CRUMBLE_DELAY;
    if (!fell && s.vy >= 0 && s.x + HERO_W > p.x && s.x < p.x + p.w && prevFeet <= p.y + 2 && s.y + HERO_H >= p.y) {
      s.y = p.y - HERO_H; s.vy = 0; s.grounded = true; s.jumps = 0;
      if (p.crumble && s.crumbling[i] === undefined) s.crumbling[i] = s.t;
    }
  });
  if (s.grounded && s.x >= level.checkpoint && s.x < level.checkpoint + 130) s.checkpoint = true;
  storyCoins(level).forEach((coin, i) => {
    if (!s.coins.includes(i) && Math.abs(s.x + HERO_W / 2 - coin.x) < 28 && Math.abs(s.y + HERO_H / 2 - coin.y) < 35) s.coins.push(i);
  });
  if (Math.abs(s.x + HERO_W / 2 - level.shard.x) < 32 && Math.abs(s.y + HERO_H / 2 - level.shard.y) < 40) s.shard = true;
  for (const trap of level.traps) {
    const floor = level.platforms.find(p => trap.x >= p.x && trap.x < p.x + p.w)?.y ?? 350;
    if (trapPhase(trap, s.t) === "active" && s.x + HERO_W - 5 > trap.x && s.x + 5 < trap.x + trap.w && s.y + HERO_H > floor - 25 && s.y < floor) {
      s.status = "dead"; s.reason = trap.timed ? "The moon roots woke up. Watch for amber sparks before crossing." : "Caught by the thorns. Jump a little earlier to clear them.";
    }
  }
  if (s.y > STORY_H + 60) { s.status = "dead"; s.reason = "The bridge gave way. Try a second jump to reach the next ledge."; }
  if (s.status === "playing" && s.x > level.length - 150 && s.grounded && s.shard) s.status = "won";
}

export type StoryProgress = { completed: number[]; bestCoins: number[] };
export function parseStoryProgress(raw: string | null): StoryProgress {
  try {
    const value = JSON.parse(raw ?? "null");
    const completed: number[] = [];
    // Only contiguous, valid completion records can unlock the next chapter.
    for (let i = 0; i < STORY_LEVELS.length; i++) {
      if (!Array.isArray(value?.completed) || !value.completed.includes(i)) break;
      completed.push(i);
    }
    return { completed, bestCoins: STORY_LEVELS.map((level, i) => {
      const n = value?.bestCoins?.[i];
      return Number.isInteger(n) && n >= 0 ? Math.min(storyCoins(level).length, n) : 0;
    }) };
  } catch { return { completed: [], bestCoins: STORY_LEVELS.map(() => 0) }; }
}
