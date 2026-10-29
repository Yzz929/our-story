// 生成安卓需要的图标（普通/圆形/自适应前景）和启动图
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const RES = 'android/app/src/main/res';
const TMP = 'D:\\DSH\\AI-Projects\\_research\\android-assets';
fs.mkdirSync(TMP, { recursive: true });

const HEART =
  '<path d="M50 84S16 62 16 40.5C16 29 25 21 35.5 21c6.3 0 11.5 3.3 14.5 8.4C53 24.3 58.2 21 64.5 21 75 21 84 29 84 40.5 84 62 50 84 50 84z" fill="url(#hg)"/>';

const defs =
  '<defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffe6ea"/></linearGradient></defs>';

function page(w, h, body, radius = 0) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}
  .wrap{width:${w}px;height:${h}px;display:grid;place-items:center}
  .plate{width:${w}px;height:${h}px;border-radius:${radius}px;background:linear-gradient(150deg,#d1566d 0%,#b23c53 55%,#8f5c86 100%);display:grid;place-items:center}
  .circle{width:${w}px;height:${h}px;border-radius:50%;background:linear-gradient(150deg,#d1566d 0%,#b23c53 55%,#8f5c86 100%);display:grid;place-items:center}
  svg{width:76%;height:76%}
  .fg svg{width:100%;height:100%;padding:${Math.round(w * 0.18)}px;box-sizing:border-box}
  .splash{width:${w}px;height:${h}px;display:grid;place-items:center;gap:24px;
    background:radial-gradient(60% 45% at 50% 38%, #fdf0f2 0%, #fffaf7 60%, #f7efe9 100%);
    font-family:"Noto Serif SC","Songti SC","SimSun",serif;color:#2b2126;text-align:center}
  .splash .heart{width:${Math.round(Math.min(w, h) * 0.22)}px}
  .splash .name{font-size:${Math.round(Math.min(w, h) * 0.055)}px;letter-spacing:.14em}
  .splash .sub{font-size:${Math.round(Math.min(w, h) * 0.026)}px;color:#9c8c92;letter-spacing:.3em}
  </style></head><body>${body}</body></html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function render(w, h, body, outFile, port, transparent = false) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await renderOnce(w, h, body, outFile, port + attempt * 37, transparent);
    } catch (e) {
      console.log("  retry", attempt, outFile, e.message);
      await sleep(600);
    }
  }
  throw new Error("render 失败: " + outFile);
}

async function renderOnce(w, h, body, outFile, port, transparent = false) {
  const f = path.join(TMP, path.basename(outFile) + '-' + w + 'x' + h + '.html');
  fs.writeFileSync(f, page(w, h, body));
  const profile = path.join(TMP, `p-${port}`);
  fs.rmSync(profile, { recursive: true, force: true });
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`];
  if (transparent) args.push('--default-background-color=00000000');
  args.push('about:blank');
  const proc = spawn(EDGE, args, { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    } catch {}
    await sleep(200);
  }
  if (!target) throw new Error('devtools 未就绪');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await new Promise((r) => (ws.onopen = r));
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file:///' + f.replace(/\\/g, '/') });
  await sleep(700);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(shot.result.data, 'base64'));
  ws.close();
  proc.kill();
  await sleep(150);
}

let port = 9700;
const DENSITIES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

const square = `<div class="plate"><svg viewBox="0 0 100 100">${defs}${HEART}</svg></div>`;
const round = `<div class="circle"><svg viewBox="0 0 100 100">${defs}${HEART}</svg></div>`;
const foreground = `<div class="fg"><svg viewBox="0 0 100 100">${defs}${HEART}</svg></div>`;

for (const [density, size] of DENSITIES) {
  const dir = path.join(RES, `mipmap-${density}`);
  await render(size, size, square, path.join(dir, 'ic_launcher.png'), ++port);
  await render(size, size, round, path.join(dir, 'ic_launcher_round.png'), ++port);
  console.log('icons', density, size);
}

// 启动图：竖屏 1080x1920、横屏 1920x1080，铺到各 drawable 目录
const splashBody = `<div class="splash">
  <div class="heart"><svg viewBox="0 0 100 100">${defs}${HEART}</svg></div>
  <div class="name">我们的小宇宙</div>
  <div class="sub">JUST FOR TWO</div>
</div>`;

const portSplash = path.join(TMP, 'splash-port.png');
const landSplash = path.join(TMP, 'splash-land.png');
await render(1080, 1920, splashBody, portSplash, ++port);
await render(1920, 1080, splashBody, landSplash, ++port);

for (const d of ['', '-port-mdpi', '-port-hdpi', '-port-xhdpi', '-port-xxhdpi', '-port-xxxhdpi']) {
  fs.copyFileSync(portSplash, path.join(RES, `drawable${d}`, 'splash.png'));
}
for (const d of ['-land-mdpi', '-land-hdpi', '-land-xhdpi', '-land-xxhdpi', '-land-xxxhdpi']) {
  fs.copyFileSync(landSplash, path.join(RES, `drawable${d}`, 'splash.png'));
}
console.log('splash done');

// ---- 自适应图标：矢量前景 + 纯色背景 ----
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpi, { recursive: true });
fs.mkdirSync(path.join(RES, 'drawable'), { recursive: true });
fs.mkdirSync(path.join(RES, 'values'), { recursive: true });

const heartPath = 'M50,84 C50,84 16,62 16,40.5 C16,29 25,21 35.5,21 C41.8,21 47,24.3 50,29.4 C53,24.3 58.2,21 64.5,21 C75,21 84,29 84,40.5 C84,62 50,84 50,84 Z';
const fgXml = [
  "<?xml version='1.0' encoding='utf-8'?>",
  "<vector xmlns:android='http://schemas.android.com/apk/res/android'",
  "    android:width='108dp' android:height='108dp'",
  "    android:viewportWidth='100' android:viewportHeight='100'>",
  "    <group android:scaleX='0.62' android:scaleY='0.62' android:pivotX='50' android:pivotY='50'>",
  '        <path android:fillColor="#FFFFFF" android:pathData="' + heartPath + '"/>',
  '    </group>',
  '</vector>',
  ''
].join('\n');
fs.writeFileSync(path.join(RES, 'drawable', 'ic_launcher_foreground.xml'), fgXml);

const bgXml = [
  "<?xml version='1.0' encoding='utf-8'?>",
  '<resources>',
  '    <color name="ic_launcher_background">#B23C53</color>',
  '</resources>',
  ''
].join('\n');
fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'), bgXml);

const adaptiveXml = [
  "<?xml version='1.0' encoding='utf-8'?>",
  "<adaptive-icon xmlns:android='http://schemas.android.com/apk/res/android'>",
  "    <background android:drawable='@color/ic_launcher_background'/>",
  "    <foreground android:drawable='@drawable/ic_launcher_foreground'/>",
  '</adaptive-icon>',
  ''
].join('\n');
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  fs.writeFileSync(path.join(anydpi, name), adaptiveXml);
}
console.log('adaptive icon done');
