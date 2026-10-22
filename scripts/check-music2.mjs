// 真实点击（非 JS 合成）验证：点「进去看看」后音乐是否自动开始
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9555;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-music2';
const APP = process.env.APP_URL || 'http://127.0.0.1:5188/';
fs.rmSync(PROFILE, { recursive: true, force: true });

// 注意：没有加 --autoplay-policy，模拟真实浏览器策略
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
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

async function realClick(selector) {
  const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return false;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  return true;
}

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(2600);

const out = {};
out.gateShown = await ev(`!!document.querySelector('.gate')`);
out.musicMountedBeforeUnlock = await ev(`!!document.querySelector('.music')`);
out.musicHiddenBeforeUnlock = await ev(`document.querySelector('.music')?.classList.contains('is-hidden')`);

// 真实点击输入框 + 真实键入
await realClick('.gate-input');
await sleep(200);
await send('Input.insertText', { text: '20260512' });
await sleep(300);
out.inputValue = await ev(`document.querySelector('.gate-input')?.value`);

// 真实点击「进去看看」
out.clicked = await realClick('.gate-btn');
await sleep(2600);

out.afterUnlock = {
  audioExists: await ev(`!!document.querySelector('audio')`),
  paused: await ev(`document.querySelector('audio')?.paused`),
  currentTime: await ev(`Math.round((document.querySelector('audio')?.currentTime || 0) * 10) / 10`),
  src: await ev(`document.querySelector('audio')?.currentSrc || ''`),
  musicVisible: await ev(`!document.querySelector('.music')?.classList.contains('is-hidden')`),
  className: await ev(`document.querySelector('.music')?.className`),
  title: await ev(`document.querySelector('.music-title')?.textContent`),
};

// 真实点击静音按钮
await realClick('.music-btn');
await sleep(700);
out.afterMute = {
  paused: await ev(`document.querySelector('audio')?.paused`),
  className: await ev(`document.querySelector('.music')?.className`),
  stored: await ev(`localStorage.getItem('our-story:music')`),
};

out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
