import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const out = resolve(fileURLToPath(new URL(".", import.meta.url)), "assets/panda-back.png");
const size = 256;
const pixels = Buffer.alloc(size * size * 4);
const colors = {
  dark: [32, 30, 28, 255], mid: [75, 73, 68, 255], cream: [245, 238, 223, 255], shade: [229, 220, 203, 255],
  brown: [160, 108, 62, 255], brownDark: [95, 58, 35, 255], brownLight: [178, 122, 70, 255], strap: [63, 42, 30, 255],
};
const rect = (x, y, w, h, color) => {
  for (let py = Math.max(0, y); py < Math.min(size, y + h); py++) for (let px = Math.max(0, x); px < Math.min(size, x + w); px++) {
    const at = (py * size + px) * 4;
    pixels.set(color, at);
  }
};
// Scaled 1.46x from the original hand-drawn layout and re-centred so the
// silhouette fills the 256x256 canvas the same ~95-99% both axes koala/
// redpanda/panda's front sprites do (measured, not eyeballed) -- the
// original was drawn at ~65% fill, which is why this character alone read
// as noticeably smaller everywhere it's placed next to the other two.
rect(20, 5, 54, 55, colors.dark); rect(182, 5, 54, 55, colors.dark);
rect(32, 17, 31, 32, colors.mid); rect(194, 17, 31, 32, colors.mid);
rect(4, 60, 248, 117, colors.dark); rect(20, 58, 216, 124, colors.cream); rect(36, 155, 184, 39, colors.shade);
rect(20, 166, 54, 61, colors.dark); rect(182, 166, 54, 61, colors.dark); rect(30, 177, 34, 39, colors.mid); rect(192, 177, 34, 39, colors.mid);
rect(55, 131, 146, 77, colors.brown); rect(67, 142, 123, 54, colors.brownDark); rect(81, 142, 93, 16, colors.brownLight); rect(105, 151, 47, 20, colors.strap);
rect(33, 69, 190, 74, colors.shade); rect(51, 69, 155, 64, colors.cream); rect(57, 205, 60, 39, colors.dark); rect(140, 205, 60, 39, colors.dark); rect(68, 215, 38, 18, colors.mid); rect(150, 215, 38, 18, colors.mid); rect(83, 44, 91, 19, colors.cream);
// Backpack shoulder straps -- drawn last so they read as worn over the body
// rather than another patch: two bands running from the shoulder line down
// into the top of the pack.
rect(70, 69, 20, 71, colors.strap); rect(166, 69, 20, 71, colors.strap);
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buffer => { let value = 0xffffffff; for (const byte of buffer) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), data])), 0); return Buffer.concat([head, data, tail]); };
const scanlines = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) pixels.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]));
