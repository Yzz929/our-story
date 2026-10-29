// 线上确认 v1.0.2：编辑页出现连接状态行，且探测请求节奏正确
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9202;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-live-conn';
const APP = 'https://yzz929.github.io/our-story/?v=102';

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
const probes = [];
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Network.requestWillBeSent' && /\/rest\/v1\/site\?id=eq\.1&select=id/.test(m.params.request.url) && m.params.request.method === 'GET') {
    probes.push(Date.now());
  }
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(5000);

const out = {};
out.probeCount = probes.length; // 连上之后应该只有 1 次
out.gateNet = await ev(`document.querySelector('.gate-net')?.textContent?.trim() || '（无，说明已连上）'`);

await ev(`(() => { const i = document.querySelector('.gate-input'); if(!i) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, (process.env.GATE_PASS || '00000000')); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.gate-btn').click(); })()`);
await sleep(3000);
await ev(`location.hash = '#/edit'`);
await sleep(2600);

out.editor = {
  loaded: await ev(`!!document.querySelector('.editor')`),
  conn: await ev(`document.querySelector('.conn-line')?.textContent?.replace(/\\s+/g,' ').trim() || 'none'`),
  sync: await ev(`[...document.querySelectorAll('.panel-title')].map(e=>e.textContent.trim()).find(t=>t.includes('云端'))`),
  buttons: await ev(`[...document.querySelectorAll('.panel-actions button')].map(b=>b.textContent.trim()).join(' / ')`),
};
out.errors = errors.slice(0, 5);

const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:\\DSH\\AI-Projects\\our-story\\docs\\preview\\22-live-conn.png', Buffer.from(shot.result.data, 'base64'));
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
