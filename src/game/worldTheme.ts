/** Shared landscape assets for the daily world, story canvas, and menus. */
export const WORLD_BACKGROUNDS = [
  "/assets/forest-bg-1.webp",
  "/assets/world-2/caves-bg.webp",
  "/assets/worlds/grove.svg",
  "/assets/world-4/mountains-bg.webp",
  "/assets/world-5/skyrealm-bg.webp",
  "/assets/world-6/volcano-bg.webp",
] as const;

export function worldBackground(worldIndex: number): string {
  return WORLD_BACKGROUNDS[worldIndex] ?? WORLD_BACKGROUNDS[0];
}

export const WORLD_TERRAIN = [
  { soil: "#293d36", surface: "#608464", detail: "#acc790", vegetation: true },
  { soil: "#34334e", surface: "#8581b0", detail: "#b5c8fa", vegetation: false },
  { soil: "#493345", surface: "#916689", detail: "#eaa5ce", vegetation: true },
  { soil: "#34485b", surface: "#c6dce7", detail: "#8cacbe", vegetation: false },
  { soil: "#241a3a", surface: "#4a3a72", detail: "#c9974f", vegetation: false },
  { soil: "#472f34", surface: "#b45639", detail: "#ed9560", vegetation: false },
] as const;

export function worldTerrain(worldIndex: number) {
  return WORLD_TERRAIN[worldIndex] ?? WORLD_TERRAIN[0];
}
