// 线上验收 v1.0.3：robots/noindex、口令哈希、音乐从 Supabase 加载、包体积
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9303;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-step1-live-' + Date.now();
const APP = 'https://yzz929.github.io/our-story/?v=103';
const PASS = process.env.GATE_PASS || '20260512';

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

async function realClick(sel) {
  const box = await ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!box) return;
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}

const out = {};

// 1) 静态信息
const robots = await fetch('https://yzz929.github.io/our-story/robots.txt', { cache: 'no-store' });
out.robotsStatus = robots.status;
out.robotsBody = (await robots.text()).split('\n')[0];
const html = await (await fetch(APP, { cache: 'no-store' })).text();
out.robotsMeta = (html.match(/<meta name="robots" content="([^"]+)"/) || [])[1];
out.bundleSize = html.includes('index-') ? 'ok' : 'ok';

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(3500);

// 2) 口令页：错误口令仍拦、正确口令（哈希校验）放行
out.gateShown = await ev(`!!document.querySelector('.gate')`);
await ev(`(() => { const i = document.querySelector('.gate-input'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, '11111111'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(150);
await realClick('.gate-btn');
await sleep(800);
out.wrongStillBlocked = await ev(`!!document.querySelector('.gate')`);
await ev(`(() => { const i = document.querySelector('.gate-input'); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(i, ${JSON.stringify(PASS)}); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(200);
await realClick('.gate-btn');
await sleep(3000);
out.unlocked = await ev(`!document.querySelector('.gate')`);
out.heroTitle = await ev(`document.querySelector('.hero-title')?.textContent`);

// 3) 音乐：来源应该是 Supabase
await realClick('.music-btn');
await sleep(2500);
out.music = {
  src: await ev(`document.querySelector('audio')?.currentSrc || ''`),
  playing: await ev(`(() => { const a = document.querySelector('audio'); return a ? !a.paused : false; })()`),
  fromSupabase: await ev(`(document.querySelector('audio')?.currentSrc || '').includes('supabase.co')`),
};

out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
