import { useMemo } from "react";
import { DIORAMA_H, DIORAMA_W, buildDiorama } from "../../game/worldDiorama";
import "../../world-diorama.css";

/** The story screen's pixel-art scene for a world: skyline, scenery, ledge,
   ground and the lantern gate. Decorative — the copy beside it carries meaning. */
export default function WorldDiorama({ worldIndex }: { worldIndex: number }) {
  const scene = useMemo(() => buildDiorama(worldIndex), [worldIndex]);
  return (
    <svg className="world-diorama" viewBox={`0 0 ${DIORAMA_W} ${DIORAMA_H}`} preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="world-diorama-halo">
          <stop offset="0%" stopColor="var(--dio-glow)" stopOpacity=".38" />
          <stop offset="55%" stopColor="var(--dio-glow)" stopOpacity=".11" />
          <stop offset="100%" stopColor="var(--dio-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {scene.rects.map((rect, i) => (
        <rect key={i} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={`var(--dio-${rect.c})`} opacity={rect.o} />
      ))}
      <g className="world-diorama-halos" shapeRendering="auto">
        {scene.glows.map((glow, i) => <circle key={i} cx={glow.x} cy={glow.y} r={glow.r} fill="url(#world-diorama-halo)" />)}
      </g>
      <g className={`world-diorama-motes is-${scene.moteKind}`}>
        {scene.motes.map((mote, i) => (
          <rect key={i} x={mote.x} y={mote.y} width={mote.size} height={mote.size} fill="var(--dio-light)"
            style={{ animationDelay: `${mote.delay}s`, animationDuration: `${mote.duration}s` }} />
        ))}
      </g>
    </svg>
  );
}
