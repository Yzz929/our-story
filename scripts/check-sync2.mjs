// 补充验收：断网时刷新页面 → 从本地草稿恢复 → 网络恢复后自动重连并补传
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9888;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-sync2';
const APP = 'http://127.0.0.1:5190/';
const MOCK = 'D:\\DSH\\AI-Projects\\_research\\mock-cloud.json';

fs.rmSync(PROFILE, { recursive: true, force: true });
try { fs.rmSync(MOCK); } catch {}

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
const offline = (on) => send('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const draft = () => ev(`(() => { const d = JSON.parse(localStorage.getItem('our-story:draft') || 'null'); return d ? { dirty: d.dirty, milestones: d.data.milestones.length } : null; })()`);

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(2600);

// 口令
await ev(`(() => { const i = document.querySelector('.gate-input'); if(!i) return; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, (process.env.GATE_PASS || '00000000')); i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.gate-btn').click(); return 'ok'; })()`);
await sleep(2800);

const out = {};

// 编辑器里加一条，等它存好
await ev(`location.hash = '#/edit'`);
await sleep(2000);
await ev(`(() => { const p = [...document.querySelectorAll('.panel')].find(x => x.textContent.includes('点点滴滴')); [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加')).click(); return 'ok'; })()`);
await sleep(3200);
out.step1 = { cloud: JSON.parse(fs.readFileSync(MOCK, 'utf8')).row.data.milestones.length, draft: await draft() };

// 断网，再加一条（会失败）
await offline(true);
await sleep(200);
await ev(`(() => { const p = [...document.querySelectorAll('.panel')].find(x => x.textContent.includes('点点滴滴')); [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加')).click(); return 'ok'; })()`);
await sleep(4000);
out.step2_offline = { label: await ev(`document.querySelector('.panel-title small')?.textContent`), draft: await draft(), cloud: JSON.parse(fs.readFileSync(MOCK, 'utf8')).row.data.milestones.length };

// 断网状态下刷新
await send('Page.reload');
await sleep(4000);
out.step3_offlineReload = {
  url: await ev(`location.hash`),
  bootGone: await ev(`!document.querySelector('.boot')`),
  draft: await draft(),
  editorItems: await ev(`document.querySelectorAll('.editor-item').length`),
  cloudPanel: await ev(`document.querySelector('.panel-title small')?.textContent`),
};

// 恢复网络：应自动重连 + 补传
await offline(false);
await sleep(1000);
await ev(`window.dispatchEvent(new Event('online'))`);
await sleep(6000);
out.step4_online = {
  label: await ev(`document.querySelector('.panel-title small')?.textContent`),
  draft: await draft(),
  cloud: fs.existsSync(MOCK) ? JSON.parse(fs.readFileSync(MOCK, 'utf8')).row.data.milestones.length : 0,
};

console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
