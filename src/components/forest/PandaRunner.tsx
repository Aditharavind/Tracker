import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { CHARACTER_SPRITE, type CharacterId } from "../../game/characters";
import { createRunner, metres, PANDA_W, PANDA_X, step, type RunnerState } from "../../game/runnerEngine";

// world-y -> fraction of stage height for the "floor line" at that height.
const Y_BASE = 0.1;
const Y_SCALE = 0.017;

/** The golden panda-imprint coin from Coin.tsx, drawn on canvas. */
function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f0c04a";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = "#8a5a17";
  ctx.stroke();
  ctx.fillStyle = "#8a5a17";
  ctx.beginPath();
  ctx.arc(cx - r * 0.36, cy - r * 0.18, r * 0.2, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.36, cy - r * 0.18, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c9";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, r * 0.46, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5a17";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.18, cy + r * 0.02, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.18, cy + r * 0.02, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.34, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
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
  onClose,
}: {
  character: CharacterId;
  userId: number | null;
  onClose: () => void;
}) {
  const key = userId ?? "guest";
  const bestDistKey = `75hard.dash.best:${key}`;
  const bestCoinKey = `75hard.dash.coins:${key}`;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const distRef = useRef<HTMLSpanElement | null>(null);
  const coinRef = useRef<HTMLSpanElement | null>(null);

  const stateRef = useRef<RunnerState>(createRunner(String(key)));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const jumpRef = useRef(0); // press edges queued since the last frame
  const runningRef = useRef(false);
  const imgs = useRef<{ bg?: HTMLImageElement; panda?: HTMLImageElement; plant?: HTMLImageElement; mine?: HTMLImageElement }>({});
  const bgShift = useRef(0);

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
    imgs.current.plant = load("/assets/zombie-plant.webp");
    imgs.current.mine = load("/assets/landmine.webp");
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
      ctx.globalAlpha = 0.5;
      let x = -((bgShift.current * 0.25) % bw);
      for (; x < W; x += bw) ctx.drawImage(bg, x, 0, bw, H);
      ctx.globalAlpha = 1;
    }

    // --- ledges ---
    for (const p of st.platforms) {
      const x = p.x * sx;
      const w = p.w * sx;
      const top = yPx(p.y);
      const h = Math.max(16, H * 0.05);
      ctx.fillStyle = "#4a3b2c";
      ctx.fillRect(x, top + h * 0.34, w, h * 0.66);
      ctx.fillStyle = "#6cbb54";
      ctx.fillRect(x, top, w, h * 0.4);
      ctx.fillStyle = "rgba(120,190,110,0.5)";
      ctx.fillRect(x, top, w, 3);
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.fillRect(x, top + h, w, H * 0.016);
    }

    // --- coins: the panda-imprint gold coin, matching Coin.tsx ---
    const coinR = Math.max(6, H * 0.017);
    for (const c of st.coins) {
      if (c.taken) continue;
      drawCoin(ctx, c.x * sx, yPx(c.y), coinR);
    }

    // --- hazards: sized to about the character, sitting flush on the ledge ---
    const charH = H * 0.13;
    for (const h of st.hazards) {
      const hx = h.x * sx;
      const baseY = yPx(h.y) + 1; // a hair into the moss so it reads as planted
      if (h.kind === "plant") {
        const im = imgs.current.plant;
        const hh = charH * 1.05;
        const hw = im?.naturalWidth ? hh * (im.naturalWidth / im.naturalHeight) : hh * 0.85;
        if (im && im.complete && im.naturalWidth) {
          ctx.filter = h.hue ? `hue-rotate(${h.hue}deg) saturate(1.4)` : "none";
          ctx.drawImage(im, hx - hw / 2, baseY - hh, hw, hh);
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
    // "alive" tell: a gentle idle bob while grounded, plus a quick blink-squash
    // roughly every 2.6s so the character never looks frozen.
    const tSec = st.t / 1000;
    const bob = st.grounded ? Math.sin(tSec * 5.5) * (H * 0.004) : 0;
    const bp = (tSec % 2.6) / 2.6;
    const squash = st.grounded ? (bp < 0.05 ? 0.8 : bp < 0.1 ? 0.92 : 1) : 1;
    const ph = charH * squash;
    const pw = (charH * 0.92) / Math.sqrt(squash);
    const px = (PANDA_X + PANDA_W / 2) * sx - pw / 2;
    // the sprite carries transparent padding below the feet -- drop it so the
    // character stands ON the ledge with only a hair of daylight under it.
    const feet = yPx(st.y) + bob + ph * 0.08;
    const py = feet - ph;
    ctx.save();
    if (!st.grounded) {
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate(st.vy > 0 ? -0.16 : 0.12);
      ctx.translate(-(px + pw / 2), -(py + ph / 2));
    }
    if (pImg && pImg.complete && pImg.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pImg, px, py, pw, ph);
    } else {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(px, py, pw, ph);
    }
    ctx.restore();
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse((PANDA_X + PANDA_W / 2) * sx, yPx(st.y), pw * 0.45, H * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const frame = useCallback(
    (ts: number) => {
      const st = stateRef.current;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      if (runningRef.current && !st.over) {
        const jumped = jumpRef.current;
        jumpRef.current = 0;
        step(st, dt, jumped);
        bgShift.current += (st.speed * dt) / 1000;
        if (distRef.current) distRef.current.textContent = `${metres(st)}`;
        if (coinRef.current) coinRef.current.textContent = `${st.coinsTaken}`;
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
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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
    jumpRef.current = Math.min(2, jumpRef.current + 1);
  }, [phase, start]);

  useEffect(() => {
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
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
      <div className="runner-hud pixel-font">
        <span>
          DIST <span ref={distRef}>0</span>m
        </span>
        <span>
          🪙 <span ref={coinRef}>0</span>
        </span>
        <span className="runner-hud-best">
          BEST {best.dist}m · {best.coins}🪙
        </span>
        <button type="button" className="runner-exit pixel-font" onClick={onClose}>
          ‹ EXIT
        </button>
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
          <div className="runner-card">
            <p className="pixel-font runner-card-title">FOREST DASH</p>
            <p>
              Floating ledges, no ground. <kbd>↑</kbd> / <kbd>Space</kbd> / tap to hop every gap — and
              the plants and mines on the ledges. <b>Double-tap</b> for a big jump. Grab coins. Miss
              once and you start over.
            </p>
            <p className="runner-card-note">Optional bonus — nothing here affects your challenge.</p>
            <button type="button" className="pixel-font runner-btn" onClick={onJumpInput} autoFocus>
              START
            </button>
          </div>
        )}

        {phase === "over" && (
          <div className="runner-card" role="alert">
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
                <ol>
                  {board.slice(0, 8).map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      <span className="runner-board-rank">{i + 1}</span>
                      <i className="runner-board-dot" style={{ background: p.color }} />
                      <span className="runner-board-name">{p.name}</span>
                      <span className="runner-board-score">
                        {p.coins}🪙 · {p.distance}m
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
