import { useEffect, useRef } from "react";
import { WORLDS } from "../../game/adventure/content";
import { BOSS_SPRITES, drawBossSprite } from "../../game/adventure/sprites";
import { loadImage } from "../../game/adventure/render";
import type { Boss } from "../../game/adventure/engine";

export default function AdventureBoss({ world, reducedMotion }: { world: number; reducedMotion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    const spec = BOSS_SPRITES[world];
    if (!ctx || !spec) return;
    const image = loadImage(spec.src);
    const reduced = reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const boss: Boss = { x: 0, y: 0, hp: 1, maxHp: 1, phase: 1, stage: "waiting", timer: 0, animationTime: 0, cycle: 0, pattern: 0, direction: -1, hit: 0, targetX: 0, active: false };
    const draw = () => {
      if (document.hidden) return;
      ctx.clearRect(0, 0, 200, 160);
      ctx.save(); ctx.translate(100, 147);
      const scale = Math.min(130 / spec.height, 180 / (spec.w * spec.scale));
      ctx.scale(scale, scale); boss.animationTime = performance.now() / 1000;
      drawBossSprite(ctx, image, spec, boss, reduced); ctx.restore();
    };
    let timer: ReturnType<typeof setInterval> | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      clearInterval(timer);
      if (entry.isIntersecting) { draw(); if (!reduced) timer = setInterval(draw, 1000 / 12); }
    });
    observer.observe(canvas.current!); image.addEventListener("load", draw); draw();
    return () => { clearInterval(timer); observer.disconnect(); image.removeEventListener("load", draw); };
  }, [world, reducedMotion]);
  return <canvas ref={canvas} className="adventure-boss-portrait" width={200} height={160} role="img" aria-label={WORLDS[world].boss} />;
}
