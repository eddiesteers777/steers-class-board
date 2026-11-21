/* ==========================================
   Anchor Board — turn on the offline copy of the site (sw.js).
   Loaded by the board, the Remote and Quick lesson. Once it has run on a device, those pages open
   even with no wifi, showing the lesson saved on that device, and catch up when the wifi is back.
   ?nooffline on any of those pages removes it from that device (for troubleshooting).
========================================== */
if ("serviceWorker" in navigator && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
    const off = new URLSearchParams(location.search).has("nooffline");
    const go = () => {
        if (off) {
            navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
            if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
            return;
        }
        navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch((e) => console.warn("Anchor Board: offline copy not available.", e));
    };
    if (document.readyState === "complete") go(); else addEventListener("load", go);
}
