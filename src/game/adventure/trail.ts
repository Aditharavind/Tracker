import { levelIdsForWorld, makeLevel } from "./content";
import { canPlay, type Save } from "./save";

export const TRAIL_ART = { src: "/assets/story/level-trail-v1.webp", width: 1024, height: 1536 };

// Centers of the stone TOP surfaces in the artwork, from entrance to boss.
// Portal bottoms anchor here; never position against a cover-cropped image.
export const TRAIL_STONES = [
  { x: 390, y: 1342 }, { x: 658, y: 1225 }, { x: 398, y: 1117 },
  { x: 661, y: 1021 }, { x: 400, y: 929 }, { x: 661, y: 839 },
  { x: 404, y: 748 }, { x: 653, y: 665 }, { x: 412, y: 588 },
  { x: 647, y: 501 }, { x: 412, y: 420 }, { x: 646, y: 336 },
  { x: 407, y: 258 }, { x: 632, y: 181 }, { x: 514, y: 86 },
] as const;

export function trailLevels(save: Save, world: number, dayNumber: number) {
  return levelIdsForWorld(world).map((id, stage) => {
    const level = makeLevel(id);
    return {
      id, stage, title: level.title, boss: level.boss, stone: TRAIL_STONES[stage],
      done: save.completed.includes(id), playable: canPlay(save, id, dayNumber),
      attempt: save.attempts[id], coins: save.collectibles[id]?.length ?? 0,
      totalCoins: level.things.filter(thing => thing.kind === "coin").length,
    };
  });
}
