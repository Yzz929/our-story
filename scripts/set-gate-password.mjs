// 设置进入口令：只把 SHA-256 写进 cloud-config.json，明文不落仓库
// 用法：node scripts/set-gate-password.mjs <新口令>
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const pass = process.argv[2];
if (!pass) {
  console.error('用法：node scripts/set-gate-password.mjs <新口令>');
  process.exit(1);
}

const file = 'src/data/cloud-config.json';
const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = createHash('sha256').update(pass, 'utf8').digest('hex');

cfg.gate = {
  enabled: true,
  title: cfg.gate?.title ?? '故事的开始',
  hint: cfg.gate?.hint ?? '输入我们的那一天',
  passwordHash: hash,
  placeholder: cfg.gate?.placeholder ?? '口令',
  button: cfg.gate?.button ?? '进去看看',
  wrong: cfg.gate?.wrong ?? '口令不对，再想想',
};
delete cfg.gate.password;

fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
console.log('已更新口令哈希：', hash.slice(0, 16) + '…');
console.log('记得重新构建并发布，旧口令立即失效。');
