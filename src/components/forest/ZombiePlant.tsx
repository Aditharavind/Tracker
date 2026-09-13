/**
 * The guardian plant at the start of the level (skill §11) -- one only, never
 * scattered. Art is built by scripts/pack-zombie-plant.py from
 * frontend/assets/zombie_plant.png into two aligned frames (open/closed
 * mouth) so the two can be cross-faded in CSS for a snapping-jaw animation,
 * on top of the existing idle bob. A pixel speech bubble taunts the player
 * on a loop.
 *
 * In the Forest Dash minigame it's reused as the obstacle: `bare` drops the
 * taunt bubble and `hue` recolours the sprite so each plant looks distinct.
 */
export default function ZombiePlant({
  left,
  bottom,
  bare,
  hue = 0,
}: {
  left: number;
  bottom: number;
  bare?: boolean;
  hue?: number;
}) {
  const tint = hue ? { filter: `hue-rotate(${hue}deg) saturate(1.3)` } : undefined;
  return (
    <div className="zombie-plant" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      {!bare && (
        <div className="plant-bubble">
          <span className="plant-bubble-text pixel-font">DON'T START — I'LL EAT U</span>
        </div>
      )}
      <div className="plant-sprite">
        <img className="plant-frame plant-frame-open" src="/assets/zombie-plant-open.webp" alt="" style={tint} />
        <img className="plant-frame plant-frame-closed" src="/assets/zombie-plant-closed.webp" alt="" style={tint} />
      </div>
    </div>
  );
}
