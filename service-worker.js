const VERSION = "v8552-mobile-checkout-1";
const STATIC_CACHE = `tpg-static-${VERSION}`;
const IMAGE_CACHE = `tpg-images-${VERSION}`;
const CORE = [
  "./", "./index.html", "./admin.html", "./pos.html", "./reports.html",
  "./style.css", "./admin.css", "./pos.css", "./reports.css",
  "./app.js", "./admin.js", "./pos.js", "./reports.js", "./stability.js",
  "./config.js", "./logo.png", "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![STATIC_CACHE, IMAGE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
    return response;
  } catch (_) {
    return (await cache.match(request)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then((response) => {
    if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || update || Response.error();
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Cache menu images even when they come from Supabase Storage (cross-origin).
  if (event.request.destination === "image") {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (["document", "script", "style"].includes(event.request.destination)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
