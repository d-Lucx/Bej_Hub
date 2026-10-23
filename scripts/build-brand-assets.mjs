// Original pixel artwork. Run with Node; no image tools or dependencies required.
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const colors = { ink: '#493b35', skin: '#edbb8e', cream: '#fff0d8', copper: '#bb764c', sage: '#658e72', lavender: '#7981af', gold: '#d3aa65' };
const rect = (x, y, w, h, color) => ({ x, y, w, h, color });
const mark = [rect(4,0,24,32,'#536c4f'),rect(0,4,32,24,'#536c4f'),rect(2,2,28,28,'#536c4f'),rect(7,6,4,20,colors.cream),rect(11,13,9,4,colors.cream),rect(19,17,4,6,colors.cream),rect(11,23,9,4,colors.cream),rect(25,3,2,8,colors.gold),rect(22,6,8,2,colors.gold)];
function avatar(role) {
  const shirt = { manager: colors.copper, researcher: colors.sage, writer: colors.lavender }[role];
  const background = { manager: '#eee0cc', researcher: '#dce6d2', writer: '#e0e1ee' }[role];
  const accent = { manager: '#c9a16d', researcher: '#8faa76', writer: '#aaafd0' }[role];
  const r = [rect(0,0,64,64,background),rect(5,6,54,1,accent),rect(5,57,54,1,accent),rect(6,6,1,7,accent),rect(57,50,1,7,accent),rect(14,51,36,4,accent)];
  // Each character uses the same block proportions and palette as the office.
  r.push(rect(20,12,24,5,colors.ink),rect(16,17,32,16,colors.ink),rect(20,22,24,18,colors.skin),rect(18,17,28,9,colors.ink),rect(25,29,3,3,colors.ink),rect(36,29,3,3,colors.ink),rect(29,35,6,2,'#bc8664'));
  r.push(rect(17,40,30,13,shirt),rect(13,43,5,9,colors.skin),rect(47,43,5,9,colors.skin),rect(28,40,8,7,colors.cream),rect(20,53,10,4,colors.ink),rect(34,53,10,4,colors.ink));
  if (role === 'manager') r.push(rect(31,41,3,9,'#775438'),rect(23,17,14,3,'#73533e'),rect(8,37,11,3,colors.gold),rect(8,40,11,11,'#96694c'),rect(10,42,7,1,colors.cream));
  if (role === 'researcher') r.push(rect(22,27,10,7,'#3c5446'),rect(34,27,10,7,'#3c5446'),rect(32,29,2,2,'#3c5446'),rect(24,29,6,3,'#b5d2c0'),rect(36,29,6,3,'#b5d2c0'),rect(46,36,10,10,'#3c5446'),rect(48,38,6,6,'#bed6c4'),rect(50,46,4,7,'#3c5446'));
  if (role === 'writer') r.push(rect(17,24,3,17,colors.ink),rect(44,24,3,17,colors.ink),rect(40,41,13,12,colors.cream),rect(42,44,9,1,'#b5b1a0'),rect(42,47,7,1,'#b5b1a0'),rect(12,36,3,14,colors.gold),rect(12,35,3,3,colors.ink));
  r.push(rect(51,12,2,8,accent),rect(48,15,8,2,accent));
  return r;
}
function svg(rectangles, grid) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${grid}" height="${grid}" viewBox="0 0 ${grid} ${grid}" shape-rendering="crispEdges">${rectangles.map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}"/>`).join('')}</svg>\n`;
}
const crcTable = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ n >>> 1 : n >>> 1; return n >>> 0; });
function chunk(type, data) {
  const name = Buffer.from(type); const bytes = Buffer.concat([name, data]); let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); name.copy(result,4); data.copy(result,8); result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4); return result;
}
function png(rectangles, grid, size, height = size) {
  const pixels = Buffer.alloc((size * 4 + 1) * height);
  const rgba = rectangles.map(r => ({ ...r, rgb: [1,3,5].map(n => parseInt(r.color.slice(n,n+2),16)) }));
  for (let y = 0; y < height; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor(x * grid / size); const gy = Math.floor(y * grid / size);
    let color;
    for (const r of rgba) if (gx >= r.x && gx < r.x+r.w && gy >= r.y && gy < r.y+r.h) color = r.rgb;
    if (color) { const p = y * (size * 4 + 1) + 1 + x * 4; pixels[p]=color[0]; pixels[p+1]=color[1]; pixels[p+2]=color[2]; pixels[p+3]=255; }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size,0); header.writeUInt32BE(height,4); header[8]=8; header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length); header.writeUInt16LE(1,2); header.writeUInt16LE(images.length,4); let offset = header.length;
  images.forEach(({ size, data }, i) => { const p=6+i*16; header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(data.length,p+8);header.writeUInt32LE(offset,p+12);offset+=data.length; });
  return Buffer.concat([header,...images.map(image => image.data)]);
}
await mkdir(resolve(root,'public/avatars'),{recursive:true}); await mkdir(resolve(root,'public/brand'),{recursive:true});
for (const role of ['manager','researcher','writer']) {
  const artwork = avatar(role);
  await writeFile(resolve(root,`public/avatars/${role}.svg`),svg(artwork,64));
  await writeFile(resolve(root,`public/avatars/${role}.png`),png(artwork,64,512));
}
await writeFile(resolve(root,'app/icon.svg'),svg(mark,32));
await writeFile(resolve(root,'public/brand/bej-mark.svg'),svg(mark,32));
await writeFile(resolve(root,'public/brand/bej-hub.png'),png(mark,32,512));
await writeFile(resolve(root,'app/favicon.ico'),ico([16,32,48].map(size => ({size,data:png(mark,32,size)}))));
await writeFile(resolve(root,'app/apple-icon.png'),png(mark,32,180));
// A shareable overview of the new artwork.
const sheet = [...mark.map(r=>({...r,x:r.x+16,y:r.y+16})), ...avatar('manager').map(r=>({...r,x:r.x+72,y:r.y})), ...avatar('researcher').map(r=>({...r,x:r.x+144,y:r.y})), ...avatar('writer').map(r=>({...r,x:r.x+216,y:r.y}))];
await mkdir(resolve(root,'artifacts'),{recursive:true});
await writeFile(resolve(root,'artifacts/brand-preview.png'),png(sheet,280,1120,256));
console.log('Built favicon, touch icon, studio mark, and three 512px Discord avatars.');
