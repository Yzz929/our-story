// 用无头 Edge + CDP 把 HTML 渲染成各个尺寸的 App 图标 PNG
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = 'public/icons';
const TMP = 'D:\\DSH\\AI-Projects\\_research\\icon-tmp';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

function html(size, padding) {
  const inner = Math.round(size * (1 - padding * 2));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${size}px;height:${size}px;overflow:hidden}
  body{display:grid;place-items:center;background:linear-gradient(150deg,#d1566d 0%,#b23c53 55%,#8f5c86 100%)}
  .box{width:${inner}px;height:${inner}px;display:grid;place-items:center}
  svg{width:100%;height:100%}
  </style></head><body><div class="box">
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#ffe6ea"/>
    </linearGradient></defs>
    <path d="M50 84S16 62 16 40.5C16 29 25 21 35.5 21c6.3 0 11.5 3.3 14.5 8.4C53 24.3 58.2 21 64.5 21 75 21 84 29 84 40.5 84 62 50 84 50 84z" fill="url(#g)"/>
  </svg></div></body></html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function render(size, padding, outFile, port) {
  const htmlFile = path.join(TMP, `icon-${size}-${Math.round(padding * 100)}.html`);
  fs.writeFileSync(htmlFile, html(size, padding));
  const profile = path.join(TMP, `profile-${port}`);
  fs.rmSync(profile, { recursive: true, force: true });

  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' });

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
  await send('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') });
  await sleep(900);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outFile, Buffer.from(shot.result.data, 'base64'));
  ws.close();
  proc.kill();
}

const jobs = [
  [192, 0, 'icon-192.png'],
  [512, 0, 'icon-512.png'],
  [512, 0.1, 'icon-maskable-512.png'],
  [180, 0, 'apple-touch-icon.png'],
  [1024, 0, 'icon-1024.png'],
];

let port = 9600;
for (const [size, pad, name] of jobs) {
  port += 1;
  const out = path.join(OUT, name);
  await render(size, pad, out, port);
  console.log('wrote', out, fs.statSync(out).size + ' bytes');
}
