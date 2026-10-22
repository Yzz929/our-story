// 生成一张测试用 PNG（纯 Node，无依赖）
import fs from 'node:fs';
import zlib from 'node:zlib';

const W = 320;
const H = 240;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
let p = 0;
for (let y = 0; y < H; y++) {
  raw[p++] = 0; // filter none
  for (let x = 0; x < W; x++) {
    raw[p++] = Math.round(200 + 40 * Math.sin((x / W) * Math.PI));
    raw[p++] = Math.round(150 + 60 * (y / H));
    raw[p++] = Math.round(180 + 50 * Math.cos(((x + y) / (W + H)) * Math.PI));
  }
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
const out = process.argv[2] ?? 'D:\\DSH\\AI-Projects\\_research\\test-photo.png';
fs.writeFileSync(out, png);
console.log('wrote', out, (png.length / 1024).toFixed(1) + ' KB');
