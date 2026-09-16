/** Builds the story screen's pixel diorama: one horizontal slice of the world,
   drawn as 4px blocks so it keeps the same pixel density as the game sprites.
   Pure geometry — colours are tone names the stylesheet maps per world. */
import { worldScenery, type CeilingKind, type PropKind } from "./worldScenery";

export const DIORAMA_W = 320;
export const DIORAMA_H = 120;
/** One art pixel. Every rect snaps to this grid. */
export const PX = 4;
const GROUND_Y = 96;
const TERRACE_Y = 80;
const LEDGE = { x: 92, y: 64, w: 56 };

export type Tone = "sky" | "far" | "mid" | "soil" | "surface" | "detail" | "glow" | "light";
export type Rect = { x: number; y: number; w: number; h: number; c: Tone; o?: number };
export type Glow = { x: number; y: number; r: number };
export type Mote = { x: number; y: number; size: number; delay: number; duration: number };
export type Diorama = { rects: Rect[]; glows: Glow[]; motes: Mote[]; moteKind: "spark" | "snow" | "ember" };

const q = (n: number) => Math.round(n / PX) * PX;
/** Stable per-world noise: the same world always draws the same scene. */
const noise = (seed: number, i: number) => {
  const v = Math.sin(seed * 37.3 + i * 91.7) * 43758.5453;
  return v - Math.floor(v);
};

/** A stepped pixel spike. flat=0 is a point, flat=1 a column, .75 a mesa. */
function spike(out: Rect[], x: number, base: number, h: number, w: number, c: Tone, options: { down?: boolean; flat?: number; o?: number } = {}) {
  const { down = false, flat = 0, o } = options;
  const steps = Math.max(2, Math.round(h / PX));
  for (let i = 0; i < steps; i++) {
    const width = Math.max(PX, q(w * (1 - (1 - flat) * (i / steps))));
    out.push({ x: q(x + (w - width) / 2), y: down ? base + i * PX : base - (i + 1) * PX, w: width, h: PX, c, o });
  }
}

/** Stepped skyline silhouette filling everything below it. */
function ridge(out: Rect[], seed: number, y: number, amp: number, c: Tone, step = 12, o?: number) {
  for (let x = 0; x < DIORAMA_W; x += step) {
    const top = q(y - noise(seed, x) * amp);
    out.push({ x, y: top, w: step, h: DIORAMA_H - top, c, o });
  }
}

