// The one canonical gold panda-imprint coin, drawn on a canvas 2D context.
// Both the endless-runner minigame (PandaRunner) and Story Mode (render.ts)
// call this instead of each drawing their own -- see Coin.tsx for the same
// design as an SVG, used everywhere the coin is DOM/React-rendered instead.
export function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#f0c04a";
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = "#8a5a17";
  ctx.stroke();
  ctx.fillStyle = "#8a5a17";
  ctx.beginPath();
  ctx.arc(cx - r * 0.36, cy - r * 0.18, r * 0.2, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.36, cy - r * 0.18, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c9";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.12, r * 0.46, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5a17";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.18, cy + r * 0.02, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.18, cy + r * 0.02, r * 0.12, r * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.34, r * 0.1, r * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}
