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
 * Inline so it costs no request at all, and so the legs are real nodes: the
 * .panda-leg-l / .panda-leg-r swing in styles.css is written against exactly
 * these two classes, which is what gives the run its stride on top of the
 * whole-body bob.
 *
 * (public/panda-runner.svg is not this -- that file is a standalone animated
 * scene with its own platforms, meant to be opened directly in a browser.)
 */
const PandaFlat = () => (
  <svg className="panda-model panda-flat" viewBox="0 0 40 44" aria-hidden="true">
    {/* legs first, so the body overlaps the hips */}
    <ellipse className="panda-leg-l" cx="16" cy="36" rx="3.4" ry="5" fill="#2b2b33" />
    <ellipse className="panda-leg-r" cx="24" cy="36" rx="3.4" ry="5" fill="#2b2b33" />

    {/* arms */}
    <ellipse cx="10.5" cy="28" rx="3" ry="4.4" fill="#2b2b33" transform="rotate(-18 10.5 28)" />
    <ellipse cx="29.5" cy="28" rx="3" ry="4.4" fill="#2b2b33" transform="rotate(18 29.5 28)" />

    {/* body */}
    <ellipse cx="20" cy="29" rx="8.6" ry="8" fill="#fff" stroke="#d3d3dc" strokeWidth="0.7" />

    {/* ears behind the head so they read as ears, not lumps */}
    <circle cx="12.5" cy="7.5" r="4.6" fill="#2b2b33" />
    <circle cx="27.5" cy="7.5" r="4.6" fill="#2b2b33" />
    <circle cx="12.5" cy="7.2" r="2" fill="#4a4a55" />
    <circle cx="27.5" cy="7.2" r="2" fill="#4a4a55" />

    {/* head */}
    <circle cx="20" cy="15" r="11" fill="#fff" stroke="#d3d3dc" strokeWidth="0.7" />

    {/* eye patches */}
    <ellipse cx="15.4" cy="14.2" rx="3.7" ry="4.4" fill="#2b2b33" transform="rotate(-14 15.4 14.2)" />
    <ellipse cx="24.6" cy="14.2" rx="3.7" ry="4.4" fill="#2b2b33" transform="rotate(14 24.6 14.2)" />
    <circle cx="15.8" cy="14.2" r="1.7" fill="#fff" />
    <circle cx="24.2" cy="14.2" r="1.7" fill="#fff" />
    <circle cx="16.3" cy="13.7" r="0.7" fill="#2b2b33" />
    <circle cx="24.7" cy="13.7" r="0.7" fill="#2b2b33" />

    {/* nose + mouth */}
    <ellipse cx="20" cy="19.4" rx="1.7" ry="1.3" fill="#2b2b33" />
    <path
      d="M20 20.9q-1.7 1.9-3.2 0.6M20 20.9q1.7 1.9 3.2 0.6"
      stroke="#2b2b33"
      strokeWidth="0.85"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

export default function Panda({ anim }: { anim: PandaAnim }) {
  return (
    <div className={`panda panda-${anim}`} role="img" aria-label="Your panda">
      {USE_3D_PANDA ? <Panda3D anim={anim} /> : <PandaFlat />}
    </div>
  );
}
