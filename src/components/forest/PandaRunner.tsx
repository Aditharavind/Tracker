import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import {
  CHARACTER_EYES,
  CHARACTER_FUR,
  CHARACTER_SPRITE,
  type CharacterId,
} from "../../game/characters";
import { playJump } from "../../sound";
import DashLeaderboard from "../DashLeaderboard";
import { createRunner, metres, PANDA_W, PANDA_X, step, type RunnerState } from "../../game/runnerEngine";
import { drawCoin } from "../../game/coinArt";
import { createSeededRandom } from "../../game/seededRandom";
import { CHARACTER_RUN_ATLAS, characterRunFrame } from "../../game/characterRunAtlas";
import { createNearBiteTracker, drawPlant, PLANT_SPRITE_ASPECT, type NearBiteTracker } from "../../game/plantJaw";
import type { DayCell } from "../../types";

// world-y -> fraction of stage height for the "floor line" at that height.
const Y_BASE = 0.1;
const Y_SCALE = 0.017;

/**
 * The star power-up (see runnerEngine.ts's Star type / STAR_MS) -- a Mario-
 * style invincibility pickup. Slow spin and a soft glow make it read as
 * clearly rarer/more special than a coin at a glance, same hand-drawn-canvas
 * style as drawCoin() (../../game/coinArt).
 */
function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, spin: number) {
  ctx.save();
  ctx.shadowColor = "rgba(255, 224, 102, 0.85)";
  ctx.shadowBlur = r * 1.4;
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.beginPath();
  const spikes = 5;
  const outer = r;
  const inner = r * 0.44;
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const ang = (Math.PI / spikes) * i - Math.PI / 2;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffe066";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = "#a9720f";
  ctx.stroke();
  ctx.restore();
}

type CloudDef = { y: number; scale: number; speed: number; phase: number; opacity: number };

/** Same seeded cloud recipe as the home forest's Clouds.tsx, converted from
 * CSS percentages/seconds into canvas fractions. */
function makeClouds(seed: string, count: number): CloudDef[] {
  const rand = createSeededRandom(`${seed}:clouds`);
  return Array.from({ length: count }, () => {
    const scale = 1 + rand() * 1.1;
    return {
      y: (4 + rand() * 40) / 100,
      scale,
      speed: 1 / (46 - scale * 12 + rand() * 18),
      phase: rand(),
      opacity: 0.55 + rand() * 0.35,
    };
  });
}

/**
 * One pixel-art cloud: a flat body plus a couple of stepped puffs on top,
 * same silhouette as the DOM forest's .cloud (styles.css) -- box-shadow
 * stacked rectangles there, drawn rectangles here, so Forest Dash's sky
 * reads as the same place instead of a flatter, cloudless backdrop.
 */
function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#d9e0d0";
  const w = 42 * scale;
  const h = 14 * scale;
  ctx.shadowColor = "rgba(0, 0, 0, 0.14)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 4 * scale;
  ctx.fillRect(cx, cy, w, h);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = "#b9c8b5";
  ctx.fillRect(cx + 40 * scale, cy + 2 * scale, 8 * scale, h);
  ctx.fillStyle = "#d9e0d0";
  ctx.fillRect(cx + 8 * scale, cy - 8 * scale, 10 * scale, h);
  ctx.fillRect(cx + 20 * scale, cy - 13 * scale, 10 * scale, h);
  ctx.fillRect(cx + 32 * scale, cy - 7 * scale, 10 * scale, h);
  ctx.fillStyle = "#eef0dd";
  ctx.fillRect(cx + w * 0.12, cy - h * 0.9, w * 0.3, h * 1.3);
  ctx.fillRect(cx + w * 0.62, cy - h * 0.55, w * 0.26, h * 1.05);
  ctx.restore();
}

/** Drift the whole cloud layer across the canvas, looping each one from just
 * off the left edge to just off the right. Runs continuously (not gated on
 * the run/pause state, per cloudDrift's own accumulator) so the sky is alive
 * even on the ready/game-over screens, like real weather would be. */
function drawClouds(ctx: CanvasRenderingContext2D, W: number, H: number, driftMs: number, clouds: CloudDef[]) {
  for (const c of clouds) {
    const t = (c.phase + (driftMs / 1000) * c.speed) % 1;
    const x = (-0.14 + t * 1.26) * W;
    drawCloud(ctx, x, c.y * H, c.scale, c.opacity);
  }
}

