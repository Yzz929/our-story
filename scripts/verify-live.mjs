// 验收线上 GitHub Pages 站点：首页、资源、图片、云端数据
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const SITE = 'https://yzz929.github.io/our-story/';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9999;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-live';

const html = await (await fetch(SITE)).text();
console.log('首页:', html.length, 'bytes |', (html.match(/<title>([^<]+)/) || [])[1]);
const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
console.log('引用资源:', assets.join(' '));
for (const a of assets) {
  const r = await fetch(new URL(a.replace('./', ''), SITE));
  console.log('  ', a, '→', r.status, r.headers.get('content-type'));
}
const photo = await fetch(SITE + 'photos/p1.svg');
console.log('照片 p1.svg:', photo.status, photo.headers.get('content-type'));

// 用无头浏览器验证线上页面真的渲染出来、并且读到云端数据
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
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: SITE });
await sleep(4500);

console.log('\n--- 线上页面 ---');
console.log('boot 消失:', await ev(`!document.querySelector('.boot')`));
console.log('标题:', await ev(`document.querySelector('.hero-title')?.textContent`));
console.log('第几天:', await ev(`document.querySelector('.counter-foot')?.textContent`));
console.log('时间轴条数:', await ev(`document.querySelectorAll('.tl-item').length`));
console.log('相册张数:', await ev(`document.querySelectorAll('.gal-item').length`));
console.log('纪念日卡片:', await ev(`document.querySelectorAll('.anniv').length`));
console.log('图片全部加载成功:', await ev(`[...document.images].every(i => i.complete && i.naturalWidth > 0)`));
console.log('编辑页可达:', await ev(`(async () => { location.hash = '#/edit'; await new Promise(r=>setTimeout(r,1500)); const t = document.querySelector('.editor-title')?.textContent; return t || 'no'; })()`));
console.log('JS 报错:', errors.length ? errors.slice(0, 3) : '无');

ws.close();
proc.kill();
