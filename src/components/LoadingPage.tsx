import { CHARACTERS } from "../game/characters";

const LOADING_SCENE = "/assets/character_selection/character_selection.jpg";

export default function LoadingPage({ label = "Loading run" }: { label?: string }) {
  return (
    <div className="arcade-loading" aria-busy="true" aria-label={label}>
      <div
        className="arcade-loading-bg"
        style={{ ["--loading-scene" as string]: `url(${LOADING_SCENE})` }}
        aria-hidden="true"
      />
      <div className="arcade-loading-track" aria-hidden="true">
        {CHARACTERS.map((character, index) => (
          <img
            key={character.id}
            src={character.sprite}
            alt=""
            className={`arcade-loading-runner arcade-loading-runner-${index}`}
          />
        ))}
      </div>
      <div className="arcade-loading-copy">
        <img src="/assets/logo.webp" alt="OnTrack" className="arcade-loading-logo" />
        <p className="pixel-font arcade-loading-title">{label.toUpperCase()}</p>
        <div className="arcade-loading-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
