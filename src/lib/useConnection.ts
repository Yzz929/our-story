import { useEffect, useRef, useState } from 'react';
import { probeCloud } from '../data/cloud';

export type ConnState = 'probing' | 'online' | 'offline';

export interface Connection {
  state: ConnState;
  /** 累计探测次数 */
  attempts: number;
  /** 最近一次成功的往返延迟 */
  latency: number | null;
}

/**
 * 打开页面就开始的连接探测（口令页阶段也在跑）。
 *
 * 节奏：
 * - 一开始每 1 秒探一次，持续 10 秒
 * - 10 秒还没连上，改成 1.5s → 4s → 9s → 20s，之后每 20s 一次，直到成功
 * - 一旦成功就停；之后断网由「online」事件触发一次立即重探
 */
export function useConnection(onFirstSuccess?: () => void): Connection {
  const [state, setState] = useState<ConnState>('probing');
  const [attempts, setAttempts] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);

  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const startedAtRef = useRef(Date.now());
  const attemptRef = useRef(0);
  const slowPhaseRef = useRef(0);
  const successRef = useRef(false);
  const onSuccessRef = useRef(onFirstSuccess);
  onSuccessRef.current = onFirstSuccess;

  useEffect(() => {
    aliveRef.current = true;

    const clear = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const schedule = (delay: number) => {
      clear();
      timerRef.current = window.setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      if (!aliveRef.current || successRef.current) return;
      attemptRef.current += 1;
      setAttempts(attemptRef.current);

      const result = await probeCloud(4000);
      if (!aliveRef.current) return;

      if (result.ok) {
        successRef.current = true;
        setState('online');
        setLatency(result.ms);
        clear();
        onSuccessRef.current?.();
        return;
      }

      setState('offline');

      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed < 10000) {
        // 前 10 秒：每秒重连一次
        schedule(1000);
      } else {
        // 之后：1.5s → 4s → 9s → 20s，然后固定 20s
        const seq = [1500, 4000, 9000, 20000];
        const delay = seq[Math.min(slowPhaseRef.current, seq.length - 1)];
        slowPhaseRef.current += 1;
        schedule(delay);
      }
    };

    void tick();

    // 系统告诉网络恢复时立刻重探一次（不必等下一个定时器）
    const onOnline = () => {
      if (!successRef.current) {
        clear();
        void tick();
      }
    };
    window.addEventListener('online', onOnline);

    return () => {
      aliveRef.current = false;
      clear();
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return { state, attempts, latency };
}
