// Builds the three forest-character models -- public/assets/characters/{panda,
// koala,redpanda}.glb -- as flat pixel-art billboards, the same technique as
// the older avatars/panda.glb (a single textured quad with node-TRS clips, no
// skinning). @google/model-viewer plays the clips; the art is the chibi sprite
// sheet (.claude/skills/platformer-interface/assets/reference-characters.png is
// the design bible), pre-cropped to public/assets/*-sprite.webp and handed to
// this script as PNG.
//
//   node scripts/build-characters-glb.mjs
//
// Each model ships three clips with a shared name contract so any character
// drops into the same viewer without special-casing:
//   Idle   -- barely-there breathing bob
//   Hop    -- a quick jump (reused for "running/among platforms")
//   Dance  -- victory wiggle: bob + side-to-side tilt (Day-complete screen)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

// PNG sources (opaque-safe copies of public/assets/*-sprite.webp). Regenerate
// with a <canvas> toDataURL("image/png") pass if the sprite art changes.
const CHARACTERS = [
  { id: "panda", png: "scripts/assets/panda-character.png" },
  { id: "koala", png: "scripts/assets/koala-character.png" },
  { id: "redpanda", png: "scripts/assets/redpanda-character.png" },
];

const width = 1.1;
const height = 1;

// quat for a Z-rotation of `rad` -> [x,y,z,w]
const zq = (rad) => [0, 0, Math.sin(rad / 2), Math.cos(rad / 2)];

function buildGlb(imagePath) {
  const image = readFileSync(imagePath);
  const chunks = [];
  const align = (buffer) => {
    const pad = (4 - (buffer.byteLength % 4)) % 4;
    return pad ? Buffer.concat([buffer, Buffer.alloc(pad)]) : buffer;
  };
  const push = (typedArray) => {
    const buffer = align(Buffer.from(typedArray.buffer));
    const byteOffset = chunks.reduce((s, c) => s + c.buffer.byteLength, 0);
    chunks.push({ buffer, byteOffset, byteLength: typedArray.byteLength });
    return chunks.length - 1;
  };
  const pushBuffer = (buffer) => {
    const byteOffset = chunks.reduce((s, c) => s + c.buffer.byteLength, 0);
    chunks.push({ buffer: align(buffer), byteOffset, byteLength: buffer.byteLength });
    return chunks.length - 1;
  };

  const positions = new Float32Array([
    -width / 2, 0, 0, width / 2, 0, 0, -width / 2, height, 0, width / 2, height, 0,
  ]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);

  const idleT = new Float32Array([0, 1, 2]);
  const idleTrans = new Float32Array([0, 0, 0, 0, 0.015, 0, 0, 0, 0]);

  const hopT = new Float32Array([0, 0.35, 0.7]);
  const hopTrans = new Float32Array([0, 0, 0, 0, 0.13, 0, 0, 0, 0]);

  const danceT = new Float32Array([0, 0.25, 0.5, 0.75, 1]);
  const danceTrans = new Float32Array([
    -0.05, 0, 0, 0.05, 0.06, 0, -0.05, 0, 0, 0.05, 0.06, 0, -0.05, 0, 0,
  ]);
  const danceRotArr = [zq(-0.16), zq(0.16), zq(-0.16), zq(0.16), zq(-0.16)].flat();
  const danceRot = new Float32Array(danceRotArr);

  const vPos = push(positions);
  const vNorm = push(normals);
  const vUv = push(uvs);
  const vIdx = push(indices);
  const vIdleT = push(idleT);
  const vIdleTr = push(idleTrans);
  const vHopT = push(hopT);
  const vHopTr = push(hopTrans);
  const vDanceT = push(danceT);
  const vDanceTr = push(danceTrans);
  const vDanceRot = push(danceRot);
  const vImg = pushBuffer(image);

  const gltf = {
    asset: { version: "2.0", generator: "Tracker build-characters-glb.mjs" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "billboard", mesh: 0, translation: [0, -0.5, 0] }],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] },
    ],
    materials: [
      {
        name: "character",
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        alphaMode: "MASK",
        alphaCutoff: 0.5,
        doubleSided: true,
      },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    images: [{ mimeType: "image/png", bufferView: vImg }],
    animations: [
      {
        name: "Idle",
        samplers: [{ input: vIdleT, output: vIdleTr, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
      },
      {
        name: "Hop",
        samplers: [{ input: vHopT, output: vHopTr, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
      },
      {
        name: "Dance",
        samplers: [
          { input: vDanceT, output: vDanceTr, interpolation: "LINEAR" },
          { input: vDanceT, output: vDanceRot, interpolation: "LINEAR" },
        ],
        channels: [
          { sampler: 0, target: { node: 0, path: "translation" } },
          { sampler: 1, target: { node: 0, path: "rotation" } },
        ],
      },
    ],
    buffers: [{ byteLength: chunks.reduce((s, c) => s + c.buffer.byteLength, 0) }],
    bufferViews: chunks.map((chunk, index) => ({
      buffer: 0,
      byteOffset: chunk.byteOffset,
      byteLength: chunk.byteLength,
      ...(index === vIdx ? { target: 34963 } : index < vIdleT ? { target: 34962 } : {}),
    })),
    accessors: [
      { bufferView: vPos, componentType: 5126, count: 4, type: "VEC3", min: [-width / 2, 0, 0], max: [width / 2, height, 0] },
      { bufferView: vNorm, componentType: 5126, count: 4, type: "VEC3" },
      { bufferView: vUv, componentType: 5126, count: 4, type: "VEC2" },
      { bufferView: vIdx, componentType: 5123, count: 6, type: "SCALAR" },
      { bufferView: vIdleT, componentType: 5126, count: 3, type: "SCALAR", min: [0], max: [2] },
      { bufferView: vIdleTr, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: vHopT, componentType: 5126, count: 3, type: "SCALAR", min: [0], max: [0.7] },
      { bufferView: vHopTr, componentType: 5126, count: 3, type: "VEC3" },
      { bufferView: vDanceT, componentType: 5126, count: 5, type: "SCALAR", min: [0], max: [1] },
      { bufferView: vDanceTr, componentType: 5126, count: 5, type: "VEC3" },
      { bufferView: vDanceRot, componentType: 5126, count: 5, type: "VEC4" },
    ],
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
