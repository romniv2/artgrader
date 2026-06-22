/* ArtGrader service worker — offline app shell.
   Bump CACHE when you change any cached asset. */
const CACHE = "artgrader-v2";
const ASSETS = [
  "./", "index.html", "styles.css",
  "analysis.js", "corrections.js", "theory.js", "history.js", "share.js", "app.js",
  "manifest.webmanifest", "favicon.svg", "favicon-32.png",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png", "og-image.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // only handle same-origin GETs; let the Anthropic API call go straight to network
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("index.html"))   // offline navigation fallback
    )
  );
});
