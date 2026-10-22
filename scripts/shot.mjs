// 用 DevTools 协议截图：真实设备尺寸模拟 + 全页截图 + 深色模式
// 用法: node scripts/shot.mjs <url> <width> <height> <out.png> [--dark] [--full] [--scroll=Y]
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9444;
const PROFILE = 'D:\\DSH\\AI-Projects\\_research\\edge-cdp-shot';

const [url, w, h, out] = process.argv.slice(2, 6);
const flags = process.argv.slice(6);
const dark = flags.includes('--dark');
const full = flags.includes('--full');
const dsf = Number((flags.find((f) => f.startsWith('--dsf=')) ?? '').split('=')[1] ?? 2);
const scroll = Number((flags.find((f) => f.startsWith('--scroll=')) ?? '').split('=')[1] ?? 0);

fs.rmSync(PROFILE, { recursive: true, force: true });

const proc = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* wait */
    }
    await sleep(200);
  }
  throw new Error('DevTools 没起来');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
await new Promise((r) => (ws.onopen = r));

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(w),
  height: Number(h),
  deviceScaleFactor: dsf,
  mobile: Number(w) < 800,
});
if (dark) {
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: 'dark' }],
  });
}

await send('Page.navigate', { url });
await sleep(2600);

if (scroll > 0) {
  await send('Runtime.evaluate', { expression: `window.scrollTo(0, ${scroll});` });
  await sleep(1200);
}

if (full) {
  const m = await send('Page.getLayoutMetrics');
  const size = m.result.cssContentSize ?? m.result.contentSize;
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(w),
    height: Math.ceil(size.height),
    deviceScaleFactor: dsf,
    mobile: Number(w) < 800,
  });
  await sleep(1500);
}

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
if (!shot.result?.data) {
  console.error('截图失败', JSON.stringify(shot).slice(0, 300));
  process.exit(1);
}
fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');

ws.close();
proc.kill();
