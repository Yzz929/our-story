type Starter = () => void;

let starter: Starter | null = null;

/** MusicPlayer 挂载时登记自己的启动函数 */
export function registerMusicStarter(fn: Starter | null): void {
  starter = fn;
}

/**
 * 在「点进去」的同一个手势里同步触发播放。
 * iOS Safari 只认点击事件里同步调用的 play()，所以必须由口令页直接调用。
 */
export function kickMusic(): void {
  try {
    starter?.();
  } catch {
    /* 忽略：播放失败还有后续兜底 */
  }
}
