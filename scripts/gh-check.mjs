// 用 GitHub API 检查 token、账号、仓库名占用情况
const TOKEN = process.env.GH_TOKEN;
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-agent',
};

const call = async (method, path, body) => {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: { ...H, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};

const user = await call('GET', '/user');
if (user.status !== 200) {
  console.log('token 无效:', user.status, user.text.slice(0, 200));
  process.exit(1);
}
const login = user.json.login;
console.log('token OK | 账号:', login, '| 名字:', user.json.name, '| 类型:', user.json.type);
console.log('token scopes:', (await fetch('https://api.github.com/user', { headers: H })).headers.get('x-oauth-scopes'));

for (const name of ['our-story', 'our-love-story', 'xiao-zhu-story']) {
  const r = await call('GET', `/repos/${login}/${name}`);
  console.log(`仓库 ${login}/${name}:`, r.status === 404 ? '可用' : `${r.status} 已存在`);
}
