// 真·云端验收：浏览器里读云端 → 加一条回忆 → 换标题 → 上传照片 → 刷新验证 → 记录结果
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9888;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-real';
const APP = 'http://127.0.0.1:5188';
const PHOTO = 'D:\\DSH\\AI-Projects\\_research\\test-photo.png';
const cfg = JSON.parse(fs.readFileSync('src/data/cloud-config.json', 'utf8'));
const BASE = cfg.url.replace(/\/+$/, '');
const H = { apikey: cfg.anonKey };
if (cfg.anonKey.startsWith('eyJ')) H.Authorization = `Bearer ${cfg.anonKey}`;

const readCloud = async () => {
  const r = await fetch(`${BASE}/rest/v1/${cfg.table}?id=eq.1&select=data`, { headers: H });
  const rows = await r.json();
  return rows?.[0]?.data;
};

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
  throw new Error('devtools 未就绪');
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
await send('DOM.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

const out = {};
out.cloudBefore = (await readCloud())?.milestones?.length ?? 'none';

// 1) 手机尺寸打开首页，应直接读到云端内容
await send('Page.navigate', { url: APP + '/' });
await sleep(3000);
out.bootGone = await ev(`!document.querySelector('.boot')`);
out.heroTitle = await ev(`document.querySelector('.hero-title')?.textContent`);
out.timelineCount = await ev(`document.querySelectorAll('.tl-item').length`);

// 2) 进编辑页加一条
await send('Page.navigate', { url: APP + '/#/edit' });
await sleep(2000);
out.cloudPanelText = await ev(`document.querySelector('.panel-title')?.textContent?.trim()`);
await ev(`(() => {
  const p = [...document.querySelectorAll('.panel')].find(x => x.textContent.includes('点点滴滴'));
  const btn = [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加'));
  btn.click(); return 'ok';
})()`);
await sleep(3000);
out.cloudAfterAdd = (await readCloud())?.milestones?.length ?? 'none';

// 3) 上传一张测试照片到相册
const doc = await send('DOM.getDocument', { depth: -1, pierce: true });
const all = await send('DOM.querySelectorAll', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
let galleryNode = null;
for (const nid of all.result.nodeIds) {
  const d = await send('DOM.describeNode', { nodeId: nid, depth: 6 });
  if (JSON.stringify(d.result?.node ?? {}).includes('相册')) { galleryNode = nid; break; }
}
if (!galleryNode && all.result.nodeIds.length) galleryNode = all.result.nodeIds[all.result.nodeIds.length - 1];
if (galleryNode) {
  await send('DOM.setFileInputFiles', { nodeId: galleryNode, files: [PHOTO] });
  await sleep(6000);
}
const afterUpload = await readCloud();
const gallery = afterUpload?.gallery ?? [];
out.cloudGallery = gallery.length;
out.lastPhoto = gallery[gallery.length - 1]?.src ?? 'none';
if (String(out.lastPhoto).startsWith('http')) {
  const r = await fetch(out.lastPhoto);
  out.photoStatus = r.status;
  out.photoType = r.headers.get('content-type');
}

// 4) 刷新首页，确认云端数据在手机上可见
await send('Page.navigate', { url: APP + '/' });
await sleep(3000);
out.timelineAfterReload = await ev(`document.querySelectorAll('.tl-item').length`);
out.errors = errors.slice(0, 5);

console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
