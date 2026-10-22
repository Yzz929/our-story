// 用你给的 URL + anon key 实测：域名解析、key 是否有效、表/存储桶是否已建
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cXBzYndjaWJyYWp4Z3hnbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODM2MzEsImV4cCI6MjEwODI1OTYzMX0.55oaNy0aJwxfZYg1tKIyHPOvf3UubxM6GBhfX_QqeDo';

const bases = [
  'https://hyqpsbwcibrjaxgxglrf.supabase.co',
  'https://hyqpsbwcibrajxgxglrf.supabase.co',
];

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

for (const base of bases) {
  console.log('\n=== ' + base);
  try {
    const health = await fetch(`${base}/auth/v1/health`);
    console.log('auth/health:', health.status, (await health.text()).slice(0, 120));
  } catch (e) {
    console.log('auth/health: FAIL', e.message, e.cause?.code ?? '');
    continue;
  }

  try {
    const r = await fetch(`${base}/rest/v1/site?id=eq.1&select=data`, { headers: H });
    console.log('GET site:', r.status, (await r.text()).slice(0, 200).replace(/\s+/g, ' '));
  } catch (e) {
    console.log('GET site: FAIL', e.message);
  }

  try {
    const r = await fetch(`${base}/storage/v1/bucket`, { headers: H });
    console.log('list buckets:', r.status, (await r.text()).slice(0, 220).replace(/\s+/g, ' '));
  } catch (e) {
    console.log('list buckets: FAIL', e.message);
  }
}
