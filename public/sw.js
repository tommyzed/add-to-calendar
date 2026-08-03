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

                    const file = mediaFiles[0];

                    // Try sending via BroadcastChannel
                    try {
                        const channel = new BroadcastChannel('share-target');
                        channel.postMessage({ type: 'share-file', file });
                    } catch (err) {
                        console.error('BroadcastChannel failed', err);
                    }

                    // Try sending via Client.postMessage
                    try {
                        const windowClients = await self.clients.matchAll({ type: 'window' });
                        for (const client of windowClients) {
                            client.postMessage({ type: 'share-file', file });
                        }
                    } catch (err) {
                        console.error('postMessage failed', err);
                    }

                    // Fallback: Store in a specifically named cache "share-target"
                    const cache = await caches.open('share-target');
                    await cache.put('shared-file', new Response(file));

                    return Response.redirect('/?shared=true', 303);
                } catch (err) {
                    console.error('Share target failed', err);
                    return Response.redirect('/?error=share_failed', 303);
                }
            })()
        );
    }
});
