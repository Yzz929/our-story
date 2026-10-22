import sample from './sample.json';
import type { SiteData } from './types';

const KEY = 'our-story:data:v1';

export const SAMPLE = sample as unknown as SiteData;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** 把用户保存的数据补全到当前结构上，避免旧数据缺字段时白屏 */
function merge(base: SiteData, patch: Partial<SiteData> | null): SiteData {
  if (!patch) return clone(base);
  return {
    version: base.version,
    couple: { ...base.couple, ...(patch.couple ?? {}) },
    quotes: Array.isArray(patch.quotes) ? patch.quotes : base.quotes,
    milestones: Array.isArray(patch.milestones) ? patch.milestones : base.milestones,
    anniversaries: Array.isArray(patch.anniversaries) ? patch.anniversaries : base.anniversaries,
    gallery: Array.isArray(patch.gallery) ? patch.gallery : base.gallery,
  };
}

export function loadData(): SiteData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(SAMPLE);
    const saved = JSON.parse(raw) as Partial<SiteData>;
    // sample.json 里把 version 调大了，说明仓库里的内容更新了，本地旧缓存让位
    if ((saved.version ?? 0) < (SAMPLE.version ?? 0)) return clone(SAMPLE);
    return merge(SAMPLE, saved);
  } catch {
    return clone(SAMPLE);
  }
}

export function saveData(data: SiteData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearSaved(): void {
  localStorage.removeItem(KEY);
}

export function hasSaved(): boolean {
  return localStorage.getItem(KEY) !== null;
}

/** 估算本机存储占用（浏览器 localStorage 一般只有 5MB） */
export function storageBytes(): number {
  const raw = localStorage.getItem(KEY);
  return raw ? new Blob([raw]).size : 0;
}

export function downloadJson(data: SiteData, filename = 'site.json'): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const uid = (): string => Math.random().toString(36).slice(2, 10);
