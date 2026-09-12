import Phaser from "phaser";
import type { CharacterId } from "./characters";

/**
 * The one typed channel between React and any Phaser scene in this app.
 * React owns and persists all challenge state (day, tasks, character,
 * lives, XP, resets...) exactly as it always has -- this bridge only carries
 * a read-only snapshot of it INTO Phaser, and carries game events back OUT.
 *
 * No React component reaches into a Phaser Scene or GameObject directly, and
 * no Phaser scene reaches into React state, a hook, or localStorage/the API
 * client directly -- everything crosses here. See PhaserGame.ts for the
 * single Phaser.Game instance this drives, and
 * components/forest/PhaserForestScene.tsx for the only React component
 * allowed to touch it.
 */
export type ForestGameState = {
  dayNumber: number;
  /** Same seed platformGenerator.ts already uses -- keeps the layout identical to the DOM version. */
  seed: string;
  character: CharacterId;
  totalTasks: number;
  doneTasks: number;
  /** Included for parity with the rest of the app's state shape; unused by the Forest Entrance scene so far. */
  resets: number;
};

export type ForestGameEvent =
  | { type: "ready" }
  | { type: "platformReached"; taskIndex: number }
  | { type: "goalReached" };

class ForestBridge extends Phaser.Events.EventEmitter {
  private current: ForestGameState | null = null;

  /** React -> Phaser. Call after a task's completion is already persisted -- the animation is a consequence of state, never the other way around. */
  setState(next: ForestGameState): void {
    this.current = next;
    this.emit("state", next);
  }

  /** What a freshly-created scene should read for its own initial (non-animated) layout. */
  getState(): ForestGameState | null {
    return this.current;
  }

  /** Phaser -> React. */
  notify(event: ForestGameEvent): void {
    this.emit("event", event);
  }
}

// One instance for the app's lifetime. The Phaser.Game itself is created and
// destroyed per mount (see PhaserGame.ts) -- the bridge outliving that just
// means a remount doesn't lose the last state React pushed.
export const forestBridge = new ForestBridge();
