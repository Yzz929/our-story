// 从 anon key 里解出 project ref，并探测 Supabase 项目状态
const KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cXBzYndjaWJyYWp4Z3hnbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2ODM2MzEsImV4cCI6MjEwODI1OTYzMX0.55oaNy0aJwxfZYg1tKIyHPOvf3UubxM6GBhfX_QqeDo';

const payload = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64url').toString('utf8'));
console.log('payload:', payload);
const ref = payload.ref;
const url = `https://${ref}.supabase.co`;
console.log('推断 URL:', url);

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const probe = async (label, u, init = {}) => {
  try {
    const r = await fetch(u, { ...init, headers: { ...H, ...(init.headers || {}) } });
    const text = await r.text();
    console.log(`${label}: ${r.status} ${text.slice(0, 220).replace(/\s+/g, ' ')}`);
    return { status: r.status, text };
  } catch (e) {
    console.log(`${label}: FAIL ${e.message}`);
    return { status: 0, text: '' };
  }
};

await probe('auth health', `${url}/auth/v1/health`);
await probe('site 表', `${url}/rest/v1/site?id=eq.1&select=data`);
await probe('storage bucket 列表', `${url}/storage/v1/bucket`);
await probe('photos 桶公开读', `${url}/storage/v1/object/public/photos/__probe__.txt`);
