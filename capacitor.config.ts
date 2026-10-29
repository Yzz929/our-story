import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yzz929.ourstory',
  appName: '我们的小宇宙',
  webDir: 'dist',
  backgroundColor: '#fffaf7',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#fffaf7',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#fffaf7',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#fffaf7',
      overlaysWebView: false,
    },
  },
};

export default config;
