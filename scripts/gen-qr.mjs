// 生成站点二维码（PNG）+ 一张和站点同风格的扫码卡片（HTML，稍后用无头浏览器截成 PNG）
import fs from 'node:fs';
import QRCode from 'qrcode';

const URL_SITE = 'https://yzz929.github.io/our-story/';
const DIR = 'docs/qr';
fs.mkdirSync(DIR, { recursive: true });

// 1) 纯二维码，给需要打印/贴图的人
await QRCode.toFile(`${DIR}/our-story-qr.png`, URL_SITE, {
  width: 1024,
  margin: 2,
  errorCorrectionLevel: 'H',
  color: { dark: '#2b2126', light: '#fffaf7' },
});
console.log('wrote', `${DIR}/our-story-qr.png`);

// 2) 扫码卡片
const dataUrl = await QRCode.toDataURL(URL_SITE, {
  width: 760,
  margin: 1,
  errorCorrectionLevel: 'H',
  color: { dark: '#2b2126', light: '#ffffff' },
});

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 860px; height: 1120px; }
  body {
    position: relative;
    display: grid;
    place-items: center;
    background:
      radial-gradient(58% 42% at 18% 8%, rgba(209, 86, 109, 0.16), transparent 70%),
      radial-gradient(52% 40% at 92% 96%, rgba(157, 131, 198, 0.16), transparent 72%),
      linear-gradient(160deg, #fffdfb 0%, #fdf6f1 55%, #f8efe9 100%);
    font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", Georgia, serif;
    color: #2b2126;
    overflow: hidden;
  }
  .ring {
    position: absolute;
    inset: 28px;
    border: 1px solid rgba(43, 33, 38, 0.1);
    border-radius: 34px;
    pointer-events: none;
  }
  .inner { text-align: center; width: 100%; padding: 0 60px; }
  .heart {
    width: 62px; height: 62px; margin: 0 auto 22px;
    border-radius: 50%;
    background: linear-gradient(145deg, #d1566d, #b23c53);
    box-shadow: 0 14px 34px rgba(209, 86, 109, 0.38);
    display: grid; place-items: center;
  }
  .heart svg { width: 26px; height: 26px; fill: #fff; }
  .eyebrow {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 12px; letter-spacing: 0.42em; color: rgba(43, 33, 38, 0.4);
    display: inline-flex; align-items: center; gap: 12px;
  }
  .eyebrow::before, .eyebrow::after { content: ""; width: 34px; height: 1px; background: rgba(43, 33, 38, 0.18); }
  h1 { margin: 18px 0 10px; font-size: 52px; font-weight: 500; letter-spacing: 0.08em; }
  .hl { background: linear-gradient(96deg, #d1566d 8%, #9d83c6 92%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { margin: 0 0 34px; font-size: 17px; color: rgba(43, 33, 38, 0.55); letter-spacing: 0.04em; }
  .qr-wrap {
    width: 470px; height: 470px; margin: 0 auto;
    padding: 22px; background: #fff;
    border-radius: 30px;
    box-shadow: 0 26px 60px rgba(92, 58, 70, 0.16), 0 0 0 1px rgba(43, 33, 38, 0.06);
  }
  .qr-wrap img { width: 100%; height: 100%; display: block; image-rendering: pixelated; }
  .hint {
    margin: 30px 0 0;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 14px; color: rgba(43, 33, 38, 0.5); letter-spacing: 0.06em;
  }
  .names {
    margin-top: 26px;
    font-size: 20px; letter-spacing: 0.12em; color: rgba(43, 33, 38, 0.75);
    display: inline-flex; align-items: center; gap: 12px;
  }
  .names svg { width: 15px; height: 15px; fill: #d1566d; }
  .foot {
    position: absolute; bottom: 44px; left: 0; right: 0; text-align: center;
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 11px; letter-spacing: 0.24em; color: rgba(43, 33, 38, 0.3);
  }
</style>
</head>
<body>
  <div class="ring"></div>
  <div class="inner">
    <div class="heart">
      <svg viewBox="0 0 24 24"><path d="M12 20.4s-7.6-4.7-7.6-9.7A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.6 3.5c0 5-7.6 9.7-7.6 9.7z"/></svg>
    </div>
    <p class="eyebrow">OUR LITTLE WORLD</p>
    <h1>我们的小宇宙</h1>
    <p class="sub">扫一扫，走进我们的故事</p>
    <div class="qr-wrap"><img src="${dataUrl}" alt="扫码打开我们的故事" /></div>
    <p class="hint">打开后输入口令：我们在一起的那一天</p>
    <div class="names">小豭 <svg viewBox="0 0 24 24"><path d="M12 20.4s-7.6-4.7-7.6-9.7A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.6 3.5c0 5-7.6 9.7-7.6 9.7z"/></svg> 小谢</div>
  </div>
  <div class="foot">JUST FOR TWO · ${URL_SITE.replace('https://', '')}</div>
</body>
</html>`;

fs.writeFileSync(`${DIR}/card.html`, html, 'utf8');
fs.writeFileSync(`${DIR}/qr-dataurl.txt`, dataUrl, 'utf8');
console.log('wrote', `${DIR}/card.html`);
console.log('二维码内容:', URL_SITE);
