// 回归测试：过口令后滚动，所有区块必须真的显示出来
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9222;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-fix';
const APP = process.env.APP_URL || 'http://127.0.0.1:5188/';
const W = Number(process.env.VW || 1440);
const H = Number(process.env.VH || 900);

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
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 800 });
await send('Page.navigate', { url: APP });
await sleep(2500);

const out = { app: APP, viewport: `${W}x${H}` };
out.gateShown = await ev(`!!document.querySelector('.gate')`);
await ev(`(() => {
  const i = document.querySelector('.gate-input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, '20260512');
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`);
await sleep(200);
await ev(`document.querySelector('.gate-btn').click()`);
await sleep(2200);

out.afterUnlock = {
  hero: await ev(`!!document.querySelector('.hero')`),
  revealTotal: await ev(`document.querySelectorAll('[data-reveal]').length`),
  revealHiddenInView: await ev(`(() => {
    const vh = innerHeight;
    return [...document.querySelectorAll('[data-reveal]:not(.is-in)')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < vh;
    }).length;
  })()`),
};

// 逐段滚动，模拟用户往下拉
await ev(`(async () => {
  const step = Math.round(innerHeight * 0.75);
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 320));
  }
  await new Promise(r => setTimeout(r, 900));
  return 'scrolled';
})()`);

out.afterScroll = {
  revealStillHidden: await ev(`document.querySelectorAll('[data-reveal]:not(.is-in)').length`),
  timelineVisible: await ev(`(() => { const els = [...document.querySelectorAll('.tl-card')]; return els.length ? els.every(e => getComputedStyle(e.closest('[data-reveal]') || e).opacity === '1') : false; })()`),
  galleryVisible: await ev(`(() => { const els = [...document.querySelectorAll('.gal-item')]; return els.length ? els.every(e => getComputedStyle(e).opacity === '1') : false; })()`),
  annivVisible: await ev(`(() => { const els = [...document.querySelectorAll('.anniv')]; return els.length ? els.every(e => getComputedStyle(e).opacity === '1') : false; })()`),
  sectionTitlesVisible: await ev(`[...document.querySelectorAll('.section-title')].map(e => ({ t: e.textContent, o: getComputedStyle(e.closest('[data-reveal]') || e).opacity }))`),
};
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();

