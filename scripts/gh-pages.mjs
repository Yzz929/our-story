// 开启/查询 GitHub Pages
const TOKEN = process.env.GH_TOKEN;
const REPO = 'Yzz929/our-story';
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-agent',
  'Content-Type': 'application/json',
};

const call = async (method, path, body) => {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const before = await call('GET', `/repos/${REPO}/pages`);
console.log('当前 Pages 状态:', before.status, before.status === 404 ? '(未开启)' : JSON.stringify(before.json).slice(0, 200));

if (before.status === 404) {
  const created = await call('POST', `/repos/${REPO}/pages`, {
    source: { branch: 'gh-pages', path: '/' },
  });
  console.log('开启 Pages:', created.status, JSON.stringify(created.json).slice(0, 300));
} else if (before.json?.build_type !== 'legacy' || before.json?.source?.branch !== 'gh-pages') {
  const updated = await call('PUT', `/repos/${REPO}/pages`, {
    source: { branch: 'gh-pages', path: '/' },
    build_type: 'legacy',
  });
  console.log('切换来源:', updated.status, JSON.stringify(updated.json).slice(0, 200));
}

// 轮询构建状态
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 6000));
  const info = await call('GET', `/repos/${REPO}/pages`);
  const st = info.json?.status;
  console.log(`第 ${i + 1} 次: status=${st} url=${info.json?.html_url}`);
  if (st === 'built') break;
}
const final = await call('GET', `/repos/${REPO}/pages`);
console.log('\n最终:', JSON.stringify({ url: final.json?.html_url, status: final.json?.status, branch: final.json?.source?.branch }));
