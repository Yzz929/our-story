import { useCallback, useEffect, useRef, useState } from 'react';
import { photoUrl } from '../lib/photo';
import { registerMusicStarter } from '../lib/audioBus';
import { MusicNote, Mute } from './Icons';

const KEY = 'our-story:music';
const VOLUME = 0.55;

export interface Track {
  src: string;
  title: string;
}

/** 随机不重复播放：一轮放完再重洗 */
function shuffled(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function MusicPlayer({ tracks, visible }: { tracks: Track[]; visible: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<number[]>([]);
  const mutedRef = useRef(false);
  const startedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(KEY) === 'off';
    } catch {
      return false;
    }
  });
  const [title, setTitle] = useState('');

  const nextIndex = useCallback(() => {
    if (!tracks.length) return 0;
    if (!queueRef.current.length) queueRef.current = shuffled(tracks.length);
    return queueRef.current.shift()!;
  }, [tracks.length]);

  const playNext = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !tracks.length) return;
    const index = nextIndex();
    audio.src = photoUrl(tracks[index].src);
    setTitle(tracks[index].title);
    audio.volume = VOLUME;
    const p = audio.play();
    if (p) p.catch(() => setPlaying(false));
  }, [nextIndex, tracks]);

  // 监听静音状态，供外部（口令页手势）判断
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // 把「点进来就播」的入口交给 audioBus，供口令页在点击手势里同步调用
  useEffect(() => {
    registerMusicStarter(() => {
      if (!tracks.length || mutedRef.current) return;
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.src && !audio.paused) return;
      if (audio.src && startedRef.current) {
        audio.play().catch(() => {});
        return;
      }
      startedRef.current = true;
      playNext();
    });
    return () => registerMusicStarter(null);
  }, [playNext, tracks.length]);

  // 进入站点后如果还没开始（比如桌面端没走手势），直接播
  useEffect(() => {
    if (!visible || !tracks.length || muted) return;
    if (startedRef.current) return;
    startedRef.current = true;
    playNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tracks.length, muted]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setMuted(true);
      mutedRef.current = true;
      try {
        localStorage.setItem(KEY, 'off');
      } catch {}
      return;
    }
    setMuted(false);
    mutedRef.current = false;
    try {
      localStorage.setItem(KEY, 'on');
    } catch {}
    if (!audio.src) {
      startedRef.current = true;
      playNext();
    } else {
      audio.play().catch(() => {});
    }
  };

  if (!tracks.length) return null;

  return (
    <div className={`music ${playing ? 'is-playing' : 'is-muted'} ${visible ? '' : 'is-hidden'}`}>
      <audio
        ref={audioRef}
        preload="none"
        onEnded={playNext}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        className="music-btn"
        onClick={toggle}
        aria-label={playing ? '静音' : '播放背景音乐'}
        title={title ? `${playing ? '正在播放：' : '已静音：'}${title}` : '背景音乐'}
      >
        {playing ? <MusicNote /> : <Mute />}
        {playing && (
          <span className="music-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
      </button>
      {title && <span className="music-title">{title}</span>}
    </div>
  );
}
