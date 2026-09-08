import { idleInput, type Input } from "./engine";
import type { Power } from "./content";
import type { Action, Settings } from "./save";

export type InputMethod = "keyboard" | "touch" | "gamepad";
export class Controls {
  held = new Set<Action>();
  edges = new Set<Action>();
  axis = 0;
  touchAxis = 0;
  touchDown = false;
  method: InputMethod = "keyboard";
  private buttons: boolean[] = [];
  private pauseDown = false;
  private pauseRequested = false;
  private gamepadHeld = new Set<Action>();
  press(action: Action, method: InputMethod = "keyboard") {
    this.method = method;
    if (!this.held.has(action)) this.edges.add(action);
    this.held.add(action);
  }
  release(action: Action) { this.held.delete(action); }
  clear() { this.held.clear(); this.edges.clear(); this.gamepadHeld.clear(); this.axis = 0; this.touchAxis = 0; this.touchDown = false; this.buttons = []; }
  key(key: string, settings: Settings): Action | undefined {
    const normalized = key.toLowerCase();
    const mapped = (Object.keys(settings.keys) as Action[]).find(action => settings.keys[action] === normalized);
    if (mapped) return mapped;
    return ({ arrowleft: "left", arrowright: "right", arrowup: "jump", arrowdown: "crouch" } as Record<string, Action>)[normalized];
  }
  pollGamepad() {
    const pad = navigator.getGamepads?.()?.[0];
    if (!pad) { this.axis = 0; this.gamepadHeld.clear(); this.buttons = []; this.pauseDown = false; this.pauseRequested = false; return; }
    const pause = pad.buttons[9]?.pressed ?? false;
    if (pause && !this.pauseDown) this.pauseRequested = true;
    this.pauseDown = pause;
    this.axis = Math.abs(pad.axes[0] ?? 0) > .18 ? pad.axes[0] : 0;
    const mapping: Record<number, Action> = { 0: "jump", 1: "dash", 2: "attack", 3: "ability", 4: "cycle", 13: "crouch", 14: "left", 15: "right" };
    this.gamepadHeld.clear();
    for (const [index, action] of Object.entries(mapping)) {
      const pressed = pad.buttons[Number(index)]?.pressed ?? false;
      if (pressed) { this.gamepadHeld.add(action); if (!this.buttons[Number(index)]) this.edges.add(action); this.method = "gamepad"; }
    }
    if (this.axis) this.method = "gamepad";
    this.buttons = pad.buttons.map(button => button.pressed);
  }
  consumeCycle() { const cycle = this.edges.has("cycle"); this.edges.delete("cycle"); return cycle; }
  consumePause() { const pause = this.pauseRequested; this.pauseRequested = false; return pause; }
  input(selected: Power): Input {
    const held = (key: Action) => this.held.has(key) || this.gamepadHeld.has(key);
    const edge = (key: Action) => { const value = this.edges.has(key); this.edges.delete(key); return value; };
    const result = idleInput();
    result.move = this.touchDown ? this.touchAxis : this.axis || Number(held("right")) - Number(held("left"));
    result.jump = edge("jump"); result.jumpHeld = held("jump"); result.attack = edge("attack"); result.dash = edge("dash"); result.ability = edge("ability");
    result.crouch = held("crouch"); result.walk = held("walk") || (this.touchDown && Math.abs(this.touchAxis) < .65); result.selected = selected;
    return result;
  }
}

/** Gradual graphics adaptation; the physics step never changes. */
export class PerformanceGovernor {
  level = 2;
  resolution = 1;
  private slow = 0;
  private fast = 0;
  sample(seconds: number, automatic: boolean) {
    if (!automatic) return;
    if (seconds > .027) { this.slow += seconds; this.fast = 0; }
    else if (seconds < .019) { this.fast += seconds; this.slow = Math.max(0, this.slow - seconds); }
    else { this.slow = Math.max(0, this.slow - seconds); this.fast = 0; }
    if (this.slow > 2) { if (this.resolution > .7) this.resolution = Math.max(.7, this.resolution - .15); else this.level = Math.max(0, this.level - 1); this.slow = 0; }
    if (this.fast > 12) { if (this.level < 2) this.level++; else this.resolution = Math.min(1, this.resolution + .1); this.fast = 0; }
  }
}
