import { useEffect, useRef, useState } from "react";
import { useModelViewer } from "../../modelViewer";
import { CHARACTER_MODEL, CHARACTER_SPRITE, type CharacterAnim, type CharacterId } from "../../game/characters";

/**
 * The billboard .glb for a forest character (panda / koala / red panda),
 * played through <model-viewer>. The flat sprite is the model's
 * LOADING-STATE placeholder, not a second permanent layer -- exactly one
 * character is ever visible. It's hidden the instant the model reports a
 * loaded frame; a slow/failed viewer (no WebGL, chunk still loading) just
 * leaves the sprite showing rather than an empty box, and the two never
 * overlap. Only used behind a tap / gate, never on first load (~1MB runtime).
 */
export default function CharacterModel({
  character,
  anim = "Idle",
  autoRotate = false,
  orbit = "0deg 88deg 105%",
  className,
}: {
  character: CharacterId;
  anim?: CharacterAnim;
  autoRotate?: boolean;
  orbit?: string;
  className?: string;
}) {
  const ready = useModelViewer();
  const ref = useRef<HTMLElement>(null);

  // Hide the sprite the instant the model has actually painted a frame, so
  // the 3D model doesn't sit on top of a still-visible flat sprite and read
  // as two overlapping characters. Checking el.loaded directly (not just the
  // one-shot "load" event) catches an already-cached model that finishes
  // before this effect attaches its listener.
  const [modelLoaded, setModelLoaded] = useState(false);
  useEffect(() => {
    setModelLoaded(false);
    const el = ref.current as (HTMLElement & { loaded?: boolean }) | null;
    if (!el) return;
    if (el.loaded) {
      setModelLoaded(true);
      return;
    }
    const onLoad = () => setModelLoaded(true);
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [character, ready]);

  return (
    <div className={`charmodel${className ? ` ${className}` : ""}`}>
      <img
        className={`charmodel-sprite charmodel-sprite-${anim.toLowerCase()}`}
        src={CHARACTER_SPRITE[character]}
        alt=""
        aria-hidden="true"
        hidden={modelLoaded}
      />
      {ready && (
        <model-viewer
          ref={ref}
          key={character}
          src={CHARACTER_MODEL[character]}
          alt={`${character} character`}
          animation-name={anim}
          autoplay
          camera-orbit={orbit}
          auto-rotate={autoRotate ? true : undefined}
          auto-rotate-delay={autoRotate ? 0 : undefined}
          rotation-per-second={autoRotate ? "24deg" : undefined}
          camera-controls={false}
          disable-zoom
          interaction-prompt="none"
          class="charmodel-viewer"
        />
      )}
    </div>
  );
}
