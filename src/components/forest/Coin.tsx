import { useEffect, useRef, useState } from "react";
import coinSrc from "../../../frontend/assets/coin.png";

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
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

// In-world coin size -- doubled from the original 26px default so coins
// actually read at a glance on the platform path, not just as small dots.
const WORLD_COIN_SIZE = 52;

// How many sparkle points burst outward on collection, and how long that
// burst stays on screen -- kept a little longer than .coin.hidden's own
// 0.3s fade/shrink transition so the sparkles read as a distinct "collect"
// flourish rather than disappearing together with the coin.
const SPARKLE_COUNT = 6;
const SPARKLE_MS = 650;

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
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (!visible && wasVisible.current) {
      setCollecting(true);
      const t = window.setTimeout(() => setCollecting(false), SPARKLE_MS);
      wasVisible.current = visible;
      return () => window.clearTimeout(t);
    }
    wasVisible.current = visible;
  }, [visible]);

  return (
    <div
      className={`coin${visible ? "" : " hidden"}${multiplier ? " coin-bonus" : ""}`}
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
    </div>
  );
}
