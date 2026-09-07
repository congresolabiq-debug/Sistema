const CACHE_NAME = 'fesz-9no-v2';
const ASSETS = [
    '/',
    'index.html',
    'login.html',
    'register.html',
    'student-dashboard.html',
    'evaluator-dashboard.html',
    'admin-dashboard.html',
    'submit-work.html',
    'encuesta-satisfaccion.html',
    'download.html',
    '404.html',
    'tutorial-estudiante.html',
    'tutorial-evaluador.html',
    'css/style.css',
    'js/config.js',
    'js/api-client.js',
    'js/app.js',
    'js/evaluation-assignment.js',
    'manifest.json',
    'favicon.ico',
    'favicon.jpg',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // API GET requests: cache then network
    if (url.origin === 'https://script.google.com' && e.request.method === 'GET') {
        e.respondWith(
            caches.match(e.request).then(cached => {
                const fetchPromise = fetch(e.request).then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return res;
                }).catch(() => cached);
                return fetchPromise;
            })
        );
        return;
    }

    // Navigation: stale-while-revalidate
    if (e.request.mode === 'navigate') {
        e.respondWith(
            caches.match(e.request).then(cached => {
                const fetchPromise = fetch(e.request).then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                    return res;
                }).catch(() => cached);
                return fetchPromise || caches.match('index.html');
            })
        );
        return;
    }

    // Static assets: cache-first
    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request).then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            });
        })
    );
});
