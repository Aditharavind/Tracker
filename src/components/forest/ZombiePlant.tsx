/**
 * The guardian plant at the start of the level (skill §11) -- one only, never
 * scattered. Art is cropped straight from the reference environment. It bobs,
 * and a pixel speech bubble taunts the player on a loop.
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
  return (
    <div className="zombie-plant" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      {!bare && (
        <div className="plant-bubble">
          <span className="plant-bubble-text pixel-font">DON'T START — I'LL EAT U</span>
        </div>
      )}
      <img
        className="plant-sprite"
        src="/assets/zombie-plant.webp"
        alt=""
        style={hue ? { filter: `hue-rotate(${hue}deg) saturate(1.3)` } : undefined}
      />
    </div>
  );
}
