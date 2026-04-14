const CACHE_NAME = 'labiq-v1';
const ASSETS = [
    'index.html',
    'login.html',
    'register.html',
    'css/style.css',
    'js/api-client.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css'
];

// Instalar Service Worker y cachear archivos estáticos
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Estrategia: Intentar red, si falla usar caché
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});