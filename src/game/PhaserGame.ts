import Phaser from "phaser";
import { BootScene, BOOT_SCENE_KEY } from "./scenes/BootScene";
import { ForestEntranceScene, FOREST_ENTRANCE_SCENE_KEY, VIEWPORT_H, VIEWPORT_W } from "./scenes/ForestEntranceScene";
import type { CharacterId } from "./characters";

let activeGame: Phaser.Game | null = null;

/**
 * The one Phaser.Game instance the app ever runs at a time -- see this
 * migration's own "no multiple Phaser instances" rule. Only
 * components/forest/PhaserForestScene.tsx calls this, and only from a
 * mount effect whose cleanup calls destroyForestGame(); nothing else should
 * construct a Phaser.Game directly.
 */
export function createForestGame(container: HTMLElement, character: CharacterId): Phaser.Game {
  if (activeGame) destroyForestGame();

  activeGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: "#0c1710",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEWPORT_W,
      height: VIEWPORT_H,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { x: 0, y: 900 }, debug: false },
    },
    render: { pixelArt: true },
  });

  activeGame.scene.add(BOOT_SCENE_KEY, BootScene, false);
  activeGame.scene.add(FOREST_ENTRANCE_SCENE_KEY, ForestEntranceScene, false);
  activeGame.scene.start(BOOT_SCENE_KEY, { character, nextScene: FOREST_ENTRANCE_SCENE_KEY });

  return activeGame;
}

export function destroyForestGame(): void {
  activeGame?.destroy(true);
  activeGame = null;
}
