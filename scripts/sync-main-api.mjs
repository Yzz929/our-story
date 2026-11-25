// 没有 .git 的情况下，把本地改动同步到远端 main（Git Data API）
// 做法：拉远端 tree，只上传内容有变化的文件，删掉远端有、本地已经没有的文件，再用 base_tree 合成新 tree 提交。
//
// 用法：
//   $env:GH_TOKEN="ghp_xxx"; node scripts/sync-main-api.mjs            # 真推
//   node scripts/sync-main-api.mjs --dry                              # 只列差异（匿名也能跑）
//   node scripts/sync-main-api.mjs --tag v1.2.0                       # 推完顺手打个 tag
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO || 'Yzz929/our-story';
const BRANCH = process.env.GH_BRANCH || 'main';
const DRY = process.argv.includes('--dry');
const TAG = (() => {
  const i = process.argv.indexOf('--tag');
  return i > 0 ? process.argv[i + 1] : null;
})();
const MESSAGE =
  process.env.GH_MESSAGE || `feat(editor): 点点滴滴逐条折叠（v${JSON.parse(fs.readFileSync('package.json', 'utf8')).version}）`;

const H = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-agent',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(method, url, body) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch('https://api.github.com' + url, {
        method,
        headers: { ...H, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {}
      if (!r.ok) {
        if (r.status >= 500 || r.status === 409) {
          await new Promise((res) => setTimeout(res, 1200 * attempt));
          continue;
        }
        throw new Error(`${method} ${url} → ${r.status} ${text.slice(0, 160)}`);
      }
      return json;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 1200 * attempt));
    }
  }
}

// 只走这几棵目录树，其余（构建产物、预览图、临时文件）天然被排除
const ROOTS = ['src', 'scripts', 'public', 'supabase', '.github', 'android', 'docs'];
const ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'capacitor.config.ts',
  'index.html',
  'README.md',
  'CHANGELOG.md',
  'VERSIONING.md',
  '.gitignore',
  '.npmrc',
  '.env.example',
];
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-cloud',
  'dist-apk',
  'dist-conn',
  '.vite',
  '_tmp',
  'preview',
  'qr',
  'build',
  '.gradle',
  'music',
  '_源文件',
]);
const SKIP_FILES = new Set(['local.properties', '.DS_Store', 'Thumbs.db', '.env', '.env.local']);

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      // docs/preview、public/music 由 SKIP_DIRS 里同名目录兜住
      out.push(...walk(abs, rel));
    } else {
      if (SKIP_FILES.has(entry.name) || entry.name.endsWith('.local')) continue;
      out.push({ rel, abs });
    }
  }
  return out;
}

const local = new Map();
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  if (fs.statSync(root).isDirectory()) for (const f of walk(root, root)) local.set(f.rel, f.abs);
  else local.set(root, root);
}
for (const f of ROOT_FILES) if (fs.existsSync(f)) local.set(f, f);

const inScope = (rel) => ROOT_FILES.includes(rel) || ROOTS.some((r) => rel.startsWith(`${r}/`));

const blobSha = (buf) =>
  crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

const head = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
const commit = await api('GET', `/repos/${REPO}/git/commits/${head.object.sha}`);
const remote = await api('GET', `/repos/${REPO}/git/trees/${commit.tree.sha}?recursive=1`);
const remoteBlobs = new Map(remote.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));

const changed = [];
const added = [];
const removed = [];

for (const [rel, abs] of local) {
  const buf = fs.readFileSync(abs);
  const sha = blobSha(buf);
  if (!remoteBlobs.has(rel)) added.push({ rel, abs, buf });
  else if (remoteBlobs.get(rel) !== sha) changed.push({ rel, abs, buf });
}
for (const rel of remoteBlobs.keys()) if (inScope(rel) && !local.has(rel)) removed.push(rel);

console.log(`远端 ${BRANCH}@${head.object.sha.slice(0, 7)}：${remoteBlobs.size} 个文件`);
console.log(`改动 ${changed.length} / 新增 ${added.length} / 删除 ${removed.length}`);
for (const f of [...changed, ...added]) console.log(`  ${changed.includes(f) ? 'M' : 'A'} ${f.rel}`);
for (const r of removed) console.log(`  D ${r}`);

if (DRY) {
  console.log('\n--dry：只列差异，没有提交');
  process.exit(0);
}

if (!changed.length && !added.length && !removed.length) {
  console.log('没有需要提交的改动');
  process.exit(0);
}

const entries = [];
for (const f of [...changed, ...added]) {
  const blob = await api('POST', `/repos/${REPO}/git/blobs`, {
    content: f.buf.toString('base64'),
    encoding: 'base64',
  });
  entries.push({ path: f.rel, mode: '100644', type: 'blob', sha: blob.sha });
}
for (const rel of removed) entries.push({ path: rel, mode: '100644', type: 'blob', sha: null });

const tree = await api('POST', `/repos/${REPO}/git/trees`, { base_tree: commit.tree.sha, tree: entries });
const next = await api('POST', `/repos/${REPO}/git/commits`, {
  message: MESSAGE,
  tree: tree.sha,
  parents: [head.object.sha],
});
await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: next.sha, force: true });
console.log(`\n${BRANCH} 已更新 → ${next.sha.slice(0, 7)}`);

if (TAG) {
  try {
    await api('POST', `/repos/${REPO}/git/refs`, { ref: `refs/tags/${TAG}`, sha: next.sha });
    console.log('已创建 tag:', TAG);
  } catch (e) {
    console.log('tag 创建失败（可能已存在）：', e.message.slice(0, 120));
  }
}
