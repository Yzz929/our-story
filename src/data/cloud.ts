import { compressImage } from '../lib/image';
import cloudConfig from './cloud-config.json';
import type { SiteData } from './types';

/**
 * 云端存储（Supabase）。
 *
 * 完全可选：不配置就是「只存本机浏览器」的模式。
 * 配置写在 src/data/cloud-config.json（随代码走，GitHub Actions 构建也能读到），
 * 也可以用 .env 里的 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 覆盖。
 * anon key 是公开可读的 key，放在前端是 Supabase 的常规用法。
 */
const cfg = cloudConfig as { url?: string; anonKey?: string; table?: string; bucket?: string };

const URL_ = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || cfg.url || '').replace(/\/+$/, '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || cfg.anonKey || '';
const TABLE = (import.meta.env.VITE_SUPABASE_TABLE as string | undefined) || cfg.table || 'site';
const BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET as string | undefined) || cfg.bucket || 'photos';

export const cloudEnabled = Boolean(URL_ && KEY);

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { apikey: KEY, ...extra };
  // 旧版 anon key 是 JWT（eyJ...），新版 publishable key（sb_publishable_...）只放 apikey 头即可
  if (KEY.startsWith('eyJ')) h.Authorization = `Bearer ${KEY}`;
  return h;
}

/** 读云端保存的整站数据；没配云端或云端还没有数据时返回 null */
export async function fetchCloudSite(): Promise<SiteData | null> {
  if (!cloudEnabled) return null;
  const res = await fetch(`${URL_}/rest/v1/${TABLE}?id=eq.1&select=data`, { headers: headers() });
  if (!res.ok) throw new Error(`读取云端失败：${res.status} ${await res.text().catch(() => '')}`);
  const rows = (await res.json()) as { data: SiteData }[];
  return rows?.[0]?.data ?? null;
}

/** 整站数据写回云端（id 固定为 1，存在就覆盖） */
export async function saveCloudSite(data: SiteData, opts: { keepalive?: boolean } = {}): Promise<void> {
  if (!cloudEnabled) return;
  const res = await fetch(`${URL_}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: headers({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    }),
    body: JSON.stringify([{ id: 1, data, updated_at: new Date().toISOString() }]),
    keepalive: opts.keepalive,
  });
  if (!res.ok) throw new Error(`保存到云端失败：${res.status} ${await res.text().catch(() => '')}`);
}

/** 上传一张图片到云存储，返回公开访问地址 */
export async function uploadImage(file: File): Promise<string> {
  if (!cloudEnabled) throw new Error('没有配置云端存储');
  const blob = await compressImage(file, 1600, 0.82);
  const ext = blob.type === 'image/png' ? 'png' : 'jpg';
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${name}`, {
    method: 'POST',
    headers: headers({
      'Content-Type': blob.type || 'image/jpeg',
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000',
    }),
    body: blob,
  });
  if (!res.ok) throw new Error(`上传图片失败：${res.status} ${await res.text().catch(() => '')}`);
  return `${URL_}/storage/v1/object/public/${BUCKET}/${name}`;
}

/** 连接自检，编辑页里用来显示状态 */
export async function pingCloud(): Promise<string> {
  if (!cloudEnabled) return '未配置云端';
  const res = await fetch(`${URL_}/rest/v1/${TABLE}?id=eq.1&select=id`, { headers: headers() });
  if (!res.ok) return `连接失败（${res.status}）`;
  return '已连接云端';
}

export interface CloudProbe {
  ok: boolean;
  ms: number;
  message: string;
  /** HTTP 状态码（网络层失败时为 0） */
  status: number;
}

/** 网络诊断：测一次读写往返，判断是网络问题还是配置问题 */
export async function probeCloud(timeoutMs = 4000): Promise<CloudProbe> {
  if (!cloudEnabled) return { ok: false, ms: 0, message: '未配置云端', status: 0 };
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${URL_}/rest/v1/${TABLE}?id=eq.1&select=id`, {
      headers: headers(),
      cache: 'no-store',
      signal: ctrl.signal,
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      return { ok: false, ms, message: `服务器返回 ${res.status}（${res.statusText || '请求被拒绝'}）`, status: res.status };
    }
    return { ok: true, ms, message: `连接正常，往返 ${ms} ms`, status: res.status };
  } catch (e) {
    const ms = Date.now() - t0;
    const aborted = (e as Error)?.name === 'AbortError';
    return {
      ok: false,
      ms,
      message: aborted ? `连接超时（>${timeoutMs}ms）` : `网络不通：${e instanceof Error ? e.message : String(e)}`,
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
