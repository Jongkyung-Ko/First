/* Lightweight PWA shell — network-first for app code, cache for offline revisit. */
const CACHE_NAME = "digital-world-shell-v5";
const PWA_ASSET_RE = /PWA_Loading|pwa-icon|manifest\.webmanifest/i;
const LEGACY_ASSET_RE = /digimon-icon|welcome-hero/i;

const PRECACHE = [
  "index.html?app=35",
  "manifest.webmanifest?v=35",
  "images/PWA_Loading.png?v=35",
  "images/pwa-icon-192.png?v=35",
  "images/pwa-icon-512.png?v=35"
];

function scopeUrl(path) {
  return new URL(path, self.registration.scope).href;
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function skipCachePath(pathname) {
  return (
    pathname.includes("/assets/audio/") ||
    pathname.includes("/.git") ||
    pathname.endsWith("sw.js")
  );
}

function isPwaAsset(url) {
  return PWA_ASSET_RE.test(url.pathname) || PWA_ASSET_RE.test(url.search);
}

function isLegacyAsset(url) {
  return LEGACY_ASSET_RE.test(url.pathname);
}

async function purgeLegacyAssets() {
  const keys = await caches.keys();
  await Promise.all(
    keys.map(async (key) => {
      const cache = await caches.open(key);
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((req) => isLegacyAsset(new URL(req.url)))
          .map((req) => cache.delete(req))
      );
    })
  );
}

async function networkFirst(request, fetchOptions = {}) {
  try {
    const response = await fetch(request, fetchOptions);
    if (response.ok && request.method === "GET" && !isLegacyAsset(new URL(request.url))) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match(scopeUrl("index.html?app=35"));
      if (fallback) return fallback;
      const legacyFallback = await caches.match(scopeUrl("index.html"));
      if (legacyFallback) return legacyFallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await caches.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkPromise;
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return caches.match(scopeUrl("index.html?app=35"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE.map(scopeUrl)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      purgeLegacyAssets()
    ])
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (!isSameOrigin(url) || skipCachePath(url.pathname)) return;

  if (isLegacyAsset(url)) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  if (event.request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(event.request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.includes("/data/") || url.pathname.endsWith(".json")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.pathname.endsWith(".js")) {
    event.respondWith(networkFirst(event.request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.endsWith(".webmanifest")) {
    event.respondWith(networkFirst(event.request, { cache: "no-store" }));
    return;
  }

  if (/\.(png|jpe?g|webp|ico|svg|woff2?)$/i.test(url.pathname)) {
    if (isPwaAsset(url)) {
      event.respondWith(networkFirst(event.request, { cache: "no-store" }));
      return;
    }
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
