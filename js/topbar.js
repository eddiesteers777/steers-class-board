/* Anchor Board — the Home top bar on every teacher page, on phones (Eddie, Nov 26: "bring that same header to every
   page on the phone except remote and board builder").
   A plain script placed right after the page's own <header>, so the bar is there before the page paints.
   It adds the same bar as Home: three lines that open the Pages card (and turn into an X), a gear that drops the
   Settings card (and turns into an X), and a sign-out icon that opens one Sign out button. The anchor sits faintly
   behind the bar. css/topbar.css shows it only below 1000px; computers and the classroom screen keep the page's own header.
   On phones the page's own header keeps only what is particular to that page (a Save button, a period picker, ...);
   its logo and the links the Pages card already has are hidden, and the save status moves into the bar.
   Bell times, Today and Plan ahead live on Home, so those rows open Home's Settings at that section. */
(function () {
    if (window.__anchorTopbar) return;
    window.__anchorTopbar = 1;
    var old = document.querySelector("header.cbar, header.tk-top");
    if (!old) return;
    var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    var SVG = function (d) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + "</svg>"; };
    var I = {
        home: '<path d="M3 11l9-8 9 8"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
        remote: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
        builder: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M6 13l3-3 2 2 4-4 3 3"/><path d="M8 21h8M12 17v4"/>',
        tracker: '<path d="M12 2l2.9 6.9L22 9.3l-5.5 4.7L18.2 21 12 17.3 5.8 21l1.7-7L2 9.3l7.1-.4z"/>',
        lesson: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
        sub: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        games: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        plan: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
        library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
        students: '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>',
        seats: '<rect x="3" y="3" width="18" height="3" rx="1"/><rect x="4" y="10" width="6" height="4" rx="1"/><rect x="14" y="10" width="6" height="4" rx="1"/><rect x="4" y="17" width="6" height="4" rx="1"/><rect x="14" y="17" width="6" height="4" rx="1"/>',
        rosters: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        x: '<path d="M6 6l12 12M18 6L6 18"/>',
        out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1 0 1.7-.8 1.7-1.7 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-1 .8-1.7 1.7-1.7H17a5 5 0 0 0 5-5C22 6 17.5 2 12 2z"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
        cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 15h3"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        year: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M8 7h8M8 11h6"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
        chev: '<path d="M9 6l6 6-6 6"/>'
    };
    // The same pages, groups and order as Home's Pages card on a phone (Open Board stays off phones). Home comes first here.
    // Each page that belongs to a row (the Students tabs, the Plan tabs, the games) lights that row up.
    var PAGES = [
        [null, [["index.html", "Home", I.home, []]]],
        ["Teach", [["remote.html", "Remote", I.remote, []], ["studio.html", "Board Builder", I.builder, []], ["tracker.html", "Class Tracker", I.tracker, []],
            ["lesson.html", "Quick lesson", I.lesson, []], ["sub.html", "Sub view", I.sub, []], ["games.html", "Game Library", I.games, ["bingo.html", "maker.html"]]]],
        ["Plan", [["plan.html", "Plan", I.plan, ["review.html", "builder.html", "planner.html", "standards.html", "timeline.html", "bank.html", "walk.html"]],
            ["library.html", "Library", I.library, []]]],
        ["Track", [["progress.html", "Students", I.students, ["profiles.html", "grades.html", "assign.html", "data.html", "work.html", "catchup.html", "fluency.html"]],
            ["seats.html", "Seating Charts", I.seats, []], ["rosters.html", "Rosters", I.rosters, []]]]
    ];
    var inCard = {};
    var nav = PAGES.map(function (g) {
        return (g[0] ? '<p class="hm-sg">' + g[0] + "</p>" : "") + g[1].map(function (p) {
            inCard[p[0]] = 1;
            var on = p[0] === here || p[3].indexOf(here) >= 0;
            return '<a class="hm-sl" href="' + p[0] + '"' + (on ? ' aria-current="page"' : "") + ">" + SVG(p[2]) + '<span class="hm-slt"><b>' + p[1] + "</b></span></a>";
        }).join("");
    }).join("");
    inCard["standards.html"] = 1;   // a new teacher's Plan row opens Standards
    var row = function (k, ic, title, small, tag, href) {
        var inner = '<span class="tbs-ic">' + SVG(ic) + '</span><span class="tbs-t"><b>' + title + "</b><small" + (k ? ' id="tbsSum-' + k + '"' : "") + ">" + small + '</small></span><svg class="tbs-chev" viewBox="0 0 24 24" aria-hidden="true">' + I.chev + "</svg>";
        return tag === "a" ? '<a class="tbs-row tbs-head" href="' + href + '">' + inner + "</a>"
            : '<button class="tbs-row tbs-head" type="button" id="tbsH-' + k + '" aria-expanded="false" aria-controls="tbsB-' + k + '">' + inner + "</button>";
    };
    var link = function (ic, title, small, href, id) {
        return '<a class="tbs-row tbs-link" href="' + href + '"' + (id ? ' id="' + id + '"' : "") + '><span class="tbs-ic">' + SVG(ic) + '</span><span class="tbs-t"><b>' + title + "</b><small>" + small + '</small></span><svg class="tbs-chev" viewBox="0 0 24 24" aria-hidden="true">' + I.chev + "</svg></a>";
    };
    var html =
        '<div class="cbar hb-bar tb-bar">' +
            '<button class="hb-menu" id="tbPages" type="button" aria-controls="tbSide" aria-expanded="false" aria-label="Pages" data-tip="Pages"><span class="hb-lines" aria-hidden="true"><i></i><i></i><i></i></span></button>' +
            '<span class="tb-live" id="tbLive"></span>' +
            '<div class="hb-acts">' +
                '<button class="hb-ico tb-gear" id="tbGear" type="button" aria-haspopup="dialog" aria-controls="tbSettings" aria-expanded="false" aria-label="Settings" data-tip="Settings"><svg class="tb-g" viewBox="0 0 24 24" aria-hidden="true">' + I.gear + '</svg><svg class="tb-gx" viewBox="0 0 24 24" aria-hidden="true">' + I.x + "</svg></button>" +
                '<button class="hb-ico hb-out" id="tbOut" type="button" aria-controls="tbOutPop" aria-expanded="false" aria-label="Sign out" data-tip="Sign out">' + SVG(I.out) + "</button>" +
                '<div class="hb-pop" id="tbOutPop" hidden><button class="btn" id="tbSignOut" type="button">' + SVG(I.out) + "<span>Sign out</span></button></div>" +
            "</div>" +
        "</div>" +
        '<aside class="hm-side tb-side" id="tbSide" aria-label="Pages"><nav class="hm-snav">' + nav + "</nav></aside>" +
        '<div class="tb-scrim" id="tbSideScrim" hidden></div>' +
        '<div class="tb-scrim tbs-scrim" id="tbSetScrim" hidden></div>' +
        '<div class="tbs" id="tbSettings" role="dialog" aria-label="Settings" inert><div class="tbs-in">' +
            '<section class="tbs-acc" data-k="look">' + row("look", I.palette, "Look", "Colors and Light or Night") +
                '<div class="tbs-body" id="tbsB-look" role="region" aria-labelledby="tbsH-look"><div class="tbs-bi">' +
                    '<div class="sk-sw" id="tbsSw" role="group" aria-label="Color scheme"></div>' +
                    '<div class="sk-modes" id="tbsModes" role="group" aria-label="Light or Night"></div>' +
                    '<p class="tbs-hint">These colors follow you to your other devices. The projected board keeps its own Board look.</p>' +
                    '<p class="tbs-note" id="tbsNote" role="status"></p>' +
                "</div></div></section>" +
            '<section class="tbs-acc">' + row(null, I.clock, "Today runs on", "Pick today's schedule on Home", "a", "index.html?settings=today") + "</section>" +
            '<section class="tbs-acc">' + row(null, I.bell, "Bell times", "Periods and other times, on Home", "a", "index.html?settings=bells") + "</section>" +
            '<section class="tbs-acc">' + row(null, I.cal, "Plan ahead", "Activity days and early dismissal, on Home", "a", "index.html?settings=ahead") + "</section>" +
            '<section class="tbs-acc" data-k="acct">' + row("acct", I.users, "Classes, school year and data", "Your classes, dates and backup") +
                '<div class="tbs-body" id="tbsB-acct" role="region" aria-labelledby="tbsH-acct"><div class="tbs-bi">' +
                    link(I.users, "Your classes", "Classes and periods", "setup.html", "tbsSetup") +
                    link(I.year, "School year", "First and last day", "setup.html#year") +
                    link(I.shield, "Your data and backup", "See, download or delete", "account.html") +
                    link(I.users, "Teacher access", "Who can use Anchor Board", "access.html", "tbsAccess") +
                "</div></div></section>" +
        "</div></div>";
    old.insertAdjacentHTML("beforebegin", html);
    var body = document.body, $ = function (id) { return document.getElementById(id); };
    body.classList.add("tb-on");
    var phone = window.matchMedia("(max-width:999px)");

    /* ---------- the page's own header on phones: keep only what is particular to this page ---------- */
    var setupRow = $("tbsSetup");
    setupRow.hidden = true;   // "Your classes" is for a new teacher's own setup; shown once the account is known to be one
    // "Teacher access" (access.html) is the site owner's alone: shown once js/access.js has found this account is the owner.
    var accessRow = $("tbsAccess");
    accessRow.hidden = true;
    try { var me = localStorage.getItem("school-account-storage-owner"); if (me && localStorage.getItem("anchor-access:" + me) === "owner") accessRow.hidden = false; } catch (e) { /* storage unavailable */ }
    if (old.classList.contains("cbar")) {
        old.querySelectorAll("a[href]").forEach(function (a) {
            var h = (a.getAttribute("href") || "").toLowerCase();
            if (h.indexOf("?") < 0 && h.indexOf("#") < 0 && inCard[h]) a.classList.add("tb-dup");   // the Pages card has it
        });
        var status = $("status"), mark = null;
        var rest = [].filter.call(old.children, function (c) { return !c.classList.contains("cbrand") && !c.classList.contains("tb-dup") && c !== status; });
        if (!rest.length) old.classList.add("tb-empty");
        // The save status ("Saved", "Offline") sits in the bar on phones, beside the gear, and goes back on a computer.
        if (status && old.contains(status)) {
            mark = document.createComment("status");
            status.parentNode.insertBefore(mark, status);
            var place = function () { if (phone.matches) $("tbLive").appendChild(status); else mark.parentNode.insertBefore(status, mark.nextSibling); };
            place();
            if (phone.addEventListener) phone.addEventListener("change", place);
        }
    }

    /* ---------- Pages: the three lines drop the card and turn into an X ---------- */
    var side = $("tbSide"), sideScrim = $("tbSideScrim"), lines = $("tbPages");
    side.querySelectorAll(".hm-sg,.hm-sl").forEach(function (e, i) { e.style.setProperty("--i", i); });
    function drawer(open) {
        if (open && stOpen) closeSettings(false);
        body.classList.toggle("tb-drawer", open); sideScrim.hidden = !open; side.inert = !open;
        lines.classList.toggle("hb-x", open); lines.setAttribute("aria-expanded", String(open));
        lines.setAttribute("aria-label", open ? "Close Pages" : "Pages"); lines.dataset.tip = open ? "Close" : "Pages";
        if (open) { var first = side.querySelector("a"); if (first) first.focus({ preventScroll: true }); }
    }
    side.inert = true;
    lines.onclick = function () { var open = !body.classList.contains("tb-drawer"); drawer(open); if (!open) lines.focus(); };
    sideScrim.onclick = function () { drawer(false); };

    /* ---------- Settings: the gear drops the card, sections fold open one at a time, the gear turns into an X ---------- */
    var card = $("tbSettings"), setScrim = $("tbSetScrim"), gear = $("tbGear"), stOpen = false;
    var secs = [].slice.call(card.querySelectorAll(".tbs-acc[data-k]"));
    function fold(k) {
        secs.forEach(function (s) { var on = s.dataset.k === k; s.classList.toggle("open", on); s.querySelector(".tbs-head").setAttribute("aria-expanded", String(on)); s.querySelector(".tbs-body").inert = !on; });
    }
    secs.forEach(function (s) { s.querySelector(".tbs-head").onclick = function () { fold(s.classList.contains("open") ? null : s.dataset.k); }; });
    card.querySelectorAll(".tbs-acc").forEach(function (s, i) { s.style.setProperty("--i", i); });
    function place() {   // under the gear, with the point aimed at it
        var r = gear.getBoundingClientRect(), bar = gear.closest(".tb-bar").getBoundingClientRect();
        var w = card.offsetWidth, right = 12, left = innerWidth - right - w;
        card.style.top = Math.round(bar.bottom + 14) + "px"; card.style.right = right + "px";
        card.style.setProperty("--cx", Math.round(Math.min(w - 24, Math.max(24, r.left + r.width / 2 - left))) + "px");
    }
    function openSettings() {
        if (body.classList.contains("tb-drawer")) drawer(false);   // one card at a time
        fold("look"); place(); stOpen = true; card.inert = false; setScrim.hidden = false; body.classList.add("tbs-open");
        gear.classList.add("hb-x"); gear.setAttribute("aria-expanded", "true"); gear.setAttribute("aria-label", "Close Settings"); gear.dataset.tip = "Close";
        var h = card.querySelector(".tbs-head"); if (h) setTimeout(function () { h.focus({ preventScroll: true }); }, 60);
    }
    function closeSettings(back) {
        if (!stOpen) return; stOpen = false; card.inert = true; setScrim.hidden = true; body.classList.remove("tbs-open");
        gear.classList.remove("hb-x"); gear.setAttribute("aria-expanded", "false"); gear.setAttribute("aria-label", "Settings"); gear.dataset.tip = "Settings";
        if (back) gear.focus();
    }
    gear.onclick = function () { if (stOpen) closeSettings(true); else openSettings(); };
    setScrim.onclick = function () { closeSettings(false); };
    addEventListener("resize", function () { if (stOpen) place(); });

    // Colors: the same dots and Light / Night / Match device as Home, saved to the account the same way.
    var SK = window.AnchorScheme, skTimer = 0, store = function () { return import("./boardStore.js?v=58"); };
    var MODE_ICON = { light: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        dark: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>', auto: '<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' };
    function skPaint() {
        var cur = SK.get();
        $("tbsSw").querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.c === cur.c)); });
        $("tbsModes").querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.m === cur.m)); });
        var it = SK.list.filter(function (x) { return x[0] === cur.c; })[0], md = (SK.modes.filter(function (x) { return x[0] === cur.m; })[0] || [, ""])[1];
        $("tbsSum-look").textContent = (it ? it[1] : "Colors") + ", " + md;
    }
    function skPick(o) {
        var cur = SK.set(o); skPaint();
        clearTimeout(skTimer);   // one save after the teacher stops tapping around
        skTimer = setTimeout(function () {
            store().then(function (s) { return s.save("settings/site", { c: cur.c, m: cur.m, at: cur.at }); })
                .then(function () { $("tbsNote").textContent = "Saved. Your other devices pick this up when they open Home."; })
                .catch(function (e) { $("tbsNote").textContent = "Saved on this device. Not saved to your account yet (" + ((e && e.code) || "connection") + ")."; });
        }, 700);
    }
    if (SK) {
        SK.list.forEach(function (s) {
            var b = document.createElement("button"); b.type = "button"; b.className = "sk-s"; b.dataset.c = s[0];
            b.innerHTML = '<i style="background:linear-gradient(135deg,' + s[2][0] + " 0%," + s[2][1] + " 55%," + s[2][2] + ' 100%)"></i><span></span>';
            b.lastChild.textContent = s[1]; b.onclick = function () { skPick({ c: s[0] }); }; $("tbsSw").appendChild(b);
        });
        SK.modes.forEach(function (m) {
            var b = document.createElement("button"); b.type = "button"; b.dataset.m = m[0];
            b.innerHTML = MODE_ICON[m[0]] + "<span></span>"; b.lastChild.textContent = m[1]; b.onclick = function () { skPick({ m: m[0] }); }; $("tbsModes").appendChild(b);
        });
        skPaint();
        addEventListener("anchor-scheme", skPaint);
    } else secs[0].hidden = true;
    fold(null);

    /* ---------- Sign out: the icon opens one Sign out button, so a stray tap never signs anyone out ---------- */
    var pop = $("tbOutPop"), outBtn = $("tbOut");
    function showOut(on) { pop.hidden = !on; outBtn.setAttribute("aria-expanded", String(on)); outBtn.classList.toggle("on", on); if (on) $("tbSignOut").focus(); }
    outBtn.onclick = function (e) { e.stopPropagation(); showOut(pop.hidden); };
    document.addEventListener("click", function (e) { if (!pop.hidden && !pop.contains(e.target)) showOut(false); });
    $("tbSignOut").onclick = function () {
        store().then(function (s) { return s.signOut(); }).catch(function () {}).then(function () { location.replace("login.html"); });
    };

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (stOpen) { e.preventDefault(); closeSettings(true); }
        else if (body.classList.contains("tb-drawer")) { drawer(false); lines.focus(); }
        else if (!pop.hidden) { showOut(false); outBtn.focus(); }
    });
    if (phone.addEventListener) phone.addEventListener("change", function () { drawer(false); closeSettings(false); showOut(false); });

    /* ---------- a new teacher (starter pack) sees the same Pages and Settings rows as on Home ---------- */
    import("./contentPack.js?v=5").then(function (m) { return m.myPack(); }).then(function (pack) {
        if (pack === "calera") return;
        setupRow.hidden = false;
        var pl = side.querySelector('a[href="plan.html"]');
        if (pl) { pl.href = "standards.html"; pl.querySelector("b").textContent = "Standards"; }
    }).catch(function () { /* signed out or offline: keep the default rows */ });
})();
