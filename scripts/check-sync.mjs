// 同步健壮性验收：断网失败 → 本地草稿 → 恢复网络自动补传
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9777;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-sync';
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
const offline = (on) => send('Network.emulateNetworkConditions', {
  offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(2600);

const out = {};

// 过口令
if (await ev(`!!document.querySelector('.gate')`)) {
  await ev(`(() => {
    const i = document.querySelector('.gate-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, (process.env.GATE_PASS || '00000000'));
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(200);
  await ev(`document.querySelector('.gate-btn').click()`);
  await sleep(2600);
}

// 先手动写一次，让云端有基线
await ev(`location.hash = '#/edit'`);
await sleep(2000);
await ev(`(() => {
  const p = [...document.querySelectorAll('.panel')].find(x => (x.textContent || '').includes('点点滴滴'));
  const btn = [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加'));
  btn.click(); return 'ok';
})()`);
await sleep(3000);
out.baseline = { cloudRows: fs.existsSync(MOCK) ? JSON.parse(fs.readFileSync(MOCK, 'utf8')).row.data.milestones.length : 0 };
out.savedLabel = await ev(`document.querySelector('.panel-title small')?.textContent`);

// ---- 断网 ----
await offline(true);
await sleep(300);
await ev(`(() => {
  const p = [...document.querySelectorAll('.panel')].find(x => (x.textContent || '').includes('点点滴滴'));
  const btn = [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加'));
  btn.click(); return 'ok';
})()`);
await sleep(4500);
out.offlineState = {
  label: await ev(`document.querySelector('.panel-title small')?.textContent`),
  errorText: await ev(`document.querySelector('.hint.sync-error')?.textContent || ''`),
  retryBtn: await ev(`[...document.querySelectorAll('.panel-actions button')].map(b => b.textContent.trim()).join(',')`),
  draftDirty: await ev(`(() => { const d = JSON.parse(localStorage.getItem('our-story:draft') || 'null'); return d ? d.dirty : 'no-draft'; })()`),
  draftCount: await ev(`(() => { const d = JSON.parse(localStorage.getItem('our-story:draft') || 'null'); return d ? d.data.milestones.length : 0; })()`),
  cloudCount: fs.existsSync(MOCK) ? JSON.parse(fs.readFileSync(MOCK, 'utf8')).row.data.milestones.length : 0,
};

// 断网时刷新：应能从本地草稿恢复（不丢）
await send('Page.reload');
await sleep(3500);
out.afterOfflineReload = {
  bootGone: await ev(`!document.querySelector('.boot')`),
  homeCount: await ev(`document.querySelectorAll('.tl-item').length`),
  draftDirty: await ev(`(() => { const d = JSON.parse(localStorage.getItem('our-story:draft') || 'null'); return d ? d.dirty : 'no-draft'; })()`),
};

// ---- 恢复网络 ----
await offline(false);
await sleep(500);
// 回到编辑页，等待自动补传
await ev(`location.hash = '#/edit'`);
await sleep(5000);
out.afterOnline = {
  label: await ev(`document.querySelector('.panel-title small')?.textContent`),
  draftDirty: await ev(`(() => { const d = JSON.parse(localStorage.getItem('our-story:draft') || 'null'); return d ? d.dirty : 'no-draft'; })()`),
  cloudCount: fs.existsSync(MOCK) ? JSON.parse(fs.readFileSync(MOCK, 'utf8')).row.data.milestones.length : 0,
};

// 手动点「网络诊断」
await ev(`(() => { const b = [...document.querySelectorAll('.panel-actions button')].find(x => x.textContent.includes('诊断')); b && b.click(); return 'ok'; })()`);
await sleep(2500);
out.probe = await ev(`[...document.querySelectorAll('.panel .hint')].map(e => e.textContent).find(t => t.includes('诊断')) || 'none'`);

console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
