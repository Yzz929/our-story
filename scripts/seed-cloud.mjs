// 把本地 sample.json 的内容播种到云端（第一次初始化用）
import fs from 'node:fs';

const cfg = JSON.parse(fs.readFileSync('src/data/cloud-config.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('src/data/sample.json', 'utf8'));
const BASE = cfg.url.replace(/\/+$/, '');
const H = { apikey: cfg.anonKey, 'Content-Type': 'application/json' };
if (cfg.anonKey.startsWith('eyJ')) H.Authorization = `Bearer ${cfg.anonKey}`;

const post = await fetch(`${BASE}/rest/v1/${cfg.table}`, {
  method: 'POST',
  headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify([{ id: 1, data, updated_at: new Date().toISOString() }]),
});
console.log('seed POST:', post.status, (await post.text()).slice(0, 160));

const get = await fetch(`${BASE}/rest/v1/${cfg.table}?id=eq.1&select=data`, { headers: H });
const rows = await get.json();
const cloud = rows?.[0]?.data;
console.log('read back:', get.status, '| milestones:', cloud?.milestones?.length, '| startDate:', cloud?.couple?.startDate, '| title:', cloud?.couple?.titleTemplate);
