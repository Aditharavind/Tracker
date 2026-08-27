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

export const DEFAULT_CHARACTER: CharacterId = "panda";

export function isCharacterId(v: unknown): v is CharacterId {
  return v === "panda" || v === "koala" || v === "redpanda";
}
