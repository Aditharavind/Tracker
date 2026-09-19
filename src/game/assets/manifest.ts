import { CHARACTER_SPRITE, type CharacterId } from "../characters";

/**
 * Every real, already-shipped asset the Phaser side loads, in one place --
 * so "what does this scene actually load" is answerable without grepping
 * scene files, and so no scene ever hardcodes a path inline. Nothing here is
 * new art: these are the exact files the DOM version of the forest already
 * uses (ForestScene.tsx / Panda.tsx / StartSign.tsx / styles.css).
 */
export const TEXTURES = {
  forestEntranceBg: "forest-entrance-bg",
  startSign: "start-sign",
  coin: "coin",
} as const;

export const TEXTURE_PATHS: Record<(typeof TEXTURES)[keyof typeof TEXTURES], string> = {
  [TEXTURES.forestEntranceBg]: "/assets/forest-bg-1.webp",
  [TEXTURES.startSign]: "/assets/start-sign.webp",
  [TEXTURES.coin]: "/assets/coin.webp",
};

/** The flat character sprite -- one static image per character, same as CHARACTER_SPRITE everywhere else in the app. */
export function characterTextureKey(character: CharacterId): string {
  return `panda-char-${character}`;
}

export function characterTexturePath(character: CharacterId): string {
  return CHARACTER_SPRITE[character];
}
