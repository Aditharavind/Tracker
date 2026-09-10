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
rect(54, 51, 37, 38, colors.dark); rect(165, 51, 37, 38, colors.dark);
rect(62, 59, 21, 22, colors.mid); rect(173, 59, 21, 22, colors.mid);
rect(43, 89, 170, 80, colors.dark); rect(54, 87, 148, 85, colors.cream); rect(65, 154, 126, 27, colors.shade);
rect(54, 161, 37, 42, colors.dark); rect(165, 161, 37, 42, colors.dark); rect(61, 169, 23, 27, colors.mid); rect(172, 169, 23, 27, colors.mid);
rect(78, 137, 100, 53, colors.brown); rect(86, 145, 84, 37, colors.brownDark); rect(96, 145, 64, 11, colors.brownLight); rect(112, 151, 32, 14, colors.strap);
rect(63, 95, 130, 51, colors.shade); rect(75, 95, 106, 44, colors.cream); rect(79, 188, 41, 27, colors.dark); rect(136, 188, 41, 27, colors.dark); rect(87, 195, 26, 12, colors.mid); rect(143, 195, 26, 12, colors.mid); rect(97, 78, 62, 13, colors.cream);
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buffer => { let value = 0xffffffff; for (const byte of buffer) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4); const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), data])), 0); return Buffer.concat([head, data, tail]); };
const scanlines = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) pixels.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]));
