/**
 * Shared timing for the zombie plant's chomping jaw, used by every canvas
 * renderer that draws the plant (Forest Dash hazards in PandaRunner.tsx,
 * "rootling" enemies in game/adventure/render.ts) so the same character
 * animates the same way everywhere it appears, not just in the DOM guardian
 * plant at the start of the main path (ZombiePlant.tsx). Mirrors
 * .plant-mouth-shutter / @keyframes plant-mouth-close in src/styles.css --
 * repeated biting: 200ms to close, a 300ms closed hold (teeth interlocked),
 * 200ms to reopen, then a 1.25s gap fully open before the next bite,
 * looping every 1.95s.
 *
 * The idle loop always runs, on its own schedule, regardless of whether the
 * player character is nearby -- an earlier version froze the jaw shut for
 * as long as the character stayed close, which on the main page (the panda
 * rests right next to the plant for as long as the day's first task is
 * still undone -- often most of a viewing session) read as "the mouth
 * doesn't move at all". Proximity now only adds a brief immediate reaction
 * bite (NEAR_BITE_MS) on the moment the character *arrives* -- a
 * rising-edge trigger, not a held state -- and the idle loop keeps going
 * underneath it the whole time.
 *
 * Layout constants (hinge position, sprite aspect ratio) come from
 * scripts/pack-zombie-plant-jaw.py, which crops
 * public/assets/zombie-plant-head.webp and zombie-plant-jaw.webp from the
 * same shared canvas -- draw both at identical position/size and this
 * hinge fraction lines them up with no further offset math.
 */

export const PLANT_JAW_HINGE_X = 0.4779; // fraction of sprite width
export const PLANT_JAW_HINGE_Y = 0.3467; // fraction of sprite height
export const PLANT_SPRITE_ASPECT = 376 / 300; // height / width

const CYCLE_MS = 1950;
const CLOSE_START_PCT = 64.103;
const CLOSE_END_PCT = 74.359;
const OPEN_START_PCT = 89.744;
const OPEN_END_PCT = 100;
const CLOSED_DEG = -14;

/** How long the immediate "character just arrived" reaction bite holds
 * before handing back to the idle cycle -- a quick close (40% of this) then
 * a hold (the rest), not the full close/hold/open shape of an idle bite. */
export const NEAR_BITE_MS = 260;

/** Per-instance state for the rising-edge reaction (see plantJawAngleRad).
 * Callers own one of these per on-screen plant instance -- create with
 * createNearBiteTracker() and keep it alive across frames (a ref, or a
 * field on a longer-lived hazard/enemy object), not a new one each call. */
export type NearBiteTracker = { wasNear: boolean; biteUntil: number };

export const createNearBiteTracker = (): NearBiteTracker => ({ wasNear: false, biteUntil: -Infinity });

/**
 * Jaw rotation in radians at elapsed time `tMs`. `phaseOffsetMs` staggers
 * multiple on-screen plants running the idle cycle so they don't all chomp
 * in lockstep. `near` + `tracker` add the rising-edge reaction bite on top
 * of the idle cycle -- omit both for just the plain idle loop.
 */
export function plantJawAngleRad(tMs: number, phaseOffsetMs = 0, near = false, tracker?: NearBiteTracker): number {
  if (tracker) {
    if (near && !tracker.wasNear) tracker.biteUntil = tMs + NEAR_BITE_MS;
    tracker.wasNear = near;
    if (tMs < tracker.biteUntil) {
      const closeMs = NEAR_BITE_MS * 0.4;
      const sinceStart = tMs - (tracker.biteUntil - NEAR_BITE_MS);
      const deg = CLOSED_DEG * Math.min(1, sinceStart / closeMs);
      return (deg * Math.PI) / 180;
    }
  }

  const t = (((tMs + phaseOffsetMs) % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  const pct = (t / CYCLE_MS) * 100;
  let deg: number;
  if (pct <= CLOSE_START_PCT) deg = 0;
  else if (pct <= CLOSE_END_PCT) deg = (CLOSED_DEG * (pct - CLOSE_START_PCT)) / (CLOSE_END_PCT - CLOSE_START_PCT);
  else if (pct <= OPEN_START_PCT) deg = CLOSED_DEG;
  else if (pct <= OPEN_END_PCT) deg = CLOSED_DEG * (1 - (pct - OPEN_START_PCT) / (OPEN_END_PCT - OPEN_START_PCT));
  else deg = 0;
  return (deg * Math.PI) / 180;
}

/**
 * Draws the two-layer chomping plant into a canvas 2D context at (x, y)
 * top-left, `w` wide (height follows PLANT_SPRITE_ASPECT). `head`/`jaw`
 * must be the zombie-plant-head/jaw.webp images (or undefined while still
 * loading, in which case nothing is drawn -- callers already have their
 * own fallback for that). Pass `near` + a per-instance `tracker` (from
 * createNearBiteTracker()) to get the immediate reaction bite when the
 * player character is close; omit both for just the idle loop.
 */
export function drawPlant(
  ctx: CanvasRenderingContext2D,
  head: HTMLImageElement | undefined,
  jaw: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  tMs: number,
  phaseOffsetMs = 0,
  near = false,
  tracker?: NearBiteTracker
): void {
  if (!head || !head.complete || !head.naturalWidth || !jaw || !jaw.complete || !jaw.naturalWidth) return;
  const h = w * PLANT_SPRITE_ASPECT;
  ctx.drawImage(head, x, y, w, h);
  const hingeX = x + w * PLANT_JAW_HINGE_X;
  const hingeY = y + h * PLANT_JAW_HINGE_Y;
  ctx.save();
  ctx.translate(hingeX, hingeY);
  ctx.rotate(plantJawAngleRad(tMs, phaseOffsetMs, near, tracker));
  ctx.drawImage(jaw, -w * PLANT_JAW_HINGE_X, -h * PLANT_JAW_HINGE_Y, w, h);
  ctx.restore();
}
