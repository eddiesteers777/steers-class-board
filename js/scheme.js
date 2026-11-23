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
        ["navy", "Anchor navy", ["#173F86", "#0B2559", "#081B45"]],
        ["royal", "Royal", ["#2E3AA8", "#1C2470", "#0F1440"]],
        ["ocean", "Ocean", ["#11607C", "#0A3D5A", "#06243A"]],
        ["teal", "Teal", ["#0F6B6B", "#0A4747", "#052A2A"]],
        ["forest", "Forest", ["#1F5C47", "#123B2E", "#0A251C"]],
        ["plum", "Plum", ["#4B2E75", "#2D1B4B", "#1A0F2E"]],
        ["berry", "Berry", ["#7A2257", "#4B1438", "#2A0A1F"]],
        ["crimson", "Crimson", ["#6E2533", "#42161F", "#260B12"]],
        ["slate", "Slate", ["#3B4659", "#242C3B", "#141A24"]]
    ];
    var MODES = [["light", "Light"], ["dark", "Night"], ["auto", "Match device"]];
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function clean(o) {
        o = o && typeof o === "object" ? o : {};
        var c = LIST.some(function (s) { return s[0] === o.c; }) ? o.c : "navy";
        var m = MODES.some(function (s) { return s[0] === o.m; }) ? o.m : "light";
        return { c: c, m: m, at: +o.at || 0 };
    }
    function read() { try { return clean(JSON.parse(localStorage.getItem(K) || "null")); } catch (e) { return clean(null); } }
    function modeOf(o) { return o.m === "auto" ? (mq && mq.matches ? "dark" : "light") : o.m; }
    function apply(o) {
        var h = document.documentElement, mode = modeOf(o);
        h.setAttribute("data-scheme", o.c);
        h.setAttribute("data-mode", mode);
        h.style.colorScheme = mode;
        var s = LIST.filter(function (x) { return x[0] === o.c; })[0] || LIST[0];
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", mode === "dark" ? "#070B16" : s[2][2]);
    }
    var cur = read();
    apply(cur);
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
