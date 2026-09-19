import { useLayoutEffect, useRef, useState } from "react";
import coinSrc from "../../../frontend/assets/coin.webp";
import { playCoinCollect } from "../../sound";

// Coin state is a pure readout of task.done -- it never toggles the task.
// See CLAUDE.md section 8: "coin count is never the source of truth."
// The same bitmap coin used by every game surface.
export function CoinIcon({ size = 26 }: { size?: number }) {
  return (
    <img
      className="coin-icon"
      src={coinSrc}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

// Keep collectibles compact so the character and platform path stay visible.
const WORLD_COIN_SIZE = 30;

// How many sparkle points burst outward on collection, and how long that
// burst stays on screen -- kept a little longer than .coin.hidden's own
// 0.3s fade/shrink transition so the sparkles read as a distinct "collect"
// flourish rather than disappearing together with the coin.
const SPARKLE_COUNT = 6;
const SPARKLE_MS = 650;
const FLY_MS = 720;
// The "+1"/"+N" value readout that pops up and rises away on collection --
// held a touch longer than the sparkle burst so it reads clearly before fading.
const VALUE_POP_MS = 800;

type CoinFlight = {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
};

export default function Coin({
  left,
  bottom,
  visible,
  multiplier,
}: {
  left: number;
  bottom: number;
  visible: boolean;
  // A bonus coin -- the "+5" stashed near the end of the level. Collecting it
  // (i.e. clearing the whole day) adds 5 to the coin total, not 1.
  multiplier?: number;
}) {
  // Rising-edge trigger: a coin only ever goes visible -> hidden once (task
  // completion isn't reversible from here), but this still guards against
  // firing again on an unrelated re-render where `visible` was already
  // false, same pattern as ZombiePlant's bite reaction.
  const [collecting, setCollecting] = useState(false);
  const [valuePop, setValuePop] = useState(false);
  const [flight, setFlight] = useState<CoinFlight | null>(null);
  const coinRef = useRef<HTMLDivElement | null>(null);
  const wasVisible = useRef(visible);

  useLayoutEffect(() => {
    if (!visible && wasVisible.current) {
      const coinRect = coinRef.current?.getBoundingClientRect();
      const targetRect = document.querySelector("[data-coin-target]")?.getBoundingClientRect();
      let flightTimer: number | undefined;
      if (coinRect && targetRect) {
        const startX = coinRect.left + coinRect.width / 2;
        const startY = coinRect.top + coinRect.height / 2;
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;
        setFlight({ startX, startY, dx: targetX - startX, dy: targetY - startY });
        flightTimer = window.setTimeout(() => setFlight(null), FLY_MS);
      }
      playCoinCollect();
      setCollecting(true);
      setValuePop(true);
      const t = window.setTimeout(() => setCollecting(false), SPARKLE_MS);
      const vt = window.setTimeout(() => setValuePop(false), VALUE_POP_MS);
      wasVisible.current = visible;
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(vt);
        if (flightTimer !== undefined) window.clearTimeout(flightTimer);
      };
    }
    wasVisible.current = visible;
  }, [visible]);

  return (
    <>
      <div
        ref={coinRef}
        className={`coin${visible ? "" : collecting ? " collecting" : " hidden"}${multiplier ? " coin-bonus" : ""}`}
        style={{ left: `${left}%`, bottom: `${bottom}%` }}
        aria-hidden="true"
      >
        {multiplier ? <span className="coin-mult pixel-font">+{multiplier}</span> : null}
        <CoinIcon size={WORLD_COIN_SIZE} />
        {collecting && (
          <span className="coin-sparkle-burst">
            {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
              <span key={i} className="coin-sparkle" style={{ ["--i" as string]: i, ["--n" as string]: SPARKLE_COUNT }} />
            ))}
          </span>
        )}
        {valuePop && (
          <span className="coin-value-pop pixel-font" aria-hidden="true">
            +{multiplier ?? 1}
          </span>
        )}
      </div>
      {flight && (
        <span
          className="coin-fly"
          style={{
            left: `${flight.startX}px`,
            top: `${flight.startY}px`,
            ["--coin-fly-x" as string]: `${flight.dx}px`,
            ["--coin-fly-y" as string]: `${flight.dy}px`,
          }}
          aria-hidden="true"
        >
          <CoinIcon size={WORLD_COIN_SIZE} />
          {multiplier ? <span className="coin-fly-mult pixel-font">+{multiplier}</span> : null}
        </span>
      )}
    </>
  );
}
