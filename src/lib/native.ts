import { Capacitor } from '@capacitor/core';

/** 是否跑在 Capacitor 原生壳里（安卓/iOS），网页上返回 false */
export const isNative = (): boolean => Capacitor.isNativePlatform();

/** 原生壳的启动收尾：状态栏配色 + 隐藏启动图 */
export async function initNativeUi(theme: 'light' | 'dark'): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#171219' : '#fffaf7' });
  } catch {
    /* 插件不可用就忽略 */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* 忽略 */
  }
}

/**
 * 注册安卓物理返回键处理。
 * handler 返回 true 表示「这次返回被页面消化了」，false 交给系统（退出 App）。
 * 返回一个取消注册的函数。
 */
export async function registerBackHandler(handler: () => boolean | Promise<boolean>): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { App: CapApp } = await import('@capacitor/app');
    const listener = await CapApp.addListener('backButton', async () => {
      const handled = await handler();
      if (!handled) await CapApp.exitApp();
    });
    return () => {
      void listener.remove();
    };
  } catch {
    return () => {};
  }
}
