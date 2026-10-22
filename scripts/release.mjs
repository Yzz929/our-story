// 一键发版：改版本号 → 构建 → 提交/打 tag → 推送 → 发布 gh-pages → 建 GitHub Release
// 用法：$env:GH_TOKEN="ghp_xxx"; node scripts/release.mjs 1.0.1 "这次改了什么"
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO || 'Yzz929/our-story';
const version = process.argv[2];
const note = process.argv[3] ?? '';

if (!TOKEN) {
  console.error('缺少 GH_TOKEN（GitHub classic token，repo 权限）');
  process.exit(1);
}
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('用法：node scripts/release.mjs <版本号，如 1.0.1> "<这一版改了什么>"');
  process.exit(1);
}

const tag = `v${version}`;
const git = (args, opts = {}) =>
  execFileSync('git', args, { stdio: 'inherit', ...opts });

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: true });

// 0) 工作区必须干净
const status = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (status) {
  console.error('工作区有未提交的改动，先提交再发版：\n' + status);
  process.exit(1);
}

// 1) 版本号
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(`版本号：${version}`);

// 2) CHANGELOG 顶部插入
const today = new Date().toISOString().slice(0, 10);
const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
const entry =
  `## [v${version}] — ${today}\n\n` + (note ? `### 变更\n\n- ${note}\n\n` : '### 变更\n\n- （未填写）\n\n');
const marker = changelog.indexOf('## [v');
const updated =
  marker > 0 ? changelog.slice(0, marker) + entry + changelog.slice(marker) : changelog.trimEnd() + '\n\n' + entry;
fs.writeFileSync('CHANGELOG.md', updated);

// 3) 构建（prebuild 会同步音乐）
run('npm', ['run', 'build']);

// 4) 提交 + 打 tag
git(['add', '-A']);
git(['commit', '-m', `chore(release): ${tag}${note ? ' — ' + note : ''}`]);
git(['tag', '-a', tag, '-m', `${tag}${note ? ' — ' + note : ''}`]);
git(['push', `https://x-access-token:${TOKEN}@github.com/${REPO}.git`, 'main:main']);
git(['push', `https://x-access-token:${TOKEN}@github.com/${REPO}.git`, '--tags']);
console.log('已提交并推送 tag');

// 5) 发布 gh-pages
run('node', ['scripts/deploy-api.mjs']);

// 6) 建 Release
const headings = updated.split('\n## [v');
const section = headings.find((s) => s.startsWith(`${version}]`)) ?? '';
const body = section.replace(/^\d+\.\d+\.\d+\][^\n]*\n/, '').trim();

const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dsh-agent',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    tag_name: tag,
    name: tag,
    body: body || note,
    draft: false,
    prerelease: false,
  }),
});
if (res.ok) {
  const rel = await res.json();
  console.log('Release 已创建：', rel.html_url);
} else {
  console.log('Release 创建失败：', res.status, (await res.text()).slice(0, 200));
}

console.log(`\n完成：${tag} 已发布 → https://yzz929.github.io/our-story/`);
