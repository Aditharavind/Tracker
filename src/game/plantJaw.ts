/**
 * Shared timing for the zombie plant's chomping jaw, used by every canvas
 * renderer that draws the plant (Forest Dash hazards in PandaRunner.tsx,
 * "rootling" enemies in game/adventure/render.ts) so the same character
 * animates the same way everywhere it appears, not just in the DOM guardian
 * plant at the start of the main path (ZombiePlant.tsx). Mirrors
 * .plant-mouth-shutter / @keyframes plant-mouth-close in src/styles.css --
 * open hold, then exactly 200ms to close, a short closed hold, then exactly
 * 200ms to reopen, looping every 4s.
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

const CYCLE_MS = 4000;
const CLOSE_START_PCT = 55;
const CLOSE_END_PCT = 60;
const OPEN_START_PCT = 67.5;
const OPEN_END_PCT = 72.5;
const CLOSED_DEG = -8;

/**
 * Jaw rotation in radians at elapsed time `tMs`. `phaseOffsetMs` staggers
 * multiple on-screen plants (pass something derived from each instance's
 * id/x) so they don't all chomp in lockstep.
 */
export function plantJawAngleRad(tMs: number, phaseOffsetMs = 0): number {
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
 * own fallback for that).
 */
export function drawPlant(
  ctx: CanvasRenderingContext2D,
  head: HTMLImageElement | undefined,
  jaw: HTMLImageElement | undefined,
  x: number,
  y: number,
  w: number,
  tMs: number,
  phaseOffsetMs = 0
): void {
  if (!head || !head.complete || !head.naturalWidth || !jaw || !jaw.complete || !jaw.naturalWidth) return;
  const h = w * PLANT_SPRITE_ASPECT;
  ctx.drawImage(head, x, y, w, h);
  const hingeX = x + w * PLANT_JAW_HINGE_X;
  const hingeY = y + h * PLANT_JAW_HINGE_Y;
  ctx.save();
  ctx.translate(hingeX, hingeY);
  ctx.rotate(plantJawAngleRad(tMs, phaseOffsetMs));
  ctx.drawImage(jaw, -w * PLANT_JAW_HINGE_X, -h * PLANT_JAW_HINGE_Y, w, h);
  ctx.restore();
}
