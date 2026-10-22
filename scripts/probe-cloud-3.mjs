// 用 publishable key 探测：key 是否有效、site 表、photos 桶
const BASE = 'https://hyqpsbwcibrjaxgxglrf.supabase.co';
const KEY = 'sb_publishable_vxt4CwXmqq3VBW7XKu3GvA_xNM6NVo4';

const H = { apikey: KEY };

async function probe(label, path, init = {}) {
  try {
    const r = await fetch(BASE + path, { ...init, headers: { ...H, ...(init.headers || {}) } });
    const text = await r.text();
    console.log(`${label}: ${r.status} ${text.slice(0, 300).replace(/\s+/g, ' ')}`);
    return { status: r.status, text };
  } catch (e) {
    console.log(`${label}: FAIL ${e.message}`);
    return { status: 0, text: '' };
  }
}

await probe('rest 根', '/rest/v1/');
await probe('GET site', '/rest/v1/site?id=eq.1&select=data');
await probe('storage buckets', '/storage/v1/bucket');
await probe('photos 公开探测', '/storage/v1/object/public/photos/__probe__.txt');