/** One piece of scenery. `tone` flattens it into a silhouette for far layers. */
function prop(out: Rect[], glows: Glow[], kind: PropKind, x: number, base: number, scale: number, tone?: Tone) {
  const h = q(28 * scale);
  const w = q(24 * scale);
  const halo = tone ? null : glows;
  const body = (fallback: Tone) => tone ?? fallback;
  switch (kind) {
    case "tree":
      out.push({ x: q(x + w / 2 - PX), y: base - q(14 * scale), w: PX * 2, h: q(14 * scale), c: body("soil") });
      spike(out, x, base - q(12 * scale), h, w, body("surface"), { flat: .25 });
      spike(out, x, base - q(4 * scale), q(16 * scale), w * .8, body("surface"), { flat: .3 });
      if (!tone) spike(out, x + PX, base - q(16 * scale), q(14 * scale), w - PX * 3, "detail", { flat: .25, o: .45 });
      break;
    case "crystal":
      spike(out, x, base, h, w * .55, body("glow"), { o: tone ? 1 : .9 });
      if (!tone) spike(out, x + PX, base, q(h * .65), PX * 2, "light", { o: .85 });
      spike(out, x - q(8 * scale), base, q(h * .6), w * .4, body("glow"), { o: tone ? 1 : .6 });
      spike(out, x + q(12 * scale), base, q(h * .45), w * .35, body("glow"), { o: tone ? 1 : .55 });
      halo?.push({ x: q(x + w * .3), y: base - h * .5, r: h * .75 });
      break;
    case "mushroom":
      out.push({ x: q(x + w / 2 - PX), y: base - q(13 * scale), w: PX * 2, h: q(13 * scale), c: body("surface") });
      out.push({ x, y: base - q(19 * scale), w, h: PX * 2, c: body("glow") });
      out.push({ x: x + PX, y: base - q(25 * scale), w: w - PX * 2, h: q(6 * scale), c: body("glow"), o: tone ? 1 : .8 });
      if (!tone) {
        out.push({ x: x + PX * 2, y: base - q(23 * scale), w: PX, h: PX, c: "light" });
        out.push({ x: q(x + w - PX * 3), y: base - q(22 * scale), w: PX, h: PX, c: "light" });
      }
      halo?.push({ x: q(x + w / 2), y: base - q(19 * scale), r: h * .7 });
      break;
    case "peak":
      spike(out, x, base, h * 1.35, w * 1.5, body("surface"));
      if (!tone) spike(out, x + q(w * .25), base - h * 1.35 + q(11 * scale), q(11 * scale), w * .7, "detail");
      break;
    case "butte":
      spike(out, x, base, h * 1.1, w * 1.3, body("surface"), { flat: .7 });
      if (!tone) {
        out.push({ x: q(x + w * .08), y: base - q(h * .5), w: q(w * 1.15), h: PX, c: "detail", o: .55 });
        out.push({ x: q(x + w * .2), y: base - q(h * .8), w: q(w * .7), h: PX, c: "detail", o: .35 });
      }
      break;
    case "spire":
      spike(out, x, base, h * 1.25, w * .85, body("surface"));
      if (!tone) spike(out, x - q(w * .12), base, h * .9, w * .5, "soil", { o: .7 });
      if (!tone) {
        out.push({ x: q(x + w * .3), y: base - q(h * .55), w: PX, h: q(h * .4), c: "glow", o: .8 });
        out.push({ x: q(x + w * .5), y: base - q(h * .3), w: PX, h: q(h * .2), c: "glow", o: .5 });
      }
      halo?.push({ x: q(x + w * .4), y: base - h * .4, r: h * .65 });
      break;
  }
}

/** What hangs from the top of the frame: leaves, stalactites, icicles, vines. */
function ceiling(out: Rect[], glows: Glow[], kind: CeilingKind, seed: number) {
  if (kind === "none") return;
  for (let i = 0; i < 7; i++) {
    const x = q(8 + i * 46 + noise(seed, i) * 18);
    const h = q(14 + noise(seed, i + 40) * 26);
    if (kind === "stalactite" || kind === "icicle") {
      const width = kind === "icicle" ? PX * 2 : PX * 3;
      spike(out, x, 0, h, width, kind === "icicle" ? "detail" : "soil", { down: true });
      if (i % 3 === 1) {
        out.push({ x: q(x + width / 2 - PX / 2), y: h, w: PX, h: PX, c: "glow" });
        glows.push({ x: q(x + width / 2), y: h, r: 13 });
      }
      continue;
    }
    out.push({ x, y: 0, w: PX, h, c: "soil" });
    for (const at of [.4, .7, 1]) {
      const y = q(h * at) - PX;
      const leaf = kind === "vine" && at === 1 ? "glow" : "surface";
      out.push({ x: x - PX * 2, y, w: PX * 2, h: PX, c: leaf as Tone });
      out.push({ x: x + PX, y: y + (at === 1 ? 0 : PX), w: PX * 2, h: PX, c: leaf as Tone });
    }
    if (kind === "vine") glows.push({ x, y: h, r: 12 });
  }
}

