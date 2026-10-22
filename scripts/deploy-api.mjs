// 用 GitHub Git Data API 把 dist/ 发布到 gh-pages（git over https 不通时的备用通道）
// 用法：$env:GH_TOKEN="..." ; node scripts/deploy-api.mjs
import fs from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO || 'Yzz929/our-story';
const BRANCH = 'gh-pages';
const DIST = 'dist';

if (!TOKEN) {
  console.error('缺少 GH_TOKEN');
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-agent',
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
      try { json = JSON.parse(text); } catch {}
      if (!r.ok) {
        console.log(`  ! ${method} ${url} → ${r.status} ${text.slice(0, 160)}`);
        if (r.status === 409 || r.status === 422 || r.status >= 500) {
          await new Promise((res) => setTimeout(res, 1500 * attempt));
          continue;
        }
        throw new Error(`${method} ${url} failed: ${r.status}`);
      }
      return json;
    } catch (e) {
      if (attempt === 4) throw e;
      console.log(`  ! 重试 ${attempt}: ${e.message}`);
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else out.push({ rel, abs });
  }
  return out;
}

const files = walk(DIST).sort((a, b) => a.rel.localeCompare(b.rel));
if (!files.some((f) => f.rel === '.nojekyll')) {
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  files.push({ rel: '.nojekyll', abs: path.join(DIST, '.nojekyll') });
}
console.log(`dist 共 ${files.length} 个文件，开始上传 ${BRANCH}...`);

// 1) 现有分支头（可能不存在）
let headSha = null;
try {
  const ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  headSha = ref.object.sha;
  console.log('当前分支头:', headSha.slice(0, 7));
} catch {
  console.log('分支还不存在，将新建');
}

// 2) 逐个上传 blob
const tree = [];
let total = 0;
for (const f of files) {
  const buf = fs.readFileSync(f.abs);
  total += buf.length;
  let sha;
  if (buf.length > 1_500_000) {
    // 大文件用 base64 blob 单独上传，失败重试
    console.log(`  上传 ${f.rel} (${(buf.length / 1024 / 1024).toFixed(1)} MB)...`);
    const blob = await api('POST', `/repos/${REPO}/git/blobs`, {
      content: buf.toString('base64'),
      encoding: 'base64',
    });
    sha = blob.sha;
  } else {
    const blob = await api('POST', `/repos/${REPO}/git/blobs`, {
      content: buf.toString('base64'),
      encoding: 'base64',
    });
    sha = blob.sha;
  }
  tree.push({ path: f.rel, mode: '100644', type: 'blob', sha });
}
console.log(`上传完成，共 ${(total / 1024 / 1024).toFixed(1)} MB`);

// 3) 新建 tree（不带 base_tree，保证和 dist 完全一致）
const newTree = await api('POST', `/repos/${REPO}/git/trees`, { tree });
console.log('tree:', newTree.sha.slice(0, 7));

// 4) 提交
const commit = await api('POST', `/repos/${REPO}/git/commits`, {
  message: `deploy ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
  tree: newTree.sha,
  parents: headSha ? [headSha] : [],
});
console.log('commit:', commit.sha.slice(0, 7));

// 5) 更新引用
if (headSha) {
  await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });
} else {
  await api('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
}
console.log(`已发布到 ${BRANCH} · https://github.com/${REPO}`);
