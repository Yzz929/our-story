// 扫描 background_music/，生成曲目清单。
// - 配了 Supabase（src/data/cloud-config.json 有 url + anonKey）→ 把音频传到云存储，
//   清单里写公开 URL。这样歌曲不再进 git 仓库、也不在站点包里（体积更小）。
// - 没配云端 → 退回老行为：复制到 public/music/，清单写相对路径。
// 支持：mp3 m4a aac ogg oga wav flac  ·  跳过 .ncm 等加密格式
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'background_music';
const OUT_DIR = 'public/music';
const MANIFEST = 'src/data/music.json';
const CONFIG = 'src/data/cloud-config.json';
const OK_EXT = new Set(['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.wav', '.flac']);
const MIME = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
};

let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
} catch {
  cfg = {};
}
const cloud = cfg.url && cfg.anonKey ? { url: cfg.url.replace(/\/+$/, ''), key: cfg.anonKey, bucket: cfg.bucket || 'photos' } : null;

// 本地模式才需要 public/music；云端模式不会有拷贝文件
if (!cloud) fs.mkdirSync(OUT_DIR, { recursive: true });
else if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });

async function uploadToCloud(absPath, remoteName) {
  const body = fs.readFileSync(absPath);
  const res = await fetch(`${cloud.url}/storage/v1/object/${cloud.bucket}/music/${remoteName}`, {
    method: 'POST',
    headers: {
      apikey: cloud.key,
      'Content-Type': MIME[path.extname(remoteName).toLowerCase()] || 'application/octet-stream',
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000',
    },
    body,
  });
  if (!res.ok) throw new Error(`上传失败 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`);
  return `${cloud.url}/storage/v1/object/public/${cloud.bucket}/music/${remoteName}`;
}

const tracks = [];
const skipped = [];
const failed = [];

if (fs.existsSync(SRC)) {
  const files = fs
    .readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .sort();

  let index = 0;
  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!OK_EXT.has(ext)) {
      skipped.push(name);
      continue;
    }
    index += 1;
    const fileName = `track-${String(index).padStart(2, '0')}${ext}`;
    const title = path.basename(name, path.extname(name)).replace(/^\d+[\s._-]*/, '').trim();

    if (cloud) {
      try {
        const url = await uploadToCloud(path.join(SRC, name), fileName);
        tracks.push({ src: url, title });
        console.log(`[music] 已上传云端：${title} → ${fileName}`);
      } catch (e) {
        failed.push(`${name}（${e.message}）`);
      }
    } else {
      fs.copyFileSync(path.join(SRC, name), path.join(OUT_DIR, fileName));
      tracks.push({ src: `music/${fileName}`, title });
    }
  }
}

// 云端模式若全部失败，保留上一版清单，避免把线上音乐清空
const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { tracks: [] };
if (cloud && !tracks.length && (prev.tracks?.length ?? 0) > 0) {
  console.warn('[music] 这次上传没有成功，保留上一版曲目清单');
} else {
  fs.writeFileSync(MANIFEST, JSON.stringify({ tracks }, null, 2) + '\n', 'utf8');
}

if (skipped.length) {
  console.warn(`[music] 跳过 ${skipped.length} 个不能直接播放的文件：`);
  for (const s of skipped) console.warn('  -', s);
  if (skipped.some((s) => s.toLowerCase().endsWith('.ncm'))) {
    console.warn('  .ncm 是网易云的加密格式，浏览器放不了，需要先转成 mp3/flac 再放进来。');
  }
}
if (failed.length) {
  console.warn(`[music] ${failed.length} 首上传失败：`);
  for (const f of failed) console.warn('  -', f);
}

console.log(
  `[music] 可用曲目 ${tracks.length} 首${tracks.length ? '：' + tracks.map((t) => t.title).join(' / ') : ''}（${cloud ? '云端存储' : '本地 public/music'}）`
);
