// 线上验收：编辑页标作者 → 首页卡片出现 @名字；侧栏不挤占布局
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9666;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-author';
const APP = process.env.APP_URL || 'https://yzz929.github.io/our-story/?v=5';
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
const errors = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await new Promise((r) => (ws.onopen = r));
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url: APP });
await sleep(3200);

const out = {};

// 1) 口令
if (await ev(`!!document.querySelector('.gate')`)) {
  await ev(`(() => {
    const i = document.querySelector('.gate-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, (process.env.GATE_PASS || '00000000'));
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(250);
  await ev(`document.querySelector('.gate-btn').click()`);
  await sleep(2800);
}

// 2) 侧栏几何：是否还挤占布局
out.layout = await ev(`(() => {
  const rail = document.querySelector('.side-rail');
  const plate = document.querySelector('.hero-plate');
  const sub = document.querySelector('.hero-sub');
  if (!rail || !plate || !sub) return 'missing';
  const r = rail.getBoundingClientRect();
  const p = plate.getBoundingClientRect();
  const s = sub.getBoundingClientRect();
  return {
    railRight: Math.round(r.right),
    railWidth: Math.round(r.width),
    plateLeft: Math.round(p.left),
    textLeft: Math.round(s.left),
    bodyPaddingLeft: getComputedStyle(document.body).paddingLeft,
    railBg: getComputedStyle(rail).backgroundColor,
    railOpacity: getComputedStyle(rail).opacity,
    textCovered: r.right > s.left,
  };
})()`);

// 3) 编辑页：把第一条记录标成小A
await ev(`location.hash = '#/edit'`);
await sleep(2200);
out.editorLoaded = await ev(`!!document.querySelector('.editor')`);
out.mePills = await ev(`document.querySelectorAll('.me-row .author-pills button').length`);

// 点「我是」里的第一个（小A）
await ev(`(() => { const b = document.querySelectorAll('.me-row .author-pills button')[0]; b.click(); return 'ok'; })()`);
await sleep(600);
out.meStored = await ev(`localStorage.getItem('our-story:me')`);

// 第一条记录里点「小A」作为作者
out.setAuthor = await ev(`(() => {
  const panels = [...document.querySelectorAll('.panel')];
  const p = panels.find(x => (x.querySelector('.panel-title')?.textContent || '').includes('点点滴滴'));
  const first = p.querySelector('.editor-item');
  const pills = [...first.querySelectorAll('.author-pills button')];
  if (!pills.length) return 'no-pills';
  const boyPill = pills.find(b => b.textContent.trim() === '小A') || pills[0];
  boyPill.click();
  return boyPill.textContent.trim();
})()`);
out.pillActive = await ev(`(() => {
  const panels = [...document.querySelectorAll('.panel')];
  const p = panels.find(x => (x.querySelector('.panel-title')?.textContent || '').includes('点点滴滴'));
  const first = p.querySelector('.editor-item');
  return [...first.querySelectorAll('.author-pills button')].map(b => b.textContent.trim() + ':' + b.classList.contains('on')).join(' ');
})()`);

// 等云端自动保存
await sleep(4200);

// 4) 回首页看徽章
await ev(`location.hash = '#/'`);
await sleep(2600);
await ev(`document.getElementById('moments').scrollIntoView()`);
await sleep(1200);
out.badge = await ev(`(() => {
  const first = document.querySelector('.tl-item');
  const a = first?.querySelector('.tl-author');
  return a ? { text: a.textContent.trim(), className: a.className, color: getComputedStyle(a).color } : 'none';
})()`);
out.badgeCount = await ev(`document.querySelectorAll('.tl-author').length`);

// 5) 截图时间轴
const shot = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:\\DSH\\AI-Projects\\our-story\\docs\\preview\\19-live-author.png', Buffer.from(shot.result.data, 'base64'));

out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
