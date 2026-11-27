// Zikirmatik çevrimdışı önbelleği.
// - Her sürümde önbellek adı değişir (1.10.5+2027-20261127121029 derleme betiğiyle doldurulur),
//   eski önbellek silinir; böylece kullanıcılar eski sürümde takılı kalmaz.
// - Adında sürüm damgası olan dosyalar (ör. main.dart.79675bfc.js): önce önbellek.
// - Diğer her şey (index.html, haptics.js, stats.js, canvaskit...): önce internet, yoksa önbellek.
//   (Önceki sürümde damgasız dosyalar önbellekten verildiği için güncellemeden sonraki ilk
//   açılışta eski haptics.js ile yeni uygulama karışabiliyordu.)
// - İlk açılışta sayfanın yüklediği dosyalar, sayfadan gelen mesajla önbelleğe alınır.
const CACHE = 'zikirmatik-1.10.5+2027-20261127121029';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'cache' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        data.urls.filter((u) => !/\.apk(\?|$)/.test(u)).map((u) =>
          cache.match(u).then((hit) => hit || cache.add(u).catch(() => {}))
        )
      )
    )
  );
});

function isHashed(url) {
  return /\.[0-9a-f]{8}\.[a-z0-9]+$/i.test(url.pathname);
}

function sameVersion(a, b) {
  const ea = a.headers.get('etag');
  const eb = b.headers.get('etag');
  if (ea && eb) return ea === eb;
  const la = a.headers.get('last-modified');
  const lb = b.headers.get('last-modified');
  return !!(la && lb && la === lb);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Android APK'sı (48 MB) önbelleğe alınmaz; doğrudan internetten iner.
  if (url.pathname.endsWith('.apk')) return;

  if (isHashed(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          const old = await cache.match(request, { ignoreSearch: true });
          // Aynı dosyayı (ör. 7 MB canvaskit) her açılışta yeniden yazmamak için sürüm kontrolü.
          if (!old || !sameVersion(old, response)) await cache.put(request, response.clone());
        }
        return response;
      } catch (e) {
        return (
          (await cache.match(request, { ignoreSearch: true })) ||
          (request.mode === 'navigate'
            ? (await cache.match('/')) || (await cache.match('index.html'))
            : undefined) ||
          Response.error()
        );
      }
    })()
  );
});
