// 验收：进入后自动随机播放、静音按钮、手机端侧边跳转、手机端横排
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9444;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-music';
const APP = process.env.APP_URL || 'http://127.0.0.1:5188/';
fs.rmSync(PROFILE, { recursive: true, force: true });

const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required',
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
await sleep(2500);

// 过口令
if (await ev(`!!document.querySelector('.gate')`)) {
  await ev(`(() => {
    const i = document.querySelector('.gate-input');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(i, '20260512');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(200);
  await ev(`document.querySelector('.gate-btn').click()`);
  await sleep(3000);
}

const out = {};
out.musicButton = await ev(`!!document.querySelector('.music-btn')`);
out.audioPlaying = await ev(`(() => { const a = document.querySelector('audio'); return a ? (!a.paused && a.currentTime >= 0) : 'no-audio'; })()`);
out.audioSrc = await ev(`document.querySelector('audio')?.getAttribute('src') || document.querySelector('audio')?.currentSrc || ''`);
out.trackTitle = await ev(`document.querySelector('.music-title')?.textContent`);
out.iconState = await ev(`document.querySelector('.music')?.className`);
out.volume = await ev(`document.querySelector('audio')?.volume`);

// 点一下 = 静音
await ev(`document.querySelector('.music-btn').click()`);
await sleep(700);
out.afterMute = {
  paused: await ev(`document.querySelector('audio')?.paused`),
  className: await ev(`document.querySelector('.music')?.className`),
  stored: await ev(`localStorage.getItem('our-story:music')`),
};
// 再点 = 恢复
await ev(`document.querySelector('.music-btn').click()`);
await sleep(900);
out.afterResume = {
  paused: await ev(`document.querySelector('audio')?.paused`),
  className: await ev(`document.querySelector('.music')?.className`),
  stored: await ev(`localStorage.getItem('our-story:music')`),
};

// 手机端侧边栏
out.sideRail = await ev(`(() => {
  const rail = document.querySelector('.side-rail');
  if (!rail) return 'missing';
  const cs = getComputedStyle(rail);
  return { display: cs.display, buttons: rail.querySelectorAll('a').length, visible: cs.display !== 'none' };
})()`);
out.coupleRow = await ev(`(() => {
  const boy = document.querySelector('.person-boy')?.getBoundingClientRect();
  const girl = document.querySelector('.person-girl')?.getBoundingClientRect();
  const heart = document.querySelector('.heart-badge')?.getBoundingClientRect();
  if (!boy || !girl || !heart) return 'missing';
  return { sameRow: Math.abs(boy.top - girl.top) < 30 && boy.right < girl.left, boyLeft: Math.round(boy.left), girlRight: Math.round(girl.right), heartCenter: Math.round(heart.left + heart.width / 2) };
})()`);

// 点侧边栏第一个图标应该跳到点点滴滴
await ev(`document.querySelectorAll('.side-rail a')[1].click()`);
await sleep(1600);
out.afterRailClick = await ev(`(() => {
  const g = document.getElementById('gallery');
  const r = g.getBoundingClientRect();
  return { scrollY: Math.round(scrollY), galleryTop: Math.round(r.top), nearTop: r.top < innerHeight * 0.6 };
})()`);
out.activeRail = await ev(`[...document.querySelectorAll('.side-rail a')].findIndex(a => a.classList.contains('is-active'))`);
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 2));
ws.close();
proc.kill();
