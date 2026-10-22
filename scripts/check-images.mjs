// 检查线上图片：滚动到底后是否全部加载
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const SITE = 'https://yzz929.github.io/our-story/';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9991;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-live2';
fs.rmSync(PROFILE, { recursive: true, force: true });

const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) return p;
    } catch {}
    await sleep(200);
  }
  throw new Error('no devtools');
}
const ws = new WebSocket((await target()).webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: SITE });
await sleep(3500);

// 逐段滚到底，让懒加载图片都出来
await ev(`(async () => {
  const h = document.body.scrollHeight;
  for (let y = 0; y <= h; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); }
  window.scrollTo(0, h);
  await new Promise(r => setTimeout(r, 1200));
  return 'done';
})()`);

const report = await ev(`(() => {
  const imgs = [...document.images];
  const bad = imgs.filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.currentSrc || i.src);
  return { total: imgs.length, badCount: bad.length, bad: bad.slice(0, 5) };
})()`);
console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
