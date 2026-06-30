/* Lightweight PWA shell — network-first for app code, cache for offline revisit. */
const CACHE_NAME = "digital-world-shell-v3";

const PRECACHE = ["index.html", "manifest.webmanifest", "images/digimon-icon-256.png"];

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

async function networkFirst(request, fetchOptions = {}) {
  try {
    const response = await fetch(request, fetchOptions);
    if (response.ok && request.method === "GET") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match(scopeUrl("index.html"));
      if (fallback) return fallback;
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
  return caches.match(scopeUrl("index.html"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE.map(scopeUrl)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
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

  if (event.request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
    event.respondWith(networkFirst(event.request));
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

  if (/\.(png|jpe?g|webp|ico|svg|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
