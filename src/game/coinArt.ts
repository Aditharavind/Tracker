import coinImageSrc from "../../frontend/assets/coin.webp";

export { coinImageSrc };

let coinImage: HTMLImageElement | null = null;

function getCoinImage() {
  if (typeof Image === "undefined") return null;
  if (!coinImage) {
    coinImage = new Image();
    coinImage.src = coinImageSrc;
  }
  return coinImage;
}

// The one canonical bitmap coin, drawn on a canvas 2D context.
export function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const img = getCoinImage();
  if (img?.complete && img.naturalWidth > 0) {
    const size = r * 6;
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    return;
  }

  const fallbackR = r * 3;
  ctx.beginPath();
  ctx.arc(cx, cy, fallbackR, 0, Math.PI * 2);
  ctx.fillStyle = "#f0c04a";
  ctx.fill();
  ctx.lineWidth = Math.max(1, fallbackR * 0.16);
  ctx.strokeStyle = "#8a5a17";
  ctx.stroke();
  ctx.fillStyle = "#8a5a17";
  ctx.beginPath();
  ctx.arc(cx - fallbackR * 0.36, cy - fallbackR * 0.18, fallbackR * 0.2, 0, Math.PI * 2);
  ctx.arc(cx + fallbackR * 0.36, cy - fallbackR * 0.18, fallbackR * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3c9";
  ctx.beginPath();
  ctx.ellipse(cx, cy + fallbackR * 0.12, fallbackR * 0.46, fallbackR * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5a17";
  ctx.beginPath();
  ctx.ellipse(cx - fallbackR * 0.18, cy + fallbackR * 0.02, fallbackR * 0.12, fallbackR * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + fallbackR * 0.18, cy + fallbackR * 0.02, fallbackR * 0.12, fallbackR * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + fallbackR * 0.34, fallbackR * 0.1, fallbackR * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
}
