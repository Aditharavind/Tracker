export type PandaAnim = "idle" | "running" | "jumping" | "landing" | "celebrating" | "falling";

export default function Panda({ anim }: { anim: PandaAnim }) {
  const active = anim === "running" || anim === "jumping" || anim === "celebrating";

  return (
    <div className={`panda panda-${anim}`} role="img" aria-label="Your panda">
      <model-viewer
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
    </div>
  );
}
