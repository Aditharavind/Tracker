import atlas from "./character-run-atlas.json";
import type { CharacterId } from "./characters";

export type CharacterRunClip = { row: number; frames: number };
export type CharacterRunSheet = { src: string; clips: { run: CharacterRunClip } };

export const CHARACTER_RUN_ATLAS = atlas as {
  version: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  characters: Record<CharacterId, CharacterRunSheet>;
};

export function characterRunFrame(timeMs: number, frames = CHARACTER_RUN_ATLAS.characters.panda.clips.run.frames): number {
  return Math.floor((Math.max(0, timeMs) / 1000) * CHARACTER_RUN_ATLAS.fps) % frames;
}
