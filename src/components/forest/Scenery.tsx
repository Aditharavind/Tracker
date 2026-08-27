import { useMemo } from "react";
import { createSeededRandom } from "../../game/seededRandom";

/**
 * Mario-style set dressing along the horizontal level (skill §7): floating
 * brick rows, the occasional `?` block, and a green warp pipe. Deliberately
 * NOT the path — the task platforms (generated separately) carry the forward
 * route; this is seasoning placed in the gaps between them and up near the
 * canopy, deterministic per seed so it never reshuffles on a re-render.
 *
 * Per the skill's §7 divergence note the `?`-block count is kept low so the
 * arrangement never reads as a staircase.
 */
type Prop =
  | { kind: "bricks"; left: number; bottom: number; cells: number }
  | { kind: "question"; left: number; bottom: number }
  | { kind: "pipe"; left: number; height: number };

export default function Scenery({ seed, taskCount }: { seed: string; taskCount: number }) {
  const props = useMemo<Prop[]>(() => {
    const rand = createSeededRandom(`${seed}:scenery`);
    const out: Prop[] = [];

    // One brick cluster roughly between each pair of task platforms, floating
    // high enough to sit above the walking route.
    const clusters = Math.min(4, Math.max(2, Math.round(taskCount / 2)));
    for (let i = 0; i < clusters; i++) {
      const slot = (i + 0.5) / clusters;
      const left = 14 + slot * 68 + (rand() - 0.5) * 8;
      const bottom = 46 + rand() * 26;
      const cells = 2 + Math.floor(rand() * 3);
      out.push({ kind: "bricks", left, bottom, cells });
      // Slip a single ? block beside about half the clusters.
      if (rand() > 0.5) {
        out.push({ kind: "question", left: left + cells * 3.4 + 3, bottom: bottom + (rand() > 0.5 ? 0 : 14) });
      }
    }

    // A warp pipe near the far end, as a landmark rather than an obstacle.
    out.push({ kind: "pipe", left: 90 + rand() * 4, height: 34 + rand() * 16 });
    return out;
  }, [seed, taskCount]);

  return (
    <div className="forest-scenery" aria-hidden="true">
      {props.map((p, i) => {
        if (p.kind === "bricks") {
          return (
            <div key={i} className="scn-bricks" style={{ left: `${p.left}%`, bottom: `${p.bottom}%` }}>
              {Array.from({ length: p.cells }, (_, c) => (
                <span key={c} className="scn-brick" />
              ))}
            </div>
          );
        }
        if (p.kind === "question") {
          return (
            <div key={i} className="scn-question" style={{ left: `${p.left}%`, bottom: `${p.bottom}%` }}>
              <span>?</span>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="scn-pipe"
            style={{ left: `${p.left}%`, ["--pipe-h" as string]: `${p.height}px` }}
          >
            <span className="scn-pipe-lip" />
            <span className="scn-pipe-body" />
          </div>
        );
      })}
    </div>
  );
}
