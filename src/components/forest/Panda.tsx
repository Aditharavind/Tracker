import { useEffect, useRef } from "react";
import { useModelViewer } from "../../modelViewer";

export type PandaAnim = "idle" | "running" | "jumping" | "landing" | "celebrating" | "falling";

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
const USE_3D_PANDA = false;

// Truly at rest -- landing/falling are brief transitional beats (a squash on
// touchdown, a stumble on reset), not places the panda should sit and idle-
// loop, so only "idle" itself freezes the model.
const RESTING: PandaAnim[] = ["idle"];

function Panda3D({ anim }: { anim: PandaAnim }) {
  const active = anim === "running" || anim === "jumping" || anim === "celebrating";
  const ref = useRef<HTMLElement & { pause?: () => void; play?: () => void }>(null);
  // Without this the tag is an unregistered custom element and the panda is
  // simply absent -- no error, just an empty box on the platform.
  const ready = useModelViewer();

  // model-viewer's own GLB clip (the "Idle" breathing bob) keeps looping
  // forever via `autoplay` even while the panda is meant to be standing
  // still on a platform -- that continuous micro-motion, stacked on top of
  // the CSS landing/hop transforms, is what read as flickering/instability
  // once landed. Freeze the model outright once it's genuinely at rest;
  // resume it for every state that's actually mid-motion.
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    if (RESTING.includes(anim)) el.pause?.();
    else el.play?.();
  }, [anim, ready]);

  if (!ready) return <PandaFlat />;

  return (
    <model-viewer
      ref={ref}
      src="/avatars/panda.glb"
      alt="Reference panda character"
      animation-name={active ? "Hop" : "Idle"}
      autoplay
      camera-orbit="0deg 90deg 105%"
      camera-controls={false}
      disable-zoom
      interaction-prompt="none"
      class="panda-model"
    />
  );
}

/**
 * This is the same panda as panda.glb, not a redraw of it -- the model was
 * rendered through model-viewer at the component's own camera-orbit, trimmed
 * to its bounding box and saved at 3x the largest size the CSS ever draws it
 * (72px, so 216px covers a DPR-3 phone). The GLB turned out to be flat
 * pixel-art on a billboard rather than a genuinely 3D model, which is why a
 * still is indistinguishable from it at this size -- for 10 KB instead of the
 * 1.75 MB that model-viewer plus the .glb cost to show it.
 *
 * Regenerate with scripts/capture-panda.mjs if the model ever changes.
 */
const PandaFlat = () => (
  <img className="panda-model panda-flat" src="/assets/panda-sprite.webp" alt="" aria-hidden="true" />
);

export default function Panda({ anim }: { anim: PandaAnim }) {
  return (
    <div className={`panda panda-${anim}`} role="img" aria-label="Your panda">
      {USE_3D_PANDA ? <Panda3D anim={anim} /> : <PandaFlat />}
    </div>
  );
}
