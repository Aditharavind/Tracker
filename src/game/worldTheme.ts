/** Shared landscape assets for the daily world, story canvas, and menus. */
export const WORLD_BACKGROUNDS = [
  "/assets/forest-bg-1.webp",
  "/assets/world-2/caves-bg.webp",
  "/assets/worlds/grove.svg",
  "/assets/worlds/mountains.svg",
  "/assets/worlds/valley.svg",
  "/assets/worlds/volcano.svg",
] as const;

export function worldBackground(worldIndex: number): string {
  return WORLD_BACKGROUNDS[worldIndex] ?? WORLD_BACKGROUNDS[0];
}

export const WORLD_TERRAIN = [
  { soil: "#293d36", surface: "#608464", detail: "#acc790", vegetation: true },
  { soil: "#34334e", surface: "#8581b0", detail: "#b5c8fa", vegetation: false },
  { soil: "#493345", surface: "#916689", detail: "#eaa5ce", vegetation: true },
  { soil: "#34485b", surface: "#c6dce7", detail: "#8cacbe", vegetation: false },
  { soil: "#715039", surface: "#b98b43", detail: "#e6ba68", vegetation: true },
  { soil: "#472f34", surface: "#b45639", detail: "#ed9560", vegetation: false },
] as const;

export function worldTerrain(worldIndex: number) {
  return WORLD_TERRAIN[worldIndex] ?? WORLD_TERRAIN[0];
}
