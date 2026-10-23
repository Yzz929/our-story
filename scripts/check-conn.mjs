// 验收连接探测节奏：前 10 秒每秒一次 → 之后 1.5s/4s/9s/20s；连上即停
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9101;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-conn';
const APP = 'http://127.0.0.1:5191/';
const MOCK_PORT = 5198;

fs.rmSync(PROFILE, { recursive: true, force: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });

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
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/rest/v1/site?id=eq.1&select=id')) {
    probes.push({ t: Date.now(), url: m.params.request.url });
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
const t0 = Date.now();
await sleep(12500);

const marks = probes.map((p, i) => ({
  i: i + 1,
  at_ms: p.t - t0,
  gap_ms: i ? p.t - probes[i - 1].t : 0,
}));
const out = { duringDown: { count: marks.length, marks } };

out.offlineUI = {
  gateVisible: await ev(`!!document.querySelector('.gate')`),
  gateNetHint: await ev(`document.querySelector('.gate-net')?.textContent?.trim() || ''`),
};

// 现在把「云端」启动起来，模拟网络恢复
const mock = spawn(process.execPath, ['scripts/mock-cloud.mjs', String(MOCK_PORT)], { stdio: 'ignore' });
await sleep(1500);

// 等自动重连（后续节奏 4s / 9s / 20s，这里最多等 25 秒）
let recovered = false;
for (let i = 0; i < 25; i++) {
  await sleep(1000);
  const ok = await ev(`(() => {
    const net = document.querySelector('.gate-net');
    return !net; // 连上后提示会消失
  })()`);
  if (ok) { recovered = true; break; }
}
out.recovered = recovered;
out.afterOnline = {
  gateGone: await ev(`!document.querySelector('.gate')`),
  gateNetHint: await ev(`document.querySelector('.gate-net')?.textContent?.trim() || '（已消失）'`),
  totalProbes: probes.length,
  lastGap: probes.length > 1 ? probes[probes.length - 1].t - probes[probes.length - 2].t : 0,
};

// 进编辑页看连接状态行
await ev(`(() => { const i = document.querySelector('.gate-input'); if(!i) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '20260512'); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.gate-btn').click(); })()`);
await sleep(2500);
await ev(`location.hash = '#/edit'`);
await sleep(2500);
out.editorConn = await ev(`document.querySelector('.conn-line')?.textContent?.replace(/\\s+/g,' ').trim() || 'none'`);

console.log(JSON.stringify(out, null, 2));
mock.kill();
ws.close();
proc.kill();
