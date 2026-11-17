/* Review game results on the Class Data page.
 * The Remote saves one summary per finished game to teacher/{uid}/games/results ({ list: [...] }).
 * This file only reads those summaries, works out winners, student wins and accuracy, and saves the
 * "bonus given" box. Names come from the teacher's private account and are never part of the repo. */

/** Plain summaries for one period. Pure, so it can be tested on its own. */
export function summariseGames(list, period) {
    const games = (list || []).filter((r) => r && r.id && r.period === period)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.at || 0) - (a.at || 0));
    const people = new Map(), cats = new Map(), vs = { cls: 0, tch: 0, tie: 0 };
    games.forEach((r) => {
        const win = r.win || [], given = !!(r.bonus && r.bonus.given);
        (r.teams || []).forEach((t, i) => (t.m || []).forEach((name) => {
            const p = people.get(name) || { s: name, played: 0, wins: 0, owed: 0, last: "" };
            p.played++; if (win.includes(i) && win.length < r.teams.length) { p.wins++; if (!given) p.owed++; }
            if (!p.last || r.date > p.last) p.last = r.date;
            people.set(name, p);
        }));
        (r.cats || []).forEach((c) => { const k = c.c || "Questions", x = cats.get(k) || { c: k, ok: 0, of: 0, games: 0 }; x.ok += c.ok || 0; x.of += c.of || 0; x.games++; cats.set(k, x); });
        if (r.kind === "versus") { if (win.length > 1) vs.tie++; else if (win[0] === 0) vs.cls++; else vs.tch++; }
    });
    const acc = (r) => { let ok = 0, of = 0; (r.cats || []).forEach((c) => { ok += c.ok || 0; of += c.of || 0; }); return of ? ok / of : null; };
    return {
        games: games.map((r) => Object.assign({}, r, { acc: acc(r) })),
        people: [...people.values()].sort((a, b) => b.owed - a.owed || b.wins - a.wins || a.s.localeCompare(b.s)),
        cats: [...cats.values()].map((x) => Object.assign(x, { acc: x.of ? x.ok / x.of : null })).sort((a, b) => (a.acc ?? 2) - (b.acc ?? 2)),
        vs,
    };
}

const fmtDay = (d) => { const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); };
const sc = (n) => (n < 0 ? "−" + Math.abs(n) : String(n));

