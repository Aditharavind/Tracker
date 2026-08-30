// Forest Dash -- the optional endless platformer minigame unlocked once a
// day's tasks are all done. It reuses the main forest environment: the same
// background layers, the same rigged character, the same platform / coin /
// zombie-plant art.
//
// There is NO ground. The panda auto-runs across a stream of floating ledges,
// some long, some thin, at varying heights. Every gap must be jumped -- run off
// an edge without jumping and you fall out of the world. Some ledges carry a
// hazard (a recoloured zombie plant or a landmine) that has to be hopped too.
// One miss and the run restarts.
//
// Pure, framework-free and deterministic given a seed, so it unit-tests without
// a canvas or a clock.
//
// NO connection to challenge state: no challenge XP / coins / lives. Losing
// costs nothing. Only a local best distance / coin count persists (view side).
//
// World units are abstract; the view maps LANE onto the full stage width and
// world-y onto a fraction of stage height.

import { createSeededRandom } from "./seededRandom";

export const LANE = 100;

export const PANDA_X = 16;
export const PANDA_W = 7;
export const PANDA_H = 11;

export const HAZARD_W = 6;
export const HAZARD_H = 9;
export const COIN_R = 3;

// Below this world-y there is nothing to land on -- the panda has fallen.
export const KILL_Y = -12;

const GRAVITY = 235; // units / s^2
const JUMP_V = 118; // peak ~29.6 above the launch ledge
const BASE_SPEED = 27;
const MAX_SPEED = 60;
const SPEED_RAMP = 0.016;
const MAX_DT = 0.05;

// Height band the ledges wander within (kept clear of the HUD up top).
const Y_MIN = 6;
const Y_MAX = 34;

// Recoloured zombie plants -- the view hue-rotates the sprite by this many deg.
export const PLANT_HUES = [0, 65, 135, 205, 285];

export type HazardKind = "plant" | "mine";
export type Hazard = { id: number; x: number; y: number; kind: HazardKind; hue: number };
export type Platform = { id: number; x: number; y: number; w: number };
export type Coin = { id: number; x: number; y: number; taken: boolean };

export type RunnerState = {
  rng: () => number;
  ids: number;
  t: number;
  distance: number;
  speed: number;
  y: number; // panda feet, world-y
  vy: number;
  grounded: boolean;
  platforms: Platform[];
  hazards: Hazard[];
  coins: Coin[];
  coinsTaken: number;
  over: boolean;
  edgeX: number; // world-x of the right end of the last placed platform
  lastY: number; // world-y of the last placed platform
};

export const jumpAirtime = () => (2 * JUMP_V) / GRAVITY;
export const jumpPeak = () => (JUMP_V * JUMP_V) / (2 * GRAVITY);

/** Horizontal reach of a single jump at a given speed. */
export const jumpReach = (speed: number) => speed * jumpAirtime();

const clampY = (y: number) => Math.max(Y_MIN, Math.min(Y_MAX, y));

function addLedge(state: RunnerState) {
  const s = state.speed;
  // Gap always well inside a jump's reach, with headroom for reaction time.
  const gap = jumpReach(s) * (0.4 + state.rng() * 0.28);
  const w = (0.45 + state.rng() * 2.0) * (PANDA_W + HAZARD_W);
  // Next height steps up or down from the last, but stays in band and within
  // one jump's climb so it's always makeable.
  const delta = (state.rng() - 0.45) * 2 * (jumpPeak() * 0.6);
  const y = clampY(state.lastY + delta);
  const x = state.edgeX + gap;

  state.platforms.push({ id: state.ids++, x, y, w });
  state.edgeX = x + w;
  state.lastY = y;

  // Hazard on wider ledges only (must be room to stand before it too).
  if (w > PANDA_W + HAZARD_W + 5 && state.rng() < 0.5) {
    state.hazards.push({
      id: state.ids++,
      x: x + PANDA_W + 3 + state.rng() * (w - PANDA_W - HAZARD_W - 6),
      y,
      kind: state.rng() < 0.5 ? "plant" : "mine",
      hue: PLANT_HUES[Math.floor(state.rng() * PLANT_HUES.length)],
    });
  }

  // Coins arc over the gap leading to this ledge.
  const coins = 1 + Math.floor(state.rng() * 3);
  for (let i = 0; i < coins; i++) {
    const f = (i + 1) / (coins + 1);
    state.coins.push({
      id: state.ids++,
      x: x - gap * (1 - f),
      y: y + 5 + Math.sin(f * Math.PI) * 9,
      taken: false,
    });
  }
}

