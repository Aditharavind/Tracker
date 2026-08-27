import { useModelViewer } from "../../modelViewer";
import { CHARACTER_MODEL, CHARACTER_SPRITE, type CharacterAnim, type CharacterId } from "../../game/characters";

/**
 * The billboard .glb for a forest character (panda / koala / red panda),
 * played through <model-viewer>. The flat sprite is ALWAYS rendered as the
 * base layer -- the model-viewer sits on top and covers it once it has
 * painted, so a slow/failed viewer (no WebGL, chunk still loading) just
 * leaves the sprite showing rather than an empty box. Only used behind a
 * tap / gate, never on first load (the runtime is ~1MB).
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

  return (
    <div className={`charmodel${className ? ` ${className}` : ""}`}>
      <img className="charmodel-sprite" src={CHARACTER_SPRITE[character]} alt="" aria-hidden="true" />
      {ready && (
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
          class="charmodel-viewer"
        />
      )}
    </div>
  );
}
