// 没有本地 .git 的一键发版（全部走 GitHub API + 本机 Windows 凭据）
//   1) 把改动同步到 main 并打 tag
//   2) 把 dist/ 发布到 gh-pages
//   3) 建 GitHub Release
//   4) 触发 Android APK 构建 → 等它跑完 → 把 APK 挂到 Release
//
// 用法：node scripts/publish.mjs 1.2.0 "这一版改了什么" [--skip-apk] [--skip-web]
// 凭据：从 Windows 凭据管理器里取（git credential fill，账号 x-access-token@github.com），
//       也可以直接用环境变量 GH_TOKEN。
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const REPO = process.env.GH_REPO || 'Yzz929/our-story';
const version = process.argv[2];
const note = process.argv[3] || '';
const SKIP_APK = process.argv.includes('--skip-apk');
const SKIP_WEB = process.argv.includes('--skip-web');

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('用法：node scripts/publish.mjs <版本号，如 1.2.0> "<这一版改了什么>"');
  process.exit(1);
}
const tag = `v${version}`;

function storedToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  for (const host of ['x-access-token@github.com', 'github.com']) {
    try {
      const out = execFileSync('git', ['-c', 'credential.helper=manager', 'credential', 'fill'], {
        input: `protocol=https\nhost=${host}\n\n`,
        encoding: 'utf8',
        timeout: 20000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      });
      const p = (out.match(/password=(.*)/) || [])[1];
      if (p) return p.trim();
    } catch {}
  }
  return null;
}

const TOKEN = storedToken();
if (!TOKEN) {
  console.error('没拿到 GitHub 凭据：请在环境变量里给 GH_TOKEN，或用 git 凭据管理器登录一次');
  process.exit(1);
}
const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-agent' };

async function api(method, url, body) {
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
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status} ${text.slice(0, 200)}`);
  return json;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 0) 构建产物必须是最新的
if (!fs.existsSync('dist/index.html')) {
  console.error('dist/ 不存在，先跑一次构建：npm run build');
  process.exit(1);
}
const swVer = (fs.readFileSync('dist/sw.js', 'utf8').match(/our-story-v[\d.]+/) || [''])[0];
console.log(`dist 就绪（sw ${swVer}）`);

// 1) 源码 → main + tag
if (!SKIP_WEB) {
  console.log('\n[1/4] 同步源码到 main 并打 tag');
  const r = spawnSync(process.execPath, ['scripts/sync-main-api.mjs', '--tag', tag], {
    stdio: 'inherit',
    env: { ...process.env, GH_TOKEN: TOKEN, GH_MESSAGE: `feat: ${note || tag}` },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);

  console.log('\n[2/4] 发布 dist/ 到 gh-pages');
  const d = spawnSync(process.execPath, ['scripts/deploy-api.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, GH_TOKEN: TOKEN },
  });
  if (d.status !== 0) process.exit(d.status ?? 1);
} else {
  console.log('跳过源码/网页发布');
}

// 3) Release
console.log('\n[3/4] 建 Release');
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const section = changelog.split('\n## ').find((s) => s.startsWith(`[${tag}]`));
const body = (section || '').split('\n').slice(1).join('\n').trim() || note;
let release = null;
try {
  release = await api('GET', `/repos/${REPO}/releases/tags/${tag}`);
  console.log('Release 已存在：', release.html_url);
} catch {
  release = await api('POST', `/repos/${REPO}/releases`, {
    tag_name: tag,
    name: tag,
    body,
    draft: false,
    prerelease: false,
  });
  console.log('Release 已创建：', release.html_url);
}

// 4) APK：触发 CI → 等 → 挂到 Release
if (SKIP_APK) {
  console.log('\n跳过 APK 构建');
} else {
  console.log('\n[4/4] 触发 Android APK 构建');
  const startedAt = Date.now();
  await api('POST', `/repos/${REPO}/actions/workflows/android.yml/dispatches`, { ref: 'main' });
  let run = null;
  for (let i = 0; i < 150; i++) {
    await sleep(5000);
    const runs = await api('GET', `/repos/${REPO}/actions/workflows/android.yml/runs?event=workflow_dispatch&per_page=5`);
    const latest = runs.workflow_runs?.[0];
    if (!latest) continue;
    if (new Date(latest.created_at).getTime() < startedAt - 120000) continue; // 旧的 run，还没轮到新的
    run = latest;
    if (latest.status === 'completed') break;
  }
  if (!run) {
    console.log('没找到 CI run');
  } else if (run.conclusion !== 'success') {
    console.log(`CI 没成功（${run.conclusion}）：${run.html_url}`);
  } else {
    console.log('CI 成功：', run.html_url);
    const arts = await api('GET', `/repos/${REPO}/actions/runs/${run.id}/artifacts`);
    const art = arts.artifacts?.find((a) => a.name === 'our-story-debug-apk');
    if (!art) {
      console.log('产物里没有 our-story-debug-apk');
    } else {
      // 下载 artifact：要带 token 拿 302，然后匿名取真实地址
      const dl = await fetch(art.archive_download_url, { headers: H, redirect: 'manual' });
      const loc = dl.headers.get('location');
      const zip = Buffer.from(await (await fetch(loc)).arrayBuffer());
      fs.mkdirSync('dist-apk', { recursive: true });
      fs.writeFileSync('dist-apk/_ci.zip', zip);
      const unzip = execFileSync('tar', ['-xf', '_ci.zip'], { cwd: 'dist-apk', encoding: 'utf8' });
      void unzip;
      const apkPath = fs.readdirSync('dist-apk').find((f) => f.endsWith('.apk'));
      if (!apkPath) {
        console.log('解压后没找到 apk');
      } else {
        const name = `our-story-${tag}-debug.apk`;
        fs.copyFileSync(`dist-apk/${apkPath}`, `dist-apk/${name}`);
        // 先删掉同名旧资产，再上传
        const rel = await api('GET', `/repos/${REPO}/releases/tags/${tag}`);
        for (const asset of rel.assets || []) {
          if (asset.name === name) await api('DELETE', `/repos/${REPO}/releases/assets/${asset.id}`);
        }
        const up = await fetch(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=${name}`, {
          method: 'POST',
          headers: { ...H, 'Content-Type': 'application/vnd.android.package-archive' },
          body: fs.readFileSync(`dist-apk/${name}`),
        });
        if (up.ok) {
          const asset = await up.json();
          console.log(`APK 已挂到 Release：${asset.browser_download_url}`);
        } else {
          console.log('APK 上传失败：', up.status, (await up.text()).slice(0, 200));
        }
      }
    }
  }
}

console.log(`\n完成：${tag} → https://yzz929.github.io/our-story/`);
