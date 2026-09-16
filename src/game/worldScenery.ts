/** Art direction for each world's story diorama — the asset-sheet look of the
   story screen. Colours come from world-theme.css; this file only says what
   grows, hangs and glows in that world. */
export type PropKind = "tree" | "crystal" | "mushroom" | "peak" | "butte" | "spire";
export type CeilingKind = "leaves" | "stalactite" | "vine" | "icicle" | "none";

export type Scenery = {
  /** One line describing the environment, shown under the world name. */
  blurb: string;
  /** Feeling words for the chapter, shown as small plates beside the blurb. */
  moods: string[];
  prop: PropKind;
  ceiling: CeilingKind;
  /** "photo" worlds have real painted backdrop art; the rest draw a diorama. */
  art: "diorama" | "photo";
  /** Drifting foreground particles: motes, sparks or falling snow. */
  motes: "spark" | "snow" | "ember";
};

export const WORLD_SCENERY: Scenery[] = [
  { blurb: "Mossy canopy, sunlit ledges, and quiet fallen wood.", moods: ["Gentle", "Sleepy", "Warm", "Patient"], prop: "tree", ceiling: "leaves", art: "diorama", motes: "spark" },
  { blurb: "Indigo caverns, luminous crystals, and lavender ledges.", moods: ["Mysterious", "Calm", "Deep", "Hopeful"], prop: "crystal", ceiling: "stalactite", art: "photo", motes: "spark" },
  { blurb: "Violet woodland, glowing mushrooms, and drifting lights.", moods: ["Curious", "Playful", "Bright", "Tempting"], prop: "mushroom", ceiling: "vine", art: "diorama", motes: "spark" },
  { blurb: "Snowbound peaks, icy ridges, and pale blue stone.", moods: ["Cold", "Vast", "Still", "Brave"], prop: "peak", ceiling: "icicle", art: "diorama", motes: "snow" },
  { blurb: "Golden canyon walls, a long desert trail, and amber light.", moods: ["Open", "Sunlit", "Long", "Steady"], prop: "butte", ceiling: "none", art: "diorama", motes: "spark" },
  { blurb: "A smoking volcano, glowing lava, and dark red stone.", moods: ["Restless", "Fierce", "Heavy", "Resolute"], prop: "spire", ceiling: "none", art: "diorama", motes: "ember" },
];

export function worldScenery(worldIndex: number): Scenery {
  return WORLD_SCENERY[worldIndex] ?? WORLD_SCENERY[0];
}
