/**
 * The end-of-run marker: the same carved signpost sprite as the START sign
 * (public/assets/start-sign.webp), with an opaque wooden "VICTORY" plaque
 * bolted over its face so the painted-in "START" is hidden. Stands in front of
 * the bush at the very end of the run, in the game's own pixel font.
 */
export default function VictorySign({ left, bottom }: { left: number; bottom: number }) {
  return (
    <div className="victory-sign" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      <img className="victory-sign-sprite" src="/assets/start-sign.webp" alt="" />
      <span className="victory-sign-plaque pixel-font">VICTORY</span>
    </div>
  );
}
