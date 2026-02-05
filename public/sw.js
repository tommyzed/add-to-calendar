const CACHE_NAME = 'screenshot-calendar-v3'; // Increment to force update

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Clear old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== 'share-target') {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.pathname === '/share-target' && event.request.method === 'POST') {
        event.respondWith(
            (async () => {
                try {
                    const formData = await event.request.formData();
                    const mediaFiles = formData.getAll('media');

                    // Store in Cache API or IndexedDB to retrieve in the client
                    // For simplicity/robustness, we'll try to use the BroadcastChannel or Client.postMessage
                    // But first, let's just redirect to root which will check for the data

                    // Better approach:
                    // 1. Get client
                    // 2. Post message

                    const client = await self.clients.get(event.clientId);
                    // Note: event.clientId might be null if it's a navigation request/form submission from outside

                    // Fallback: Store in a specifically named cache "share-target"
                    const cache = await caches.open('share-target');
                    await cache.put('shared-file', new Response(mediaFiles[0]));

                    return Response.redirect('/?shared=true', 303);
                } catch (err) {
                    console.error('Share target failed', err);
                    return Response.redirect('/?error=share_failed', 303);
                }
            })()
        );
    }
});
