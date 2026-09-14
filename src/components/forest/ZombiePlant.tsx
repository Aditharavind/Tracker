/**
 * The guardian plant at the start of the level (skill §11) -- one only, never
 * scattered. Art is scripts/pack-zombie-plant-jaw.py's split of
 * frontend/assets/zombie_plant.png (one painted frame, mouth open) into two
 * layers sharing one canvas: `plant-frame` is the head with the lower jaw
 * cut to transparent, `plant-mouth-shutter` is that lower jaw on its own.
 * Both are real cropped pixels, not a synthesized closed-mouth frame. The
 * jaw layer rotates around the mouth's back-left corner (a real hinge, set
 * as its CSS transform-origin) -- one end anchored at the pivot, the other
 * swinging up to close the gap and back down to open it. Earlier attempts:
 * a flat-colour shutter (a plain oval dropped over the mouth) read as a
 * stray green circle, not a jaw; a version using the un-split
 * zombie-plant-open.webp as the base left a duplicate jaw always visible
 * underneath once the real one rotated away. Because the source mouth is
 * one flat-painted shape rather than two separate anatomical pieces, the
 * rotation still leaves a hairline seam at the far (non-hinge) end when
 * closed -- outlined in the sprite's own near-black dye in the packer so it
 * reads as a gum-line crease rather than a rendering gap. A pixel speech
 * bubble taunts the player on a loop.
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
        <img className="plant-frame" src="/assets/zombie-plant-head.webp" alt="" style={tint} />
        <img className="plant-mouth-shutter" src="/assets/zombie-plant-jaw.webp" alt="" style={tint} />
      </div>
    </div>
  );
}
