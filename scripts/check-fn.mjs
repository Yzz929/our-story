// 功能自测：编辑页添加节点 → 自动保存 → 刷新后仍在
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9555;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-fn';
const BASE = 'http://127.0.0.1:5188';

fs.rmSync(PROFILE, { recursive: true, force: true });
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
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description ?? ''));
};
const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

const report = {};

await send('Page.navigate', { url: BASE + '/' });
await sleep(2200);
report.homeMilestones = await evaluate(`document.querySelectorAll('.tl-item').length`);
report.homeStats = await evaluate(`[...document.querySelectorAll('.hero-stat b')].map(e=>e.textContent).join('/')`);

// 进编辑页
await send('Page.navigate', { url: BASE + '/#/edit' });
await sleep(1800);
report.editorLoaded = await evaluate(`!!document.querySelector('.editor')`);
report.before = await evaluate(`document.querySelectorAll('.editor-item').length`);

// 点「点点滴滴」面板里的「添加」
report.added = await evaluate(`(() => {
  const panels = [...document.querySelectorAll('.panel')];
  const p = panels.find(x => (x.querySelector('.panel-title')?.textContent || '').includes('点点滴滴'));
  const btn = [...p.querySelectorAll('button')].find(b => b.textContent.trim().includes('添加'));
  if (!btn) return 'no-btn';
  btn.click();
  return 'clicked';
})()`);
await sleep(900);
report.after = await evaluate(`document.querySelectorAll('.editor-item').length`);

// 等自动保存后读 localStorage
await sleep(800);
report.savedKeys = await evaluate(`localStorage.getItem('our-story:data:v1') ? JSON.parse(localStorage.getItem('our-story:data:v1')).milestones.length : 'none'`);

// 刷新验证持久化
await send('Page.reload');
await sleep(2000);
report.afterReload = await evaluate(`document.querySelectorAll('.editor-item').length`);

// 回到首页确认新增节点出现在时间轴
await send('Page.navigate', { url: BASE + '/' });
await sleep(2000);
report.timelineAfterReload = await evaluate(`document.querySelectorAll('.tl-item').length`);

// 深色切换 + 相册点击
report.themeToggle = await evaluate(`(() => {
  const btn = document.querySelector('.icon-btn');
  const before = document.documentElement.dataset.theme;
  btn.click();
  const after = document.documentElement.dataset.theme;
  return before + '->' + after;
})()`);
await sleep(400);
report.themePersisted = await evaluate(`localStorage.getItem('our-story:theme')`);

report.galleryOpen = await evaluate(`(() => {
  const item = document.querySelector('.gal-item');
  if (!item) return 'no-gallery';
  item.click();
  return document.querySelector('.lightbox') ? 'lightbox-open' : 'no-lightbox';
})()`);
await sleep(300);
report.lightboxCaption = await evaluate(`document.querySelector('.lightbox figcaption')?.textContent || ''`);
report.errors = errors.slice(0, 5);

console.log(JSON.stringify(report, null, 2));
ws.close();
proc.kill();
