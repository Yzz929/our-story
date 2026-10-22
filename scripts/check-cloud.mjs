// 云端链路自测：加载 → 编辑 → 自动保存到云端 → 刷新仍在 → 上传图片
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9666;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-cloud';
const APP = 'http://127.0.0.1:5190';
const MOCK_DATA = 'D:\\DSH\\AI-Projects\\_research\\mock-cloud.json';
const PHOTO = 'D:\\DSH\\AI-Projects\\our-story\\public\\photos\\p1.svg';

fs.rmSync(PROFILE, { recursive: true, force: true });
try {
  fs.rmSync(MOCK_DATA);
} catch {}

const proc = spawn(
  EDGE,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore' }
);
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
  throw new Error('devtools 未就绪');
}

const ws = new WebSocket((await target()).webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return 'ERR:' + r.result.exceptionDetails.text;
  return r.result?.result?.value;
};
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const out = {};

// 1) 首页（云端还没有数据，应回落到本地示例）
await send('Page.navigate', { url: APP + '/' });
await sleep(2600);
out.bootGone = await ev(`!document.querySelector('.boot')`);
out.homeTitle = await ev(`document.querySelector('.hero-title')?.textContent`);
out.homeMilestones = await ev(`document.querySelectorAll('.tl-item').length`);

// 2) 进编辑页，确认云端模式文案
await send('Page.navigate', { url: APP + '/#/edit' });
await sleep(2000);
out.editorLoaded = await ev(`!!document.querySelector('.editor')`);
out.cloudPanel = await ev(`[...document.querySelectorAll('.panel-title')].map(e=>e.textContent.trim()).find(t=>t.includes('云端')) || 'no-cloud-panel'`);

// 3) 添加一条回忆，等自动同步
out.before = await ev(`document.querySelectorAll('.editor-item').length`);
out.clicked = await ev(`(() => {
  const p = [...document.querySelectorAll('.panel')].find(x => x.textContent.includes('点点滴滴'));
  const btn = [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加'));
  btn.click(); return 'ok';
})()`);
await sleep(3200);

const mockRaw = fs.existsSync(MOCK_DATA) ? JSON.parse(fs.readFileSync(MOCK_DATA, 'utf8')) : null;
out.cloudRowSaved = Boolean(mockRaw?.row?.data);
out.cloudMilestones = mockRaw?.row?.data?.milestones?.length ?? 0;
out.cloudTitle = mockRaw?.row?.data?.couple?.titleTemplate ?? '';

// 4) 刷新后首页应读到云端的 6 条
await send('Page.navigate', { url: APP + '/' });
await sleep(2800);
out.homeMilestonesAfterCloud = await ev(`document.querySelectorAll('.tl-item').length`);
out.homeTitleAfterCloud = await ev(`document.querySelector('.hero-title')?.textContent`);

// 5) 上传一张图片到相册
await send('Page.navigate', { url: APP + '/#/edit' });
await sleep(1800);
const doc = await send('DOM.getDocument', { depth: -1, pierce: true });
const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file][accept="image/*"]' });
out.fileInputFound = Boolean(q.result?.nodeId);
if (q.result?.nodeId) {
  await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files: [PHOTO] });
  await sleep(4000);
}
const afterUpload = fs.existsSync(MOCK_DATA) ? JSON.parse(fs.readFileSync(MOCK_DATA, 'utf8')) : null;
const gallery = afterUpload?.row?.data?.gallery ?? [];
out.cloudGalleryCount = gallery.length;
out.uploadedUrl = gallery[gallery.length - 1]?.src ?? 'none';
out.uploadedIsCloudUrl = String(out.uploadedUrl).includes('127.0.0.1:5199/storage');
if (out.uploadedIsCloudUrl) {
  const r = await fetch(out.uploadedUrl);
  out.uploadedFetchStatus = r.status;
}
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
