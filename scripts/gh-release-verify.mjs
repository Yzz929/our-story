// 用 API 创建 v1.0.0 Release，并核对仓库状态
const TOKEN = process.env.GH_TOKEN;
const REPO = 'Yzz929/our-story';
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-agent',
  'Content-Type': 'application/json',
};

const changelog = (await import('node:fs')).readFileSync('CHANGELOG.md', 'utf8');
const body = changelog.split('## [v1.0.0]')[1]?.split('\n## [v')[0].replace(/^[^\n]*\n/, '').trim() ?? '';

const create = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
  method: 'POST',
  headers: H,
  body: JSON.stringify({ tag_name: 'v1.0.0', name: 'v1.0.0', body, draft: false, prerelease: false }),
});
console.log('创建 Release:', create.status);
const rel = await create.json().catch(() => null);
if (rel?.html_url) console.log('  ', rel.html_url);
else console.log('  ', JSON.stringify(rel).slice(0, 200));

// 核对
const info = async (path) => {
  const r = await fetch(`https://api.github.com${path}`, { headers: H });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const tags = await info(`/repos/${REPO}/tags`);
console.log('tags:', tags.json?.map((t) => t.name).join(', '));
const releases = await info(`/repos/${REPO}/releases`);
console.log('releases:', releases.json?.map((r) => r.tag_name + ' ' + r.name).join(' | '));
const main = await info(`/repos/${REPO}/commits/main`);
console.log('main HEAD:', main.json?.sha?.slice(0, 7), '|', main.json?.commit?.message?.split('\n')[0]);
const branches = await info(`/repos/${REPO}/branches`);
console.log('branches:', branches.json?.map((b) => b.name).join(', '));
const pages = await info(`/repos/${REPO}/pages`);
console.log('pages:', pages.json?.status, pages.json?.html_url);