/**
 * The turf on top of a ledge, drawn from the same three grass tiles the DOM
 * platforms use (see --grass-image in styles.css): the two finished caps are
 * pinned to the ends and only the middle repeats, so the strip is cropped to
 * the length of the ledge instead of being stretched across it.
 */
function drawGrassStrip(
  ctx: CanvasRenderingContext2D,
  tiles: { grassLeft?: HTMLImageElement; grassMid?: HTMLImageElement; grassRight?: HTMLImageElement },
  x: number,
  y: number,
  w: number,
  h: number
) {
  const { grassLeft: left, grassMid: mid, grassRight: right } = tiles;
  if (!left?.naturalWidth || !mid?.naturalWidth || !right?.naturalWidth) {
    // Art not decoded yet -- the flat strip the ledges used to draw.
    ctx.fillStyle = "#6cbb54";
    ctx.fillRect(x, y, w, h * 0.65);
    return;
  }
  const scale = h / left.naturalHeight;
  const lw = Math.max(1, Math.round(left.naturalWidth * scale));
  const rw = Math.max(1, Math.round(right.naturalWidth * scale));
  const mw = Math.max(1, Math.round(mid.naturalWidth * scale));
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let mx = x + Math.min(lw, w); mx < x + w; mx += mw) ctx.drawImage(mid, mx, y, mw, h);
  ctx.drawImage(left, x, y, lw, h);
  ctx.drawImage(right, x + w - rw, y, rw, h);
  ctx.restore();
}

/**
 * Forest Dash -- optional endless platformer, unlocked once the day is cleared.
 *
 * Rendered on a single <canvas> with the game's own flat sprites and forest
 * art -- no <model-viewer>, no animated CSS parallax layers -- so the loop
 * actually holds 60fps. Floating ledges only, no ground: every gap must be
 * jumped. Some ledges carry a zombie plant or a landmine to hop. One miss and
 * it restarts. Nothing here touches challenge state; only a local best is kept.
 */
