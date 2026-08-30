import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CharacterId } from "../../game/characters";
import Panda from "./Panda";
import ZombiePlant from "./ZombiePlant";
import Clouds from "./Clouds";
import { createRunner, metres, PANDA_W, PANDA_X, step, type RunnerState } from "../../game/runnerEngine";

// world-y -> % of stage height. There is no ground; ledges float in a band.
const Y_BASE = 6;
const Y_SCALE = 1.5;
const bottomPct = (worldY: number) => Y_BASE + worldY * Y_SCALE;

/**
 * The forest backdrop, rendered once and never re-rendered while the game
 * loop runs -- the parallax layers don't move per frame, so keeping them out
 * of the render path is what stops the minigame juddering.
 */
const DashBackdrop = memo(function DashBackdrop({ seed }: { seed: string }) {
  return (
    <>
      <div className="forest-photo" />
      <div className="forest-sky" />
      <div className="forest-mountains" />
      <Clouds seed={seed} />
      <div className="forest-trees-far" />
      <div className="forest-trees-mid" />
      <div className="forest-texture" />
      <div className="forest-fireflies" />
      <div className="forest-fg" />
    </>
  );
});

/**
 * Forest Dash -- optional endless platformer, unlocked once the day is cleared.
 * Reuses the forest environment and the rigged character. Floating ledges only,
 * no ground: every gap must be jumped or the panda falls out of the world.
 * Some ledges carry a recoloured zombie plant or a landmine to hop. One miss
 * restarts. Nothing here touches challenge state -- only a local best is kept.
 *
 * The loop runs imperatively (writing element styles in rAF); React only
 * re-renders when the set of on-screen entities changes or the phase flips.
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
  const pandaRef = useRef<HTMLDivElement | null>(null);
  const distRef = useRef<HTMLSpanElement | null>(null);
  const coinRef = useRef<HTMLSpanElement | null>(null);
  const elRefs = useRef<Map<number, HTMLElement>>(new Map());

  const stateRef = useRef<RunnerState>(createRunner(String(key)));
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const jumpRef = useRef(false);
  const runningRef = useRef(false);
  const memberSigRef = useRef("");

  const [phase, setPhase] = useState<"ready" | "running" | "over">("ready");
  const [scene, setScene] = useState(() => snapshot(stateRef.current));
  const [result, setResult] = useState({ dist: 0, coins: 0 });
  const [best, setBest] = useState({ dist: 0, coins: 0 });

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

  // paint element positions from current engine state -- pure DOM writes
  const paint = useCallback(() => {
    const st = stateRef.current;
    for (const p of st.platforms) {
      const el = elRefs.current.get(p.id);
      if (el) el.style.left = `${p.x}%`;
    }
    for (const h of st.hazards) {
      const el = elRefs.current.get(h.id);
      if (el) el.style.left = `${h.x}%`;
    }
    for (const c of st.coins) {
      const el = elRefs.current.get(c.id);
      if (el) el.style.left = `${c.x}%`;
    }
    const panda = pandaRef.current;
    if (panda) {
      panda.style.bottom = `${bottomPct(st.y)}%`;
      panda.dataset.air = st.grounded ? "" : "1";
    }
  }, []);

  const frame = useCallback(
    (ts: number) => {
      const st = stateRef.current;
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      if (runningRef.current && !st.over) {
        const jumped = jumpRef.current;
        jumpRef.current = false;
        step(st, dt, jumped);

        // re-render only when the on-screen entity set changes
        const sig = `${st.platforms.length}:${st.platforms[0]?.id ?? 0}|${st.hazards.length}:${
          st.hazards[0]?.id ?? 0
        }|${st.coins.length}:${st.coins[0]?.id ?? 0}`;
        if (sig !== memberSigRef.current) {
          memberSigRef.current = sig;
          setScene(snapshot(st));
        }

        if (distRef.current) distRef.current.textContent = `${metres(st)}`;
        if (coinRef.current) coinRef.current.textContent = `${st.coinsTaken}`;

        if (st.over) {
          runningRef.current = false;
          setResult({ dist: metres(st), coins: st.coinsTaken });
          setPhase("over");
          commitBest(metres(st), st.coinsTaken);
        }
      }

      paint();
      rafRef.current = requestAnimationFrame(frame);
    },
    [paint, commitBest]
  );

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
    memberSigRef.current = "";
    lastTsRef.current = null;
    runningRef.current = true;
    setScene(snapshot(stateRef.current));
    setPhase("running");
  }, [key]);

  const onJumpInput = useCallback(() => {
    if (phase === "ready" || phase === "over") {
      start();
      jumpRef.current = true;
      return;
    }
    jumpRef.current = true;
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
        onJumpInput();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onJumpInput]);

  const seed = useMemo(() => `dash:${key}`, [key]);
  const setRef = (id: number) => (el: HTMLElement | null) => {
    if (el) elRefs.current.set(id, el);
    else elRefs.current.delete(id);
  };

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
        <div className="forest-scene" data-stage={1} data-dash aria-hidden="true">
          <DashBackdrop seed={seed} />

          <div className="forest-path">
            {scene.platforms.map((p) => (
              <div
                key={p.id}
                ref={setRef(p.id)}
                className="runner-platform"
                style={{ left: `${p.x}%`, width: `${p.w}%`, bottom: `${bottomPct(p.y)}%` }}
              >
                <div className="runner-platform-moss" />
                <div className="runner-platform-stone" />
              </div>
            ))}

            {scene.coins.map((c) => (
              <div
                key={c.id}
                ref={setRef(c.id)}
                className="coin runner-coin"
                style={{ left: `${c.x}%`, bottom: `${bottomPct(c.y)}%` }}
              >
                <span className="runner-coin-dot" />
              </div>
            ))}

            {scene.hazards.map((h) => (
              <div
                key={h.id}
                ref={setRef(h.id)}
                className={`runner-hazard runner-hazard-${h.kind}`}
                style={{ left: `${h.x}%`, bottom: `${bottomPct(h.y)}%` }}
              >
                {h.kind === "plant" ? (
                  <ZombiePlant left={0} bottom={0} bare hue={h.hue} />
                ) : (
                  <span className="runner-mine-body" />
                )}
              </div>
            ))}

            <div ref={pandaRef} className="panda-anchor runner-panda" style={{ left: `${PANDA_X + PANDA_W / 2}%`, bottom: `${bottomPct(stateRef.current.y)}%` }}>
              <Panda anim={phase === "running" ? "running" : "idle"} character={character} />
            </div>
          </div>
        </div>

        {phase === "ready" && (
          <div className="runner-card">
            <p className="pixel-font runner-card-title">FOREST DASH</p>
            <p>
              Floating ledges, no ground. Press <kbd>↑</kbd> / <kbd>Space</kbd> or tap to hop every gap
              — and the plants and mines on the ledges. Miss one and you start over.
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
              {result.dist === 0 ? "OOPS" : "DOWN YOU GO"}
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
          </div>
        )}
      </div>
    </div>
  );
}

function snapshot(st: RunnerState) {
  return {
    platforms: st.platforms.map((p) => ({ id: p.id, w: p.w, y: p.y, x: p.x })),
    hazards: st.hazards.map((h) => ({ id: h.id, kind: h.kind, hue: h.hue, y: h.y, x: h.x })),
    coins: st.coins.map((c) => ({ id: c.id, y: c.y, x: c.x })),
  };
}
