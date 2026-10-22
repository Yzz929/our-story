// 扫描 background_music/，把浏览器能播的音频复制到 public/music/，并生成曲目清单
// 支持：mp3 m4a aac ogg oga wav flac  ·  跳过 .ncm 等加密格式
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'background_music';
const OUT_DIR = 'public/music';
const MANIFEST = 'src/data/music.json';
const OK_EXT = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.wav', '.flac']);

fs.mkdirSync(OUT_DIR, { recursive: true });

const tracks = [];
const skipped = [];

if (fs.existsSync(SRC)) {
  const files = fs
    .readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();

  // 清掉旧的拷贝，保证增删歌曲后不会残留
  for (const old of fs.readdirSync(OUT_DIR)) {
    if (old !== 'list.json') fs.rmSync(path.join(OUT_DIR, old), { force: true });
  }

  let index = 0;
  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!OK_EXT.has(ext)) {
      skipped.push(name);
      continue;
    }
    index += 1;
    const fileName = `track-${String(index).padStart(2, '0')}${ext}`;
    fs.copyFileSync(path.join(SRC, name), path.join(OUT_DIR, fileName));
    tracks.push({
      src: `music/${fileName}`,
      title: path.basename(name, path.extname(name)).replace(/^\d+[\s._-]*/, '').trim(),
    });
  }
}

fs.writeFileSync(MANIFEST, JSON.stringify({ tracks }, null, 2) + '\n', 'utf8');

if (skipped.length) {
  console.warn(`[music] 跳过 ${skipped.length} 个不能直接播放的文件：`);
  for (const s of skipped) console.warn('  -', s);
  if (skipped.some((s) => s.toLowerCase().endsWith('.ncm'))) {
    console.warn('  .ncm 是网易云的加密格式，浏览器放不了，需要先转成 mp3/flac 再放进来。');
  }
}

console.log(`[music] 可用曲目 ${tracks.length} 首${tracks.length ? '：' + tracks.map((t) => t.title).join(' / ') : ''}`);
