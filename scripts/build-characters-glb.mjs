// Builds the three forest-character models -- public/assets/characters/{panda,
// koala,redpanda}.glb.
//
//   node scripts/build-characters-glb.mjs
//
// Each model is a flat pixel-art billboard CUT INTO THREE PIECES that share
// one texture: an upper "body" quad plus a left-leg and right-leg quad that
// pivot at the hip. Plain node-TRS animation (no skinning) swings the legs,
// so the character actually strides when it runs -- @google/model-viewer just
// plays the clip.
//
// Clip name contract (all three characters):
//   Idle   -- barely-there breathing bob, legs still
//   Run    -- alternating leg swing + running bob
//   Hop    -- both legs tuck, body lifts (a jump)
//   Dance  -- side-to-side tilt + bob (Day-complete screen)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const CHARACTERS = [
  { id: "panda", png: "scripts/assets/panda-character.png" },
  { id: "koala", png: "scripts/assets/koala-character.png" },
  { id: "redpanda", png: "scripts/assets/redpanda-character.png" },
];

const W = 1.1; // world width of the character
const H = 1.0; // world height
// Fraction of the texture height (measured from the bottom) that is "legs".
const LEG_FRAC = 0.24;
// Horizontal span of each leg within the texture, as u coordinates.
const LEG_L_U = [0.3, 0.52];
const LEG_R_U = [0.48, 0.7];

const legLen = LEG_FRAC * H;
const hipY = LEG_FRAC * H; // world y where the legs meet the body

// quat for a Z-rotation of `deg` -> [x,y,z,w]
const zq = (deg) => {
  const r = (deg * Math.PI) / 180 / 2;
  return [0, 0, Math.sin(r), Math.cos(r)];
};
const IDENT = [0, 0, 0, 1];

