import { useEffect, useRef } from "react";
import { useModelViewer } from "../../modelViewer";
import {
  CHARACTER_MODEL,
  CHARACTER_SPRITE,
  DEFAULT_CHARACTER,
  type CharacterId,
} from "../../game/characters";

export type PandaAnim =
  | "idle"
  | "running"
  | "jumping"
  | "landing"
  | "celebrating"
  | "falling"
  | "dancing";

/**
 * Draw the forest panda with the 3D model instead of the flat sprite.
 *
 * Off, because it is by far the most expensive thing in the app: the
 * <model-viewer> runtime (1,047 KB) plus panda.glb (706 KB) is 1.75 MB, against
 * a 366 KB critical path for everything else combined -- and it buys a subtly
 * animated model inside a box that is 46-72px wide. Every bit of motion you
 * actually see (run, jump, land, celebrate, fall) is CSS on the wrapper below
 * and is identical either way; the GLB only adds an in-model breathe/hop.
 *
 * Flip to true to get it back -- nothing else needs changing. The Profile
 * drawer's character preview still uses the 3D models regardless, which is
 * fine: that is behind a tap, so it never touches first load.
 */
const USE_3D_PANDA = true;


function Panda3D({
  anim,
  character,
}: {
  anim: PandaAnim;
  character: CharacterId;
}) {
  const ref = useRef<HTMLElement & { pause?: () => void; play?: () => void }>(
    null,
  );
  // Without this the tag is an unregistered custom element and the panda is
  // simply absent -- no error, just an empty box on the platform.
  const ready = useModelViewer();

  // Keep the model's Idle clip playing (barely-there breathing bob). Never
  // pause it -- a paused <model-viewer> blanks out the moment the layout
  // reflows under it.
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    el.play?.();
  }, [ready]);

  // The flat sprite is ALWAYS the base layer and carries every bit of MOTION
  // (run on the ground, jump between platforms) via CSS. The 3D model is
  // overlaid ONLY while the character is at rest -- a gently breathing Idle
  // on a platform. Keeping it out of the fast run/jump/land churn is what
  // stops it blanking out ("vanishing from the stairs"); and if it fails to
  // paint at all, the sprite underneath is simply still there.
  const atRest = anim === "idle";
  return (
    <div className="panda-model panda-3d">
      <PandaFlat character={character} />
      {ready && atRest && (
        <model-viewer
          ref={ref}
          src={CHARACTER_MODEL[character]}
          alt="Your character"
          animation-name="Idle"
          autoplay
          camera-orbit="0deg 90deg 105%"
          camera-controls={false}
          disable-zoom
          interaction-prompt="none"
          class="panda-3d-viewer"
        />
      )}
    </div>
  );
}

/**
 * Flat pixel-art sprite for whichever character is selected -- panda, koala
 * or red panda. All three are cropped from the same reference sheet onto a
 * matching canvas (see .claude/skills/platformer-interface/assets), so they
 * share scale/proportions and can drop into the same `.panda-model` box and
 * the same CSS-transform animation classes below without any per-character
 * tuning.
 *
 * Regenerate from the reference sheet if the source art ever changes.
 */
const PandaFlat = ({ character }: { character: CharacterId }) => (
  <img
    className={`panda-model panda-flat panda-flat-${character}`}
    src={CHARACTER_SPRITE[character]}
    alt=""
    aria-hidden="true"
  />
);

export default function Panda({
  anim,
  character = DEFAULT_CHARACTER,
}: {
  anim: PandaAnim;
  character?: CharacterId;
}) {
  return (
    <div
      className={`panda panda-${anim}`}
      role="img"
      aria-label="Your character"
    >
      {USE_3D_PANDA ? (
        <Panda3D anim={anim} character={character} />
      ) : (
        <PandaFlat character={character} />
      )}
    </div>
  );
}
