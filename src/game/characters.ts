// The three playable forest characters. Cosmetic only -- selecting one never
// touches challenge/day/lives/coin state (see App.tsx's characters/
// setCharacterFor, which mirrors the existing avatar-selection pattern).
export type CharacterId = "panda" | "koala" | "redpanda";

export type CharacterInfo = {
  id: CharacterId;
  name: string;
  sprite: string;
};

export const CHARACTERS: CharacterInfo[] = [
  { id: "panda", name: "Panda", sprite: "/assets/panda-sprite.webp" },
  { id: "koala", name: "Koala", sprite: "/assets/koala-sprite.webp" },
  { id: "redpanda", name: "Red Panda", sprite: "/assets/redpanda-sprite.webp" },
];

export const CHARACTER_SPRITE: Record<CharacterId, string> = {
  panda: "/assets/panda-sprite.webp",
  koala: "/assets/koala-sprite.webp",
  redpanda: "/assets/redpanda-sprite.webp",
};

// Billboard .glb built by scripts/build-characters-glb.mjs -- flat pixel-art
// on a quad with Idle / Hop / Dance clips. Used only where model-viewer is
// already worth its weight (Profile turntable, Day-complete dance) -- never on
// the first-load critical path; the in-world character stays the flat sprite.
export const CHARACTER_MODEL: Record<CharacterId, string> = {
  panda: "/assets/characters/panda.glb",
  koala: "/assets/characters/koala.glb",
  redpanda: "/assets/characters/redpanda.glb",
};

// Fur/face tone immediately around each character's eyes -- used to paint the
// blink "eyelids" so the same lightweight blink effect reads on all three.
export const CHARACTER_FUR: Record<CharacterId, string> = {
  panda: "#f4f0e6",
  koala: "#9d999a",
  redpanda: "#f0e3c8",
};

/**
 * Where each character's eyes sit, as percentages of the sprite's own box
 * (measured off the sprite art against a grid). `lx`/`rx` are eye centres,
 * `y` the eye-centre height, `w`/`h` the lid size. The blink overlay and the
 * canvas minigame both position the eyelids from this.
 */
// Sized with a little extra margin beyond the measured eye box -- the in-world
// render can be the flat sprite OR the billboard .glb (a 3D quad with its own
// camera framing that a CSS overlay can't measure directly), so the lids need
// slack to still land on the eye even if that render is a few % off.
export const CHARACTER_EYES: Record<
  CharacterId,
  { lx: number; rx: number; y: number; w: number; h: number }
> = {
  panda: { lx: 40, rx: 57, y: 43, w: 19, h: 21 },
  koala: { lx: 41, rx: 55, y: 46, w: 15, h: 17 },
  redpanda: { lx: 40, rx: 58, y: 42, w: 18, h: 20 },
};

export type CharacterAnim = "Idle" | "Run" | "Hop" | "Dance";

export const DEFAULT_CHARACTER: CharacterId = "panda";

export function isCharacterId(v: unknown): v is CharacterId {
  return v === "panda" || v === "koala" || v === "redpanda";
}
