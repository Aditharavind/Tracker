import { useEffect, useRef } from "react";
import { WORLDS } from "../../game/adventure/content";
import { drawPanda, loadArt } from "../../game/adventure/render";

export default function AdventureCinema({ mood, world, endingPage, reducedMotion = false }: { mood: "intro" | "peace" | "power"; world: number; endingPage?: number; reducedMotion?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d"); if (!ctx) return;
    const reduced = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const art = loadArt(); let raf = 0; let start = 0;
    const draw = (t: number) => {
      if (!start) start = t; const seconds = reduced ? 0 : (t - start) / 1000;
      ctx.clearRect(0, 0, 960, 360); ctx.fillStyle = WORLDS[world].sky; ctx.fillRect(0, 0, 960, 360);
      if (art.forest.complete && art.forest.naturalWidth) ctx.drawImage(art.forest, 0, -145, 960, 640);
      ctx.fillStyle = endingPage === 0 ? "#10241c90" : mood === "peace" ? "#dabc7425" : "#10241c60"; ctx.fillRect(0, 0, 960, 360);
      const glow = ctx.createRadialGradient(530, 190, 20, 530, 190, 260); glow.addColorStop(0, "#ffdc8733"); glow.addColorStop(1, "#f5d79900"); ctx.fillStyle = glow; ctx.fillRect(0, 0, 960, 360);
      if (endingPage === 0) {
        ctx.save(); ctx.globalAlpha = reduced ? .2 : Math.max(0, 1 - seconds / 4);
        drawPanda(ctx, art.panda, 650, 270, seconds, "peace", -1, 3.2, true); ctx.restore();
      }
      const walking = endingPage === 3;
      const x = walking ? 440 + Math.min(180, seconds * 22) : 480;
      drawPanda(ctx, art.panda, x, 290, seconds, walking ? "walk" : mood === "intro" ? "idle" : "peace", endingPage === 2 ? -1 : 1, mood === "intro" ? 2.4 : 2.9);
      if (walking && !reduced) { ctx.fillStyle = `rgba(248, 238, 205, ${Math.min(.8, Math.max(0, seconds - 5) / 6)})`; ctx.fillRect(0, 0, 960, 360); }
      if (mood === "power") { ctx.strokeStyle = "#ffdf99"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, 255, 85 + Math.sin(seconds * 2) * 5, 100, 0, 0, Math.PI * 2); ctx.stroke(); }
    };
    const frame = (t: number) => { draw(t); if (!reduced && !document.hidden) raf = requestAnimationFrame(frame); };
    const resume = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); };
    art.forest.onload = art.panda.onload = () => draw(performance.now()); raf = requestAnimationFrame(frame); document.addEventListener("visibilitychange", resume);
    return () => { cancelAnimationFrame(raf); art.forest.onload = art.panda.onload = null; document.removeEventListener("visibilitychange", resume); };
  }, [world, mood, endingPage, reducedMotion]);
  return <canvas className="adventure-cinema" width="960" height="360" ref={ref} aria-hidden="true" />;
}
