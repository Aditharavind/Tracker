/** Art direction for each world's story diorama — the asset-sheet look of the
   story screen. Colours come from world-theme.css; this file only says what
   grows, hangs and glows in that world. */
export type PropKind = "tree" | "crystal" | "mushroom" | "peak" | "butte" | "spire";
export type CeilingKind = "leaves" | "stalactite" | "vine" | "icicle" | "none";

/** A world's own villain, standing in for the zombie plant at the START
   sign (ForestScene) and, with a matching Forest Dash hazard kind in
   runnerEngine.ts, on the ledges of that world's endless run. Worlds
   without one keep the zombie plant everywhere. */
export type Guardian = { sprite: string; taunt: string };

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
  guardian?: Guardian;
};

export const WORLD_SCENERY: Scenery[] = [
  { blurb: "Mossy canopy, sunlit ledges, and quiet fallen wood.", moods: ["Gentle", "Sleepy", "Warm", "Patient"], prop: "tree", ceiling: "leaves", art: "diorama", motes: "spark" },
  {
    blurb: "Indigo caverns, luminous crystals, and lavender ledges.", moods: ["Mysterious", "Calm", "Deep", "Hopeful"], prop: "crystal", ceiling: "stalactite", art: "photo", motes: "spark",
    guardian: { sprite: "/assets/world-2/crystal-slime.webp", taunt: "DON'T START — I'LL DOUBT U" },
  },
  { blurb: "Violet woodland, glowing mushrooms, and drifting lights.", moods: ["Curious", "Playful", "Bright", "Tempting"], prop: "mushroom", ceiling: "vine", art: "diorama", motes: "spark" },
  {
    blurb: "Snowbound peaks, icy ridges, and pale blue stone.", moods: ["Cold", "Vast", "Still", "Brave"], prop: "peak", ceiling: "icicle", art: "photo", motes: "snow",
    guardian: { sprite: "/assets/world-4/ice-beast.webp", taunt: "DON'T START — I'LL SCARE U" },
  },
  {
    blurb: "Floating islands, twin moons, and a spire of arcane light.", moods: ["Vast", "Ancient", "Weightless", "Awed"], prop: "crystal", ceiling: "none", art: "photo", motes: "spark",
    guardian: { sprite: "/assets/world-5/sky-sentinel.webp", taunt: "DON'T START — I'LL BANISH U" },
  },
  {
    blurb: "A smoking volcano, glowing lava, and dark red stone.", moods: ["Restless", "Fierce", "Heavy", "Resolute"], prop: "spire", ceiling: "none", art: "photo", motes: "ember",
    guardian: { sprite: "/assets/world-6/lava-golem.webp", taunt: "DON'T START — I'LL BURN U" },
  },
];

export function worldScenery(worldIndex: number): Scenery {
  return WORLD_SCENERY[worldIndex] ?? WORLD_SCENERY[0];
}