export default function PandaRunner({
  character,
  userId,
  calendar: _calendar,
  onClose,
}: {
  character: CharacterId;
  userId: number | null;
  calendar: DayCell[];
  onClose: () => void;
}) {
  const key = userId ?? "guest";
  const bestDistKey = `75hard.dash.best:${key}`;
  const bestCoinKey = `75hard.dash.coins:${key}`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const distRef = useRef<HTMLSpanElement | null>(null);
  const coinRef = useRef<HTMLSpanElement | null>(null);
  const starRef = useRef<HTMLSpanElement | null>(null);

  const stateRef = useRef<RunnerState>(createRunner(String(key)));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const jumpRef = useRef(0); // press edges queued since the last frame
  const runningRef = useRef(false);
  const imgs = useRef<{
    bg?: HTMLImageElement;
    panda?: HTMLImageElement;
    run?: HTMLImageElement;
    plantHead?: HTMLImageElement;
    plantJaw?: HTMLImageElement;
    mine?: HTMLImageElement;
    grassLeft?: HTMLImageElement;
    grassMid?: HTMLImageElement;
    grassRight?: HTMLImageElement;
  }>({});
  const bgShift = useRef(0);
  const clouds = useRef(makeClouds(String(key), 6));
  const cloudDrift = useRef(0);
  // One reaction-bite tracker per plant hazard (game/plantJaw.ts), keyed by
  // the hazard's own id -- hazard objects keep a stable identity for their
  // whole lifetime (runnerEngine.ts mutates h.x in place rather than
  // replacing them), so this doesn't need cleaning up as hazards despawn;
  // ids are just a per-run counter, and the whole map is thrown away with
  // the component on unmount.
  const plantNearTrackers = useRef(new Map<number, NearBiteTracker>());

  const [phase, setPhase] = useState<"ready" | "running" | "over">("ready");
  const [result, setResult] = useState({ dist: 0, coins: 0 });
  const [best, setBest] = useState({ dist: 0, coins: 0 });
  const [board, setBoard] = useState<{ name: string; color: string; coins: number; distance: number }[]>(
    []
  );

  const loadBoard = useCallback(() => {
    api
      .dashLeaderboard()
      .then(setBoard)
      .catch(() => {
        /* leaderboard is a nicety -- ignore if the server can't serve it */
      });
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    try {
      setBest({
        dist: Number(localStorage.getItem(bestDistKey)) || 0,
        coins: Number(localStorage.getItem(bestCoinKey)) || 0,
      });
    } catch {
      /* private mode */
    }
  }, [bestDistKey, bestCoinKey]);

  // preload art
  useEffect(() => {
    const load = (src: string) => {
      const im = new Image();
      im.src = src;
      return im;
    };
    imgs.current.bg = load("/assets/forest-bg-1.webp");
    imgs.current.panda = load(CHARACTER_SPRITE[character]);
    imgs.current.run = load(CHARACTER_RUN_ATLAS.characters[character].src);
    imgs.current.plantHead = load("/assets/zombie-plant-head.webp");
    imgs.current.plantJaw = load("/assets/zombie-plant-jaw.webp");
    imgs.current.mine = load("/assets/landmine.webp");
    imgs.current.grassLeft = load("/assets/grass-left.webp");
    imgs.current.grassMid = load("/assets/grass-mid.webp");
    imgs.current.grassRight = load("/assets/grass-right.webp");
  }, [character]);

  const commitBest = useCallback(
    (dist: number, coins: number) => {
      setBest((b) => {
        const next = { dist: Math.max(b.dist, dist), coins: Math.max(b.coins, coins) };
        try {
          localStorage.setItem(bestDistKey, String(next.dist));
          localStorage.setItem(bestCoinKey, String(next.coins));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [bestDistKey, bestCoinKey]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const st = stateRef.current;
    const sx = W / 100; // LANE = 100
    const yPx = (wy: number) => H * (1 - (Y_BASE + wy * Y_SCALE));

    // --- backdrop: dark forest wash + the forest art, gently parallaxed ---
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b1a12");
    g.addColorStop(0.55, "#12271a");
    g.addColorStop(1, "#081209");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const bg = imgs.current.bg;
    if (bg && bg.complete && bg.naturalWidth) {
      const bw = H * (bg.naturalWidth / bg.naturalHeight);
      // Full opacity, same as .forest-photo on the home forest. The dark
      // gradient above is only a loading fallback now, not a permanent wash.
      ctx.globalAlpha = 1;
      let x = -((bgShift.current * 0.25) % bw);
      for (; x < W; x += bw) ctx.drawImage(bg, x, 0, bw, H);
      ctx.globalAlpha = 1;
    }
    // Drifting clouds -- the DOM forest scene's sky layer (Clouds.tsx) has
    // these; the canvas backdrop didn't, which was the rest of "looks off"
    // relative to the main game screen.
    drawClouds(ctx, W, H, cloudDrift.current, clouds.current);

    // --- ledges ---
    for (const p of st.platforms) {
      const x = p.x * sx;
      const w = p.w * sx;
      const top = yPx(p.y);
      const h = Math.max(16, H * 0.05);
      // Turf sprite over dirt: the dirt starts just under the sprite's solid
      // band so the hanging tufts drape onto it rather than floating above it.
      const gh = Math.max(10, h * 0.62);
      ctx.fillStyle = "#4a3b2c";
      ctx.fillRect(x, top + gh * 0.55, w, h - gh * 0.55);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fillRect(x, top + h, w, H * 0.016);
      drawGrassStrip(ctx, imgs.current, x, top, w, gh);
    }

    // --- coins: the panda-imprint gold coin, matching Coin.tsx ---
    const coinR = Math.max(6, H * 0.017);
    for (const c of st.coins) {
      if (c.taken) continue;
      drawCoin(ctx, c.x * sx, yPx(c.y), coinR);
    }

    // --- stars: the invincibility power-up ---
    const starR = Math.max(8, H * 0.023);
    for (const star of st.stars) {
      if (star.taken) continue;
      drawStar(ctx, star.x * sx, yPx(star.y), starR, (st.t / 1000) * 2.4);
    }

    // --- hazards: sized to about the character, sitting flush on the ledge ---
    const charH = H * 0.13;
    for (const h of st.hazards) {
      const hx = h.x * sx;
      const baseY = yPx(h.y) + 1; // a hair into the moss so it reads as planted
      if (h.kind === "plant") {
        const headIm = imgs.current.plantHead;
        const jawIm = imgs.current.plantJaw;
        const hh = charH * 1.05;
        const hw = hh / PLANT_SPRITE_ASPECT;
        if (headIm && headIm.complete && headIm.naturalWidth && jawIm && jawIm.complete && jawIm.naturalWidth) {
          ctx.filter = h.hue ? `hue-rotate(${h.hue}deg) saturate(1.4)` : "none";
          // Stagger each hazard's chomp phase by its id so a row of plants
          // doesn't bite in unison, and give each one an immediate reaction
          // bite (game/plantJaw.ts) as the panda -- fixed at PANDA_X while
          // the world scrolls past it -- comes within about a body-width.
          let tracker = plantNearTrackers.current.get(h.id);
          if (!tracker) {
            tracker = createNearBiteTracker();
            plantNearTrackers.current.set(h.id, tracker);
          }
          const near = Math.abs(h.x - PANDA_X) < PANDA_W * 1.5;
          drawPlant(ctx, headIm, jawIm, hx - hw / 2, baseY - hh, hw, st.t, h.id * 137, near, tracker);
          ctx.filter = "none";
        } else {
          ctx.fillStyle = "#6fae4a";
          ctx.fillRect(hx - hw / 2, baseY - hh, hw, hh);
        }
      } else {
        const im = imgs.current.mine;
        const mh = charH * 0.72;
        const mw = im?.naturalWidth ? mh * (im.naturalWidth / im.naturalHeight) : mh * 1.5;
        if (im && im.complete && im.naturalWidth) {
          ctx.drawImage(im, hx - mw / 2, baseY - mh, mw, mh);
        } else {
          ctx.fillStyle = "#3a3d42";
          ctx.fillRect(hx - mw / 2, baseY - mh, mw, mh);
        }
      }
    }

    // --- panda ---
    const pImg = imgs.current.panda;
    const runImg = imgs.current.run;
    // "alive" tell: a gentle idle bob, and the same eye-blink as everywhere
    // else -- two fur-toned lids flick shut for ~130ms every ~4.4s.
    const tSec = st.t / 1000;
    const bob = st.grounded ? Math.sin(tSec * 5.5) * (H * 0.004) : 0;
    const blinkP = (tSec % 4.2) / 4.2;
    const blinking = blinkP > 0.935 && blinkP < 0.96;
    const ph = charH;
    const pw = charH * 0.92;
    const px = (PANDA_X + PANDA_W / 2) * sx - pw / 2;
    // the sprite carries transparent padding below the feet -- drop it so the
    // character stands ON the ledge with only a hair of daylight under it.
    const feet = yPx(st.y) + bob + ph * 0.08;
    const py = feet - ph;

    // Star power: a soft rainbow-cycling glow behind the panda and a hue-cycle
    // over the sprite itself -- the same ctx.filter hue-rotate technique the
    // hazards below already use for their recolours, so no new rendering path.
    // Never invisible for long: even at the tail end of the window it keeps
    // flashing so a hazard nearby doesn't look identical to "not invincible".
    const invincible = st.invincibleMs > 0;
    if (invincible) {
      const flashing = st.invincibleMs < 1500 && Math.floor(tSec * 8) % 2 === 0;
      if (!flashing) {
        const glowHue = (tSec * 220) % 360;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.filter = `blur(${Math.max(2, pw * 0.18)}px)`;
        ctx.fillStyle = `hsl(${glowHue}, 90%, 62%)`;
        ctx.beginPath();
        ctx.ellipse(px + pw / 2, py + ph / 2, pw * 0.75, ph * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.save();
    if (!st.grounded) {
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate(st.vy > 0 ? -0.16 : 0.12);
      ctx.translate(-(px + pw / 2), -(py + ph / 2));
    }
    if (invincible) ctx.filter = `hue-rotate(${(tSec * 220) % 360}deg) saturate(1.6)`;
    const runSpec = CHARACTER_RUN_ATLAS.characters[character];
    const useRunFrame = runningRef.current && st.grounded && !st.over && runImg?.complete && runImg.naturalWidth;
    if (useRunFrame) {
      const frameIndex = characterRunFrame(st.t, runSpec.clips.run.frames);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        runImg,
        frameIndex * CHARACTER_RUN_ATLAS.frameWidth,
        runSpec.clips.run.row * CHARACTER_RUN_ATLAS.frameHeight,
        CHARACTER_RUN_ATLAS.frameWidth,
        CHARACTER_RUN_ATLAS.frameHeight,
        px,
        py,
        pw,
        ph
      );
    } else if (pImg && pImg.complete && pImg.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pImg, px, py, pw, ph);
    } else {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(px, py, pw, ph);
    }
    ctx.filter = "none";
    if (blinking) {
      // fur-toned lids over the eyes + a dark crease so it reads as "eyes shut"
      const e = CHARACTER_EYES[character];
      const ew = pw * (e.w / 100), eh = ph * (e.h / 100);
      const ey = py + ph * (e.y / 100) - eh / 2;
      for (const cx of [e.lx, e.rx]) {
        const ex = px + pw * (cx / 100) - ew / 2;
        ctx.fillStyle = CHARACTER_FUR[character];
        ctx.fillRect(ex, ey, ew, eh);
        ctx.fillStyle = "rgba(0,0,0,0.42)";
        ctx.fillRect(ex + ew * 0.1, ey + eh * 0.82, ew * 0.8, eh * 0.16);
      }
    }
    ctx.restore();
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse((PANDA_X + PANDA_W / 2) * sx, yPx(st.y), pw * 0.45, H * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
  }, [character]);

  const frame = useCallback(
    (ts: number) => {
      const st = stateRef.current;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      // Unconditional (not gated on running/over like bgShift below) --
      // clouds drift on the ready and game-over screens too, like real sky.
      cloudDrift.current += dt;

      if (runningRef.current && !st.over) {
        const jumped = jumpRef.current;
        jumpRef.current = 0;
        step(st, dt, jumped);
        bgShift.current += (st.speed * dt) / 1000;
        if (distRef.current) distRef.current.textContent = `${metres(st)}`;
        if (coinRef.current) coinRef.current.textContent = `${st.coinsTaken}`;
        if (starRef.current) {
          // Toggled via the hidden attribute, not conditional rendering --
          // this updates every frame the same way DIST/coins do, and a state
          // update per frame would re-render the whole component 60x/sec for
          // no visible benefit.
          starRef.current.hidden = st.invincibleMs <= 0;
          starRef.current.textContent = `★ ${(st.invincibleMs / 1000).toFixed(1)}s`;
        }
        if (st.over) {
          runningRef.current = false;
          const d = metres(st);
          const c = st.coinsTaken;
          setResult({ dist: d, coins: c });
          setPhase("over");
          commitBest(d, c);
          if (userId != null && (c > 0 || d > 0)) {
            api
              .submitDash(userId, c, d)
              .then(loadBoard)
              .catch(() => {
                /* offline / not migrated -- local best still stands */
              });
          }
        }
      }
      draw();
      rafRef.current = requestAnimationFrame(frame);
    },
    [draw, commitBest, userId, loadBoard]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Mirrors the media query in styles.css that rotates .runner-rotate-wrap
    // -- see the CSS comment there for why the CSS-transform fallback exists.
    const rotatedFallback = window.matchMedia("(max-width: 820px) and (orientation: portrait)");
    const resize = () => {
      // getBoundingClientRect() reports an element's post-transform, axis-
      // aligned bounding box -- a CSS transform is purely paint-time and never
      // touches layout, so a 90deg-rotated landscape box (844x390) reports
      // back as 390x844, the very shape being rotated AWAY from. Trusting it
      // here would size the canvas's drawing buffer portrait-shaped and let
      // the CSS transform merely stretch that image across a landscape-shaped
      // area on screen -- visually rotated, but the game world itself would
      // still be laid out squeezed into a tall, narrow strip; the exact
      // problem this whole rotation exists to solve. When the fallback is
      // active, use the real viewport dimensions (swapped, matching the CSS's
      // own 100vh/100vw swap) instead of asking the rotated element about
      // itself.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = rotatedFallback.matches
        ? { width: window.innerHeight, height: window.innerWidth }
        : canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    rotatedFallback.addEventListener("change", resize);
    return () => {
      window.removeEventListener("resize", resize);
      rotatedFallback.removeEventListener("change", resize);
    };
  }, [draw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [frame]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) lastTsRef.current = null;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const start = useCallback(() => {
    stateRef.current = createRunner(`${key}:${Date.now()}`);
    lastTsRef.current = null;
    bgShift.current = 0;
    runningRef.current = true;
    setPhase("running");
  }, [key]);

  const onJumpInput = useCallback(() => {
    if (phase === "ready" || phase === "over") {
      start();
      jumpRef.current = 1;
      return;
    }
    // Sound on every press while playing, whether or not it results in a hop.
    if (!stateRef.current.over) playJump();
    jumpRef.current = Math.min(2, jumpRef.current + 1);
  }, [phase, start]);

  useEffect(() => {
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // A focused card button (EXIT, PLAY AGAIN, START) activates on Space/
      // Enter via the browser's own default behaviour -- without this guard
      // the game-input binding below intercepts that same Space keydown
      // first, calls preventDefault, and restarts the run out from under the
      // button before its native click ever fires. Mirrors Adventure.tsx's
      // identical guard for the same reason.
      if (e.target instanceof HTMLButtonElement && (e.key === " " || e.key === "Spacebar" || e.key === "Enter")) return;
      if (e.key === "ArrowUp" || e.key === " " || e.key === "Spacebar" || e.key === "w") {
        e.preventDefault();
        if (!e.repeat) onJumpInput();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onJumpInput]);

  return (
    <div
      ref={rootRef}
      className="panda-runner"
      role="dialog"
      aria-modal="true"
      aria-label="Forest Dash minigame"
      tabIndex={-1}
    >
      {/* Stays upright even while runner-rotate-wrap below is rotated -- see
          the CSS for why: it lives outside the rotated box on purpose, and
          the media query that shows it is the same one that triggers the
          rotation, so it only ever appears while the fallback is active. */}
      <p className="runner-rotate-hint pixel-font" aria-hidden="true">
        ↻ turn your phone sideways
      </p>

      <div className="runner-rotate-wrap">
        <div className="runner-hud pixel-font">
          <span>
            DIST <span ref={distRef}>0</span>m
          </span>
          <span>
            🪙 <span ref={coinRef}>0</span>
          </span>
          <span ref={starRef} className="runner-hud-star" hidden>
            ★ 0.0s
          </span>
          <span className="runner-hud-best">
            BEST {best.dist}m · {best.coins}🪙
          </span>
          {/* One exit per screen: this bails out of a ready/running game;
              on game-over it's hidden and the card carries the only EXIT. */}
          {phase !== "over" && (
            <button type="button" className="runner-exit pixel-font" onClick={onClose}>
              ‹ EXIT
            </button>
          )}
        </div>

        <div
          className="runner-stage"
          onPointerDown={(e) => {
            e.preventDefault();
            onJumpInput();
          }}
        >
          <canvas ref={canvasRef} className="runner-canvas" />

          {phase === "ready" && (
            <div
              className="runner-card"
              // The stage swallows every pointerdown as "hop" -- stop it here
              // so the card's own buttons (START, PLAY AGAIN, EXIT) actually
              // get their click instead of the game restarting under them.
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="pixel-font runner-card-title">FOREST DASH</p>
              <p>
                Floating ledges, no ground. <kbd>↑</kbd> / <kbd>Space</kbd> / tap to hop every gap —
                and the plants and mines on the ledges. <b>Double-tap</b> for a big jump. Grab coins.
                Miss once and you start over.
              </p>
              <p className="runner-card-note">Optional bonus — nothing here affects your challenge.</p>
              <button type="button" className="pixel-font runner-btn" onClick={onJumpInput} autoFocus>
                START
              </button>
            </div>
          )}

          {phase === "over" && (
            <div className="runner-card" role="alert" onPointerDown={(e) => e.stopPropagation()}>
              <p className="pixel-font runner-card-title">
                {result.dist < 3 ? "OOPS" : "DOWN YOU GO"}
              </p>
              <p aria-live="assertive">
                {result.dist}m · {result.coins} coins
                <br />
                <span className="runner-card-note">
                  best {Math.max(best.dist, result.dist)}m · {Math.max(best.coins, result.coins)} coins
                </span>
              </p>
              <div className="runner-card-actions">
                <button type="button" className="pixel-font runner-btn" onClick={onJumpInput} autoFocus>
                  PLAY AGAIN
                </button>
                <button type="button" className="pixel-font runner-btn ghost" onClick={onClose}>
                  EXIT
                </button>
              </div>

              {board.length > 0 && (
                <div className="runner-board">
                  <p className="pixel-font runner-board-title">GLOBAL — MOST COINS</p>
                  <DashLeaderboard rows={board} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
