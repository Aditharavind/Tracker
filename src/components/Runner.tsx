import { useModelViewer } from "../modelViewer";

export type AvatarId = "guy" | "girl" | "panda";

// Sourced from three.js's own official example assets (mrdoob/three.js,
// examples/models/gltf) -- the well-known Mixamo-derived demo characters.
// Michelle only ships a dance + T-pose (no walk/run/idle clips), so the two
// avatars react differently to progress: he runs, she dances. Both read as
// "my character celebrates a tick," just with different motions.
//
// "panda" is hand-authored (see scripts referenced in the panda.glb commit)
// -- primitive ellipsoids rigged with plain node-TRS animation, no skinning,
// same idle/active clip-name contract as the two Mixamo avatars so it drops
// into the same picker without any special-casing.
const AVATAR_SRC: Record<AvatarId, string> = {
  guy: "/avatars/male.glb",
  girl: "/avatars/female.glb",
  panda: "/avatars/panda.glb",
};
const AVATAR_CLIP: Record<AvatarId, { idle: string; active: string }> = {
  guy: { idle: "Idle", active: "Run" },
  girl: { idle: "TPose", active: "SambaDance" },
  panda: { idle: "Idle", active: "Hop" },
};
// The two source models were authored with opposite "forward" conventions --
// verified empirically (headless screenshots at 0/90/180/270deg), not guessed.
const AVATAR_CAMERA: Record<AvatarId, string> = {
  guy: "180deg 75deg 105%",
  girl: "0deg 75deg 105%",
  panda: "0deg 80deg 105%",
};

/**
 * The 2D sprite -- which costs nothing, being inline SVG -- stands in until the
 * viewer arrives. See modelViewer.ts for why it loads on demand.
 */
export function Avatar3D({
  avatar,
  running,
  zoomed,
}: {
  avatar: AvatarId;
  running: boolean;
  zoomed?: boolean;
}) {
  const clips = AVATAR_CLIP[avatar];
  const ready = useModelViewer();

  if (!ready) {
    return (
      <div className={zoomed ? "avatar3d zoomed" : "avatar3d"}>
        <Sprite avatar={avatar} running={running} />
      </div>
    );
  }

  return (
    <model-viewer
      key={avatar}
      src={AVATAR_SRC[avatar]}
      alt={`${avatar} avatar`}
      animation-name={running ? clips.active : clips.idle}
      camera-orbit={AVATAR_CAMERA[avatar]}
      autoplay
      camera-controls={false}
      disable-zoom
      interaction-prompt="none"
      class={zoomed ? "avatar3d zoomed" : "avatar3d"}
    />
  );
}

export function Sprite({ avatar, running }: { avatar: AvatarId; running: boolean }) {
  // Same hand-drawn-path style as the Check icon and ThemePicker icons --
  // no image assets, colours resolve through --u/--accent like everything else.
  return (
    <svg
      width="26"
      height="30"
      viewBox="0 0 26 30"
      className={`sprite${running ? " running" : ""}`}
      aria-hidden="true"
    >
      <circle cx="13" cy="6" r="4.2" fill="currentColor" />
      <path
        className="torso"
        d="M13 10.5v9"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        className="arm-l"
        d="M13 13.5 8 17"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        className="arm-r"
        d="M13 13.5 18 17"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      {avatar === "girl" && (
        <path d="M8.5 10.5 13 14.5 17.5 10.5" fill="currentColor" opacity="0.9" />
      )}
      {avatar === "panda" && (
        <>
          <circle cx="8.5" cy="2.6" r="2.1" fill="currentColor" />
          <circle cx="17.5" cy="2.6" r="2.1" fill="currentColor" />
        </>
      )}
      <path
        className="leg-l"
        d="M13 19.5 9 27"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <path
        className="leg-r"
        d="M13 19.5 17 27"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

