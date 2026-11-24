/* ==========================================
   Anchor Board — the Timeline as a map (Nov 24, Eddie: "something like a map that's fun", easy to read for each grade).
   The year is one road from the first day to ACAP. Each nine weeks is a region with a signpost; each unit is a stop.
   Taught stops are green, the amber pin is "You are here" (the same place Next up calls current), and the road
   is drawn solid up to it. The stop you are at and the next one show each standard's wording; the others show
   codes and open their wording with one tap. Tapping a standard opens its problems (the Phase 2 picker).
   The road is one SVG behind the stops, drawn through the stop dots after layout and again when the size changes.
   Model: mapStops() in js/timelineCore.js. Page: js/timeline.js. Styles: css/timeline.css (class names start tm-).
========================================== */

const NS = "http://www.w3.org/2000/svg";
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function svg(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
const cut = (t, n) => (t.length > n ? t.slice(0, n - 1).trim() + "…" : t);
const STATE_WORD = { taught: "Taught", teaching: "Teaching", reteach: "Reteach", "": "Not yet" };
const ORD = ["1st", "2nd", "3rd", "4th"];

const ICON = {
    check: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pin: '<svg viewBox="0 0 20 24" width="16" height="19" aria-hidden="true"><path d="M10 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.4 7.5 13.5 7.5 13.5S17.5 14.4 17.5 9A7.5 7.5 0 0 0 10 1.5z" fill="currentColor"/><circle cx="10" cy="9" r="2.8" fill="#fff"/></svg>',
    flag: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 18V2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 3h10.5l-2.6 3.6L15.5 10H5z" fill="currentColor"/></svg>',
    finish: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 18V2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 3h11v7H5z" fill="#fff" stroke="currentColor" stroke-width="1.4"/><path d="M5 3h2.75v1.75H5zM10.5 3h2.75v1.75H10.5zM7.75 4.75h2.75V6.5H7.75zM13.25 4.75H16V6.5h-2.75zM5 6.5h2.75v1.75H5zM10.5 6.5h2.75v1.75H10.5zM7.75 8.25h2.75V10H7.75zM13.25 8.25H16V10h-2.75z" fill="currentColor"/></svg>',
};

/** Stops the teacher opened or closed by hand, per class: { cls: Map(stop number -> open) }. Others follow the default. */
const flipped = {};

/** What a stop says under its name: "Done", "You are here · teaching 8.25", "2 of 5 taught"… */
function stopLine(st) {
    const teach = st.items.filter((x) => x.state === "teaching").map((x) => x.code);
    const parts = [];
    if (st.state === "done") parts.push("Done · all " + (st.total === 1 ? "1 standard" : st.total + " standards") + " taught");
    else {
        if (teach.length) parts.push("Teaching " + teach.join(", "));
        parts.push(st.taught + " of " + st.total + " taught");
        if (st.state === "left") parts.push((st.total - st.taught) + " left open");
    }
    if (st.reteach) parts.push(st.reteach + " to reteach");
    return parts.join(" · ");
}

/**
 * Draw the map into `box`.
 * o = { cls, model (mapStops), dates: [{start, end}] per nine weeks (labels), notes: [] per nine weeks or null,
 *       nowLane (-1 if none), nowLeft (school days left in it), startLabel, endLabel,
 *       openStd(code), edit() (switch to the Cards view), onLayout() optional }
 */
export function drawMap(box, o) {
    const m = o.model; box.textContent = "";
    if (!m || !m.stops.length) {
        const e = el("div", "tm-empty"); e.appendChild(el("p", null, "No standards on this timeline yet."));
        const b = el("button", "btn", "Open the cards"); b.type = "button"; b.onclick = o.edit; e.appendChild(b); box.appendChild(e); return;
    }
    const flip = flipped[o.cls] = flipped[o.cls] || new Map();
    const openByDefault = (st, i) => i === m.here || i === m.next || st.state === "teaching";
    const isOpen = (st, i) => (flip.has(st.n) ? flip.get(st.n) : openByDefault(st, i));

    box.appendChild(summary(m, o));

    const map = el("div", "tm-map"); map.setAttribute("role", "list"); map.setAttribute("aria-label", "The year, stop by stop");
    const road = svg("svg", { class: "tm-road", "aria-hidden": "true" }); map.appendChild(road);

    const start = el("div", "tm-end tm-start"); start.setAttribute("role", "listitem");
    start.innerHTML = '<span class="tm-flag">' + ICON.flag + "</span>";
    start.appendChild(el("span", "tm-endtxt", o.startLabel || "First day of school")); map.appendChild(start);

    let idx = 0;
    m.regions.forEach((R, li) => {
        const reg = el("section", "tm-region r" + (li + 1) + (li === o.nowLane ? " now" : "")); reg.setAttribute("role", "listitem");
        reg.setAttribute("aria-label", R.name);
        // the signpost
        const sign = el("header", "tm-sign");
        const tt = el("div", "tm-stitle");
        tt.appendChild(el("h2", null, R.name));
        if (li === o.nowLane) tt.appendChild(el("span", "tm-now", "Now · " + o.nowLeft + (o.nowLeft === 1 ? " school day" : " school days") + " left"));
        sign.appendChild(tt);
        if (o.dates && o.dates[li]) sign.appendChild(el("p", "tm-dates", o.dates[li]));
        if (o.notes && o.notes[li]) sign.appendChild(el("p", "tm-note", o.notes[li]));
        const all = R.stops.flatMap((s) => s.items), done = all.filter((x) => x.state === "taught").length;
        if (all.length) {
            const pr = el("div", "tm-sprog");
            const bar = el("div", "pl-prog"); const bi = el("i"); bi.style.width = (100 * done) / all.length + "%"; bar.appendChild(bi);
            pr.append(bar, el("span", null, done + " of " + all.length + " taught"));
            sign.appendChild(pr);
        }
        const head = el("div", "tm-head"), mile = el("span", "tm-mile", String(li + 1)); mile.setAttribute("aria-hidden", "true");
        head.append(mile, sign); reg.appendChild(head);
        // the stops
        const ol = el("ol", "tm-stops"); ol.setAttribute("aria-label", "Stops in the " + R.name);
        if (!R.stops.length) {
            const li2 = el("li", "tm-none"); li2.appendChild(el("p", null, "Nothing planned in the " + R.name + " yet."));
            const b = el("button", "btn ghost sm", "Move standards here"); b.type = "button"; b.onclick = o.edit; li2.appendChild(b); ol.appendChild(li2);
        }
        R.stops.forEach((st) => {
            const i = idx++;
            const li3 = el("li", "tm-stop s-" + st.state + (i % 2 ? " side-r" : " side-l")); li3.id = "tm-stop-" + st.n;
            const dot = el("span", "tm-dot"); dot.setAttribute("aria-hidden", "true");
            if (st.state === "done") dot.innerHTML = ICON.check; else dot.textContent = String(st.n);
            const card = el("div", "tm-card");
            const kick = el("div", "tm-kick");
            if (i === m.here) { const pin = el("span", "tm-pin"); pin.innerHTML = ICON.pin; pin.appendChild(document.createTextNode("You are here")); kick.appendChild(pin); }
            else if (i === m.next) kick.appendChild(el("span", "tm-nextchip", "Next stop"));
            kick.appendChild(el("span", "tm-stopn", "Stop " + st.n + (st.label ? " · " + st.label : "") + (st.cont ? " (continued)" : "")));
            card.appendChild(kick);
            card.appendChild(el("h3", "tm-name", st.name));
            card.appendChild(el("p", "tm-line", stopLine(st)));
            const open = isOpen(st, i);
            const list = el("ul", "tm-stds" + (open ? " open" : ""));
            st.items.forEach((x) => {
                const row = el("li", "tm-std t-" + (x.state || "none"));
                const b = el("button", "tm-sbtn"); b.type = "button";
                b.setAttribute("aria-label", x.code + ", " + STATE_WORD[x.state || ""] + (x.critical ? ", critical" : "") + ". " + x.text + " Show problems.");
                b.title = x.text + "\n\nShow problems for " + x.code;
                const code = el("span", "tm-code", x.code); b.appendChild(code);
                if (x.critical) b.appendChild(el("span", "tm-star", "★"));
                if (open) b.appendChild(el("span", "tm-text", cut(x.text, 150)));
                b.onclick = () => o.openStd(x.code);
                row.appendChild(b); list.appendChild(row);
            });
            card.appendChild(list);
            const tg = el("button", "tm-more", open ? "Hide the wording" : "Show the wording"); tg.type = "button";
            tg.setAttribute("aria-expanded", String(open));
            tg.onclick = () => { flip.set(st.n, !open); drawMap(box, o); const n = document.querySelector("#tm-stop-" + st.n + " .tm-more"); if (n) n.focus({ preventScroll: true }); };
            card.appendChild(tg);
            li3.append(dot, card);
            ol.appendChild(li3);
        });
        reg.appendChild(ol);
        map.appendChild(reg);
    });

    const fin = el("div", "tm-end tm-finish"); fin.setAttribute("role", "listitem");
    fin.innerHTML = '<span class="tm-flag">' + ICON.finish + "</span>";
    fin.appendChild(el("span", "tm-endtxt", o.endLabel || "Last day of school")); map.appendChild(fin);
    box.appendChild(map);

    layoutRoad(map, m);
    if (o.onLayout) o.onLayout();
}

/** The strip above the map: where you are, the next stop, and how far through the year this class is. */
function summary(m, o) {
    const s = el("div", "tm-sum");
    const here = m.here >= 0 ? m.stops[m.here] : null, next = m.next >= 0 ? m.stops[m.next] : null;
    const a = el("div", "tm-sumhere");
    const pin = el("span", "tm-sumpin"); pin.innerHTML = here ? ICON.pin : ICON.finish; a.appendChild(pin);
    const at = el("div");
    at.appendChild(el("p", "tm-sumk", here ? "You are here" : "Every standard is taught"));
    if (here) {
        at.appendChild(el("p", "tm-sumt", here.name));
        at.appendChild(el("p", "tm-summ", ["Stop " + here.n + " of " + m.stops.length, ORD[here.lane] + " nine weeks", here.label].filter(Boolean).join(" · ")));
    } else at.appendChild(el("p", "tm-summ", "Then: " + (o.endLabel || "the end of the year")));
    a.appendChild(at);
    s.appendChild(a);
    if (next) {
        const b = el("div", "tm-sumnext");
        b.appendChild(el("p", "tm-sumk", "Next stop"));
        b.appendChild(el("p", "tm-sumt", next.name));
        b.appendChild(el("p", "tm-summ", ["Stop " + next.n, ORD[next.lane] + " nine weeks", next.label].filter(Boolean).join(" · ")));
        s.appendChild(b);
    }
    const c = el("div", "tm-sumyear");
    c.appendChild(el("p", "tm-sumk", "This year"));
    c.appendChild(el("p", "tm-sumt", m.taught + " of " + m.total + " taught"));
    const bar = el("div", "pl-prog"); const bi = el("i"); bi.style.width = (m.total ? (100 * m.taught) / m.total : 0) + "%"; bar.appendChild(bi); c.appendChild(bar);
    s.appendChild(c);
    if (here) {
        const go = el("button", "btn ghost sm tm-go", "Go to my spot"); go.type = "button";
        go.onclick = () => { const n = document.getElementById("tm-stop-" + here.n); if (n) { n.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); n.classList.add("tm-flash"); setTimeout(() => n.classList.remove("tm-flash"), 1700); } };
        s.appendChild(go);
    }
    return s;
}

