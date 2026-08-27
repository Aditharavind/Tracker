import { useModelViewer } from "../../modelViewer";
import { CHARACTER_MODEL, CHARACTER_SPRITE, type CharacterAnim, type CharacterId } from "../../game/characters";

/**
 * The billboard .glb for a forest character (panda / koala / red panda),
 * played through <model-viewer>. Falls back to the flat sprite until the
 * viewer runtime has loaded -- and since that runtime is ~1MB this is only
 * used behind a tap (Profile turntable) or a gate (Day-complete dance),
 * never on first load. Same Idle / Hop / Dance clip contract for all three.
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

  if (!ready) {
    return (
      <img
        src={CHARACTER_SPRITE[character]}
        alt=""
        aria-hidden="true"
        className={className}
        style={{ imageRendering: "pixelated", objectFit: "contain" }}
      />
    );
  }

  return (
    <model-viewer
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
      class={className}
    />
  );
}
