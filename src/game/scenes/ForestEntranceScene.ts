import Phaser from "phaser";
import { generatePlatforms, goalPoint, startPoint, type Platform as GamePlatform, type Point } from "../platformGenerator";
import { pandaPlatformIndex } from "../progress";
import { TEXTURES } from "../assets/manifest";
import { followHorizontally } from "../systems/cameraFollow";
import { PandaEntity } from "../entities/PandaEntity";
import { forestBridge, type ForestGameState } from "../bridge";
import type { CharacterId } from "../characters";

export const FOREST_ENTRANCE_SCENE_KEY = "forest-entrance";

// Fixed logical resolution -- Phaser's Scale.FIT (see PhaserGame.ts) scales
// this to whatever the container actually is, so every coordinate below is a
// constant instead of something recomputed on resize.
export const VIEWPORT_W = 900;
export const VIEWPORT_H = 460;
const WORLD_W = 2200;
const GROUND_Y = VIEWPORT_H - 70;
const CLIMB_RANGE = 240;
const SIDE_MARGIN = 90;

const toScreenX = (normX: number) => SIDE_MARGIN + normX * (WORLD_W - SIDE_MARGIN * 2);
const toScreenY = (normY: number) => GROUND_Y - normY * CLIMB_RANGE;
const toScreen = (p: Point) => ({ x: toScreenX(p.x), y: toScreenY(p.y) });

// Grassy-top, muddy-bodied platform block -- generated once into a reusable
// texture rather than drawn per-platform, per the reference art's own brick
// blocks (frontend/assets/environment1.png). TUFT_H is decorative overflow
// above the walkable surface; PLATFORM_ORIGIN_Y is where that surface (the
// top of the grass, not the tuft tips) sits within the texture, so placing
// the image at a platform's toScreen() point lines the two up exactly.
const PLATFORM_W = 88;
const TUFT_H = 6;
const PLATFORM_H = 34;
const PLATFORM_TEX_H = TUFT_H + PLATFORM_H;
const PLATFORM_ORIGIN_Y = TUFT_H / PLATFORM_TEX_H;
const PLATFORM_TEXTURE = "mario-platform";

// The ground strip's own tileable grass-on-mud texture -- a small repeat
// unit rather than one huge flat-colour rectangle, so the base of the level
// carries the same grassy/muddy read as the platforms instead of just a
// dark backdrop underneath them.
const GROUND_TILE_W = 64;
const GROUND_TILE_H = 48;
const GROUND_CAP_H = 10;
const GROUND_TEXTURE = "mario-ground";

/**
 * Stage 1 / "Forest Entrance" -- the same environment as
 * ForestScene.tsx + styles.css's `.forest-scene[data-stage="1"]`, rebuilt as
 * a real Phaser world: a genuine follow camera instead of a `--cam-x` CSS
 * variable, real Arcade Physics colliders instead of `position: absolute`
 * percentages, and the exact same deterministic layout (generatePlatforms /
 * pandaPlatformIndex, imported unchanged) instead of a re-derived one.
 *
 * This is intentionally the ONLY environment migrated so far -- see this
 * migration's own staging rule. Story Mode, Forest Dash, NPCs, enemies and
 * the other five stages are not here yet.
 */
export class ForestEntranceScene extends Phaser.Scene {
  private panda!: PandaEntity;
  private platformBodies!: Phaser.Physics.Arcade.StaticGroup;
  private coinSprites = new Map<number, Phaser.GameObjects.Image>();
  private platforms: GamePlatform[] = [];
  private currentDone = 0;
  private totalTasks = 0;
  private onBridgeState = (next: ForestGameState) => this.applyState(next);

  constructor() {
    super(FOREST_ENTRANCE_SCENE_KEY);
  }

  create(): void {
    const state = forestBridge.getState();
    const character: CharacterId = state?.character ?? "panda";
    this.totalTasks = state?.totalTasks ?? 0;
    this.currentDone = state?.doneTasks ?? 0;

    this.physics.world.setBounds(0, 0, WORLD_W, VIEWPORT_H);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEWPORT_H);

    this.ensurePlatformTexture();
    this.ensureGroundTexture();
    this.buildBackground();
    this.buildFireflies();
    this.buildGround();
    this.buildStartSign();
    this.platforms = generatePlatforms(state?.dayNumber ?? 1, this.totalTasks, state?.seed ?? "preview");
    this.buildPlatforms();
    this.buildCoins();
    this.buildGoal(state?.dayNumber ?? 1);

    const startIndex = pandaPlatformIndex(this.currentDone, this.totalTasks);
    const startPos = this.pandaTargetFor(startIndex);
    this.panda = new PandaEntity(this, startPos.x, startPos.y, character);
    this.physics.add.collider(this.panda, this.platformBodies);
    followHorizontally(this.cameras.main, this.panda);
    this.setupLookControls();

