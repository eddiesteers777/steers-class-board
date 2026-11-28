/* Anchor Board — site colours (Eddie, 2026-11-23: "a setting where you can change the color scheme of the entire website").
   A plain script in <head>, before the styles paint, so a page never flashes the wrong colours.
   It only sets two attributes on <html>; css/skin.css does the rest:
     data-scheme = the accent family (navy, royal, ocean, teal, forest, plum, berry, crimson, slate)
     data-mode   = light or dark (the saved choice can be "auto", which follows the device)
   The choice lives on this device (localStorage) so every page reads it with no wait; Home also keeps
   a copy in the teacher's account (settings/site) so a new device picks it up.
   The projected board never loads this: the board has its own Board look. */
(function () {
    var K = "anchorboard-scheme";
    var LIST = [
        ["navy", "Anchor navy", ["#173F86", "#0B2559", "#081B45"], ["#7FAEDD", "#B9D3EE"]],
        ["royal", "Royal", ["#2E3AA8", "#1C2470", "#0F1440"], ["#8C98F0", "#C5CBF7"]],
        ["ocean", "Ocean", ["#11607C", "#0A3D5A", "#06243A"], ["#6FC0DA", "#B5E0EE"]],
        ["teal", "Teal", ["#0F6B6B", "#0A4747", "#052A2A"], ["#6CC7C1", "#B3E3E0"]],
        ["forest", "Forest", ["#1F5C47", "#123B2E", "#0A251C"], ["#7CC4A2", "#BCE2CF"]],
        ["plum", "Plum", ["#4B2E75", "#2D1B4B", "#1A0F2E"], ["#B79BE6", "#DACBF3"]],
        ["berry", "Berry", ["#7A2257", "#4B1438", "#2A0A1F"], ["#E39BC8", "#F2CDE3"]],
        ["crimson", "Crimson", ["#6E2533", "#42161F", "#260B12"], ["#E59AA3", "#F3CCD1"]],
        ["slate", "Slate", ["#3B4659", "#242C3B", "#141A24"], ["#9AA8BF", "#CBD3E0"]]
    ];    var MODES = [["light", "Light"], ["dark", "Night"], ["auto", "Match device"]];
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function clean(o) {
        o = o && typeof o === "object" ? o : {};
        var c = LIST.some(function (s) { return s[0] === o.c; }) ? o.c : "navy";
        var m = MODES.some(function (s) { return s[0] === o.m; }) ? o.m : "light";
        return { c: c, m: m, at: +o.at || 0 };
    }
    function read() { try { return clean(JSON.parse(localStorage.getItem(K) || "null")); } catch (e) { return clean(null); } }
    /* Glass teaching screens (Nov 28): a page with <html data-glass> (the Remote, the Board Builder) is always Night,
       whatever the site setting, so it matches Slides and Spotlight (css/glass.css). */
    function modeOf(o) { if (document.documentElement.hasAttribute("data-glass")) return "dark"; return o.m === "auto" ? (mq && mq.matches ? "dark" : "light") : o.m; }
    function apply(o) {
        var h = document.documentElement, mode = modeOf(o);
        h.setAttribute("data-scheme", o.c);
        h.setAttribute("data-mode", mode);
        h.style.colorScheme = mode;
        var s = LIST.filter(function (x) { return x[0] === o.c; })[0] || LIST[0];
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", mode === "dark" ? "#070B16" : s[2][2]);
        if (typeof paintLogo === "function" && document.body) paintLogo();
    }
    /* The top-left logo takes the scheme's colours too (Eddie, 2026-11-23). Same drawing as brand/logo.svg,
       only the colours change; Anchor navy keeps the real file. The amber ring stays: it is the brand's spark. */
    function logoUrl(s) {
        var c = s[2], k = s[3], ring = function (d, col, w) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>'; };
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".55" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient></defs><rect width="512" height="512" rx="112" fill="url(#g)"/>' +
            ring("M101.9 317.8 A170 170 0 0 1 101.9 174.2", c[0], 30) + ring("M410.1 174.2 A170 170 0 0 1 410.1 317.8", c[0], 30) + ring("M400.2 336.1 A170 170 0 0 1 111.8 336.1", k[0], 30) +
            ring("M353.0 190.0 A112 112 0 0 1 358.3 291.6", k[1], 28) + ring("M153.7 291.6 A112 112 0 0 1 159.0 190.0", k[1], 28) + ring("M352.0 303.7 A112 112 0 0 1 160.0 303.7", "#F6F9FD", 28) +
            '<path d="M256 160 L256 344" stroke="#F6F9FD" stroke-width="28" stroke-linecap="round"/><path d="M204 200 L308 200" stroke="#F6F9FD" stroke-width="24" stroke-linecap="round"/><circle cx="256" cy="122" r="30" fill="none" stroke="#F2B33D" stroke-width="22"/></svg>';
        return "data:image/svg+xml," + encodeURIComponent(svg);
    }
    function paintLogo() {
        var s = LIST.filter(function (x) { return x[0] === cur.c; })[0] || LIST[0];
        var imgs = document.querySelectorAll(".cbrand img");
        for (var i = 0; i < imgs.length; i++) {
            var im = imgs[i];
            if (!im.dataset.logo) { if (!/brand\/logo\.svg$/.test(im.getAttribute("src") || "")) continue; im.dataset.logo = im.getAttribute("src"); }
            var want = s[0] === "navy" ? im.dataset.logo : logoUrl(s);
            if (im.getAttribute("src") !== want) im.setAttribute("src", want);
        }
    }
    var cur = read();
    apply(cur);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paintLogo); else paintLogo();
    function set(o, quiet) {
        cur = clean({ c: o.c || cur.c, m: o.m || cur.m, at: o.at || Date.now() });
        try { localStorage.setItem(K, JSON.stringify(cur)); } catch (e) { /* private mode: this page still changes */ }
        apply(cur);
        if (!quiet) try { window.dispatchEvent(new CustomEvent("anchor-scheme", { detail: cur })); } catch (e) { /* old browser */ }
        return cur;
    }
    // Another tab changed it, or the device went dark.
    window.addEventListener("storage", function (e) { if (e.key === K) { cur = read(); apply(cur); } });
    if (mq) { var onMq = function () { if (cur.m === "auto") apply(cur); }; if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq); }
    // Settle the first paint, then let colours ease when the teacher changes them.
    window.addEventListener("load", function () { setTimeout(function () { document.documentElement.classList.add("sc-ready"); }, 60); });
    window.AnchorScheme = { list: LIST, modes: MODES, get: function () { return cur; }, set: set, mode: function () { return modeOf(cur); } };
})();
