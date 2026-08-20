import { useEffect, useRef } from "react";
import { useModelViewer } from "../../modelViewer";

export type PandaAnim = "idle" | "running" | "jumping" | "landing" | "celebrating" | "falling";

// Truly at rest -- landing/falling are brief transitional beats (a squash on
// touchdown, a stumble on reset), not places the panda should sit and idle-
// loop, so only "idle" itself freezes the model.
const RESTING: PandaAnim[] = ["idle"];

export default function Panda({ anim }: { anim: PandaAnim }) {
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

  return (
    <div className={`panda panda-${anim}`} role="img" aria-label="Your panda">
      {!ready && <img className="panda-model panda-flat" src="/panda-runner.svg" alt="" aria-hidden="true" />}
      {ready && (
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
      )}
    </div>
  );
}
