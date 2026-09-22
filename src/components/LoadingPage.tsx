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
        className="arcade-loading-stage"
        style={{
          ["--loading-scene" as string]: `url(${loadingScene})`,
        }}
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
