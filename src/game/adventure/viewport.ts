import { HEIGHT } from "./engine";
import type { Settings } from "./save";

export function viewportSize(width: number, height: number, pixelRatio: number, settings: Settings, resolution: number) {
  const viewWidth = Math.max(360, Math.min(1920, width / Math.max(1, height) * HEIGHT));
  // Render at the displayed size; a phone should never rasterize a desktop canvas.
  const displayScale = Math.min(width / viewWidth, height / HEIGHT);
  const qualityScale = settings.quality === "auto" ? resolution : settings.quality === "low" ? .75 : 1;
  const scale = Math.max(.25, displayScale * Math.min(settings.performance ? 1 : 2, pixelRatio) * qualityScale);
  return { viewWidth, width: Math.round(viewWidth * scale), height: Math.round(HEIGHT * scale) };
}
