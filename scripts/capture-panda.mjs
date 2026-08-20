/**
 * Regenerates public/assets/panda-sprite.webp from public/avatars/panda.glb.
 *
 * The forest panda used to be drawn by <model-viewer> reading the .glb live,
 * which cost 1.75MB on every load (1,047KB runtime + 706KB model) to fill a
 * box the CSS caps at 72px. The model is flat pixel-art on a billboard, so a
 * still frame at the component's own camera angle is indistinguishable from
 * it -- this bakes that frame once, at build time, for ~10KB.
 *
 *   node scripts/capture-panda.mjs
 *
 * Needs a built dist/ (for the model-viewer chunk) and google-chrome on PATH.
 * Run it if panda.glb changes, or if Panda.tsx's camera-orbit changes.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const CAMERA = "0deg 90deg 105%"; // keep in step with Panda.tsx
const RENDER = 512;
const OUT_PX = 216; // 3x the 72px the CSS caps .panda-model at

const chunk = (await readdir(path.join(DIST, "assets"))).find(
  (f) => f.startsWith("model-viewer-") && f.endsWith(".js")
);
if (!chunk) throw new Error("no model-viewer chunk in dist/assets -- run `npm run build` first");

const page = `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
model-viewer{width:${RENDER}px;height:${RENDER}px;background:transparent;--poster-color:transparent}
</style></head><body>
<model-viewer src="/avatars/panda.glb" camera-orbit="${CAMERA}" animation-name="Idle"
  autoplay camera-controls="false" disable-zoom interaction-prompt="none"
  shadow-intensity="0"></model-viewer>
<script type="module" src="/assets/${chunk}"></script>
</body></html>`;

const TYPES = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".html": "text/html" };
const server = createServer(async (req, res) => {
  const p = req.url.split("?")[0];
  if (p === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(page);
  }
  try {
    const body = await readFile(path.join(DIST, p));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;

const dir = process.env.PANDA_DEBUG_DIR || (await mkdtemp(path.join(tmpdir(), "panda-")));
const shot = path.join(dir, "raw.png");
await run("google-chrome", [
  "--headless", "--disable-gpu", "--hide-scrollbars",
  "--default-background-color=00000000", // real transparency, not white
  "--virtual-time-budget=15000",
  `--window-size=${RENDER},${RENDER}`,
  `--screenshot=${shot}`,
  url,
]);
server.close();

// Headless leaves a few opaque rows at the top of the frame; drop them before
// measuring the sprite's own bounds or the crop comes out full-width.
const py = `
from PIL import Image
im = Image.open(${JSON.stringify(shot)}).convert("RGBA").crop((0, 8, ${RENDER}, ${RENDER}))
a = im.split()[3]
box = a.point(lambda v: 255 if v > 8 else 0).getbbox()
# A blank frame means the model or the viewer chunk had not finished loading.
# Image.crop(None) silently returns the whole (empty) frame, which would
# overwrite a good sprite with 216x216 of nothing -- refuse instead.
if box is None:
    raise SystemExit("capture came back empty -- model never rendered; re-run")
c = im.crop(box)
w, h = c.size
side = max(w, h)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(c, ((side - w) // 2, side - h))  # feet on the floor of the box
sq.resize((${OUT_PX}, ${OUT_PX}), Image.LANCZOS).save(
    ${JSON.stringify(path.join(ROOT, "public/assets/panda-sprite.webp"))},
    "WEBP", quality=92, method=6)
print("wrote public/assets/panda-sprite.webp", box)
`;
const { stdout } = await run("python3", ["-c", py]);
process.stdout.write(stdout);
if (!process.env.PANDA_DEBUG_DIR) await rm(dir, { recursive: true, force: true });
