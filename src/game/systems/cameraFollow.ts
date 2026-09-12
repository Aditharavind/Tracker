import Phaser from "phaser";

/**
 * Horizontal follow-cam for a side-scrolling level: the ground line never
 * moves, only x pans, smoothly, as the target advances. Replaces the DOM
 * version's manual `--cam-x` CSS variable (see styles.css's .forest-photo)
 * with Phaser's own camera system, per this migration's own rule. Shared
 * across every forest-style scene instead of each one re-deriving it.
 */
export function followHorizontally(
  camera: Phaser.Cameras.Scene2D.Camera,
  target: Phaser.GameObjects.GameObject
): void {
  // lerpY = 0 means the y axis is never nudged by the follow target --
  // exactly the "pans, never scrolls vertically" behaviour the DOM scene has.
  camera.startFollow(target, true, 0.12, 0);
}
