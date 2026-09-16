import { useEffect, useRef, useState } from "react";

/** How long the arrival reaction (a quick startled squash) lasts, ms.
   Mirrors game/plantJaw.ts's NEAR_BITE_MS -- the equivalent moment for
   ZombiePlant's guardian, just a hop instead of a bite. */
export const NEAR_POUNCE_MS = 260;

/**
 * A world's own guardian at the start of the level (skill §11), standing in
 * for ZombiePlant on that world's copy of the scene -- one only, never
 * scattered in the main path. Same art as that world's Forest Dash hazard
 * (see the *_HUES-sized sibling in runnerEngine.ts and each world's pack
 * script), always a single painted pose -- unlike the plant there is no
 * separate jaw layer to animate, so "alive" comes from CSS: an idle
 * squash-stretch breathe (.creature-sprite), plus a brief startled squash
 * the moment the panda arrives (see `near`) rather than a bite. Which
 * creature, and its taunt, come from that world's entry in worldScenery.ts;
 * per-world sizing (a "boss"-scale creature reads bigger than a slime) is a
 * world-theme.css override on .creature-sprite, not a prop here.
 *
 * `near`: true while the panda is resting at the day's start point (right
 * next to this guardian, before the first task of the day is done --
 * ForestScene's `atStartRest`). Same rising-edge-only trigger as
 * ZombiePlant: the idle breathe loop never stops, proximity only adds one
 * reaction the moment `near` flips from false to true.
 */
export default function GuardianCreature({
  left,
  bottom,
  bare,
  near,
  sprite,
  taunt,
}: {
  left: number;
  bottom: number;
  bare?: boolean;
  near?: boolean;
  sprite: string;
  taunt: string;
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
      className={`guardian-creature${pounceNow ? " guardian-creature-pounce-now" : ""}`}
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      aria-hidden="true"
    >
      {!bare && (
        <div className="plant-bubble creature-bubble">
          <span className="plant-bubble-text pixel-font">{taunt}</span>
        </div>
      )}
      <img className="creature-sprite" src={sprite} alt="" />
    </div>
  );
}
