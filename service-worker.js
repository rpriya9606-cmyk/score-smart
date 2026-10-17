// Score Smart service worker (v3)
// - Pages (index.html): network first, so students always get the newest version when online.
//   If the network is slow (4 s) or offline, the saved copy is used, so the app still works offline.
// - Other files: saved copy first, then network.
const CACHE_NAME = 'score-smart-v3';
const URLS = ['./index.html', './manifest.json'];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            Promise.all(URLS.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
        )
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

function pageRequest(req) {
    return new Promise(resolve => {
        let done = false;
        const finish = res => { if (!done && res) { done = true; resolve(res); } };
        const timer = setTimeout(() => { caches.match('./index.html').then(finish); }, 4000);
        fetch(req.url, { cache: 'no-cache' }).then(res => {
            clearTimeout(timer);
            if (res && res.ok) {
                const copy = res.clone();
                caches.open(CACHE_NAME).then(c => c.put('./index.html', copy));
                finish(res);
            } else {
                caches.match('./index.html').then(hit => finish(hit || res));
            }
        }).catch(() => {
            clearTimeout(timer);
            caches.match('./index.html').then(hit => finish(hit || Response.error()));
        });
    });
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
    if (isPage) { event.respondWith(pageRequest(req)); return; }
    event.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
            if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
            return res;
        }).catch(() => caches.match('./index.html')))
    );
});