/** Wires the section into the page. Returns draw(period, cut, band, pct). */
export function mountGameResults({ store, el, status }) {
    let list = [], seen = false, last = null;
    const $ = (id) => document.getElementById(id);
    const row = (cells, tag) => { const tr = el("tr"); cells.forEach((c) => { const td = el(tag || "td"); if (c instanceof Node) td.appendChild(c); else if (Array.isArray(c)) { td.textContent = c[0]; td.className = c[1]; } else td.textContent = c == null ? "" : c; tr.appendChild(td); }); return tr; };

    store.watch("games/results", (snap) => {
        if (snap.pending) return; seen = true;
        list = ((snap.exists && snap.data && snap.data.list) || []).filter((r) => r && r.id);
        if (last) draw(...last);
    }, () => { seen = true; if (last) draw(...last); });

    async function setBonus(id, on) {
        const r = list.find((x) => x.id === id); if (!r) return;
        r.bonus = on ? { given: true, at: Date.now() } : {};
        status("Saving…");
        try { await store.save("games/results", { list, at: Date.now() }); status("Saved", "ok"); }
        catch (e) { status("Could not save (" + ((e && e.code) || "connection") + ")", "bad"); }
        if (last) draw(...last);
    }

    function draw(period, cut, band, pct) {
        last = [period, cut, band, pct];
        const W = $("gWins"), P = $("gPeople"), C = $("gCats"), V = $("gVs"); [W, P, C].forEach((t) => t.replaceChildren()); V.textContent = "";
        if (!seen) { W.appendChild(row(["Loading…"])); return; }
        const { games, people, cats, vs } = summariseGames(list, period);
        if (!games.length) {
            W.appendChild(row(["No review games finished in " + period + " period yet. Play one on the Remote (Review Game screen) and it lands here when you show final scores."]));
            P.appendChild(row(["Nothing yet."])); C.appendChild(row(["Nothing yet."])); return;
        }
        // Who won
        W.appendChild(row(["Date", "Game", "Set", "Winner", "All scores", "Right answers", "Bonus given"], "th"));
        games.slice(0, 80).forEach((r) => {
            const teams = r.teams || [], win = r.win || [], tie = win.length > 1;
            const who = el("div", "grWho");
            if (!teams.length) who.textContent = "";
            else if (win.length === teams.length) who.textContent = "Tie (everyone)";
            else win.forEach((i) => { const t = teams[i]; const b = el("b", null, (tie ? "Tie: " : "") + t.n); who.appendChild(b); if (t.m && t.m.length) who.appendChild(el("small", null, t.m.join(", "))); });
            const cb = el("input"); cb.type = "checkbox"; cb.checked = !!(r.bonus && r.bonus.given); cb.setAttribute("aria-label", "Bonus given for " + r.title + " on " + r.date);
            cb.onchange = () => setBonus(r.id, cb.checked);
            const teacherWon = r.kind === "versus" && win.length === 1 && win[0] === 1;
            const lab = teacherWon ? el("span", "sub", "No bonus") : el("label", "grChk"); if (!teacherWon) { lab.appendChild(cb); lab.appendChild(document.createTextNode(cb.checked ? " Given" : " Not yet")); }
            W.appendChild(row([fmtDay(r.date), r.game || "", r.title || "", who, teams.map((t) => t.n + " " + sc(t.s)).join(" · "),
                r.acc == null ? "" : [pct(r.acc), "num " + band(r.acc, cut)], lab]));
        });
        // Students
        if (!people.length) P.appendChild(row(["No team names saved yet. Make groups with the Group maker before you start a game, and each student's wins show here."]));
        else {
            P.appendChild(row(["Student", "Games played", "Wins", "Wins still owed a bonus", "Last played"], "th"));
            people.forEach((p) => P.appendChild(row([p.s, [String(p.played), "num"], [String(p.wins), "num"], [String(p.owed), "num" + (p.owed ? " mid" : "")], fmtDay(p.last)])));
        }
        // Growth
        const withAcc = games.filter((r) => r.acc != null).slice().reverse();
        if (withAcc.length) {
            const box = el("div", "grSpark"); box.setAttribute("aria-label", "Right answers in each game, oldest to newest");
            withAcc.slice(-30).forEach((r) => { const bar = el("span", band(r.acc, cut)); bar.style.height = Math.max(4, Math.round(r.acc * 100)) + "%"; bar.title = fmtDay(r.date) + " · " + (r.title || r.game) + " · " + pct(r.acc); box.appendChild(bar); });
            V.appendChild(el("p", "sub", "Right answers in each game, oldest to newest (last " + Math.min(30, withAcc.length) + "):"));
            V.appendChild(box);
            const half = Math.floor(withAcc.length / 2);
            if (withAcc.length >= 4) {
                const avg = (a) => a.reduce((s, r) => s + r.acc, 0) / a.length, a1 = avg(withAcc.slice(0, half)), a2 = avg(withAcc.slice(half));
                V.appendChild(el("p", "grTrend", "First half of these games: " + pct(a1) + ". Second half: " + pct(a2) + ". " + (a2 - a1 >= 0.03 ? "Going up." : a1 - a2 >= 0.03 ? "Going down." : "About the same.")));
            }
        }
        if (vs.cls + vs.tch + vs.tie) V.appendChild(el("p", "grTrend", "Class vs. Teacher record: class " + vs.cls + ", teacher " + vs.tch + (vs.tie ? ", ties " + vs.tie : "") + "."));
        if (!cats.length) C.appendChild(row(["Nothing yet."]));
        else {
            C.appendChild(row(["Category", "Right", "Asked", "Percent right", "Games"], "th"));
            cats.forEach((c) => C.appendChild(row([c.c, [String(c.ok), "num"], [String(c.of), "num"], c.acc == null ? "" : [pct(c.acc), "num " + band(c.acc, cut)], [String(c.games), "num"]])));
        }
    }
    return draw;
}
