// ══════════════════════════════════════════════════════════════
// ACPF – Service Worker
// Estrategia: el HTML siempre se pide primero a la red (para que los
// cambios que subís se vean al toque, sin cache vieja pisando la nueva
// versión); las imágenes/manifest quedan en cache para que la app abra
// rápido y funcione offline. Subí CACHE_VERSION cuando cambies escudos,
// logos o la foto de fondo, así se vuelven a descargar.
// ══════════════════════════════════════════════════════════════

const CACHE_VERSION = "v2";
const CACHE_NAME = `acpf-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  "./manifest.json",
  "./logo.png", "./logo2.png", "./cancha.jpg", "./intro.mp3",
  "./anahi.png", "./camba_pora.png", "./coe_mbota.png", "./cruz_quiroz.png",
  "./once_corazones.png", "./san_antonio.png", "./san_isidro.png", "./sol_naciente.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const esNavegacionHtml =
    req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  if (esNavegacionHtml) {
    // Red primero: siempre la versión más nueva de index.html si hay conexión.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  const esAssetEstatico = STATIC_ASSETS.some((a) => req.url.endsWith(a.replace("./", "")));
  if (esAssetEstatico) {
    // Cache primero (son archivos pesados que casi no cambian), red de respaldo.
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Todo lo demás (Supabase, fuentes de Google, CDN de supabase-js): directo
  // a la red, sin interceptar — necesitan estar siempre frescos.
});
