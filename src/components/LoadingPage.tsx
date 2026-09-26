import { useState } from "react";
import loadingScene from "../../frontend/assets/loading.webp";
import loadingSceneLandscape from "../../frontend/assets/loading-landscape.webp";

// The boot gate, the Suspense fallback and App's data load each mount their
// own LoadingPage back to back. Only the first one plays the entry animation;
// the rest must look like the same screen staying put, not a re-fade.
let firstShownAt: number | null = null;

export default function LoadingPage({
  label = "Loading run",
  progress,
}: {
  label?: string;
  progress?: number;
}) {
  const [entering] = useState(() => {
    firstShownAt ??= performance.now();
    return performance.now() - firstShownAt < 100;
  });
  const boundedProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      className="arcade-loading"
      aria-busy="true"
      aria-label={label}
      style={{
        ["--loading-scene-portrait" as string]: `url(${loadingScene})`,
        ["--loading-scene-landscape" as string]: `url(${loadingSceneLandscape})`,
      }}
    >
      <div
        className={`arcade-loading-stage${entering ? " is-entering" : ""}`}
        role={boundedProgress == null ? undefined : "progressbar"}
        aria-valuemin={boundedProgress == null ? undefined : 0}
        aria-valuemax={boundedProgress == null ? undefined : 100}
        aria-valuenow={boundedProgress == null ? undefined : boundedProgress}
        aria-label={boundedProgress == null ? label : `${label}: ${boundedProgress}% loaded`}
      >
        <div
          className={`arcade-loading-bar${boundedProgress == null ? "" : " is-determinate"}`}
          aria-hidden="true"
        >
          <span style={boundedProgress == null ? undefined : { width: `${boundedProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
