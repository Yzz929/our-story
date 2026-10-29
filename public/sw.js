/* 我们的小宇宙 · Service Worker
 * 策略：
 * - 页面导航：网络优先，断网回退到缓存的 index.html（壳）
 * - 同源静态资源（js/css/照片/图标）：缓存优先 + 后台更新
 * - Supabase 接口：只走网络（数据必须实时）；公开存储的图片/音乐：缓存优先
 */
const VERSION = 'our-story-v1.1.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isApi = (url) => url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/');
const isPublicStorage = (url) => url.pathname.includes('/storage/v1/object/public/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase 数据接口：不缓存，保证新鲜
  if (isApi(url)) return;

  // 页面导航：网络优先，断网用缓存的壳
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 云端图片/音乐：缓存优先
  if (isPublicStorage(url)) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
    return;
  }

  // 同源静态资源：缓存优先，后台更新
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
