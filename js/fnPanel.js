/* The function machine panel (Math tools, "fn"), for 8.13 and 8.14.
   Machine: tap a number to drop it in; the rule turns it into its output, and the pairs build a table, a mapping and a
   graph. Change the rule and every output changes with it. "Mystery rule" hides a new rule for the class to find.
   Function or not?: a set of pairs as a mapping, table or graph. The class decides, then the answer shows the input
   with two outputs (and the vertical line on the graph).
   The model is in js/manipCore.js (fnOut, fnRule, fnTest, fnNewSet); the state is S.tools.mt.fn. */

const NUMS = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const VIEW_NAMES = { table: "Table", map: "Mapping", graph: "Graph" };
const neg = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));
const list = (a) => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

/** ctx: { shell, h, btn, st, save, s, txt, clear, M } from js/manipPanels.js */
export function makeFn(k, ctx) {
    const { h, btn, s, txt, clear, M } = ctx;
    const st = () => ctx.st(k), save = ctx.save;
    const p = ctx.shell(k);

    /* ---- the machine ---- */
    const svg = s("svg", { viewBox: "0 0 360 150", class: "mt-svg fn-svg", role: "img" });
    txt(svg, 45, 30, "IN", "fn-lab", { "text-anchor": "middle" });
    txt(svg, 315, 58, "OUT", "fn-lab", { "text-anchor": "middle" });
    s("path", { d: "M58 62 C 100 20, 130 6, 160 10", class: "fn-path" }, svg);
    s("polygon", { points: "146,6 214,6 194,36 166,36", class: "fn-hop" }, svg);
    const ball = (cls) => { const g = s("g", { class: "fn-ball " + cls }, svg); s("circle", { r: 17 }, g); return { g, t: txt(g, 0, 5.5, "", "fn-bv", { "text-anchor": "middle" }) }; };
    const inB = ball("fn-inb"), outB = ball("fn-outb");
    s("rect", { x: 255, y: 86, width: 52, height: 18, rx: 4, class: "fn-chute" }, svg);
    s("rect", { x: 100, y: 34, width: 160, height: 80, rx: 16, class: "fn-box" }, svg);
    const gear = (x, y, r) => { const g = s("g", { class: "fn-gear", transform: "translate(" + x + " " + y + ")" }, svg); const gi = s("g", null, g); s("circle", { r, class: "fn-teeth" }, gi); s("circle", { r: r * 0.42, class: "fn-hub" }, gi); return g; };
    gear(118, 52, 8); gear(242, 96, 8);
    txt(svg, 180, 58, "y =", "fn-y", { "text-anchor": "middle" });
    const ruleT = txt(svg, 180, 88, "", "fn-rule", { "text-anchor": "middle" });

    const rec = h("div", "fn-rec");

    /* ---- the side ---- */
    const modes = h("div", "mt-row");
    const mMach = btn("Machine", "mt-chip", () => { const F = st(); if (F.m !== "mach") { F.m = "mach"; save(); } });
    const mTest = btn("Function or not?", "mt-chip", () => { const F = st(); if (F.m !== "test") { F.m = "test"; if (!F.ps.length) M.fnNewSet(F); save(); } });
    modes.append(mMach, mTest);
    const head = h("div", "mt-eq fn-head");
    const sub = h("p", "fn-sub");

    const insRow = h("div", "fn-nums");
    NUMS.forEach((n) => insRow.appendChild(btn(neg(n), "fn-num", () => drop(n), "Put in " + neg(n))));
    function drop(n) { const F = st(); F.ins = F.ins.concat([n]).slice(-M.FN_MAX); save(); }

    const ruleRow = h("div", "fn-rulerow");
    const stepper = (lab, key, lo, hi) => {
        const w = h("div", "fn-step"), v = h("b", "fn-sv");
        w.append(h("span", "mt-sl", lab), btn("−", "fn-sb", () => { const F = st(); if (F[key] > lo) { F[key]--; save(); } }, lab + " down"), v, btn("+", "fn-sb", () => { const F = st(); if (F[key] < hi) { F[key]++; save(); } }, lab + " up"));
        return { w, v };
    };
    const stA = stepper("Times", "a", -M.FN_A, M.FN_A), stB = stepper("Add", "b", -M.FN_B, M.FN_B);
    const tSq = btn("Square x first", "mt-chip fn-sq", () => { const F = st(); F.q = !F.q; save(); }, "Square x before multiplying");
    ruleRow.append(stA.w, stB.w, tSq);

    const myst = h("div", "mt-row");
    const bMyst = btn("New mystery rule", "fn-myst", () => { M.fnMystery(st()); save(); }, "Hide a new rule for the class to find");
    const bShow = btn("Show the rule", "", () => { const F = st(); F.hide = false; save(); });
    myst.append(bMyst, bShow);

    const ans = h("div", "fn-ans");
    const aYes = btn("Function", "fn-a", () => answer("f")), aNo = btn("Not a function", "fn-a", () => answer("n"));
    ans.append(aYes, aNo);
    function answer(g) { const F = st(); F.g = g; F.sh = true; save(); }

    const views = h("div", "mt-row");
    const viewB = {};
    M.FN_VIEWS.forEach((v) => { viewB[v] = btn(VIEW_NAMES[v], "mt-chip", () => { const F = st(); if (F.v !== v) { F.v = v; save(); } }); views.appendChild(viewB[v]); });

    const foot = h("div", "mt-row mt-setup");
    const bClear = btn("Clear inputs", "", () => { const F = st(); F.ins = []; save(); });
    const bReveal = btn("Show answer", "", () => { const F = st(); F.sh = true; save(); });
    const bNew = btn("New set", "", () => { M.fnNewSet(st()); save(); });
    const bOver = btn("Start over", "", () => { const F = st(), m = F.m; Object.assign(F, M.fnDefault(), { m }); if (m === "test") M.fnNewSet(F); save(); });
    foot.append(bClear, bReveal, bNew, bOver);

    p.main.append(svg, rec);
    p.side.append(modes, head, sub, insRow, ruleRow, myst, ans, views, foot, p.note);

    /* ---- the record: table, mapping, graph ---- */
    function table(ps, bad) {
        if (!ps.length) { rec.appendChild(h("p", "fn-empty", "Tap a number to drop it in. Each one adds a row.")); return; }
        const t = h("table", "fn-tab"), r1 = h("tr"), r2 = h("tr");
        r1.appendChild(h("th", null, "x")); r2.appendChild(h("th", null, "y"));
        ps.forEach(([x, y], i) => { const a = h("td", null, neg(x)), b = h("td", null, neg(y)); if (bad && x === bad.x) { a.className = b.className = "bad"; } if (i === ps.length - 1 && st().m === "mach") { a.classList.add("new"); b.classList.add("new"); } r1.appendChild(a); r2.appendChild(b); });
        t.append(r1, r2); rec.appendChild(t);
    }
    function mapping(ps, bad) {
        const xs = [...new Set(ps.map((q) => q[0]))].sort((a, b) => a - b), ys = [...new Set(ps.map((q) => q[1]))].sort((a, b) => a - b);
        const n = Math.max(xs.length, ys.length, 3), H = 40 + n * 26;
        const g = s("svg", { viewBox: "0 0 360 " + H, class: "mt-svg fn-map" });
        const defs = s("defs", null, g);
        ["", "Bad"].forEach((v) => { const mk = s("marker", { id: "fnArr" + v + "-" + k, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto" }, defs); s("path", { d: "M0 0 L10 5 L0 10 z", class: "fn-ah" + (v ? " bad" : "") }, mk); });
        const col = (x, items, lab) => {
            s("ellipse", { cx: x, cy: H / 2 + 8, rx: 46, ry: H / 2 - 12, class: "fn-oval" }, g);
            txt(g, x, 14, lab, "fn-lab", { "text-anchor": "middle" });
            const top = H / 2 + 8 - (items.length - 1) * 13;
            return items.map((v, i) => { const y = top + i * 26; txt(g, x, y + 5, neg(v), "fn-mv", { "text-anchor": "middle" }); return y; });
        };
        const yx = col(90, xs, "Input"), yy = col(270, ys, "Output");
        const done = new Set();
        ps.forEach(([x, y]) => {
            const key = x + "," + y; if (done.has(key)) return; done.add(key);
            const y1 = yx[xs.indexOf(x)], y2 = yy[ys.indexOf(y)];
            s("line", { x1: 112, y1, x2: 246, y2, class: "fn-arrow" + (bad && x === bad.x ? " bad" : ""), "marker-end": "url(#fnArr" + (bad && x === bad.x ? "Bad" : "") + "-" + k + ")" }, g);
        });
        if (!ps.length) txt(g, 180, H / 2 + 12, "Nothing yet", "fn-none", { "text-anchor": "middle" });
        rec.appendChild(g);
    }
    function graph(ps, bad) {
        const W = 360, H = 210, L = 26, R = 350, T = 10, B = 196;
        const rng = (vals) => { let lo = Math.min(-1, ...vals), hi = Math.max(1, ...vals); lo--; hi++; const span = hi - lo, st = span <= 14 ? 1 : span <= 28 ? 2 : span <= 70 ? 5 : 10; return { lo: Math.floor(lo / st) * st, hi: Math.ceil(hi / st) * st, st }; };
        const X = rng(ps.map((q) => q[0])), Y = rng(ps.map((q) => q[1]));
        const px = (x) => L + (x - X.lo) / (X.hi - X.lo) * (R - L), py = (y) => B - (y - Y.lo) / (Y.hi - Y.lo) * (B - T);
        const g = s("svg", { viewBox: "0 0 " + W + " " + H, class: "mt-svg fn-graph" });
        for (let x = X.lo; x <= X.hi; x += X.st) { s("line", { x1: px(x), y1: T, x2: px(x), y2: B, class: x === 0 ? "fn-ax" : "fn-gl" }, g); if (x && x > X.lo && x < X.hi) txt(g, px(x), py(0) + 13 > B ? B - 3 : Math.max(T + 10, py(0) + 13), neg(x), "fn-tk", { "text-anchor": "middle" }); }
        for (let y = Y.lo; y <= Y.hi; y += Y.st) { s("line", { x1: L, y1: py(y), x2: R, y2: py(y), class: y === 0 ? "fn-ax" : "fn-gl" }, g); if (y && y > Y.lo && y < Y.hi) txt(g, Math.max(L + 4, px(0) - 5), py(y) + 4, neg(y), "fn-tk", { "text-anchor": "end" }); }
        if (bad) s("line", { x1: px(bad.x), y1: T, x2: px(bad.x), y2: B, class: "fn-vlt" }, g);
        const seen = new Set();
        ps.forEach(([x, y], i) => { if (seen.has(x + "," + y)) return; seen.add(x + "," + y); s("circle", { cx: px(x), cy: py(y), r: 6, class: "fn-pt" + (bad && x === bad.x ? " bad" : "") + (i === ps.length - 1 && st().m === "mach" ? " new" : "") }, g); });
        rec.appendChild(g);
    }

    /* ---- drawing ---- */
    let lastN = null, lastIns = "";
    function draw(F) {
        const mach = F.m === "mach";
        p.root.classList.toggle("fn-testing", !mach);
        mMach.setAttribute("aria-pressed", String(mach)); mTest.setAttribute("aria-pressed", String(!mach));
        M.FN_VIEWS.forEach((v) => viewB[v].setAttribute("aria-pressed", String(F.v === v)));
        [insRow, ruleRow, myst, bClear].forEach((e) => { e.hidden = !mach; });
        [ans, bReveal, bNew].forEach((e) => { e.hidden = mach; });
        svg.style.display = mach ? "" : "none";
        clear(rec);
        head.classList.remove("done", "fn-no");
        if (mach) {
            const ps = M.fnPairs(F), last = ps[ps.length - 1];
            ruleRow.hidden = F.hide; bShow.hidden = !F.hide;
            bMyst.textContent = F.hide ? "Another mystery rule" : "Mystery rule";
            stA.v.textContent = neg(F.a); stB.v.textContent = neg(F.b);
            tSq.setAttribute("aria-pressed", String(F.q));
            ruleT.textContent = F.hide ? "?" : M.fnRule(F);
            ruleT.classList.toggle("q", F.hide);
            head.textContent = F.hide ? "y = ?" : "y = " + M.fnRule(F);
            sub.textContent = F.hide
                ? (ps.length < 3 ? "Find the rule. Try a few inputs and watch the outputs." : "Can you write the rule? Check it with one more input.")
                : last ? "In " + neg(last[0]) + ", out " + neg(last[1]) + ". " + (ps.length > 1 && ps.slice(0, -1).some((q) => q[0] === last[0]) ? "Same input, same output, every time." : "Each input gives exactly one output.")
                : "Tap a number to drop it into the machine.";
            svg.setAttribute("aria-label", F.hide ? "A function machine with a hidden rule" : "A function machine with the rule y = " + M.fnRule(F));
            inB.g.style.visibility = outB.g.style.visibility = last ? "" : "hidden";
            if (last) { inB.t.textContent = neg(last[0]); outB.t.textContent = neg(last[1]); }
            const key = F.ins.join(",");
            if (lastN != null && F.ins.length && key !== lastIns && (F.ins.length > lastN || F.ins.length === M.FN_MAX)) run();
            lastN = F.ins.length; lastIns = key;
            if (F.v === "table") table(ps); else if (F.v === "map") mapping(ps); else graph(ps);
        } else {
            const T = M.fnTest(F.ps), bad = F.sh && !T.ok ? T : null;
            aYes.setAttribute("aria-pressed", String(F.g === "f")); aNo.setAttribute("aria-pressed", String(F.g === "n"));
            aYes.disabled = aNo.disabled = F.sh; bReveal.disabled = F.sh;
            if (!F.sh) { head.textContent = "Is this a function?"; sub.textContent = "A function gives each input exactly one output. Decide, then tap your answer."; }
            else {
                const right = F.g ? (F.g === "f") === T.ok : null;
                head.textContent = (right === true ? "Yes! " : right === false ? "Not quite. " : "") + (T.ok ? "It's a function." : "Not a function.");
                head.classList.add(T.ok ? "done" : "fn-no");
                sub.textContent = T.ok
                    ? "Every input has exactly one output." + (T.shared ? " Two inputs can share an output, and it's still a function." : "")
                    : "The input " + neg(T.x) + " goes to " + list(T.ys.map(neg)) + ". One input, two outputs." + (F.v === "graph" ? " A vertical line hits two points." : "");
            }
            if (F.v === "table") table(F.ps, bad); else if (F.v === "map") mapping(F.ps, bad); else graph(F.ps, bad);
        }
    }
    function run() {
        svg.classList.remove("go"); void svg.getBoundingClientRect(); svg.classList.add("go");
        clearTimeout(run.t); run.t = setTimeout(() => svg.classList.remove("go"), 1500);
    }
    p.sync = () => draw(st());
    return p;
}
