import { useMemo } from "react";
import { createSeededRandom } from "../../game/seededRandom";

/**
 * Pixel-art clouds drifting across the sky layer (skill §14/§19: "clouds drift
 * horizontally"). Deterministic per seed so a refresh doesn't reshuffle them,
 * and parallax-tied: the whole strip also carries a fraction of the follow-cam
 * shift (--cam-x) via CSS, on top of each cloud's own slow drift animation.
 */
export default function Clouds({ seed, count = 6 }: { seed: string; count?: number }) {
  const clouds = useMemo(() => {
    const rand = createSeededRandom(`${seed}:clouds`);
    return Array.from({ length: count }, (_, i) => {
      const scale = 1 + rand() * 1.1;
      return {
        id: i,
        top: 4 + rand() * 40, // % of the sky band
        left: rand() * 100, // starting offset, % — the drift loops it around
        scale,
        // Bigger clouds are nearer, so they drift a touch faster.
        duration: 46 - scale * 12 + rand() * 18,
        delay: -rand() * 60,
        opacity: 0.55 + rand() * 0.35,
      };
    });
  }, [seed, count]);

  return (
    <div className="forest-clouds" aria-hidden="true">
      {clouds.map((c) => (
        <span
          key={c.id}
          className="cloud"
          style={{
            top: `${c.top}%`,
            left: `${c.left}%`,
            opacity: c.opacity,
            ["--cloud-scale" as string]: c.scale,
            ["--cloud-dur" as string]: `${c.duration}s`,
            ["--cloud-delay" as string]: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
