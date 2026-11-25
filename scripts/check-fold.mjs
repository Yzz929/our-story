// 验收：编辑页「点点滴滴」逐条折叠
//  1) 默认全部折叠；2) 点左上角箭头能展开/收起；
//  3) 点「添加」新增的那条自动展开并且光标落在标题；
//  4) 退出编辑页再进来，全部回到折叠状态。
// 为避免污染真实云端数据，这里把 supabase 请求全部掐断（页面走本地数据）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9677;
const PROFILE = 'D:\\AI-projects-DSH\\our-story\\_tmp\\edge-fold';
const APP = process.env.APP_URL || 'http://127.0.0.1:5199/';
const SHOT_DIR = path.resolve('docs/preview');
fs.rmSync(PROFILE, { recursive: true, force: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });

const proc = spawn(
  EDGE,
  ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore' },
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
  throw new Error('devtools 连不上');
}

const ws = new WebSocket((await target()).webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const errors = [];
const blocked = new Set();

ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
    return;
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  }
  // 掐断云端：假离线，避免测试数据写进真实数据库
  if (m.method === 'Fetch.requestPaused') {
    const url = m.params.request?.url || '';
    if (/supabase\.co/.test(url)) blocked.add(url.split('?')[0].slice(0, 80));
    send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'ConnectionRefused' }).catch(() => {});
  }
};

const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, name), Buffer.from(r.result.data, 'base64'));
}

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Fetch.enable', { patterns: [{ urlPattern: '*supabase.co*' }] });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(2500);

const out = {};

// 口令页
out.gate = await ev(`!!document.querySelector('.gate')`);
if (out.gate) {
  await ev(`(() => {
    const i = document.querySelector('.gate-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, ${JSON.stringify(process.env.GATE_PASS || '20260512')});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(200);
  await ev(`document.querySelector('.gate-btn').click()`);
  await sleep(2500);
}
out.unlocked = await ev(`!document.querySelector('.gate') && !!document.querySelector('.hero')`);

// 进编辑页
await ev(`location.hash = '#/edit'`);
await sleep(2200);
out.editor = await ev(`!!document.querySelector('.editor')`);

const panelExpr = `[...document.querySelectorAll('.panel')].find(x => (x.querySelector('.panel-title')?.textContent || '').includes('点点滴滴'))`;

// 1) 默认全折叠
out.defaultState = await ev(`(() => {
  const p = ${panelExpr};
  const items = [...p.querySelectorAll('.editor-item')];
  return {
    count: items.length,
    open: items.filter(x => x.classList.contains('is-open')).length,
    closed: items.filter(x => x.classList.contains('is-closed')).length,
    bodiesZeroHeight: items.every(x => (x.querySelector('.editor-item-body')?.getBoundingClientRect().height ?? 0) < 1),
    heights: items.map(x => Math.round(x.getBoundingClientRect().height)),
    firstFoldBtn: !!items[0]?.querySelector('.fold-btn'),
    foldBtnLeft: Math.round(items[0].querySelector('.fold-btn').getBoundingClientRect().left - items[0].getBoundingClientRect().left),
  };
})()`);

// 2) 展开第一条 / 再收起
out.expand = await ev(`(() => {
  const p = ${panelExpr};
  const first = p.querySelector('.editor-item');
  first.querySelector('.fold-btn').click();
  return 'clicked';
})()`);
await sleep(600);
out.afterExpand = await ev(`(() => {
  const p = ${panelExpr};
  const first = p.querySelector('.editor-item');
  const body = first.querySelector('.editor-item-body');
  return {
    open: first.classList.contains('is-open'),
    bodyHeight: Math.round(body.getBoundingClientRect().height),
    authorPillsVisible: !!first.querySelector('.author-pills button')?.getBoundingClientRect().height,
    ariaExpanded: first.querySelector('.fold-btn')?.getAttribute('aria-expanded'),
  };
})()`);
await shot('20-fold-expanded.png');

await ev(`(() => { const p = ${panelExpr}; p.querySelector('.editor-item .fold-btn').click(); return 'ok'; })()`);
await sleep(500);
out.afterCollapse = await ev(`(() => {
  const p = ${panelExpr};
  const first = p.querySelector('.editor-item');
  return {
    open: first.classList.contains('is-open'),
    bodyHeight: Math.round(first.querySelector('.editor-item-body').getBoundingClientRect().height),
  };
})()`);

// 3) 添加：新增那条要展开 + 光标进标题
out.beforeAdd = await ev(`(() => { const p = ${panelExpr}; return p.querySelectorAll('.editor-item').length; })()`);
await ev(`(() => {
  const p = ${panelExpr};
  [...p.querySelectorAll('button')].find(b => b.textContent.includes('添加')).click();
  return 'ok';
})()`);
await sleep(900);
out.afterAdd = await ev(`(() => {
  const p = ${panelExpr};
  const items = [...p.querySelectorAll('.editor-item')];
  const last = items[items.length - 1];
  const active = document.activeElement;
  return {
    count: items.length,
    lastOpen: last.classList.contains('is-open'),
    lastBodyHeight: Math.round(last.querySelector('.editor-item-body').getBoundingClientRect().height),
    focusedIsTitle: active?.getAttribute('data-field') === 'title',
    focusedValue: active?.value ?? null,
    hasAllCollapseBtn: [...p.querySelectorAll('button')].some(b => b.textContent.includes('全部收起')),
  };
})()`);
await shot('21-fold-new-expanded.png');

// 4) 退出编辑页再进来 → 全部折叠
await ev(`location.hash = '#/'`);
await sleep(1800);
out.backHome = await ev(`!!document.querySelector('.hero') && !document.querySelector('.editor')`);
await ev(`location.hash = '#/edit'`);
await sleep(1800);
out.afterReenter = await ev(`(() => {
  const p = ${panelExpr};
  const items = [...p.querySelectorAll('.editor-item')];
  return {
    count: items.length,
    open: items.filter(x => x.classList.contains('is-open')).length,
    allClosed: items.every(x => x.classList.contains('is-closed')),
    totalHeight: Math.round(items.reduce((s, x) => s + x.getBoundingClientRect().height, 0)),
  };
})()`);
await shot('22-fold-collapsed.png');

// 桌面宽度也看一眼布局
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await sleep(500);
await ev(`(() => {
  const p = ${panelExpr};
  const top = p.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({ top, behavior: 'instant' });
  return 'ok';
})()`);
await sleep(900);
out.desktop = await ev(`(() => {
  const p = ${panelExpr};
  const items = [...p.querySelectorAll('.editor-item')];
  const first = items[0];
  const head = first.querySelector('.editor-item-head');
  return {
    count: items.length,
    itemHeight: Math.round(first.getBoundingClientRect().height),
    iconsVisible: [...head.querySelectorAll('.icon-btn')].filter(b => b.getBoundingClientRect().width > 0).length,
    dateVisible: !!first.querySelector('.ms-sub time')?.getBoundingClientRect().width,
    totalHeight: Math.round(items.reduce((s, x) => s + x.getBoundingClientRect().height, 0)),
  };
})()`);
await shot('23-fold-desktop.png');

out.blockedHosts = [...blocked].slice(0, 3);
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
