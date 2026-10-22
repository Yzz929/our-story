// 只测「相册上传图片 → 云端存储 → 拿到公开 URL」这一段
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9777;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-upload';
const APP = 'http://127.0.0.1:5190';
const MOCK_DATA = 'D:\\DSH\\AI-Projects\\_research\\mock-cloud.json';
const PHOTO = 'D:\\DSH\\AI-Projects\\_research\\test-photo.png';

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
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('DOM.enable');

await send('Page.navigate', { url: APP + '/#/edit' });
await sleep(2200);

// 找「相册」面板里的 file input（相册面板是倒数第二个 panel 区，用 :has 定位）
const found = await ev(`(() => {
  const panels = [...document.querySelectorAll('.panel')];
  const p = panels.find(x => (x.querySelector('.panel-title')?.textContent || '').includes('相册'));
  const input = p?.querySelector('input[type=file]');
  return input ? 'found' : 'missing';
})()`);

const doc = await send('DOM.getDocument', { depth: -1, pierce: true });
// 用 XPath 更稳：找出所有 file input，取相册面板里的那个——这里用 querySelector 定位不到 nodeId，改用 evaluate + DataTransfer 模拟
const injected = await ev(`(async () => {
  const panels = [...document.querySelectorAll('.panel')];
  const p = panels.find(x => (x.querySelector('.panel-title')?.textContent || '').includes('相册'));
  const input = p.querySelector('input[type=file]');
  // fetch 本地文件不行，这里返回 input 的路径提示；真正上传由 CDP 设置文件
  return input ? 'ok' : 'no-input';
})()`);

// 通过 CDP 找到相册面板 input 的 nodeId：用 DOM.querySelectorAll 按属性取所有 file input，再逐个匹配父级文案
const all = await send('DOM.querySelectorAll', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' });
const nodeIds = all.result?.nodeIds ?? [];
let galleryNode = null;
for (const nid of nodeIds) {
  const desc = await send('DOM.describeNode', { nodeId: nid, depth: 6 });
  const html = JSON.stringify(desc.result?.node ?? {});
  if (html.includes('相册')) { galleryNode = nid; break; }
}
if (!galleryNode && nodeIds.length) galleryNode = nodeIds[nodeIds.length - 1];

if (galleryNode) {
  await send('DOM.setFileInputFiles', { nodeId: galleryNode, files: [PHOTO] });
  await sleep(5000);
}

const data = JSON.parse(fs.readFileSync(MOCK_DATA, 'utf8'));
const gallery = data.row.data.gallery;
console.log(JSON.stringify({
  found,
  injected,
  inputCount: nodeIds.length,
  usedNode: galleryNode,
  galleryCount: gallery.length,
  lastSrc: gallery[gallery.length - 1].src,
  isCloud: String(gallery[gallery.length - 1].src).includes('/storage/v1/object/public/photos/'),
}, null, 2));

const last = gallery[gallery.length - 1].src;
if (String(last).startsWith('http')) {
  const r = await fetch(last);
  console.log('GET uploaded url →', r.status, r.headers.get('content-type'));
}
ws.close();
proc.kill();
