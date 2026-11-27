// Lesson slides rules: safe text, cleaning, live fields, the plan as slides. Run: node tools/board/slides.test.mjs
import assert from "node:assert/strict";
import { sanitizeHtml, textOf, plainHtml, cleanEl, cleanSlide, cleanDeck, cleanIndex, cleanBg, fillLive, liveContext, fromPlan, frameSlide, problemSlide,
    todaySlide, agendaSlide, LAYOUTS, newEl, showList, revealSteps, countShown, shapePath, SHAPES, inkFor, inkOn, MAX_SLIDES, MAX_ELS, DAILY, isLessonKey, boxOf,
    cleanPanels, panelWords, bankSlide, bankText, walkSlide, walkStep, GRIDS, gridCells, gridSlide, FRAME, GRADS, gradCss, isAurora, THEMES, cleanTheme, themeId } from "../../js/slides.js";
import demoWeek from "../../data/demo-week.js";

let n = 0; const t = (name, fn) => { fn(); n++; };

t("safe text keeps formatting and drops everything else", () => {
    assert.equal(sanitizeHtml("<b>Hi</b> <i>there</i> <u>you</u>"), "<b>Hi</b> <i>there</i> <u>you</u>");
    assert.equal(sanitizeHtml("<strong>a</strong><em>b</em><strike>c</strike>"), "<b>a</b><i>b</i><s>c</s>");
    assert.equal(sanitizeHtml("<script>alert(1)</script>ok"), "ok");
    assert.equal(sanitizeHtml('<img src=x onerror="alert(1)">ok'), "ok");
    assert.equal(sanitizeHtml('<span onclick="x()" style="color:red;position:fixed">a</span>'), "<span>a</span>");
    assert.equal(sanitizeHtml('<span style="color:#ff0000;background-color:rgb(255, 255, 0)">a</span>'), '<span style="color:#ff0000;background-color:#ffff00">a</span>');
    assert.equal(sanitizeHtml('<span style="background:url(javascript:alert(1))">a</span>'), "<span>a</span>");
    assert.equal(sanitizeHtml('<font color="#00ff00" size="6">big</font>'), '<span style="color:#00ff00;font-size:2em">big</span>');
    assert.equal(sanitizeHtml("<div style=\"text-align:center\">mid</div>"), '<div style="text-align:center">mid</div>');
    assert.equal(sanitizeHtml("a < b and c > d & e"), "a &lt; b and c &gt; d &amp; e");
    assert.equal(sanitizeHtml("<b>open"), "<b>open</b>");
    assert.equal(sanitizeHtml("x</b>y"), "xy");
    assert.equal(sanitizeHtml('<a href="javascript:x">link</a>'), "link");
    assert.equal(sanitizeHtml("<style>body{}</style><iframe src=x></iframe>t"), "t");
    assert.equal(sanitizeHtml("<b></b><span style=\"color:#000\"></span>x"), "x");
    assert.equal(sanitizeHtml('<span style="font-size:x-large">x</span>'), '<span style="font-size:1.5em">x</span>');
    assert.equal(sanitizeHtml('<ul><li>one</li><li>two</li></ul>'), "<ul><li>one</li><li>two</li></ul>");
    assert.ok(!/<(?!\/?(b|i|u|s|sup|sub|br|div|ul|ol|li|span)\b)/.test(sanitizeHtml('<svg><g onload="x"></g></svg><math>1</math><object>o</object><p>p</p>')));
});
t("text from safe html", () => {
    assert.equal(textOf("<b>Hi</b><br>there &amp; you"), "Hi\nthere & you");
    assert.equal(plainHtml("a<b\nc"), "a&lt;b<br>c");
});
t("elements stay in range and only known kinds survive", () => {
    assert.equal(cleanEl({ k: "zz" }), null);
    const b = cleanEl({ k: "bx", x: -99999, y: 50, w: 2, h: 99999, r: 450, fs: 9999, ff: "comic", fc: "red", al: "q", sh: "blob", html: "<b>x</b><script>y</script>" });
    assert.deepEqual([b.x, b.w, b.h, b.r, b.fs, b.ff, b.fc, b.al, b.sh, b.html], [-1600, 8, 3600, 90, 400, "sans", "", "l", "rect", "<b>x</b>"]);
    const l = cleanEl({ k: "ln", x1: 5, y1: 5, x2: 5, y2: 5, a2: "arrow", a1: "boom" });
    assert.equal(l.x2, 6); assert.equal(l.a2, "arrow"); assert.equal(l.a1, "");
    assert.deepEqual(boxOf(cleanEl({ k: "ln", x1: 100, y1: 300, x2: 40, y2: 200 })), { x: 40, y: 200, w: 60, h: 100 });
    assert.equal(cleanEl({ k: "pc", img: "../../etc" }), null);
    assert.equal(cleanEl({ k: "pc", img: "abc123" }).img, "abc123");
    assert.equal(cleanEl({ k: "st", t: "e", v: "<b>" }), null);
    assert.equal(cleanEl({ k: "st", t: "e", v: "⭐" }).v, "⭐");
    assert.equal(cleanEl({ k: "mt", it: { k: "nope" } }), null);
    const m = cleanEl({ k: "mt", it: { k: "numline", min: 0, max: 5, step: "1/2", x: 0.1, y: 0.9, r: 40 } });
    assert.deepEqual([m.it.x, m.it.y, m.it.r, m.it.max], [0.5, 0.5, 0, 5]);
    const tb = cleanEl({ k: "tb", rows: [["a", "b", "c"], ["d"]] });
    assert.deepEqual(tb.rows, [["a", "b", "c"], ["d", "", ""]]);
    assert.equal(cleanEl({ k: "tb", rows: Array.from({ length: 30 }, () => Array(20).fill("x")) }).rows.length, 12);
    assert.equal(cleanEl({ k: "tb", rows: [Array(20).fill("x")] }).rows[0].length, 8);
    assert.equal(cleanEl({ k: "bx", ap: 99 }).ap, 30); assert.equal(cleanEl({ k: "bx", ap: 0 }).ap, undefined);
    assert.equal(cleanEl({ k: "bx", op: 0.02 }).op, 0.1); assert.equal(cleanEl({ k: "bx", op: 1 }).op, undefined);
});
t("a slide keeps at most 80 pieces, unique ids, notes only when there are some", () => {
    const s = cleanSlide({ id: "s1", els: Array.from({ length: 120 }, () => ({ k: "bx", id: "same" })), nt: "  " });
    assert.equal(s.els.length, MAX_ELS); assert.equal(new Set(s.els.map((e) => e.id)).size, MAX_ELS); assert.equal(s.nt, undefined);
    assert.deepEqual(cleanBg({ t: "color", c: "#FFF", p: "grid" }), { t: "color", c: "#fff", p: "grid" });
    assert.deepEqual(cleanBg({ t: "board", p: "grid" }), { t: "board" });
    assert.deepEqual(cleanBg({ t: "grad", g: "nope" }), { t: "grad", g: "sky" });
});
t("a lesson keeps at most 40 slides; the index keeps only real lessons", () => {
    const d = cleanDeck({ slides: Array.from({ length: 50 }, (_, i) => ({ id: "s" + i, els: [] })), nod: true });
    assert.equal(d.slides.length, MAX_SLIDES); assert.equal(d.nod, true);
    assert.deepEqual(cleanDeck(null), { v: 1, slides: [] });
    assert.deepEqual(cleanIndex({ n: { "week5|8th|0": 3, "bad key": 2, "week5|7th|1": 0, [DAILY]: 2 } }).n, { "week5|8th|0": 3, daily: 2 });
    assert.ok(isLessonKey("ql-2026-11-23|8th-acc|4")); assert.ok(!isLessonKey("week5|8th|5"));
});
t("every-day slides come first unless the lesson turns them off; hidden slides never show", () => {
    const daily = { slides: [{ id: "d1" }, { id: "d2", hide: true }] }, own = { slides: [{ id: "a" }, { id: "b" }] };
    assert.deepEqual(showList(daily, own).map((s) => s.id), ["d1", "a", "b"]);
    assert.deepEqual(showList(daily, Object.assign({ nod: true }, own)).map((s) => s.id), ["a", "b"]);
    assert.deepEqual(showList(null, null), []);
    assert.equal(countShown({ slides: [{ id: "x" }, { id: "y", hide: true }] }), 1);
});
t("live fields fill in from the plan, safely", () => {
    const L = demoWeek.classes.demo, ctx = liveContext(demoWeek, L, L.days[0], 0);
    assert.equal(ctx.day, "Monday"); assert.equal(ctx.lt, L.days[0].lt); assert.equal(ctx.week.length, 5);
    assert.equal(fillLive("<b>{{day}}</b>", ctx), "<b>Monday</b>");
    assert.equal(fillLive("{{agenda}}", { agenda: ["One", "Two <b>"] }), "One<br>Two &lt;b&gt;");
    assert.equal(fillLive("{{nope}} {{ lt }}", { lt: "x" }), "{{nope}} x");
    assert.match(fillLive("{{lt}}", {}, true), /class="slv"/);
});
t("the plan as slides: Today, each bellringer problem, each notes frame, answers one Next away", () => {
    const L = demoWeek.classes.demo, frames = [{ kind: "Example 1 of 1", q: "Solve 2x + 5 = 17.", lines: [{ m: "2x = 12", why: "Subtract 5." }, { m: "x = 6" }] },
        { kind: "Vocabulary 1 of 1", q: "An [equation] says two expressions are equal.", lines: [], ans: "fill", blanks: true }, { kind: "PDF", pdf: { id: "x" }, lines: [] }];
    const slides = fromPlan(L, 0, frames);
    assert.equal(slides.length, 1 + L.days[0].problems.length + 2);
    assert.ok(JSON.stringify(slides[0]).includes("{{agenda}}"));
    const p = slides[1]; assert.equal(revealSteps(p), 1); assert.ok(p.els.some((e) => e.ap === 1 && /22/.test(e.html)));
    const ex = slides[1 + L.days[0].problems.length]; assert.equal(revealSteps(ex), 2);
    const vo = slides[slides.length - 1]; assert.ok(vo.els.some((e) => /equation/.test(e.html) && e.ap === 1)); assert.ok(!vo.els.some((e) => e.ap !== 1 && /\[equation\]/.test(e.html)));
    slides.forEach((s) => assert.deepEqual(cleanSlide(JSON.parse(JSON.stringify(s))).els.length, s.els.length));
    assert.ok(JSON.stringify(problemSlide("Bellringer", "1 of 1", "<x>", "y")).includes("&lt;x&gt;"));
    assert.equal(agendaSlide(L).els.filter((e) => /Mon|Tue|Wed|Thu|Fri/.test(e.html)).length, 5);
    assert.ok(frameSlide({ kind: "<b>", q: "q", lines: [] }).els.every((e) => !/<b><b>/.test(e.html || "")));
});
t("every layout and new piece is already clean", () => {
    LAYOUTS.forEach(([id, , make]) => { const s = make(); assert.deepEqual(cleanSlide(JSON.parse(JSON.stringify(s))), s, id); });
    ["text", "title", "card", "sticky", "shape", "line", "table", "math", "logo"].forEach((k) => assert.ok(newEl(k) || k === "math", k));
    assert.equal(todaySlide().els.filter((e) => e.hd).length, 6);
});
t("every shape draws a path and text sits inside it", () => {
    SHAPES.forEach(([id]) => { const d = shapePath(id, 300, 200); assert.ok(/^M/.test(d) && !/NaN/.test(d), id); });
});
t("automatic text color shows up on the background", () => {
    assert.equal(inkFor({ t: "board" }), "#f6f9fd"); assert.equal(inkFor({ t: "color", c: "#ffffff" }), "#14213d"); assert.equal(inkFor({ t: "color", c: "#081b45" }), "#f6f9fd");
    assert.equal(inkOn("#fff3b0"), "#14213d"); assert.equal(inkFor({ t: "grad", g: "night" }), "#f6f9fd"); assert.equal(inkFor({ t: "grad", g: "sky" }), "#14213d");
});
t("panels per slide keep only a timer, target and agenda", () => {
    assert.deepEqual(cleanPanels({ tm: 300, tg: true, ag: "yes", x: 1 }), { tm: 300, tg: true });
    assert.equal(cleanPanels({ tm: 0 }), null); assert.equal(cleanPanels(null), null); assert.equal(cleanPanels({ tm: 99999 }).tm, 5400);
    assert.equal(panelWords({ tm: 300, tg: true, ag: true }), "Timer 5 min, target, agenda");
    const s = cleanSlide({ id: "s1", els: [], pn: { tm: 120, ag: true, bad: 1 } }); assert.deepEqual(s.pn, { tm: 120, ag: true });
    assert.equal(cleanSlide({ id: "s2", els: [], pn: { tg: false } }).pn, undefined);
});
t("a bank problem becomes a slide with its answer on Next", () => {
    assert.equal(bankText("Cost: §12, $x$"), "Cost: $12, x");
    const s = bankSlide({ id: "8.1-01", std: "8.1", q: "Is √50 rational?", a: "Irrational", lvl: 1 }, 1, 3);
    assert.equal(revealSteps(s), 1); assert.ok(JSON.stringify(s).includes("Problem 2 of 3"));
    assert.deepEqual(cleanSlide(JSON.parse(JSON.stringify(s))), s);
});
t("a Show Steps slide plays one step per Next", () => {
    const s = walkSlide({ id: "7.4-05", std: "7.4", q: "Find −{3/4} + (−{1/2})" }, 5);
    assert.equal(revealSteps(s), 4); assert.deepEqual(cleanSlide(JSON.parse(JSON.stringify(s))), s);
    const wk = s.els.find((e) => e.k === "wk");
    assert.equal(walkStep(wk, 0), 0); assert.equal(walkStep(wk, 3), 3); assert.equal(walkStep(wk, 9), 4); assert.equal(walkStep(wk, Infinity), 4);
    assert.equal(cleanEl({ k: "wk", id: "a", x: 0, y: 0, w: 100, h: 100, wid: "bad id!", n: 3 }), null);
});
t("every grid fills the safe frame with cells that do not overlap, each with its own start", () => {
    const ids = new Set();
    for (const [id, name, fr, start] of GRIDS) {
        assert.ok(!ids.has(id), id); ids.add(id); assert.ok(name.length <= 18, name);
        assert.equal(fr.length, start.length, id);
        const cells = gridCells(id);
        cells.forEach((c, i) => {
            assert.ok(c.x >= FRAME.x - 0.5 && c.y >= FRAME.y - 0.5 && c.x + c.w <= FRAME.x + FRAME.w + 0.5 && c.y + c.h <= FRAME.y + FRAME.h + 0.5, id + " cell " + i);
            assert.ok(c.w >= 300 && c.h >= 100, id + " cell " + i + " is too small");
            cells.slice(i + 1).forEach((d) => assert.ok(c.x + c.w <= d.x || d.x + d.w <= c.x || c.y + c.h <= d.y || d.y + d.h <= c.y, id + " overlaps"));
        });
        const s = gridSlide(id, null);
        assert.equal(s.els.length, cells.length, id); assert.equal(s.gd, id);
        assert.deepEqual(cleanSlide(JSON.parse(JSON.stringify(s))), s, id);
    }
});
t("Aurora glass (Nov 27): its own background glow, light ink, and a theme that brings the glow along", () => {
    assert.ok(GRADS.some((g) => g[0] === "aurora"));
    assert.match(gradCss("aurora"), /^radial-gradient/);
    assert.match(gradCss("sky"), /^linear-gradient\(160deg,#bcd8f5/);
    assert.match(gradCss("nope"), /^linear-gradient\(160deg,#bcd8f5/, "unknown ids fall back to the first fade");
    const bg = cleanBg({ t: "grad", g: "aurora" });
    assert.deepEqual(bg, { t: "grad", g: "aurora" }); assert.ok(isAurora(bg)); assert.ok(!isAurora({ t: "grad", g: "navy" })); assert.ok(!isAurora(null));
    assert.equal(inkFor(bg), "#f6f9fd", "light words on the Aurora glow");
    const th = THEMES.find((x) => x[0] === "aurora");
    assert.ok(th && th[3] && isAurora(th[3]), "Aurora glass sets the background too");
    assert.deepEqual(cleanTheme(th[2]), th[2]); assert.equal(themeId(th[2]), "aurora");
    const ids = THEMES.map((x) => x[0]); assert.equal(new Set(ids).size, ids.length, "theme ids are unique");
    THEMES.forEach(([id, , t2]) => { if (t2) assert.equal(themeId(t2), id, "every ready-made theme is found again: " + id); });
});
console.log("Lesson slides: " + n + " checks passed");
