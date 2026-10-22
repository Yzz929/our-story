const TOKEN = process.env.GH_TOKEN;
const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-agent' };
const call = async (path) => {
  const r = await fetch('https://api.github.com' + path, { headers: H });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const repo = await call('/repos/Yzz929/our-story');
const r = repo.json;
console.log('仓库:', r.full_name, '| private:', r.private, '| 默认分支:', r.default_branch, '| size:', r.size, 'KB');
console.log('创建时间:', r.created_at, '| pushed:', r.pushed_at, '| homepage:', r.homepage);

const contents = await call('/repos/Yzz929/our-story/contents/');
console.log('根目录条目:', contents.status, Array.isArray(contents.json) ? contents.json.map((i) => i.name).join(', ') : JSON.stringify(contents.json).slice(0, 120));

const branches = await call('/repos/Yzz929/our-story/branches');
console.log('分支:', Array.isArray(branches.json) ? branches.json.map((b) => b.name).join(', ') : branches.status);