/** The lantern gate: concentric stepped arches where the adventure begins. */
function gate(out: Rect[], glows: Glow[], x: number, base: number) {
  const w = 44;
  const h = 56;
  const top = base - h;
  const arch = (inset: number, c: Tone, o?: number) => {
    const rows = Math.round((h - inset) / PX);
    for (let i = 0; i < rows; i++) {
      // The shoulders round over the first rows, then the posts run straight down.
      const width = Math.max(PX, q((w - inset * 2) * (.5 + .5 * Math.min(1, i / 3))));
      out.push({ x: q(x + (w - width) / 2), y: top + inset + i * PX, w: width, h: PX, c, o });
    }
  };
  arch(0, "soil");
  arch(PX, "surface", .9);
  arch(PX * 2, "sky", .85);
  arch(PX * 3, "glow", .35);
  arch(PX * 5, "glow", .6);
  // A bright core so the gate reads as a lit doorway from across the frame.
  out.push({ x: q(x + w / 2 - PX * 2), y: base - q(h * .62), w: PX * 4, h: q(h * .5), c: "light", o: .7 });
  out.push({ x: x - PX * 2, y: base - PX * 2, w: w + PX * 4, h: PX * 2, c: "soil" });
  out.push({ x: x - PX * 2, y: base - PX * 2, w: w + PX * 4, h: PX, c: "surface", o: .8 });
  glows.push({ x: q(x + w / 2), y: base - h * .5, r: h * .8 });
}

export function buildDiorama(worldIndex: number): Diorama {
  const scenery = worldScenery(worldIndex);
  const seed = worldIndex + 1;
  const rects: Rect[] = [];
  const glows: Glow[] = [];
  const kind = scenery.prop;

  rects.push({ x: 0, y: 0, w: DIORAMA_W, h: DIORAMA_H, c: "sky" });
  ridge(rects, seed, 52, 22, "far", 12);
  // Big silhouettes between the skyline and the lit scenery give the frame depth.
  for (const [i, x] of [-10, 58, 176, 286].entries()) prop(rects, glows, kind, x, GROUND_Y, 1.6 + noise(seed, i + 10) * .5, "mid");
  ceiling(rects, glows, scenery.ceiling, seed);

  // A back terrace: it cuts across the silhouettes, so they read as further away.
  rects.push({ x: 148, y: TERRACE_Y, w: 112, h: PX, c: "surface", o: .55 });
  rects.push({ x: 148, y: TERRACE_Y + PX, w: 112, h: GROUND_Y - TERRACE_Y - PX, c: "soil", o: .85 });
  for (const [i, x] of [160, 206].entries()) prop(rects, glows, kind, x, TERRACE_Y, .5 + noise(seed, i + 30) * .15);

  // A floating ledge — horizontal, never a staircase (platformer-interface §5).
  rects.push({ x: LEDGE.x, y: LEDGE.y, w: LEDGE.w, h: PX, c: "surface" });
  rects.push({ x: LEDGE.x, y: LEDGE.y + PX, w: LEDGE.w, h: PX * 2, c: "soil" });
  rects.push({ x: LEDGE.x + PX * 2, y: LEDGE.y + PX * 3, w: LEDGE.w - PX * 4, h: PX, c: "soil", o: .6 });
  prop(rects, glows, kind, LEDGE.x + 14, LEDGE.y, .45);

  // Ground: soil body, lit surface band, scattered detail specks.
  rects.push({ x: 0, y: GROUND_Y, w: DIORAMA_W, h: PX, c: "surface" });
  rects.push({ x: 0, y: GROUND_Y + PX, w: DIORAMA_W, h: DIORAMA_H - GROUND_Y - PX, c: "soil" });
  for (let i = 0; i < 16; i++) {
    rects.push({ x: q(noise(seed, i + 70) * DIORAMA_W), y: q(GROUND_Y + PX * 2 + noise(seed, i + 90) * 12), w: PX, h: PX, c: "detail", o: .3 });
  }

  for (const [i, x] of [-4, 38, 76, 232].entries()) prop(rects, glows, kind, x, GROUND_Y, i === 3 ? .6 : .85 + noise(seed, i + 20) * .4);
  gate(rects, glows, 264, GROUND_Y);

  const motes: Mote[] = Array.from({ length: 14 }, (_, i) => ({
    x: q(noise(seed, i + 120) * DIORAMA_W),
    y: q(10 + noise(seed, i + 150) * 74),
    size: noise(seed, i + 180) > .7 ? PX * 2 : PX,
    delay: -noise(seed, i + 200) * 6,
    duration: 4 + noise(seed, i + 230) * 5,
  }));

  return { rects, glows, motes, moteKind: scenery.motes };
}
