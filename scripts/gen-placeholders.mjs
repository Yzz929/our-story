// 生成占位照片：柔焦渐变 + 散景圆点，看起来像被虚化的照片，等你换成真照片
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'public/photos';
fs.mkdirSync(OUT, { recursive: true });

const palettes = [
  ['#f6cfd6', '#d98aa0', '#7c5b74'],
  ['#f7e0c8', '#dcae86', '#7d6350'],
  ['#dcd8f0', '#a893d0', '#5f5378'],
  ['#cfe4e0', '#8bbdb4', '#4d6f6c'],
  ['#f3d3c3', '#cf7f68', '#7a4a41'],
  ['#e6dcef', '#b39ccf', '#6a5a7d'],
  ['#f8dcd0', '#e0999a', '#7d5a63'],
  ['#dfe4f5', '#9aa6cf', '#565d7d'],
];

const blobs = (n, w, h) =>
  Array.from({ length: n }, (_, i) => {
    const cx = 60 + ((i * 197) % (w - 120));
    const cy = 50 + ((i * 313) % (h - 100));
    const r = 60 + ((i * 71) % 130);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#b${i % 3})" opacity="${(0.18 + (i % 4) * 0.07).toFixed(2)}"/>`;
  }).join('\n    ');

function svg(i, w, h) {
  const [c1, c2, c3] = palettes[i % palettes.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="0.55" stop-color="${c2}"/>
      <stop offset="1" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="b0"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="b1"><stop offset="0" stop-color="${c1}" stop-opacity=".9"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
    <radialGradient id="b2"><stop offset="0" stop-color="${c3}" stop-opacity=".8"/><stop offset="1" stop-color="${c3}" stop-opacity="0"/></radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(w / 26)}"/></filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g filter="url(#blur)">
    ${blobs(5, w, h)}
  </g>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.6"/>
  <rect width="${w}" height="${h}" fill="url(#vignette)" opacity="0.35"/>
  <defs>
    <radialGradient id="vignette" cx="0.5" cy="0.46" r="0.76">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".55"/>
    </radialGradient>
  </defs>
</svg>
`;
}

const sizes = [
  [1200, 900],
  [1000, 1250],
  [1200, 900],
  [900, 1200],
  [1200, 900],
  [1000, 1000],
  [1200, 900],
  [1000, 1250],
];

sizes.forEach(([w, h], i) => {
  const name = `p${i + 1}.svg`;
  fs.writeFileSync(path.join(OUT, name), svg(i, w, h), 'utf8');
  console.log('wrote', name, `${w}x${h}`);
});
