// Rebuild the looping character-selection background and reduced-motion still.
// Requires ffmpeg: node scripts/pack-character-selection.mjs
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const assetPath = (name) =>
  fileURLToPath(new URL(`../public/assets/character_selection/${name}`, import.meta.url));
const input = assetPath("character_selection.mp4");
const common = ["-hide_banner", "-loglevel", "warning", "-y", "-i", input];

execFileSync("ffmpeg", [
  ...common,
  "-filter_complex",
  "[0:v]fps=12,scale=800:-1:flags=lanczos,split[scene][palette_source];" +
    "[palette_source]palettegen=max_colors=128:reserve_transparent=0[palette];" +
    "[scene][palette]paletteuse=dither=none:diff_mode=rectangle",
  "-an", "-loop", "0", assetPath("character_selection.gif"),
], { stdio: "inherit" });

execFileSync("ffmpeg", [
  ...common,
  "-frames:v", "1", "-update", "1", assetPath("character_selection.jpg"),
], { stdio: "inherit" });
