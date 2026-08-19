import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const image = readFileSync(resolve(root, "public/assets/panda-character.png"));

const width = 1.16;
const height = 1;

const chunks = [];
const align = (buffer) => {
  const pad = (4 - (buffer.byteLength % 4)) % 4;
  return pad ? Buffer.concat([buffer, Buffer.alloc(pad)]) : buffer;
};
const push = (name, typedArray) => {
  const buffer = align(Buffer.from(typedArray.buffer));
  const byteOffset = chunks.reduce((sum, chunk) => sum + chunk.buffer.byteLength, 0);
  chunks.push({ name, buffer, byteOffset, byteLength: typedArray.byteLength });
  return chunks.length - 1;
};
const pushBuffer = (name, buffer) => {
  const byteOffset = chunks.reduce((sum, chunk) => sum + chunk.buffer.byteLength, 0);
  chunks.push({ name, buffer: align(buffer), byteOffset, byteLength: buffer.byteLength });
  return chunks.length - 1;
};

const positions = new Float32Array([
  -width / 2, 0, 0,
  width / 2, 0, 0,
  -width / 2, height, 0,
  width / 2, height, 0,
]);
const normals = new Float32Array([
  0, 0, 1,
  0, 0, 1,
  0, 0, 1,
  0, 0, 1,
]);
const uvs = new Float32Array([
  0, 1,
  1, 1,
  0, 0,
  1, 0,
]);
const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
const idleTimes = new Float32Array([0, 1]);
const idleTranslations = new Float32Array([0, 0, 0, 0, 0, 0]);
const hopTimes = new Float32Array([0, 0.35, 0.7]);
const hopTranslations = new Float32Array([0, 0, 0, 0, 0.12, 0, 0, 0, 0]);

const positionView = push("positions", positions);
const normalView = push("normals", normals);
const uvView = push("uvs", uvs);
const indexView = push("indices", indices);
const idleTimeView = push("idleTimes", idleTimes);
const idleTranslationView = push("idleTranslations", idleTranslations);
const hopTimeView = push("hopTimes", hopTimes);
const hopTranslationView = push("hopTranslations", hopTranslations);
const imageView = pushBuffer("pandaTexture", image);

const gltf = {
  asset: { version: "2.0", generator: "Tracker build-panda-glb.mjs" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "Panda billboard", mesh: 0, translation: [0, -0.5, 0] }],
  meshes: [
    {
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
          material: 0,
        },
      ],
    },
  ],
  materials: [
    {
      name: "Reference panda",
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      alphaMode: "BLEND",
      doubleSided: true,
    },
  ],
  textures: [{ source: 0, sampler: 0 }],
  samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
  images: [{ mimeType: "image/png", bufferView: imageView }],
  animations: [
    {
      name: "Idle",
      samplers: [{ input: 4, output: 5, interpolation: "LINEAR" }],
      channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
    },
    {
      name: "Hop",
      samplers: [{ input: 6, output: 7, interpolation: "LINEAR" }],
      channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
    },
  ],
  buffers: [{ byteLength: chunks.reduce((sum, chunk) => sum + chunk.buffer.byteLength, 0) }],
  bufferViews: chunks.map((chunk, index) => ({
    buffer: 0,
    byteOffset: chunk.byteOffset,
    byteLength: chunk.byteLength,
    ...(index === indexView ? { target: 34963 } : index < imageView ? { target: 34962 } : {}),
  })),
  accessors: [
    { bufferView: positionView, componentType: 5126, count: 4, type: "VEC3", min: [-width / 2, 0, 0], max: [width / 2, height, 0] },
    { bufferView: normalView, componentType: 5126, count: 4, type: "VEC3" },
    { bufferView: uvView, componentType: 5126, count: 4, type: "VEC2" },
    { bufferView: indexView, componentType: 5123, count: 6, type: "SCALAR" },
    { bufferView: idleTimeView, componentType: 5126, count: 2, type: "SCALAR", min: [0], max: [1] },
    { bufferView: idleTranslationView, componentType: 5126, count: 2, type: "VEC3" },
    { bufferView: hopTimeView, componentType: 5126, count: 3, type: "SCALAR", min: [0], max: [0.7] },
    { bufferView: hopTranslationView, componentType: 5126, count: 3, type: "VEC3" },
  ],
};

const json = align(Buffer.from(JSON.stringify(gltf), "utf8"));
const bin = Buffer.concat(chunks.map((chunk) => chunk.buffer));
const totalLength = 12 + 8 + json.byteLength + 8 + bin.byteLength;
const out = Buffer.alloc(totalLength);
let offset = 0;
out.writeUInt32LE(0x46546c67, offset);
offset += 4;
out.writeUInt32LE(2, offset);
offset += 4;
out.writeUInt32LE(totalLength, offset);
offset += 4;
out.writeUInt32LE(json.byteLength, offset);
offset += 4;
out.writeUInt32LE(0x4e4f534a, offset);
offset += 4;
json.copy(out, offset);
offset += json.byteLength;
out.writeUInt32LE(bin.byteLength, offset);
offset += 4;
out.writeUInt32LE(0x004e4942, offset);
offset += 4;
bin.copy(out, offset);

writeFileSync(resolve(root, "public/avatars/panda.glb"), out);
console.log(`Wrote public/avatars/panda.glb (${out.byteLength} bytes)`);
