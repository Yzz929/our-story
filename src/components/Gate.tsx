import { useEffect, useRef, useState } from 'react';
import { kickMusic } from '../lib/audioBus';
import type { Connection } from '../lib/useConnection';
import { Heart } from './Icons';

export interface GateConfig {
  enabled?: boolean;
  title?: string;
  hint?: string;
  password?: string;
  placeholder?: string;
  button?: string;
  wrong?: string;
}

const STORAGE_KEY = 'our-story:gate';

/** 口令 + 一个可爱的进入页；输对了才把站点放出来 */
export function Gate({
  config,
  onUnlock,
  connection,
}: {
  config: Required<Pick<GateConfig, 'title' | 'hint' | 'password' | 'placeholder' | 'button' | 'wrong'>>;
  onUnlock: () => void;
  connection?: Connection;
}) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() === config.password) {
      localStorage.setItem(STORAGE_KEY, config.password);
      // 必须在点击手势里同步开始播放，iOS Safari 才允许出声
      kickMusic();
      setLeaving(true);
      window.setTimeout(onUnlock, 520);
    } else {
      setWrong(true);
      setValue('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className={`gate ${leaving ? 'gate-leaving' : ''}`}>
      <div className="gate-orbs" aria-hidden="true">
        <i className="gate-orb gate-orb-a" />
        <i className="gate-orb gate-orb-b" />
      </div>
      <div className="gate-hearts" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="gate-heart" style={{ left: `${10 + i * 12}%`, animationDelay: `${i * 1.7}s` }}>
            ♥
          </span>
        ))}
      </div>

      <form className="gate-card" onSubmit={submit}>
        <div className="gate-mark" aria-hidden="true">
          <Heart />
        </div>
        <p className="eyebrow">OUR LITTLE WORLD</p>
        <h1 className="gate-title">{config.title}</h1>
        <p className="gate-hint">{config.hint}</p>

        <input
          ref={inputRef}
          className={`gate-input ${wrong ? 'shake' : ''}`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder={config.placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setWrong(false);
          }}
          aria-label={config.placeholder}
        />

        <button className="gate-btn" type="submit">
          {config.button}
        </button>

        <p className={`gate-error ${wrong ? 'show' : ''}`}>{config.wrong}</p>

        {connection?.state === 'offline' && (
          <p className="gate-net">
            <i aria-hidden="true" />
            网络有点不稳，正在自动重连…
          </p>
        )}
      </form>

      <p className="gate-foot">只给两个人的小地方</p>
    </div>
  );
}

export function gateNeeded(gate?: GateConfig): boolean {
  if (!gate?.enabled || !gate.password) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== gate.password;
  } catch {
    return true;
  }
}
