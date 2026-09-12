import Phaser from "phaser";
import { characterTextureKey } from "../assets/manifest";
import type { CharacterId } from "../characters";

/**
 * Wraps the flat character texture (game/characters.ts's CHARACTER_SPRITE --
 * one static image per character, exactly like the DOM version in
 * Panda.tsx/PandaFlat) as a real Phaser Arcade sprite: a physics body so it
 * can rest on real platform colliders, plus tween-driven hop/idle motion.
 *
 * No frame animation is invented here. There is no multi-frame sheet for
 * these characters (only a single static texture each) -- per this
 * migration's own rule, a static image stays a static image; the "life" in
 * the motion comes from tweening the sprite's transform (position, scale),
 * the same trick the DOM version already uses via CSS.
 */
export class PandaEntity extends Phaser.Physics.Arcade.Sprite {
  private idleTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, character: CharacterId) {
    super(scene, x, y, characterTextureKey(character));
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setCollideWorldBounds(true);
    this.startIdle();
  }

  private startIdle(): void {
    this.idleTween?.stop();
    this.setScale(1, 1);
    this.idleTween = this.scene.tweens.add({
      targets: this,
      scaleY: 0.97,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /** Hop from wherever it currently stands to (x, y) -- a new platform, or the goal. */
  hopTo(x: number, y: number, onLanded?: () => void): void {
    this.idleTween?.stop();
    const facing = x >= this.x ? 1 : -1;
    this.setFlipX(facing < 0);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    const fromX = this.x;
    const fromY = this.y;
    const apexY = Math.min(fromY, y) - 46;
    this.scene.tweens.chain({
      targets: this,
      tweens: [
        { x: (fromX + x) / 2, y: apexY, scaleX: 0.94, scaleY: 1.1, duration: 220, ease: "Sine.easeOut" },
        { x, y, scaleX: 1, scaleY: 1, duration: 220, ease: "Sine.easeIn" },
      ],
      onComplete: () => {
        body.enable = true;
        this.startIdle();
        onLanded?.();
      },
    });
  }

  /** Snap straight to a state-derived position -- no animation, no reward. Used on first load / a hard reset. */
  snapTo(x: number, y: number): void {
    this.idleTween?.stop();
    this.setPosition(x, y);
    this.startIdle();
  }
}
