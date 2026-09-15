import Phaser from "phaser";
import { TEXTURES, TEXTURE_PATHS, characterTextureKey, characterTexturePath } from "../assets/manifest";
import type { CharacterId } from "../characters";

export const BOOT_SCENE_KEY = "boot";

/**
 * Loads only what the scene it's booting into actually needs, for the one
 * character currently in play -- not every world, not every character's
 * texture, per this migration's "don't load every world/asset up front"
 * rule. Each future scene gets its own preload list here rather than this
 * one growing into a load-everything boot.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE_KEY);
  }

  init(data: { character: CharacterId; nextScene: string }): void {
    this.registry.set("character", data.character);
    this.registry.set("nextScene", data.nextScene);
  }

  preload(): void {
    const character = this.registry.get("character") as CharacterId;
    this.load.image(TEXTURES.forestEntranceBg, TEXTURE_PATHS[TEXTURES.forestEntranceBg]);
    this.load.image(TEXTURES.startSign, TEXTURE_PATHS[TEXTURES.startSign]);
    this.load.image(TEXTURES.coin, TEXTURE_PATHS[TEXTURES.coin]);
    this.load.image(characterTextureKey(character), characterTexturePath(character));
  }

  create(): void {
    this.scene.start(this.registry.get("nextScene") as string);
  }
}
