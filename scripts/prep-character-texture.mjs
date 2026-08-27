// Turns a raw character artwork (any size, solid background) into the
// transparent, square, centred PNG that build-characters-glb.mjs and the
// in-world sprite both expect.
//
//   node scripts/prep-character-texture.mjs <in> <out.png> [size=256]
//
// - Flood-fills the solid background from the four edges and makes it
//   transparent (keeps the character's own black parts -- they aren't
//   connected to the border).
// - Trims to the character's bounding box, then centres it on a square
//   canvas with a small margin.
// Needs headless Chrome on PATH (same as the other scratch scripts).

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "google-chrome",
  "chromium",
];
const { existsSync } = await import("node:fs");
const CHROME = CHROME_CANDIDATES.find((p) => p.includes("/") || p.includes("\\") ? existsSync(p) : true);

const IN = process.argv[2];
const OUT = process.argv[3];
const SIZE = Number(process.argv[4] || 256);
if (!IN || !OUT) {
  console.error("usage: node scripts/prep-character-texture.mjs <in> <out.png> [size]");
  process.exit(1);
}

const PORT = 9377;
const prof = mkdtempSync(path.join(tmpdir(), "cdp-"));
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  "--headless=new",
  "--disable-gpu",
  `--user-data-dir=${prof}`,
  "about:blank",
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let page;
for (let i = 0; i < 60; i++) {
  try {
    const t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    page = t.find((x) => x.type === "page");
    if (page) break;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    pending.set(++id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Runtime.enable");
const ext = path.extname(IN).slice(1).toLowerCase();
const mime = ext === "jpg" ? "image/jpeg" : `image/${ext || "png"}`;
const b64 = readFileSync(IN).toString("base64");

const r = await send("Runtime.evaluate", {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const img = new Image();
    img.src = "data:${mime};base64,${b64}";
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, w, h);
    const d = im.data;
    const idx = (x, y) => (y * w + x) * 4;

    // Background colour = the top-left pixel. Flood fill matching pixels
    // from every border pixel and knock their alpha to 0.
    const bg = [d[0], d[1], d[2]];
    const tol = 42;
    const near = (i) =>
      Math.abs(d[i] - bg[0]) <= tol &&
      Math.abs(d[i + 1] - bg[1]) <= tol &&
      Math.abs(d[i + 2] - bg[2]) <= tol;

    const seen = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) { stack.push([x, 0]); stack.push([x, h - 1]); }
    for (let y = 0; y < h; y++) { stack.push([0, y]); stack.push([w - 1, y]); }
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const p = y * w + x;
      if (seen[p]) continue;
      const i = idx(x, y);
      if (!near(i)) continue;
      seen[p] = 1;
      d[i + 3] = 0;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    // Bounding box of what's left.
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (d[idx(x, y) + 3] > 12) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
    ctx.putImageData(im, 0, 0);

    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const S = ${SIZE};
    const margin = 0.1;
    const scale = Math.min((S * (1 - margin * 2)) / bw, (S * (1 - margin * 2)) / bh);
    const dw = bw * scale, dh = bh * scale;
    const out = document.createElement("canvas");
    out.width = S; out.height = S;
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = false;
    octx.drawImage(c, minX, minY, bw, bh, (S - dw) / 2, S - dh - S * margin, dw, dh);
    return out.toDataURL("image/png");
  })()`,
});
if (r.exceptionDetails) {
  console.error(JSON.stringify(r.exceptionDetails, null, 2));
  process.exit(1);
}
writeFileSync(OUT, Buffer.from(r.result.value.split(",")[1], "base64"));
console.log("wrote", OUT);
ws.close();
chrome.kill();
process.exit(0);