export function createRunner(seed: string): RunnerState {
  const rng = createSeededRandom(`dash:${seed}`);
  const startY = 16;
  const state: RunnerState = {
    rng,
    ids: 1,
    t: 0,
    distance: 0,
    speed: BASE_SPEED,
    y: startY,
    vy: 0,
    grounded: true,
    platforms: [{ id: 0, x: -8, y: startY, w: 52 }],
    hazards: [],
    coins: [],
    coinsTaken: 0,
    over: false,
    edgeX: 44, // -8 + 52
    lastY: startY,
  };
  for (let i = 0; i < 5; i++) addLedge(state);
  return state;
}

const hitsHazard = (state: RunnerState, h: Hazard) =>
  PANDA_X < h.x + HAZARD_W &&
  PANDA_X + PANDA_W > h.x &&
  state.y < h.y + HAZARD_H &&
  state.y + PANDA_H > h.y;

const hitsCoin = (state: RunnerState, c: Coin) =>
  !c.taken &&
  PANDA_X < c.x + COIN_R &&
  PANDA_X + PANDA_W > c.x - COIN_R &&
  state.y + PANDA_H > c.y - COIN_R &&
  state.y < c.y + COIN_R;

export function step(state: RunnerState, dtMs: number, jump: boolean): RunnerState {
  if (state.over) return state;

  const dt = Math.min(MAX_DT, Math.max(0, dtMs / 1000));
  state.t += dtMs;
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.distance * SPEED_RAMP);
  state.distance += state.speed * dt;

  const shift = state.speed * dt;
  for (const p of state.platforms) p.x -= shift;
  for (const h of state.hazards) h.x -= shift;
  for (const c of state.coins) c.x -= shift;
  state.edgeX -= shift;
  state.platforms = state.platforms.filter((p) => p.x + p.w > -12);
  state.hazards = state.hazards.filter((h) => h.x > -HAZARD_W * 2);
  state.coins = state.coins.filter((c) => c.x > -COIN_R * 2 && !c.taken);
  while (state.edgeX < LANE * 1.7) addLedge(state);

  if (jump && state.grounded) {
    state.vy = JUMP_V;
    state.grounded = false;
  }

  state.vy -= GRAVITY * dt;
  const prevY = state.y;
  state.y += state.vy * dt;

  // Land on a ledge top only while descending onto it (one-way platforms).
  state.grounded = false;
  if (state.vy <= 0) {
    let land: number | null = null;
    for (const p of state.platforms) {
      if (
        p.x < PANDA_X + PANDA_W &&
        p.x + p.w > PANDA_X &&
        prevY >= p.y - 0.5 &&
        state.y <= p.y + 0.5
      ) {
        if (land == null || p.y > land) land = p.y;
      }
    }
    if (land != null) {
      state.y = land;
      state.vy = 0;
      state.grounded = true;
    }
  }

  // No ground: fall far enough and the run is over.
  if (state.y < KILL_Y) {
    state.over = true;
    return state;
  }

  for (const c of state.coins) {
    if (hitsCoin(state, c)) {
      c.taken = true;
      state.coinsTaken += 1;
    }
  }
  for (const h of state.hazards) {
    if (hitsHazard(state, h)) {
      state.over = true;
      break;
    }
  }

  return state;
}

/** Whole metres travelled -- the distance score. */
export const metres = (state: RunnerState) => Math.floor(state.distance / 4);
