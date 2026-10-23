import { useCallback, useEffect, useRef, useState } from 'react';
import { saveCloudSite } from '../data/cloud';
import { saveDraft } from './localDraft';
import type { SiteData } from '../data/types';

export type SyncStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** 连续失败 10 秒之后的重试间隔：先快后慢，最长 20 秒一次 */
const BACKOFF = [1500, 4000, 9000, 20000];
/** 开始失败的 10 秒内，每秒重试一次 */
const FAST_WINDOW = 10000;
const FAST_DELAY = 1000;

export interface CloudSync {
  status: SyncStatus;
  lastError: string;
  lastSavedAt: number | null;
  retryNow: () => void;
}

export function useCloudSync(
  data: SiteData,
  enabled: boolean,
  ready: boolean,
  initialDirty = false
): CloudSync {
  const [status, setStatus] = useState<SyncStatus>(initialDirty ? 'pending' : 'idle');
  const [lastError, setLastError] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const dataRef = useRef(data);
  const dirtyRef = useRef(initialDirty);
  const attemptRef = useRef(0);
  const failStartRef = useRef<number | null>(null);
  const slowStepRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const firstRunRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    clearTimer();
    if (!enabled || !ready || !dirtyRef.current || savingRef.current) return;

    savingRef.current = true;
    setStatus('saving');
    const snapshot = dataRef.current;

    try {
      await saveCloudSite(snapshot);
      if (!mountedRef.current) return;
      attemptRef.current = 0;
      failStartRef.current = null;
      slowStepRef.current = 0;
      setLastError('');
      setLastSavedAt(Date.now());
      if (dataRef.current === snapshot) {
        dirtyRef.current = false;
        saveDraft(snapshot, false);
        setStatus('saved');
      } else {
        // 保存期间又改了：继续保持待保存
        dirtyRef.current = true;
        setStatus('pending');
        timerRef.current = window.setTimeout(() => void flush(), 1200);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      setStatus('error');
      dirtyRef.current = true;

      if (failStartRef.current === null) failStartRef.current = Date.now();
      const failingFor = Date.now() - failStartRef.current;

      let delay: number;
      if (failingFor < FAST_WINDOW) {
        // 刚开始失败的头 10 秒：每秒重试一次
        delay = FAST_DELAY;
      } else {
        delay = BACKOFF[Math.min(slowStepRef.current, BACKOFF.length - 1)];
        slowStepRef.current += 1;
      }
      attemptRef.current += 1;
      timerRef.current = window.setTimeout(() => void flush(), delay);
    } finally {
      savingRef.current = false;
    }
  }, [clearTimer, enabled, ready]);

  const schedule = useCallback(
    (delay: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => void flush(), delay);
    },
    [clearTimer, flush]
  );

  // 数据变化：立刻落本地草稿（防丢），再排一次云端保存
  useEffect(() => {
    dataRef.current = data;

    if (firstRunRef.current) {
      firstRunRef.current = false;
      if (!initialDirty) {
        saveDraft(data, false);
        return;
      }
    }

    if (draftTimerRef.current !== null) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(
      () => saveDraft(dataRef.current, enabled && dirtyRef.current),
      350
    );

    if (!enabled || !ready) return;
    dirtyRef.current = true;
    setStatus('pending');
    schedule(1800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled, ready]);

  // 切回前台 / 网络恢复时立刻补一次
  useEffect(() => {
    const onOnline = () => {
      if (dirtyRef.current) void flush();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && dirtyRef.current) void flush();
    };
    const onHide = () => {
      // 页面要走了：用 keepalive 抢一次，失败也没关系（本地草稿还在）
      if (!enabled || !dirtyRef.current) return;
      try {
        void saveCloudSite(dataRef.current, { keepalive: true });
      } catch {}
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
    };
  }, [enabled, flush]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (draftTimerRef.current !== null) window.clearTimeout(draftTimerRef.current);
    };
  }, [clearTimer]);

  const retryNow = useCallback(() => {
    attemptRef.current = 0;
    dirtyRef.current = true;
    void flush();
  }, [flush]);

  return { status, lastError, lastSavedAt, retryNow };
}
