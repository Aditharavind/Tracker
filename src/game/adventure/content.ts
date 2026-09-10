export type Power = "dash" | "second" | "focus" | "shield" | "momentum" | "strength" | "hope";
export const POWERS: Record<Power, { name: string; icon: string; meaning: string; help: string }> = {
  dash: { name: "Burst Dash", icon: "↠", meaning: "Taking the first step.", help: "Shift / Dash: burst forward, dodge, and break marked walls." },
  second: { name: "Second Chance", icon: "☾", meaning: "Failure isn't the end.", help: "Jump again in the air. Revisit high paths you couldn't reach before." },
  focus: { name: "Focus", icon: "◎", meaning: "Choose what deserves your attention.", help: "Select Focus, then E / Ability: slow hazards and reveal illusions." },
  shield: { name: "Courage Shield", icon: "◇", meaning: "Move forward despite fear.", help: "Select Shield, then E / Ability. Time it just before a hit for a perfect block." },
  momentum: { name: "Momentum", icon: "♨", meaning: "Consistency creates momentum.", help: "Chain jumps, attacks and dashes. At a full meter, Panda Rush begins." },
  strength: { name: "Inner Strength", icon: "✹", meaning: "True strength is self-mastery.", help: "Build resolve through skilled actions. Select Strength and use Ability at 60 resolve for a shockwave." },
  hope: { name: "Hope Awakening", icon: "✦", meaning: "You became yourself again.", help: "Select Hope and use Ability at 60 resolve. All your powers become stronger for a short time." },
};
export type World = {
  name: string; emotion: string; motto: string; color: string; sky: string; tint: string;
  boss: string; reward: Power | null; mechanic: string; intro: string[]; reflection: string[];
  titles: [string, string, string]; notes: number[];
};
export const WORLDS: World[] = [
  { name: "The Sleeping Forest", emotion: "Laziness", motto: "Just start.", color: "#a8d93c", sky: "#183a32", tint: "#cfb864",
    boss: "The Lazy Giant", reward: "dash", mechanic: "Smash fallen wood. Jump roots. Strike the hanging bell when the giant sleeps.",
    intro: ["I used to have a dream. Then tomorrow became my favorite word. The path disappeared under all the days I didn't begin.", "Today I found the old trail. I don't feel ready. Will you take the first step with me?", "We can already walk, run, jump, crouch, and use Panda Smash. Let's clear the fallen wood before we face what's sleeping here."],
    reflection: ["You don't have to finish the whole journey today. You just have to take the first step.", "You know what I learned? Waiting for motivation doesn't get us anywhere.", "That first step was ours. Let's see what we can do with the next one."], titles: ["The Unopened Gate", "One Small Promise", "Wake the Giant"], notes: [48, 52, 55, 59, 62, 55, 52, 55] },
  { name: "Self-Doubt Caves", emotion: "Self-doubt", motto: "Maybe I can.", color: "#8b93e8", sky: "#21243e", tint: "#7b77bd",
    boss: "The Doubt", reward: "second", mechanic: "Watch solid edges in the fog. Moving stones carry you. The shadow mirrors your direction before it strikes.",
    intro: ["I found an old sketch in these caves. I drew myself reaching the summit. When did I decide that drawing was impossible?", "The shadow knows my old doubts. It doesn't know what we've learned. We have our dash now; we don't need a second jump to defeat it."],
    reflection: ["You can't control how the journey ends. You can control whether you keep walking.", "Falling doesn't erase the path behind you. Get up and take the next step.", "You gave me another try. Now I can give myself one, too."], titles: ["A Sketch in the Mist", "Uncertain Ground", "Face the Doubt"], notes: [45, 52, 57, 60, 64, 60, 57, 52] },
  { name: "Distraction Grove", emotion: "Distraction", motto: "Stay focused.", color: "#e668ab", sky: "#2d2444", tint: "#b85399",
    boss: "The Distractor", reward: "focus", mechanic: "Hollow coins are decoys. Follow carved arrows. The real boss casts a shadow; its copies don't.",
    intro: ["Every branch promises something brighter. I used to chase every one and forget where I was going.", "Look closely with me. Hollow coins and flickering doors aren't our goal. A steady path can be quiet."],
    reflection: ["The world will always give you something to chase. Choose what deserves your attention.", "You didn't miss out by choosing a path. You finally gave it your attention.", "The noise is still here. But it doesn't have to lead us."], titles: ["All That Glitters", "The Quiet Branch", "Behind the Illusion"], notes: [53, 60, 64, 67, 62, 69, 64, 60] },
  { name: "Fear Mountains", emotion: "Fear", motto: "Move forward anyway.", color: "#4f9fe0", sky: "#131f33", tint: "#38527d",
    boss: "The Beast of Fear", reward: "shield", mechanic: "Rock shadows warn of falling stones. Focus slows danger. Jump the beast's low shockwaves.",
    intro: ["I can hear the storm before I see the mountain. Part of me wants to turn around.", "You don't have to pretend you're unafraid. Watch the shadows, slow the noise, and take the next safe step with me."],
    reflection: ["Courage isn't knowing that you'll win. It's choosing to act even when you don't know.", "We waited for an opening. Being careful is a kind of courage, too.", "My paws still shake. But they aren't stopping me anymore."], titles: ["Before the Thunder", "Across the Exposed Ridge", "A Name for Fear"], notes: [38, 45, 50, 53, 57, 53, 50, 45] },
  { name: "Inconsistency Valley", emotion: "Inconsistency", motto: "Finish what you start.", color: "#e8912e", sky: "#3e2d29", tint: "#b76c43",
    boss: "The Quitter", reward: "momentum", mechanic: "Bell gates stay open briefly. The Quitter retreats between ledges; keep closing the distance during recovery.",
    intro: ["I used to begin everything with a burst of energy. Then I'd disappear as soon as it got ordinary.", "This valley is longer. There are lanterns along the way. We can rest without giving up the journey."],
    reflection: ["A single great day won't change your path. Keep showing up.", "Resting at a lantern isn't quitting. It's how we make the next stretch possible.", "We stayed with it. Can you feel how one good step leads into another?"], titles: ["Return to the Promise", "Keep the Bell Ringing", "Don't Walk Away"], notes: [48, 55, 57, 60, 55, 64, 60, 57] },
  { name: "Frustration Lands", emotion: "Frustration", motto: "Control yourself.", color: "#dd5940", sky: "#35232e", tint: "#9e4e4c",
    boss: "Chaos", reward: "strength", mechanic: "Cracked stone falls away. Chaos changes the arena; follow the safe markings instead of rushing blindly.",
    intro: ["When the trail broke, I used to blame the trail. Then I'd hit harder, hurry faster, and fall again.", "Let's try something different. Breathe. Watch what changes. Strength doesn't have to be anger."],
    reflection: ["You cannot control everything that happens. You can control what you do next.", "That pause before you moved? That was you choosing, instead of reacting.", "We didn't overpower the chaos. We stopped letting it control us."], titles: ["A Breath Before the Fall", "What Still Stands", "The Shape of Chaos"], notes: [41, 48, 51, 55, 58, 55, 51, 48] },
  { name: "Discipline Temple", emotion: "Discipline", motto: "Do it even when you don't feel like it.", color: "#3fbf98", sky: "#162e32", tint: "#62978a",
    boss: "The Old Habit", reward: "hope", mechanic: "Combine the powers you've earned. The Old Habit cycles familiar attacks; recognize them before reacting.",
    intro: ["No storm today. No applause either. Just the steps I promised myself I'd take.", "This temple asks us to use everything we've practiced. The old habit will offer the easy way back. We know where that leads."],
    reflection: ["The strongest person isn't the one who controls the world. It's the one who can control himself.", "You showed up even when the feeling didn't. That matters.", "I didn't become someone else. You helped me become myself again."], titles: ["The Daily Steps", "A Promise Kept", "Break the Old Habit"], notes: [50, 57, 62, 64, 69, 64, 62, 57] },
  { name: "Hope Summit", emotion: "Hope", motto: "Find your way again.", color: "#e8b62e", sky: "#546858", tint: "#e6b966",
    boss: "The Old Panda", reward: null, mechanic: "Your old self remembers every obstacle. Read the pattern, use your full moveset, and find a way forward.",
    intro: ["It's the same trail. The same trees. But now I can see the space between them.", "Someone is waiting at the summit. He looks like me on the day I gave up. We don't have to hate him. We just don't have to follow him anymore."],
    reflection: ["You may not see the whole road yet. Keep walking.", "Hope isn't a promise that nothing will hurt. It's a reason to take the next step.", "Thank you for walking with me. The path is yours, too."], titles: ["The Trail We Remember", "Light Through the Leaves", "The Old Panda"], notes: [48, 55, 60, 64, 67, 72, 67, 64] },
];
// Short, verbatim translation excerpts, verified against the linked translator's publication.
// Panda's dialogue is original interpretation, not a verse translation.
export const WISDOM = [
  { verse: "3.8", quote: "You should thus perform your prescribed Vedic duties, since action is superior to inaction." },
  { verse: "2.47", quote: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions." },
  { verse: "6.26", quote: "Whenever and wherever the restless and unsteady mind wanders, one should bring it back and continually focus it on God." },
  { verse: "2.48", quote: "Be steadfast in the performance of your duty, O Arjun, abandoning attachment to success and failure. Such equanimity is called Yog." },
  { verse: "3.19", quote: "Therefore, giving up attachment, perform actions as a matter of duty" },
  { verse: "6.5", quote: "Elevate yourself through the power of your mind, and not degrade yourself" },
  { verse: "6.6", quote: "For those who have conquered the mind, it is their friend." },
  { verse: "6.40", quote: "My dear friend, one who strives for God-realization is never overcome by evil." },
];
export const wisdomUrl = (verse: string) => `https://www.holy-bhagavad-gita.org/chapter/${verse.split(".")[0]}/verse/${verse.split(".")[1]}/`;
export type Platform = { id: number; x: number; y: number; w: number; kind: "stone" | "crumble" | "moving" | "vanish"; amplitude?: number };
export type Thing = { id: number; x: number; y: number; kind: "coin" | "lore" | "heart" | "decoy"; text?: string; power?: Power };
export type Hazard = { id: number; x: number; y: number; w: number; kind: "thorn" | "pulse" | "rock" | "beam"; phase: number };
export type EnemySpec = { id: number; x: number; y: number; min: number; max: number; kind: "rootling" | "shade" | "moth" | "armored" };
export type EnemyKind = EnemySpec["kind"];

// Shared by the weekly trail and runtime level generation. Each chapter keeps
// every earlier threat and adds one new kind, so its board matches Forest Dash.
export const CHAPTER_ENEMIES: EnemyKind[][] = [
  ["rootling"], ["rootling", "shade"], ["rootling", "shade", "moth"], ["rootling", "shade", "moth"],
  ["rootling", "shade", "moth", "armored"], ["rootling", "shade", "moth", "armored"],
  ["rootling", "shade", "moth", "armored"], ["rootling", "shade", "moth", "armored"],
];
export type Obstacle = { id: number; x: number; y: number; kind: "wood" | "dash" | "strength" | "bell" | "gate"; optional?: boolean };
export type Level = { id: number; world: number; stage: number; title: string; length: number; platforms: Platform[]; things: Thing[]; hazards: Hazard[]; enemies: EnemySpec[]; objects: Obstacle[]; checkpoints: number[]; boss: boolean; arena: number; mastery?: string; par: number };

// Authored sections: safe introduction, practice, combination, checkpoint, escalation,
// final challenge. Main routes use only powers earned BEFORE this world's boss.
export function makeLevel(id: number): Level {
  const mastery = id >= 24;
  const world = mastery ? 7 : Math.floor(id / 3); const stage = mastery ? id - 24 : id % 3;
  const boss = mastery ? stage === 2 : stage === 2;
  const variants = [
    [0, 24, 10, 44, 0, 30, 0, 38, 10],
    [0, 30, 55, 10, 0, 42, 65, 18, 0],
    [0, 22, 0, 38, 0, 22, 0, 0, 0],
  ][stage];
  const count = boss ? 5 : world >= 4 ? 9 : 8;
  const platforms: Platform[] = []; const things: Thing[] = []; const hazards: Hazard[] = []; const enemies: EnemySpec[] = []; const objects: Obstacle[] = [];
  let edge = 0; let nextId = 1;
  for (let i = 0; i < count; i++) {
    const w = i === 0 ? 560 : i === 4 ? 430 : 290 + ((i + stage) % 3) * 55;
    const x = edge + (i ? 65 + ((i + stage) % 3) * 12 : 0); const y = 430 - variants[i];
    const kind: Platform["kind"] = i !== 0 && i !== 4 && world >= 1 && i % 3 === 2 ? (world === 1 ? "moving" : world >= 5 ? "crumble" : "vanish") : "stone";
    platforms.push({ id: nextId++, x, y, w, kind, amplitude: kind === "moving" ? 20 : undefined });
    // Vanishing paths always have a visible, solid lower safety route.
    if (kind === "vanish") platforms.push({ id: nextId++, x: x - 15, y: y + 60, w: w + 30, kind: "stone" });
    for (let c = 0; c < 4; c++) things.push({ id: nextId++, x: x + 85 + c * (w - 160) / 3, y: y - 54, kind: "coin" });
    if (i > 0 && i !== 4) {
      if ((i + stage) % 2 === 0) {
        const roster = CHAPTER_ENEMIES[world];
        enemies.push({ id: nextId++, x: x + w * .6, y, min: x + 45, max: x + w - 45, kind: roster[(i + stage) % roster.length] });
      }
      else hazards.push({ id: nextId++, x: x + w * .55, y, w: world > 3 ? 58 : 40, kind: world === 0 ? "thorn" : world === 3 ? "rock" : world >= 6 ? "beam" : "pulse", phase: i * .43 });
    }
    if (i === 0) {
      objects.push({ id: nextId++, x: 350, y, kind: "wood" });
      things.push({ id: nextId++, x: 440, y: y - 50, kind: "heart" });
    }
    if (world === 2 && i > 0) things.push({ id: nextId++, x: x + 35, y: y - 80, kind: "decoy" });
    if (i === 4) things.push({ id: nextId++, x: x + 90, y: y - 35, kind: "heart" });
    if (i === 3) {
      const gatePower: Power = ["dash", "second", "focus", "shield", "momentum", "strength", "hope", "hope"][world] as Power;
      platforms.push({ id: nextId++, x: x + 80, y: y - 145, w: 170, kind: "stone" });
      things.push({ id: nextId++, x: x + 155, y: y - 180, kind: "lore", power: gatePower, text: ["An old sketch: a panda reaching a summit. Someone believed in you once. It was you.", "A note beneath the moss: 'Come back when you've learned to try again.'", "The quietest branch held the thing worth finding."][stage] });
      // The lower shortcut is revisitable with the newly earned ability.
      things.push({ id: nextId++, x: x + 230, y: y - 50, kind: "lore", power: gatePower, text: "A trail marker reads: 'The path didn't change. You did.'" });
      if (gatePower === "dash" || gatePower === "strength") objects.push({ id: nextId++, x: x + 195, y: y - 115, kind: gatePower, optional: true });
    }
    if (world === 4 && i === 5) { objects.push({ id: nextId++, x: x + 40, y, kind: "bell" }); objects.push({ id: nextId++, x: x + w - 65, y, kind: "gate" }); }
    edge = x + w;
  }
  const primary = platforms.filter(p => p.y >= 360 && p.kind !== "vanish" || p.kind === "vanish");
  const checkpointPlatform = primary.find(p => p.x > 1300 && p.kind === "stone") ?? platforms[0];
  const arena = edge + 65;
  if (boss) {
    platforms.push({ id: nextId++, x: arena, y: 430, w: 1050, kind: "stone" });
    platforms.push({ id: nextId++, x: arena + 220, y: 320, w: 130, kind: "stone" });
    platforms.push({ id: nextId++, x: arena + 700, y: 320, w: 130, kind: "stone" });
    objects.push({ id: nextId++, x: arena + 130, y: 430, kind: "bell" });
    edge = arena + 1050;
  }
  const checkpoints = [70, checkpointPlatform.x + 30, ...(boss ? [arena + 40] : [])];
  return { id, world, stage, title: mastery ? ["The Unbroken Sprint", "Steps Above the Clouds", "Echoes of the Old Self"][stage] : WORLDS[world].titles[stage], length: edge, platforms, things, hazards, enemies, objects, checkpoints, boss, arena, mastery: mastery ? ["speed", "precision", "boss"][stage] : undefined, par: boss ? 150 : 55 + world * 7 };
}
export const LEVEL_COUNT = 27;
export const MAIN_LEVELS = 24;

// Story Mode is a chapter of the same 75-day run, not a separate minigame --
// each world opens as the challenge itself progresses, one every 7 days,
// starting with World 1 on Day 1 so there's something to play immediately.
// A world unlocking is still gated by its previous world's boss (see
// save.ts's canPlay) so the powers a level assumes are always already
// earned; this only adds the day-based ceiling on top of that.
export const STORY_WORLD_UNLOCK_DAYS: number[] = WORLDS.map((_, i) => 1 + i * 7);
export function storyWorldUnlockDay(world: number): number {
  const clamped = Math.max(0, Math.min(WORLDS.length - 1, world));
  return STORY_WORLD_UNLOCK_DAYS[clamped];
}
export function unlockedStoryWorldCount(dayNumber: number): number {
  return STORY_WORLD_UNLOCK_DAYS.filter((day) => dayNumber >= day).length;
}
