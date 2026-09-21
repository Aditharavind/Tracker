import { CHARACTERS } from "../game/characters";
import loadingScene from "../../frontend/assets/loading.webp";

export default function LoadingPage({
  label = "Loading run",
  progress,
}: {
  label?: string;
  progress?: number;
}) {
  const boundedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="arcade-loading" aria-busy="true" aria-label={label}>
      <div
        className="arcade-loading-bg"
        style={{
          ["--loading-scene" as string]: `url(${loadingScene})`,
        }}
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
        <div
          className={`arcade-loading-bar${boundedProgress == null ? "" : " is-determinate"}`}
          role={boundedProgress == null ? undefined : "progressbar"}
          aria-valuemin={boundedProgress == null ? undefined : 0}
          aria-valuemax={boundedProgress == null ? undefined : 100}
          aria-valuenow={boundedProgress == null ? undefined : boundedProgress}
          aria-label={boundedProgress == null ? undefined : `${label}: ${boundedProgress}% loaded`}
        >
          <span style={boundedProgress == null ? undefined : { width: `${boundedProgress}%` }} />
          {boundedProgress != null && <strong className="pixel-font">{boundedProgress}%</strong>}
        </div>
      </div>
    </div>
  );
}