    forestBridge.on("state", this.onBridgeState);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => forestBridge.off("state", this.onBridgeState));

    forestBridge.notify({ type: "ready" });
  }

  // ------------------------------------------------------------- world build
  // Generated once (Phaser textures persist across scene restarts within the
  // same game instance) rather than redrawn with Graphics per platform.
  private ensurePlatformTexture(): void {
    if (this.textures.exists(PLATFORM_TEXTURE)) return;
    const g = this.add.graphics();
    const capY = TUFT_H;
    const capH = 12;
    // muddy dirt body
    g.fillStyle(0x6b4a2e, 1);
    g.fillRect(0, capY + capH, PLATFORM_W, PLATFORM_H - capH);
    // darker soil clumps in a loose grid -- the "muddy" texture
    g.fillStyle(0x4a3220, 1);
    for (let x = 5; x < PLATFORM_W - 6; x += 15) {
      for (let y = capY + capH + 5; y < capY + PLATFORM_H - 3; y += 9) {
        g.fillRect(x, y, 9, 4);
      }
    }
    // grass cap -- rounded top corners where the platform ends (fillRoundedRect
    // crops the sharp corner pixels away instead of leaving them square), so
    // each block reads as a rounded grassy tile rather than a hard-edged box.
    const capRadius = { tl: 7, tr: 7, bl: 0, br: 0 };
    g.fillStyle(0x6fb54a, 1);
    g.fillRoundedRect(0, capY, PLATFORM_W, capH, capRadius);
    g.fillStyle(0x8fd35f, 1);
    g.fillRoundedRect(0, capY, PLATFORM_W, 4, { tl: 4, tr: 4, bl: 0, br: 0 });
    // tufts of grass poking up above the walkable surface
    g.fillStyle(0x6fb54a, 1);
    for (let x = 3; x < PLATFORM_W - 3; x += 10) {
      g.fillTriangle(x, capY, x + 3, capY - TUFT_H, x + 6, capY);
    }
    // pixel-art outline around the solid block (not the decorative tufts) --
    // rounded at the top to match the grass, square at the bottom where the
    // muddy body would plant into the ground.
    g.lineStyle(2, 0x2c1c10, 1);
    g.strokeRoundedRect(1, capY + 1, PLATFORM_W - 2, PLATFORM_H - 2, capRadius);
    g.generateTexture(PLATFORM_TEXTURE, PLATFORM_W, PLATFORM_TEX_H);
    g.destroy();
  }

  // The base ground's own grass-on-mud tile, repeated across the whole
  // level width (see buildGround()) so the floor reads the same way the
  // platforms do everywhere, persistently, rather than a flat colour strip
  // with no texture. No corner rounding here -- it's one continuous run of
  // ground, not a discrete block with ends to crop.
  private ensureGroundTexture(): void {
    if (this.textures.exists(GROUND_TEXTURE)) return;
    const g = this.add.graphics();
    g.fillStyle(0x6b4a2e, 1);
    g.fillRect(0, GROUND_CAP_H, GROUND_TILE_W, GROUND_TILE_H - GROUND_CAP_H);
    g.fillStyle(0x4a3220, 1);
    for (let x = 4; x < GROUND_TILE_W - 5; x += 14) {
      for (let y = GROUND_CAP_H + 6; y < GROUND_TILE_H - 4; y += 10) {
        g.fillRect(x, y, 8, 4);
      }
    }
    g.fillStyle(0x6fb54a, 1);
    g.fillRect(0, 0, GROUND_TILE_W, GROUND_CAP_H);
    g.fillStyle(0x8fd35f, 1);
    g.fillRect(0, 0, GROUND_TILE_W, 3);
    g.generateTexture(GROUND_TEXTURE, GROUND_TILE_W, GROUND_TILE_H);
    g.destroy();
  }

  private buildFireflies(): void {
    // A handful of soft glowing motes drifting through the level -- matches
    // the "subtle fireflies/glowing particles" the DOM forest already uses
    // (styles.css's .forest-fireflies), rebuilt as real Phaser objects
    // instead of a CSS radial-gradient layer.
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(40, WORLD_W - 40);
      const y = Phaser.Math.Between(60, GROUND_Y - 40);
      const mote = this.add.circle(x, y, 2, 0xf0e0a0, 0.8).setDepth(-1);
      this.tweens.add({
        targets: mote,
        y: y - Phaser.Math.Between(20, 40),
        alpha: { from: 0.15, to: 0.85 },
        duration: Phaser.Math.Between(1800, 3200),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Phaser.Math.Between(0, 2000),
      });
    }
  }

  private buildBackground(): void {
    // scrollFactor < 1 is Phaser's native parallax -- the direct replacement
    // for `.forest-photo`'s `translateX(var(--cam-x) * 0.1)` CSS hack.
    this.add
      .tileSprite(0, 0, WORLD_W, VIEWPORT_H, TEXTURES.forestEntranceBg)
      .setOrigin(0, 0)
      .setScrollFactor(0.1, 0)
      .setDepth(-10);
  }

  private buildGround(): void {
    // Decorative: the textured, tiling grass-on-mud strip -- purely visual.
    this.add.tileSprite(0, GROUND_Y, WORLD_W, GROUND_TILE_H, GROUND_TEXTURE).setOrigin(0, 0).setDepth(-5);
    // Collision: a plain invisible body at the same position -- the panda
    // rests on this, not on the art.
    const collider = this.add.rectangle(WORLD_W / 2, GROUND_Y + GROUND_TILE_H / 2, WORLD_W, GROUND_TILE_H, 0x000000, 0);
    this.physics.add.existing(collider, true);
  }

  private buildStartSign(): void {
    const pos = toScreen(startPoint());
    this.add.image(pos.x - 30, pos.y - 2, TEXTURES.startSign).setOrigin(0.5, 1).setScale(0.6);
  }

  private buildPlatforms(): void {
    this.platformBodies = this.physics.add.staticGroup();
    for (const platform of this.platforms) {
      const pos = toScreen(platform);
      this.add.image(pos.x, pos.y, PLATFORM_TEXTURE).setOrigin(0.5, PLATFORM_ORIGIN_Y).setDepth(1);
      // A thin collider right at the walkable surface -- the visible block
      // is decorative, this is what the panda actually rests on.
      const body = this.add.rectangle(pos.x, pos.y - 3, PLATFORM_W, 6, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.platformBodies.add(body);
    }
  }

  private buildCoins(): void {
    this.coinSprites.clear();
    for (const platform of this.platforms) {
      const pos = toScreen(platform);
      const collected = platform.taskIndex < this.currentDone;
      const coin = this.add.image(pos.x, pos.y - 34, TEXTURES.coin).setDisplaySize(30, 30).setDepth(2);
      coin.setVisible(!collected);
      // A gentle bob + squash to read as a collectible waiting to be grabbed,
      // not a flat decal -- the "alive, not static" read the reference art's
      // own glowing coin has.
      this.tweens.add({
        targets: coin,
        y: pos.y - 44,
        scaleX: coin.scaleX * 0.82,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: Phaser.Math.Between(0, 400),
      });
      this.coinSprites.set(platform.taskIndex, coin);
    }
  }

  private buildGoal(dayNumber: number): void {
    const pos = toScreen(goalPoint(this.totalTasks));
    this.add.rectangle(pos.x, pos.y - 42, 4, 84, 0xb7c8a0).setOrigin(0.5, 0).setDepth(1);
    this.add.triangle(pos.x + 2, pos.y - 78, 0, 0, 34, 10, 0, 20, 0xf2d38c).setDepth(1);
    this.add
      .text(pos.x, pos.y - 96, `DAY ${String(dayNumber).padStart(2, "0")}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f3e6c8",
        backgroundColor: "#0b1712cc",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5, 1)
      .setDepth(1);
  }

  // ------------------------------------------------------------ react state
  private pandaTargetFor(index: number): Point {
    if (this.totalTasks <= 0) return toScreen(startPoint());
    if (index <= 0) return toScreen(startPoint());
    if (index > this.platforms.length) return toScreen(goalPoint(this.totalTasks));
    return toScreen(this.platforms[index - 1]);
  }

  private applyState(next: ForestGameState): void {
    // Idempotent: a re-render that didn't actually change completion is a
    // no-op here too, same as the state layer it mirrors.
    if (next.doneTasks === this.currentDone && next.totalTasks === this.totalTasks) return;
    this.totalTasks = next.totalTasks;
    this.currentDone = next.doneTasks;
    const targetIndex = pandaPlatformIndex(next.doneTasks, next.totalTasks);
    const target = this.pandaTargetFor(targetIndex);
    const reachedTaskIndex = targetIndex - 1;
    const coin = this.coinSprites.get(reachedTaskIndex);
    this.panda.hopTo(target.x, target.y, () => {
      coin?.setVisible(false);
      forestBridge.notify(
        next.doneTasks >= next.totalTasks && next.totalTasks > 0
          ? { type: "goalReached" }
          : { type: "platformReached", taskIndex: reachedTaskIndex }
      );
    });
  }

  // ---------------------------------------------------------------- input
  private setupLookControls(): void {
    const cursors = this.input.keyboard?.createCursorKeys();
    let resumeAt = 0;
    const nudge = (dx: number) => {
      this.cameras.main.stopFollow();
      this.cameras.main.scrollX = Phaser.Math.Clamp(this.cameras.main.scrollX + dx, 0, WORLD_W - this.cameras.main.width);
      resumeAt = this.time.now + 1200;
    };
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      nudge(-pointer.velocity.x * 0.02);
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, () => {
      if (cursors?.left.isDown) nudge(-6);
      else if (cursors?.right.isDown) nudge(6);
      else if (resumeAt && this.time.now > resumeAt) {
        resumeAt = 0;
        followHorizontally(this.cameras.main, this.panda);
      }
    });
  }
}
