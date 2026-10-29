// 用 GitHub Git Data API 把当前 HEAD 同步到远端分支（git over https 不通时的备用通道）
// 用法：$env:GH_TOKEN="ghp_xxx"; node scripts/push-api.mjs [分支名]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO || 'Yzz929/our-story';
const BRANCH = process.argv[2] || 'main';

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
        console.log(`  ! ${method} ${url} → ${r.status} ${text.slice(0, 140)}`);
        if (r.status >= 500 || r.status === 409) {
          await new Promise((res) => setTimeout(res, 1200 * attempt));
          continue;
        }
        throw new Error(`${method} ${url} failed: ${r.status}`);
      }
      return json;
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 1200 * attempt));
    }
  }
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8' });

const message = git(['log', '-1', '--format=%B']).trim() || 'sync';
const files = git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean);
console.log(`本地 HEAD 有 ${files.length} 个文件，准备同步到 ${BRANCH}`);

let headSha = null;
try {
  const ref = await api('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
  headSha = ref.object.sha;
  console.log('远端当前 HEAD:', headSha.slice(0, 7));
} catch {
  console.log('远端还没有这个分支，将新建');
}

// 上传所有文件为 blob（体积都不大：没有音视频）
const tree = [];
let total = 0;
for (const f of files) {
  const buf = fs.readFileSync(f);
  total += buf.length;
  const blob = await api('POST', `/repos/${REPO}/git/blobs`, {
    content: buf.toString('base64'),
    encoding: 'base64',
  });
  tree.push({ path: f, mode: '100644', type: 'blob', sha: blob.sha });
}
console.log(`上传完成，共 ${(total / 1024).toFixed(0)} KB`);

const newTree = await api('POST', `/repos/${REPO}/git/trees`, { tree });
const commit = await api('POST', `/repos/${REPO}/git/commits`, {
  message,
  tree: newTree.sha,
  parents: headSha ? [headSha] : [],
});
console.log('新 commit:', commit.sha.slice(0, 7));

if (headSha) {
  await api('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });
} else {
  await api('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
}
console.log(`分支 ${BRANCH} 已更新 → ${commit.sha.slice(0, 7)}`);

// 顺便把本地最新的 tag 也推上去
try {
  const tags = git(['tag', '--sort=-creatordate']).split('\n').filter(Boolean);
  for (const tag of tags.slice(0, 3)) {
    const exists = await fetch(`https://api.github.com/repos/${REPO}/git/ref/tags/${tag}`, { headers: H });
    if (exists.ok) continue;
    await api('POST', `/repos/${REPO}/git/refs`, { ref: `refs/tags/${tag}`, sha: commit.sha });
    console.log('已创建 tag:', tag);
  }
} catch (e) {
  console.log('tag 处理失败（可忽略）:', e.message);
}
