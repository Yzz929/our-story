// 过口令后截图（用于验证动画/区块是否真的显示）
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-shot-unlock';
const APP = process.env.APP_URL || 'http://127.0.0.1:5188/';
const W = Number(process.env.VW || 1440);
const H = Number(process.env.VH || 900);
const SCROLL = Number(process.env.SCROLL || 1000);
const OUT = process.env.OUT || 'D:\\DSH\\AI-Projects\\_research\\shots\\unlocked.png';

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
  throw new Error('devtools');
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
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: W < 800 ? 2 : 1, mobile: W < 800 });
await send('Page.navigate', { url: APP });
await sleep(2500);

// 有口令页就先解锁
if (await ev(`!!document.querySelector('.gate')`)) {
  await ev(`(() => {
    const i = document.querySelector('.gate-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, '20260512');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(200);
  await ev(`document.querySelector('.gate-btn').click()`);
  await sleep(2500);
}

// 平滑滚到目标位置，让动画走完
await ev(`(async () => {
  const target = ${SCROLL};
  for (let y = 0; y <= target; y += 400) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 260));
  }
  window.scrollTo(0, target);
  await new Promise(r => setTimeout(r, 1200));
  return 'ok';
})()`);

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
console.log('saved', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
ws.close();
proc.kill();
