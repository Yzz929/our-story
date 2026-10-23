import type { SiteData } from '../data/types';

const KEY = 'our-story:draft';

export interface Draft {
  data: SiteData;
  savedAt: number;
  /** 还有没写进云端的改动 */
  dirty: boolean;
}

/** 本地草稿：即使云端保存失败、或者直接关掉页面，改动也不会丢 */
export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed?.data?.couple) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(data: SiteData, dirty: boolean): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ data, savedAt: Date.now(), dirty }));
  } catch {
    /* 空间不够就算了，不要影响编辑 */
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
