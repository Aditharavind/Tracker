/**
 * The guardian plant at the start of the level (skill §11) -- one only, never
 * scattered in the main path. Art is scripts/pack-zombie-plant-jaw.py's split
 * of frontend/assets/zombie_plant.png (one painted frame, mouth open) into
 * two layers sharing one canvas: `plant-frame` is the head with the lower
 * jaw cut to transparent, `plant-mouth-shutter` is that lower jaw on its
 * own. Both are real cropped pixels, not a synthesized closed-mouth frame.
 * The jaw layer rotates around the mouth's back-left corner (a real hinge,
 * set as its CSS transform-origin) -- one end anchored at the pivot, the
 * other swinging -14deg to bring the teeth into contact and back down to
 * open, 200ms each way with a 300ms closed hold and a 200ms open gap before
 * repeating -- a rapid, repeated bite rather than one occasional chomp (see
 * @keyframes plant-mouth-close in styles.css). Earlier attempts: a
 * flat-colour shutter (a plain oval dropped over the mouth) read as a stray
 * green circle, not a jaw; a version using the un-split
 * zombie-plant-open.webp as the base left a duplicate jaw always visible
 * underneath once the real one rotated away. Because the source mouth is
 * one flat-painted shape rather than two separate anatomical pieces, the
 * rotation still leaves a hairline seam at the far (non-hinge) end when
 * closed -- the packer fills the mouth's own enclosed cavity (found by
 * flood-filling in from the canvas border) with the same dark throat colour
 * already in the art, so a peeking sliver blends in rather than showing as
 * a gap. A pixel speech bubble taunts the player on a loop.
 *
 * The same head/jaw art and hinge animation is reused outside this
 * component too, via src/game/plantJaw.ts's canvas drawPlant() -- the
 * "plant" hazards in PandaRunner.tsx's Forest Dash minigame and the
 * "rootling" enemies in game/adventure/render.ts draw with it directly
 * (those aren't <ZombiePlant>, since they're canvas-rendered scenes, not
 * DOM) so the chomping animation is consistent everywhere the character
 * appears, not just here. `bare` (drop the taunt bubble) and `hue`
 * (recolour via CSS filter) exist for any future DOM reuse of this
 * component specifically.
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
