// 口令页验收：错误口令 → 仍需口令；正确口令 → 进入站点；刷新不再询问
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9111;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-gate';
const APP = 'http://127.0.0.1:5188/';

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
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(2500);

const out = {};
out.gateVisible = await ev(`!!document.querySelector('.gate')`);
out.gateTitle = await ev(`document.querySelector('.gate-title')?.textContent`);
out.hint = await ev(`document.querySelector('.gate-hint')?.textContent`);
out.heroHidden = await ev(`!document.querySelector('.hero')`);
out.storageBefore = await ev(`localStorage.getItem('our-story:gate')`);

await ev(`(() => {
  const i = document.querySelector('.gate-input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, '11111111');
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed-wrong';
})()`);
await sleep(300);
await ev(`document.querySelector('.gate-btn').click()`);
await sleep(800);
out.afterWrong = {
  stillGate: await ev(`!!document.querySelector('.gate')`),
  errorShown: await ev(`document.querySelector('.gate-error')?.classList.contains('show')`),
  errorText: await ev(`document.querySelector('.gate-error')?.textContent`),
};

await ev(`(() => {
  const i = document.querySelector('.gate-input');
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  set.call(i, '20260512');
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return 'typed-right';
})()`);
await sleep(300);
await ev(`document.querySelector('.gate-btn').click()`);
await sleep(2200);
out.afterRight = {
  gateGone: await ev(`!document.querySelector('.gate')`),
  heroVisible: await ev(`!!document.querySelector('.hero')`),
  title: await ev(`document.querySelector('.hero-title')?.textContent`),
  stored: await ev(`localStorage.getItem('our-story:gate')`),
};

// 刷新后应直接进站，不再问口令
await send('Page.reload');
await sleep(2500);
out.afterReload = {
  gateGone: await ev(`!document.querySelector('.gate')`),
  heroVisible: await ev(`!!document.querySelector('.hero')`),
  timeline: await ev(`document.querySelectorAll('.tl-item').length`),
};
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
