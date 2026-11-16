// Calera Math — no offline cache for now.
// The earlier service worker listed files this site does not have, so it could
// never install. This one removes any old copy and its caches so every device
// always loads the newest version of the board.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) await caches.delete(key);
        await self.registration.unregister();
    })());
});
