import { useEffect, useRef, useState } from "react";

/** How long the arrival reaction (a quick startled squash) lasts, ms.
   Mirrors game/plantJaw.ts's NEAR_BITE_MS -- the equivalent moment for
   ZombiePlant's guardian, just a hop instead of a bite. */
export const NEAR_POUNCE_MS = 260;

/**
 * World 2 (Self-Doubt Caves)'s guardian at the start of the level (skill
 * §11) -- the crystal slime standing in for ZombiePlant on this world's
 * copy of the scene, one only, never scattered in the main path. Same art
 * as the "slime" hazard in Forest Dash (PandaRunner.tsx) and
 * scripts/pack-crystal-slime.py, a single painted pose -- unlike the plant
 * there is no separate jaw layer to animate, so "alive" comes from CSS: an
 * idle squash-stretch breathe, plus a brief startled squash the moment the
 * panda arrives (see `near`) rather than a bite.
 *
 * `near`: true while the panda is resting at the day's start point (right
 * next to this guardian, before the first task of the day is done --
 * ForestScene's `atStartRest`). Same rising-edge-only trigger as
 * ZombiePlant: the idle breathe loop never stops, proximity only adds one
 * reaction the moment `near` flips from false to true.
 */
export default function GuardianSlime({
  left,
  bottom,
  bare,
  near,
}: {
  left: number;
  bottom: number;
  bare?: boolean;
  near?: boolean;
}) {
  const [pounceNow, setPounceNow] = useState(false);
  const wasNear = useRef(false);

  useEffect(() => {
    if (near && !wasNear.current) {
      wasNear.current = true;
      setPounceNow(true);
      const t = window.setTimeout(() => setPounceNow(false), NEAR_POUNCE_MS);
      // See ZombiePlant.tsx for why the ref reset also happens in cleanup,
      // not just the timeout -- React 18 StrictMode's dev-only replay.
      return () => {
        window.clearTimeout(t);
        wasNear.current = false;
      };
    }
    wasNear.current = !!near;
  }, [near]);

  return (
    <div
      className={`guardian-slime${pounceNow ? " guardian-slime-pounce-now" : ""}`}
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      aria-hidden="true"
    >
      {!bare && (
        <div className="plant-bubble slime-bubble">
          <span className="plant-bubble-text pixel-font">DON'T START — I'LL DOUBT U</span>
        </div>
      )}
      <img className="slime-sprite" src="/assets/world-2/crystal-slime.webp" alt="" />
    </div>
  );
}
