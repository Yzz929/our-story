// 截图用：过口令 → 用真实点击开启音乐 → 滚到指定位置 → 截图
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = Number(process.env.CDP_PORT || 9777);
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-final';
const APP = process.env.APP_URL || 'http://127.0.0.1:5188/';
const W = Number(process.env.VW || 390);
const H = Number(process.env.VH || 844);
const SCROLL = Number(process.env.SCROLL || 0);
const OUT = process.env.OUT || 'D:\\DSH\\AI-Projects\\_research\\shots\\final.png';
const PASSWORD = process.env.PASS || (process.env.GATE_PASS || '00000000');

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

async function realClick(sel) {
  const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: W < 800 ? 2 : 1, mobile: W < 800 });
await send('Page.navigate', { url: APP });
await sleep(2600);

if (await ev(`!!document.querySelector('.gate')`)) {
  await ev(`(() => {
    const i = document.querySelector('.gate-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(PASSWORD)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(250);
  await ev(`document.querySelector('.gate-btn').click()`);
  await sleep(2800);
  // 真实点一下音乐按钮，确保截图里是「正在播放」状态
  await realClick('.music-btn');
  await sleep(1200);
}

if (SCROLL > 0) {
  await ev(`(async () => {
    for (let y = 0; y <= ${SCROLL}; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 240)); }
    window.scrollTo(0, ${SCROLL});
    await new Promise(r => setTimeout(r, 1000));
    return 'ok';
  })()`);
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
console.log('saved', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
ws.close();
proc.kill();