function buildGlb(imagePath) {
  const image = readFileSync(imagePath);
  const chunks = [];
  const align = (buf) => {
    const pad = (4 - (buf.byteLength % 4)) % 4;
    return pad ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf;
  };
  const push = (typed) => {
    const buffer = align(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
    const byteOffset = chunks.reduce((s, c) => s + c.buffer.byteLength, 0);
    chunks.push({ buffer, byteOffset, byteLength: typed.byteLength });
    return chunks.length - 1;
  };
  const pushBuffer = (buf) => {
    const byteOffset = chunks.reduce((s, c) => s + c.buffer.byteLength, 0);
    chunks.push({ buffer: align(buf), byteOffset, byteLength: buf.byteLength });
    return chunks.length - 1;
  };

  const accessors = [];
  const meshes = [];
  // A quad from a rect of world space + a rect of UV space.
  const addQuad = ({ x0, y0, x1, y1, u0, v0, u1, v1 }) => {
    const pos = new Float32Array([x0, y0, 0, x1, y0, 0, x0, y1, 0, x1, y1, 0]);
    const nrm = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    const uv = new Float32Array([u0, v1, u1, v1, u0, v0, u1, v0]);
    const idx = new Uint16Array([0, 1, 2, 2, 1, 3]);
    const vP = push(pos), vN = push(nrm), vU = push(uv), vI = push(idx);
    const aP = accessors.push({
      bufferView: vP, componentType: 5126, count: 4, type: "VEC3",
      min: [Math.min(x0, x1), Math.min(y0, y1), 0], max: [Math.max(x0, x1), Math.max(y0, y1), 0],
    }) - 1;
    const aN = accessors.push({ bufferView: vN, componentType: 5126, count: 4, type: "VEC3" }) - 1;
    const aU = accessors.push({ bufferView: vU, componentType: 5126, count: 4, type: "VEC2" }) - 1;
    const aI = accessors.push({ bufferView: vI, componentType: 5123, count: 6, type: "SCALAR" }) - 1;
    return meshes.push({
      primitives: [{ attributes: { POSITION: aP, NORMAL: aN, TEXCOORD_0: aU }, indices: aI, material: 0 }],
    }) - 1;
  };

  // texture v: 0 = top, 1 = bottom.  world y: 0 = feet, H = head.
  const bodyMesh = addQuad({ x0: -W / 2, y0: hipY, x1: W / 2, y1: H, u0: 0, v0: 0, u1: 1, v1: 1 - LEG_FRAC });
  const legLMesh = addQuad({ x0: -(LEG_L_U[1] - LEG_L_U[0]) * W / 2, y0: -legLen, x1: (LEG_L_U[1] - LEG_L_U[0]) * W / 2, y1: 0, u0: LEG_L_U[0], v0: 1 - LEG_FRAC, u1: LEG_L_U[1], v1: 1 });
  const legRMesh = addQuad({ x0: -(LEG_R_U[1] - LEG_R_U[0]) * W / 2, y0: -legLen, x1: (LEG_R_U[1] - LEG_R_U[0]) * W / 2, y1: 0, u0: LEG_R_U[0], v0: 1 - LEG_FRAC, u1: LEG_R_U[1], v1: 1 });

  const hipLX = ((LEG_L_U[0] + LEG_L_U[1]) / 2 - 0.5) * W;
  const hipRX = ((LEG_R_U[0] + LEG_R_U[1]) / 2 - 0.5) * W;

  // ---- animation sampler helper -------------------------------------------
  const animSamplers = [];
  const addSampler = (times, values, size) => {
    const input = push(new Float32Array(times));
    const output = push(new Float32Array(values));
    accessors.push({ bufferView: input, componentType: 5126, count: times.length, type: "SCALAR", min: [times[0]], max: [times[times.length - 1]] });
    accessors.push({ bufferView: output, componentType: 5126, count: times.length, type: size });
    return { inAcc: accessors.length - 2, outAcc: accessors.length - 1 };
  };

  const animations = [];
  const clip = (name, tracks) => {
    const samplers = [];
    const channels = [];
    for (const t of tracks) {
      const { inAcc, outAcc } = addSampler(t.times, t.values.flat(), t.path === "rotation" ? "VEC4" : "VEC3");
      samplers.push({ input: inAcc, output: outAcc, interpolation: "LINEAR" });
      channels.push({ sampler: samplers.length - 1, target: { node: t.node, path: t.path } });
    }
    animations.push({ name, samplers, channels });
  };

  // node ids: 0 root, 1 body, 2 legL, 3 legR
  const N_ROOT = 0, N_BODY = 1, N_LEGL = 2, N_LEGR = 3;

  clip("Idle", [
    { node: N_ROOT, path: "translation", times: [0, 1, 2], values: [[0, -0.5, 0], [0, -0.485, 0], [0, -0.5, 0]] },
  ]);

  const rt = [0, 0.14, 0.28, 0.42, 0.56];
  clip("Run", [
    { node: N_ROOT, path: "translation", times: rt, values: [[0, -0.5, 0], [0, -0.47, 0], [0, -0.5, 0], [0, -0.47, 0], [0, -0.5, 0]] },
    { node: N_LEGL, path: "rotation", times: rt, values: [zq(24), zq(-6), zq(-24), zq(-6), zq(24)] },
    { node: N_LEGR, path: "rotation", times: rt, values: [zq(-24), zq(-6), zq(24), zq(-6), zq(-24)] },
    { node: N_BODY, path: "rotation", times: rt, values: [zq(-4), zq(-6), zq(-4), zq(-6), zq(-4)] },
  ]);

  clip("Hop", [
    { node: N_ROOT, path: "translation", times: [0, 0.28, 0.55], values: [[0, -0.5, 0], [0, -0.36, 0], [0, -0.5, 0]] },
    { node: N_LEGL, path: "rotation", times: [0, 0.28, 0.55], values: [IDENT, zq(28), IDENT] },
    { node: N_LEGR, path: "rotation", times: [0, 0.28, 0.55], values: [IDENT, zq(-28), IDENT] },
  ]);

  const dt = [0, 0.25, 0.5, 0.75, 1];
  clip("Dance", [
    { node: N_ROOT, path: "translation", times: dt, values: [[-0.05, -0.5, 0], [0.05, -0.42, 0], [-0.05, -0.5, 0], [0.05, -0.42, 0], [-0.05, -0.5, 0]] },
    { node: N_ROOT, path: "rotation", times: dt, values: [zq(-12), zq(12), zq(-12), zq(12), zq(-12)] },
    { node: N_LEGL, path: "rotation", times: dt, values: [zq(-14), zq(14), zq(-14), zq(14), zq(-14)] },
    { node: N_LEGR, path: "rotation", times: dt, values: [zq(14), zq(-14), zq(14), zq(-14), zq(14)] },
  ]);

  const imgView = pushBuffer(image);

  const gltf = {
    asset: { version: "2.0", generator: "Tracker build-characters-glb.mjs" },
    scene: 0,
    scenes: [{ nodes: [N_ROOT] }],
    nodes: [
      { name: "root", translation: [0, -0.5, 0], children: [N_BODY, N_LEGL, N_LEGR] },
      { name: "body", mesh: bodyMesh },
      { name: "legL", mesh: legLMesh, translation: [hipLX, hipY, 0] },
      { name: "legR", mesh: legRMesh, translation: [hipRX, hipY, 0] },
    ],
    materials: [{
      name: "character",
      pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 },
      alphaMode: "MASK", alphaCutoff: 0.5, doubleSided: true,
    }],
    meshes,
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: [{ mimeType: "image/png", bufferView: imgView }],
    animations,
    buffers: [{ byteLength: chunks.reduce((s, c) => s + c.buffer.byteLength, 0) }],
    bufferViews: chunks.map((c, i) => ({
      buffer: 0, byteOffset: c.byteOffset, byteLength: c.byteLength,
      // meshes come first (positions/normals/uv=ARRAY_BUFFER, indices=ELEMENT);
      // give the image + animation buffers no target.
      ...(i < imgView ? {} : {}),
    })),
    accessors,
  };

  const json = align(Buffer.from(JSON.stringify(gltf), "utf8"));
  const bin = Buffer.concat(chunks.map((c) => c.buffer));
  const total = 12 + 8 + json.byteLength + 8 + bin.byteLength;
  const out = Buffer.alloc(total);
  let o = 0;
  out.writeUInt32LE(0x46546c67, o); o += 4;
  out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(total, o); o += 4;
  out.writeUInt32LE(json.byteLength, o); o += 4;
  out.writeUInt32LE(0x4e4f534a, o); o += 4;
  json.copy(out, o); o += json.byteLength;
  out.writeUInt32LE(bin.byteLength, o); o += 4;
  out.writeUInt32LE(0x004e4942, o); o += 4;
  bin.copy(out, o);
  return out;
}

const outDir = resolve(root, "public/assets/characters");
mkdirSync(outDir, { recursive: true });
for (const c of CHARACTERS) {
  const glb = buildGlb(resolve(root, c.png));
  const dest = resolve(outDir, `${c.id}.glb`);
  writeFileSync(dest, glb);
  console.log(`Wrote ${dest} (${glb.byteLength} bytes)`);
}