/* ---------- the road ---------- */
const watching = new WeakMap();
function layoutRoad(map, m) {
    const draw = () => drawRoad(map, m);
    requestAnimationFrame(draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    if (typeof ResizeObserver === "function" && !watching.has(map)) {
        let w = 0;
        const ro = new ResizeObserver(() => { if (!map.isConnected) { ro.disconnect(); return; } cancelAnimationFrame(w); w = requestAnimationFrame(draw); });
        ro.observe(map); watching.set(map, ro);
    }
}

/** A smooth path through points: each leg leaves and arrives straight up and down, so the road bends between stops. */
function pathThrough(pts) {
    if (!pts.length) return "";
    let d = "M" + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], my = (a.y + b.y) / 2;
        d += " C" + a.x.toFixed(1) + " " + my.toFixed(1) + " " + b.x.toFixed(1) + " " + my.toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1);
    }
    return d;
}

function drawRoad(map, m) {
    if (!map.isConnected) return;
    const road = map.querySelector(".tm-road"), box = map.getBoundingClientRect();
    const W = map.clientWidth, H = map.scrollHeight;
    if (!W || !H) return;
    const mid = (n) => { const r = n.getBoundingClientRect(); return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }; };
    const pts = []; let herePt = -1;
    const start = map.querySelector(".tm-start .tm-flag"); if (start) pts.push(mid(start));
    let i = 0;
    map.querySelectorAll(".tm-region").forEach((reg) => {
        const ml = reg.querySelector(".tm-mile"); if (ml) pts.push(mid(ml));
        reg.querySelectorAll(".tm-stop .tm-dot").forEach((d) => { pts.push(mid(d)); if (i === m.here) herePt = pts.length - 1; i++; });
    });
    const fin = map.querySelector(".tm-finish .tm-flag"); if (fin) pts.push(mid(fin));
    road.setAttribute("width", W); road.setAttribute("height", H); road.setAttribute("viewBox", "0 0 " + W + " " + H);
    road.textContent = "";
    const d = pathThrough(pts);
    road.appendChild(svg("path", { d, class: "tm-r-edge" }));
    road.appendChild(svg("path", { d, class: "tm-r-base" }));
    // Travelled: solid up to "You are here"; with every standard taught, the whole road.
    const upto = m.here < 0 ? pts.length - 1 : herePt;
    if (upto > 0) road.appendChild(svg("path", { d: pathThrough(pts.slice(0, upto + 1)), class: "tm-r-done" }));
    road.appendChild(svg("path", { d, class: "tm-r-dash" }));
}
