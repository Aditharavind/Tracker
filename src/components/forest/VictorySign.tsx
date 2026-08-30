/**
 * The end-of-run marker. Deliberately the *same* carved signpost art as the
 * START sign (public/assets/start-sign.webp) -- the two ends of the run read
 * as one set piece -- but a wooden "VICTORY" plaque is planted over the sign's
 * face so the baked-in "START" no longer shows. Same pixel font as the rest of
 * the game HUD.
 */
export default function VictorySign({ left, bottom }: { left: number; bottom: number }) {
  return (
    <div className="victory-sign" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      <img className="victory-sign-sprite" src="/assets/start-sign.webp" alt="" />
      <span className="victory-sign-plaque pixel-font">VICTORY</span>
    </div>
  );
}
