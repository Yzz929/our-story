// 把 dist/ 发布到 GitHub Pages（gh-pages 分支方案，不需要 workflow 权限）
// 用法：先 npm run build，然后
//   $env:GH_TOKEN="ghp_xxx"; node scripts/deploy-pages.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const TOKEN = process.env.GH_TOKEN;
const REPO = process.env.GH_REPO || 'Yzz929/our-story';
if (!TOKEN) {
  console.error('缺少 GH_TOKEN 环境变量（GitHub classic token，repo 权限即可）');
  process.exit(1);
}
if (!fs.existsSync('dist/index.html')) {
  console.error('dist/ 还没构建，先跑 npm run build');
  process.exit(1);
}

// GitHub Pages 默认走 Jekyll，加这个文件避免下划线开头的路径被忽略
fs.writeFileSync('dist/.nojekyll', '');

const git = (args, cwd = 'dist') =>
  execFileSync('git', args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, GIT_AUTHOR_NAME: 'deploy', GIT_AUTHOR_EMAIL: 'deploy@local',
      GIT_COMMITTER_NAME: 'deploy', GIT_COMMITTER_EMAIL: 'deploy@local' },
  });

if (!fs.existsSync('dist/.git')) {
  git(['init', '-q']);
  git(['checkout', '-q', '-b', 'gh-pages']);
} else {
  git(['checkout', '-q', 'gh-pages']);
}
git(['add', '-A']);
try {
  git(['commit', '-q', '-m', `deploy ${new Date().toISOString()}`]);
} catch {
  console.log('没有变化，跳过 commit');
}
git(['push', '-q', '-f', `https://x-access-token:${TOKEN}@github.com/${REPO}.git`, 'gh-pages:gh-pages']);
console.log(`已发布到 https://github.com/${REPO} 的 gh-pages 分支`);
