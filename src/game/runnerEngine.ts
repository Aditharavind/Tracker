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
// Deliberately short: the modest hop only clears ~13 units, so a tall hazard
// would be nearly unjumpable. A normal jump sails well over this.
export const HAZARD_H = 5;
export const COIN_R = 3;

// Below this world-y there is nothing to land on -- the panda has fallen.
export const KILL_Y = -14;

const GRAVITY = 160; // units / s^2
const JUMP_V = 66; // modest hop -- peak ~13.6 above the launch ledge
const BASE_SPEED = 27;
const MAX_SPEED = 52;
const SPEED_RAMP = 0.012;
const MAX_DT = 0.05;

// Height band the ledges wander within (kept clear of the HUD up top).
const Y_MIN = 5;
const Y_MAX = 26;

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
  jumpsUsed: number; // 0 on the ground, 1 after a hop, 2 after the double-hop
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

/** Horizontal reach of a single flat jump at a given speed. */
export const jumpReach = (speed: number) => speed * jumpAirtime();

/**
 * Seconds for a jump launched at the current height to descend onto a ledge
 * `dy` above (negative = below) the launch point. Used by AI / hint logic.
 */
export function descentTime(dy: number): number {
  const disc = JUMP_V * JUMP_V - 2 * GRAVITY * dy;
  return disc > 0 ? (JUMP_V + Math.sqrt(disc)) / GRAVITY : jumpAirtime();
}

const clampY = (y: number) => Math.max(Y_MIN, Math.min(Y_MAX, y));

/** y of a jump launched from y=0, `t` seconds in. */
const arcY = (t: number) => JUMP_V * t - 0.5 * GRAVITY * t * t;

function addLedge(state: RunnerState) {
  const s = state.speed;

  // Pick the next height: steps DOWN can be steep (easy), steps UP stay well
  // inside what the modest hop can actually climb.
  const r = state.rng() * 2 - 1;
  const delta = r >= 0 ? r * (jumpPeak() * 0.5) : r * (jumpPeak() * 1.4);
  const y = clampY(state.lastY + delta);
  const dy = y - state.lastY;

  // Time for the jump (launched at the previous ledge's edge) to come back
  // down onto THIS ledge's height -- the descending crossing.
  const tLand = descentTime(dy);

  // Gap deliberately shorter than the jump's full reach so an edge hop -- even
  // a slightly early one -- lands safely on this ledge, and every coin strung
  // along the arc is on the panda's real path. Still a real gap: stand still
  // and you fall.
  const gap = Math.max(PANDA_W * 1.35, s * tLand * (0.62 + state.rng() * 0.16));
  const launchX = state.edgeX;
  const x = launchX + gap;

  // A hazard mid-ledge means the panda has to hop it and land back on the SAME
  // ledge -- so the ledge must be long enough to hold: landing room + the
  // hazard + a full hop's worth of runway after it before the drop.
  const flatReach = s * jumpAirtime();
  const landRoom = PANDA_W + 4;
  const runwayAfter = flatReach * 1.05 + PANDA_W;
  const wantHazard = state.rng() < 0.5;
  const minW = (0.55 + state.rng() * 2.1) * (PANDA_W + HAZARD_W);
  const w = wantHazard ? Math.max(minW, landRoom + HAZARD_W + runwayAfter) : minW;

  state.platforms.push({ id: state.ids++, x, y, w });
  state.edgeX = x + w;
  state.lastY = y;

  // Coins strung along the ACTUAL jump arc from the launch edge to this ledge,
  // so a normal hop sweeps up every one of them.
  const coins = 4 + Math.floor(state.rng() * 4);
  for (let i = 0; i < coins; i++) {
    const t = ((i + 0.5) / coins) * tLand;
    state.coins.push({
      id: state.ids++,
      x: launchX + s * t,
      y: state.lastY - dy + arcY(t) + PANDA_H * 0.4,
      taken: false,
    });
  }
  // A few more scattered just above the new ledge -- easy pickings while running.
  const strewn = Math.floor(state.rng() * 3);
  for (let i = 0; i < strewn; i++) {
    state.coins.push({
      id: state.ids++,
      x: x + PANDA_W + state.rng() * Math.max(1, w - PANDA_W * 2),
      y: y + PANDA_H * (0.5 + state.rng() * 0.6),
      taken: false,
    });
  }

  // Place the hazard in the ledge's front half so a hop off it always has
  // `runwayAfter` of solid ledge to land back on -- never a hop into the void.
  if (wantHazard) {
    const minHx = x + landRoom;
    const maxHx = x + w - runwayAfter - HAZARD_W;
    state.hazards.push({
      id: state.ids++,
      x: minHx + state.rng() * Math.max(0, maxHx - minHx),
      y,
      kind: state.rng() < 0.5 ? "plant" : "mine",
      hue: PLANT_HUES[Math.floor(state.rng() * PLANT_HUES.length)],
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
    jumpsUsed: 0,
    // Long opening sprint before the first gap -- room to get a feel for it.
    platforms: [{ id: 0, x: -10, y: startY, w: 78 }],
    hazards: [],
    coins: [],
    coinsTaken: 0,
    over: false,
    edgeX: 68, // -10 + 78
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

/**
 * @param jumps number of jump-press edges this frame. One press = a normal hop.
 *   A second press before landing = a double-hop (a partial re-boost); pressing
 *   twice with no gap off the ground stacks into one big launch (~2x height).
 */
export function step(state: RunnerState, dtMs: number, jumps: number | boolean): RunnerState {
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

  let presses = jumps === true ? 1 : jumps === false ? 0 : Math.max(0, Math.trunc(jumps));
  while (presses-- > 0) {
    if (state.grounded) {
      state.vy = JUMP_V;
      state.grounded = false;
      state.jumpsUsed = 1;
    } else if (state.jumpsUsed < 2) {
      // Second hop: a full reset when falling, a boost when still rising -- so a
      // no-gap double tap off the ground stacks to roughly double the height.
      state.vy = state.vy > 0 ? state.vy + JUMP_V * 0.5 : JUMP_V;
      state.jumpsUsed = 2;
    } else {
      break;
    }
  }

  state.vy -= GRAVITY * dt;
  const prevY = state.y;
  state.y += state.vy * dt;

  // Land on a ledge top only while descending onto it (one-way platforms).
  // Generous catch depth (CATCH) so a hop that arrives a little high still
  // settles onto a wide ledge instead of skating over it.
  const CATCH = 9;
  state.grounded = false;
  if (state.vy <= 0) {
    let land: number | null = null;
    for (const p of state.platforms) {
      if (
        p.x < PANDA_X + PANDA_W &&
        p.x + p.w > PANDA_X &&
        prevY >= p.y - 1 &&
        state.y <= p.y + 1 &&
        state.y > p.y - CATCH
      ) {
        if (land == null || p.y > land) land = p.y;
      }
    }
    if (land != null) {
      state.y = land;
      state.vy = 0;
      state.grounded = true;
      state.jumpsUsed = 0;
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
