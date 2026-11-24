/* The graphing calculator's math (Math tools, panel "graph"). Pure: no DOM, no eval, so it is safe and testable
   (tools/board/graph.test.mjs). Each row the class types is read into one of these kinds:
     fn     y = 2x + 1, f(x) = x^2, or a bare expression in x (graphed as y = …), with an optional {−2 < x < 3}
     xfn    x = 3, x = y^2 (graphed sideways)
     ineq   y > 2x − 1, y ≤ |x| (shaded; dashed when strict)
     imp    x^2 + y^2 = 25 and other equations in x and y (and implicit inequalities)
     slider a = 3 (a number on its own makes a slider)
     def    k = 2a + 1 (a value worked out from others)
     fdef   f(x) = … that does not use x (a constant function)
     pts    (2, 3) or (1, 2), (3, 4) or (a, a^2)
     val    3 + 4·2 or f(3): the answer shows under it
   Everything the parser does not know is reported as an error the row shows in plain words. */

export const GC_MAX = 24, GC_LEN = 160;
export const GC_COLS = ["#2D70E0", "#E5484D", "#1F9D5C", "#E09A1A", "#8B5CF6", "#0FA3A8", "#F2752B", "#D6409F"];
const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: (v) => 1 / Math.cos(v), csc: (v) => 1 / Math.sin(v), cot: (v) => 1 / Math.tan(v),
    arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};
const MULTI = { min: Math.min, max: Math.max };
const NAMES = Object.keys(FUNCS).concat(Object.keys(MULTI), ["pi"]).sort((a, b) => b.length - a.length);
const CONST = { pi: Math.PI, e: Math.E };

/* ---------------- reading text ---------------- */
/** Friendly symbols to the plain ones the reader knows. */
export function normalize(s) {
    return String(s || "").slice(0, GC_LEN)
        .replace(/[−–—]/g, "-").replace(/[·×∙⋅]/g, "*").replace(/÷/g, "/")
        .replace(/²/g, "^2").replace(/³/g, "^3").replace(/π/g, "pi").replace(/√/g, "sqrt")
        .replace(/<=|=</g, "≤").replace(/>=|=>/g, "≥");
}

function tokenize(src) {
    const s = normalize(src), out = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[0-9.]/.test(c)) {
            const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
            if (!m) throw err("A number looks off near “" + s.slice(i, i + 4) + "”.");
            out.push({ k: "n", v: parseFloat(m[1]) }); i += m[1].length; continue;
        }
        if (/[A-Za-z]/.test(c)) {
            const rest = s.slice(i);
            const name = NAMES.find((n) => rest.startsWith(n));
            if (name) { out.push({ k: name === "pi" ? "id" : "fn", v: name }); i += name.length; continue; }
            // one letter is one variable, so mx is m·x; a_1 and a_12 keep their subscript
            const m = /^[A-Za-z](_[A-Za-z0-9]+)?/.exec(rest);
            out.push({ k: "id", v: m[0] }); i += m[0].length; continue;
        }
        if ("+-*/^(),|{}".includes(c)) { out.push({ k: c }); i++; continue; }
        if ("=<>≤≥".includes(c)) { out.push({ k: "cmp", v: c }); i++; continue; }
        if (c === "!") { out.push({ k: "!" }); i++; continue; }
        throw err("I don't know the symbol “" + c + "”.");
    }
    return out;
}
function err(m) { const e = new Error(m); e.gc = true; return e; }

/** Parse tokens into a tree. fnNames: the one-letter names that are functions here (f, g, …), so f(2) is a call, a(2) is a·2. */
function parseTokens(toks, fnNames) {
    let i = 0, absDepth = 0;
    const peek = () => toks[i], take = (k) => { const t = toks[i]; if (!t || (k && t.k !== k)) throw err(k === ")" ? "A “(” is missing its “)”." : "Something is missing here."); i++; return t; };
    const startsPrimary = (t) => t && (t.k === "n" || t.k === "id" || t.k === "fn" || t.k === "(" || (t.k === "|" && absDepth === 0));
    function expr() { return add(); }
    function add() {
        let a = mul();
        while (peek() && (peek().k === "+" || peek().k === "-")) { const o = take().k; a = { t: "b", o, a, b: mul() }; }
        return a;
    }
    function mul() {
        let a = unary();
        for (;;) {
            const t = peek();
            if (t && (t.k === "*" || t.k === "/")) { take(); a = { t: "b", o: t.k, a, b: unary() }; continue; }
            if (startsPrimary(t)) { a = { t: "b", o: "*", a, b: pow() }; continue; }   // 2x, 3(x+1), x sin x
            return a;
        }
    }
    function unary() {
        if (peek() && peek().k === "-") { take(); return { t: "neg", a: unary() }; }
        if (peek() && peek().k === "+") { take(); return unary(); }
        return pow();
    }
    function pow() {
        let a = post();
        if (peek() && peek().k === "^") { take(); a = { t: "b", o: "^", a, b: unary() }; }
        return a;
    }
    function post() {
        let a = primary();
        while (peek() && peek().k === "!") { take(); a = { t: "fn", n: "fact", args: [a] }; }
        return a;
    }
    function primary() {
        const t = peek();
        if (!t) throw err("The expression stops too soon.");
        if (t.k === "n") { take(); return { t: "n", v: t.v }; }
        if (t.k === "(") {
            take(); const items = [expr()];
            while (peek() && peek().k === ",") { take(); items.push(expr()); }
            take(")");
            return items.length === 1 ? items[0] : { t: "tup", items };
        }
        if (t.k === "|") { take(); absDepth++; const a = expr(); absDepth--; take("|"); return { t: "fn", n: "abs", args: [a] }; }
        if (t.k === "fn") {
            take();
            if (peek() && peek().k === "^" && t.v !== "sqrt") {   // sin^2 x
                take(); const p = unary(); const arg = fnArg(t.v); return { t: "b", o: "^", a: { t: "fn", n: t.v, args: arg }, b: p };
            }
            return { t: "fn", n: t.v, args: fnArg(t.v) };
        }
        if (t.k === "id") {
            take();
            if (fnNames.has(t.v) && peek() && peek().k === "(") { take(); const args = [expr()]; while (peek() && peek().k === ",") { take(); args.push(expr()); } take(")"); return { t: "call", n: t.v, args }; }
            return { t: "v", n: t.v };
        }
        if (t.k === ")") throw err("There's a “)” without its “(”.");
        throw err("Something is missing before “" + (t.v || t.k) + "”.");
    }
    function fnArg(name) {
        if (peek() && peek().k === "(") { take(); const a = [expr()]; while (peek() && peek().k === ",") { take(); a.push(expr()); } take(")"); return a; }
        if (MULTI[name]) throw err(name + " needs brackets, like " + name + "(2, 5).");
        return [pow()];   // sin x, sqrt 2
    }
    const tree = expr();
    if (i < toks.length) {
        const t = toks[i];
        throw err(t.k === ")" ? "There's a “)” without its “(”." : t.k === "," ? "Points need brackets, like (2, 3)." : "I couldn't read the part starting at “" + (t.v != null ? t.v : t.k) + "”.");
    }
    return tree;
}

/** Every variable a tree uses, and every function it calls. */
function usesOf(tree, vars = new Set(), calls = new Set()) {
    (function walk(n) {
        if (!n) return;
        if (n.t === "v") vars.add(n.n);
        if (n.t === "call") calls.add(n.n);
        ["a", "b"].forEach((k) => walk(n[k]));
        (n.args || n.items || []).forEach(walk);
    })(tree);
    return { vars, calls };
}

/* ---------------- working out values ---------------- */
function fact(n) { if (n < 0 || !Number.isInteger(n)) return NaN; let r = 1; for (let k = 2; k <= Math.min(n, 170); k++) r *= k; return n > 170 ? Infinity : r; }
/** A tree into a function of a scope { x, y, ...vars }; calls look up user functions in fns. No eval. */
function compile(n, fns, F = FUNCS) {
    switch (n.t) {
        case "n": { const v = n.v; return () => v; }
        case "v": { const k = n.n; return (sc) => { const v = sc[k]; return v === undefined ? (k in CONST ? CONST[k] : NaN) : v; }; }
        case "neg": { const a = compile(n.a, fns, F); return (sc) => -a(sc); }
        case "b": {
            const a = compile(n.a, fns, F), b = compile(n.b, fns, F);
            if (n.o === "+") return (sc) => a(sc) + b(sc);
            if (n.o === "-") return (sc) => a(sc) - b(sc);
            if (n.o === "*") return (sc) => a(sc) * b(sc);
            if (n.o === "/") return (sc) => a(sc) / b(sc);
            return (sc) => { const x = a(sc), p = b(sc); if (x < 0 && !Number.isInteger(p)) { const q = 1 / p; if (Number.isInteger(Math.round(q)) && Math.abs(q - Math.round(q)) < 1e-9 && Math.round(q) % 2) return -Math.pow(-x, p); } return Math.pow(x, p); };   // cube roots of negatives work
        }
        case "fn": {
            const args = n.args.map((a) => compile(a, fns, F));
            if (n.n === "fact") return (sc) => fact(args[0](sc));
            if (MULTI[n.n]) { const f = MULTI[n.n]; return (sc) => f(...args.map((a) => a(sc))); }
            const f = F[n.n]; if (args.length !== 1) throw err(n.n + " takes one number.");
            return (sc) => f(args[0](sc));
        }
        case "call": {
            const args = n.args.map((a) => compile(a, fns, F)), name = n.n;
            return (sc) => { const f = fns[name]; if (!f) return NaN; return f(args.map((a) => a(sc)), sc); };
        }
        case "tup": throw err("A point can't go inside a sum.");
    }
    throw err("Something is missing here.");
}

/* ---------------- one row ---------------- */
const isVar = (n, name) => n && n.t === "v" && n.n === name;
function splitCmp(toks) {
    let depth = 0, at = -1, brace = -1;
    toks.forEach((t, i) => {
        if (t.k === "(" ) depth++; else if (t.k === ")") depth--;
        else if (t.k === "{" && depth === 0 && brace < 0) brace = i;
        else if (t.k === "cmp" && depth === 0 && brace < 0) { if (at >= 0) at = -2; else if (at === -1) at = i; }
    });
    return { at, brace };
}
/** {−2 < x < 3} or {x > 0}: a test on x (or y) that limits where a graph is drawn. */
function parseRestrict(toks, fnNames) {
    const parts = [], cur = [];
    const pieces = [];
    toks.forEach((t) => { if (t.k === "cmp") { parts.push(cur.splice(0)); pieces.push(t.v); } else cur.push(t); });
    parts.push(cur.splice(0));
    if (pieces.length < 1 || parts.some((p) => !p.length)) throw err("A limit looks like {−2 < x < 3}.");
    const trees = parts.map((p) => parseTokens(p, fnNames));
    return { trees, ops: pieces };
}
const CMP = { "<": (a, b) => a < b, ">": (a, b) => a > b, "≤": (a, b) => a <= b + 1e-12, "≥": (a, b) => a >= b - 1e-12, "=": (a, b) => Math.abs(a - b) < 1e-9 };

/** Read one row's text. fnNames: one-letter function names defined anywhere in the list. */
export function readRow(text, fnNames = new Set()) {
    const src = normalize(text).trim();
    if (!src) return { kind: "none" };
    let toks;
    try { toks = tokenize(src); } catch (e) { return { kind: "err", msg: e.message }; }
    try {
        let restrict = null;
        const { at, brace } = splitCmp(toks);
        if (brace >= 0) {
            const end = toks.length - 1;
            if (toks[end].k !== "}") throw err("A “{” is missing its “}”.");
            restrict = parseRestrict(toks.slice(brace + 1, end), fnNames);
            toks = toks.slice(0, brace);
            if (!toks.length) throw err("Put the graph before the {limit}.");
        }
        if (at === -2) throw err("Use one =, < or > in a row (limits go in { }).");
        const cmpAt = splitCmp(toks).at;
        if (cmpAt < 0) {
            let d = 0; if (toks.some((t) => { if (t.k === "(") d++; else if (t.k === ")") d--; return t.k === "," && d === 0; })) toks = [{ k: "(" }].concat(toks, [{ k: ")" }]);   // (1, 2), (3, 4)
            const tree = parseTokens(toks, fnNames);
            if (tree.t === "tup") return pointsRow(tree, restrict);
            const u = usesOf(tree);
            if (u.vars.has("y")) throw err("Add “= …” or “< …” to graph with y.");
            if (u.vars.has("x")) return { kind: "fn", tree, uses: u, restrict };
            return { kind: "val", tree, uses: u };
        }
        const op = toks[cmpAt].v, L = toks.slice(0, cmpAt), R = toks.slice(cmpAt + 1);
        if (!L.length || !R.length) throw err(op === "=" ? "Something is missing beside the =." : "Something is missing beside the " + op + ".");
        // f(x) = …  (a function of one letter)
        if (op === "=" && L.length === 4 && L[0].k === "id" && /^[a-wzA-Z]$/.test(L[0].v) && L[1].k === "(" && L[2].k === "id" && L[3].k === ")" && !["x", "y"].includes(L[0].v)) {
            const name = L[0].v, arg = L[2].v;
            const fs = new Set(fnNames); fs.add(name);
            const tree = parseTokens(R, fs), u = usesOf(tree);
            if (u.calls.has(name)) throw err(name + " can't use itself.");
            return { kind: "fdef", name, arg, tree, uses: u, restrict };
        }
        const lt = parseTokens(L, fnNames), rt = parseTokens(R, fnNames);
        const lu = usesOf(lt), ru = usesOf(rt);
        if (lt.t === "tup" || rt.t === "tup") throw err("A point can't be in an equation.");
        // y = f(x), y < f(x), and the same written the other way round
        const flip = { "<": ">", ">": "<", "≤": "≥", "≥": "≤", "=": "=" };
        if (isVar(lt, "y") && !ru.vars.has("y")) return graphY(op, rt, ru, restrict);
        if (isVar(rt, "y") && !lu.vars.has("y")) return graphY(flip[op], lt, lu, restrict);
        if (isVar(lt, "x") && !ru.vars.has("x")) return graphX(op, rt, ru, restrict);
        if (isVar(rt, "x") && !lu.vars.has("x")) return graphX(flip[op], lt, lu, restrict);
        // a = 3 (slider) or k = 2a (a value from others)
        if (op === "=" && lt.t === "v" && !["x", "y"].includes(lt.n) && !(lt.n in CONST)) {
            if (ru.vars.has("x") || ru.vars.has("y")) {
                throw err("To graph, start with y = or x =. To name a function, write " + lt.n + "(x) = ….");
            }
            if (ru.vars.has(lt.n)) throw err(lt.n + " can't use itself.");
            const num = numberOf(rt);
            if (num != null) return { kind: "slider", name: lt.n, v: num };
            return { kind: "def", name: lt.n, tree: rt, uses: ru };
        }
        const all = new Set([...lu.vars, ...ru.vars]);
        if (all.has("x") || all.has("y")) {
            const tree = { t: "b", o: "-", a: lt, b: rt };
            return { kind: "imp", op, tree, uses: { vars: all, calls: new Set([...lu.calls, ...ru.calls]) }, restrict };
        }
        if (op === "=") throw err("Start with a letter, like a = 3, or with y =.");
        throw err("That comparison has no x or y to graph.");
    } catch (e) {
        if (e.gc) return { kind: "err", msg: e.message };
        return { kind: "err", msg: "I couldn't read that." };
    }
}
function numberOf(t) {
    if (t.t === "n") return t.v;
    if (t.t === "neg" && t.a.t === "n") return -t.a.v;
    return null;
}
function graphY(op, tree, uses, restrict) {
    if (op === "=") return { kind: "fn", tree, uses, restrict };
    return { kind: "ineq", side: "y", op, tree, uses, restrict };
}
function graphX(op, tree, uses, restrict) {
    if (op === "=") return { kind: "xfn", tree, uses, restrict };
    return { kind: "ineq", side: "x", op, tree, uses, restrict };
}
function pointsRow(tree, restrict) {
    // (1, 2) is one point; ((1, 2), (3, 4)) came from "(1,2),(3,4)" read as a tuple of tuples
    let list;
    if (tree.items.every((x) => x.t === "tup")) list = tree.items;
    else if (tree.items.length === 2) list = [tree];
    else throw err("A point has two numbers, like (2, 3).");
    if (list.some((p) => p.items.length !== 2)) throw err("A point has two numbers, like (2, 3).");
    const uses = { vars: new Set(), calls: new Set() };
    list.forEach((p) => p.items.forEach((x) => usesOf(x, uses.vars, uses.calls)));
    if (uses.vars.has("x") || uses.vars.has("y")) throw err("A point needs numbers, not x or y.");
    return { kind: "pts", list, uses, restrict };
}

/* ---------------- the whole list ---------------- */
/** Read every row: what each is, the values of sliders and defined letters, compiled graphs, and what each row says. */
export function buildList(rows) {
    // one-letter function names first, so f(2) reads as a call everywhere
    const fnNames = new Set();
    rows.forEach((r) => { const m = /^\s*([a-wzA-Z])\s*\(\s*[A-Za-z]\s*\)\s*=/.exec(normalize(r.t)); if (m) fnNames.add(m[1]); });
    const read = rows.map((r) => readRow(r.t, fnNames));
    const defs = {}, fdefs = {}, owner = {};
    read.forEach((o, i) => {
        if (o.kind === "slider" || o.kind === "def") { if (defs[o.name]) { read[i] = { kind: "err", msg: o.name + " is already used above." }; return; } defs[o.name] = o; owner[o.name] = i; }
        if (o.kind === "fdef") { if (fdefs[o.name]) { read[i] = { kind: "err", msg: o.name + " is already used above." }; return; } fdefs[o.name] = o; }
    });
    const fns = {};
    let depth = 0;   // f and g calling each other give up instead of running forever
    // values of defined letters, worked out in order of need (a loop is an error)
    const scope = {}, state = {};
    function val(name) {
        if (state[name] === 2) return scope[name];
        if (state[name] === 1) throw err("These letters use each other in a loop.");
        const d = defs[name]; if (!d) return undefined;
        state[name] = 1;
        let v = d.kind === "slider" ? d.v : NaN;
        if (d.kind === "def") { d.uses.vars.forEach((u) => { if (u !== name) val(u); }); v = compile(d.tree, fns)(scope); }
        scope[name] = v; state[name] = 2; return v;
    }
    Object.keys(fdefs).forEach((name) => {
        const d = fdefs[name], f = compile(d.tree, fns);
        fns[name] = (args, sc) => { if (depth > 40) return NaN; depth++; try { const s2 = Object.assign({}, sc); s2[d.arg] = args[0]; return f(s2); } finally { depth--; } };
    });
    const out = read.map((o, i) => {
        if (o.kind === "none" || o.kind === "err") return o;
        try {
            const missing = [];
            const seen = new Set();
            const check = (uses, extra) => {
                uses.vars.forEach((v) => {
                    if (v === "x" || v === "y" || (extra && extra.has(v)) || v in CONST) return;
                    if (defs[v]) { val(v); return; }
                    missing.push(v);
                });
                uses.calls.forEach((c) => { if (!fdefs[c]) missing.push(c + "( )"); else if (!seen.has(c)) { seen.add(c); check(fdefs[c].uses, new Set([fdefs[c].arg])); } });
            };
            if (o.kind === "slider") { val(o.name); return Object.assign({}, o, { value: scope[o.name] }); }
            if (o.kind === "def") { check(o.uses); if (missing.length) return missOf(missing); return Object.assign({}, o, { value: val(o.name) }); }
            if (o.kind === "fdef") { check(o.uses, new Set([o.arg])); if (missing.length) return missOf(missing); const f = fns[o.name]; return Object.assign({}, o, { f: (x) => f([x], scope), restrictF: restrictOf(o.restrict, fns, scope) }); }
            check(o.uses);
            if (o.restrict) o.restrict.trees.forEach((t) => check(usesOf(t)));
            if (missing.length) return missOf(missing);
            const c = compile(o.tree || { t: "n", v: 0 }, fns), restrictF = restrictOf(o.restrict, fns, scope);
            if (o.kind === "val") return Object.assign({}, o, { value: c(scope) });
            if (o.kind === "fn") return Object.assign({}, o, { f: (x) => c(Object.assign({}, scope, { x })), restrictF });
            if (o.kind === "xfn") return Object.assign({}, o, { f: (y) => c(Object.assign({}, scope, { y })), restrictF });
            if (o.kind === "ineq") return Object.assign({}, o, { f: (t) => c(Object.assign({}, scope, o.side === "y" ? { x: t } : { y: t })), restrictF });
            if (o.kind === "imp") return Object.assign({}, o, { f: (x, y) => c(Object.assign({}, scope, { x, y })), restrictF });
            if (o.kind === "pts") return Object.assign({}, o, { points: o.list.map((p) => p.items.map((t) => compile(t, fns)(scope))) });
            return o;
        } catch (e) { return { kind: "err", msg: e.gc ? e.message : "I couldn't work that out." }; }
    });
    return { rows: out, scope };
}
function missOf(list) {
    const letters = [...new Set(list.filter((v) => !v.endsWith("( )")))], calls = list.filter((v) => v.endsWith("( )"));
    if (calls.length) return { kind: "err", msg: "Name " + calls[0].replace("( )", "") + " first, like " + calls[0].replace("( )", "") + "(x) = x^2." };
    return { kind: "miss", vars: letters, msg: "Add a slider for " + letters.join(", ") + "." };
}
function restrictOf(r, fns, scope) {
    if (!r) return null;
    const cs = r.trees.map((t) => compile(t, fns));
    return (x, y) => {
        const sc = Object.assign({}, scope, { x, y });
        for (let i = 0; i < r.ops.length; i++) if (!CMP[r.ops[i]](cs[i](sc), cs[i + 1](sc))) return false;
        return true;
    };
}

/* ---------------- numbers for people ---------------- */
/** 3, 0.5, −1.25, 3.14159, 1.2×10⁶ */
export function fmt(v, digits = 6) {
    if (typeof v !== "number" || Number.isNaN(v)) return "undefined";
    if (!Number.isFinite(v)) return v > 0 ? "∞" : "−∞";
    if (Math.abs(v) < 1e-10) return "0";
    const a = Math.abs(v);
    let s;
    if (a >= 1e7 || a < 1e-5) { const e = Math.floor(Math.log10(a)), m = +(v / Math.pow(10, e)).toPrecision(4); s = m + "×10" + supOf(e); }
    else s = String(+v.toPrecision(digits));
    return s.replace(/^-/, "−");
}
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const supOf = (n) => String(n).split("").map((c) => SUP[c] || c).join("");

/* ---------------- finding special points ---------------- */
/** Where f crosses zero between a and b (sign changes and touch points), up to max. */
export function zerosOf(f, a, b, n = 400, max = 12) {
    const out = [], step = (b - a) / n;
    let x0 = a, y0 = f(x0);
    for (let i = 1; i <= n && out.length < max; i++) {
        const x1 = a + step * i, y1 = f(x1);
        if (Number.isFinite(y0) && Number.isFinite(y1)) {
            if (y0 === 0) push(x0);
            else if (y0 * y1 < 0) {
                let lo = x0, hi = x1, fl = y0;
                for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2, fm = f(m); if (!Number.isFinite(fm)) { lo = hi = NaN; break; } if (fl * fm <= 0) hi = m; else { lo = m; fl = fm; } }
                const z = (lo + hi) / 2;
                if (Number.isFinite(z) && Math.abs(f(z)) < 1e-6 * Math.max(1, Math.abs(y0), Math.abs(y1))) push(z);   // a jump across an asymptote is not a zero
            }
        }
        x0 = x1; y0 = y1;
    }
    if (out.length < max && Number.isFinite(y0) && y0 === 0) push(x0);
    return out;
    function push(z) { const r = Math.abs(z - Math.round(z * 1e6) / 1e6) < 1e-9 ? Math.round(z * 1e6) / 1e6 : z; if (!out.some((q) => Math.abs(q - r) < step / 2)) out.push(r); }
}
/** A tidy grid step for a span of about n lines: 1, 2 or 5 times a power of ten. */
export function niceStep(span, n = 10) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/* ---------------- saved state ---------------- */
export const gcDefault = () => ({ e: [{ id: "a1", t: "y = 2x + 1", c: 0 }], v: { cx: 0, cy: 0, w: 22 } });
/** The rows (id, text, colour, hidden, slider range) and the view (centre and width), cleaned. */
export function cleanGc(o) {
    const src = o && typeof o === "object" ? o : {}, out = [], seen = new Set();
    (Array.isArray(src.e) ? src.e : []).forEach((r) => {
        if (out.length >= GC_MAX || !r || typeof r !== "object") return;
        const id = String(r.id || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
        if (!id || seen.has(id)) return; seen.add(id);
        const x = { id, t: typeof r.t === "string" ? r.t.slice(0, GC_LEN) : "", c: Number.isInteger(r.c) ? ((r.c % GC_COLS.length) + GC_COLS.length) % GC_COLS.length : out.length % GC_COLS.length };
        if (r.h) x.h = true;
        if (r.r && typeof r.r === "object") {
            const lo = +r.r.lo, hi = +r.r.hi, st = +r.r.st;
            if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo && Math.abs(lo) <= 1e6 && Math.abs(hi) <= 1e6) x.r = { lo, hi, st: Number.isFinite(st) && st > 0 && st <= hi - lo ? st : 0 };
        }
        out.push(x);
    });
    const v = src.v && typeof src.v === "object" ? src.v : {};
    const cx = Number.isFinite(+v.cx) ? clamp(+v.cx, -1e6, 1e6) : 0, cy = Number.isFinite(+v.cy) ? clamp(+v.cy, -1e6, 1e6) : 0, w = Number.isFinite(+v.w) ? clamp(+v.w, 1e-3, 1e6) : 22;
    return { e: out, v: { cx, cy, w } };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** A slider's range: the saved one, or −10 to 10 grown to fit its value. */
export function rangeOf(row, v) {
    if (row.r) return { lo: row.r.lo, hi: row.r.hi, st: row.r.st || 0 };
    const m = Math.max(10, Math.ceil(Math.abs(v || 0) / 10) * 10);
    return { lo: -m, hi: m, st: 0 };
}
/** The slider value, snapped to its step (or to a tidy 1/100 of the range). */
export function snapTo(v, r) {
    const st = r.st || niceStep(r.hi - r.lo, 100);
    const n = Math.round((v - r.lo) / st) * st + r.lo;
    return +clamp(n, r.lo, r.hi).toPrecision(10);
}
/** The text a slider row shows for a value: "a = 2.5". */
export const sliderText = (name, v) => name + " = " + fmt(v).replace(/^−/, "-");

/* ---------------- the basic and scientific calculators ---------------- */
const R = Math.PI / 180;
const DEG = Object.assign({}, FUNCS, {
    sin: (v) => cleanTrig(Math.sin(v * R)), cos: (v) => cleanTrig(Math.cos(v * R)), tan: (v) => (Math.abs(((v % 180) + 180) % 180 - 90) < 1e-9 ? NaN : cleanTrig(Math.tan(v * R))),
    sec: (v) => 1 / cleanTrig(Math.cos(v * R)), csc: (v) => 1 / cleanTrig(Math.sin(v * R)), cot: (v) => cleanTrig(Math.cos(v * R)) / cleanTrig(Math.sin(v * R)),
    asin: (v) => Math.asin(v) / R, acos: (v) => Math.acos(v) / R, atan: (v) => Math.atan(v) / R, arcsin: (v) => Math.asin(v) / R, arccos: (v) => Math.acos(v) / R, arctan: (v) => Math.atan(v) / R,
});
function cleanTrig(v) { return Math.abs(v) < 1e-12 ? 0 : Math.abs(v - Math.round(v)) < 1e-12 ? Math.round(v) : v; }
/** One answer for the calculators: { v } or { err }. deg: angles in degrees. ans: the last answer. Percent: 50% is 0.5. */
export function calcValue(text, { deg = false, ans = 0 } = {}) {
    let src = normalize(text).replace(/ans/gi, "(A)").replace(/(\d|\))\s*%/g, "$1/100").replace(/%/g, "/100").trim();
    if (!src) return { v: null };
    // close any brackets left open, like a pocket calculator does
    const open = (src.match(/\(/g) || []).length - (src.match(/\)/g) || []).length;
    if (open > 0) src += ")".repeat(open);
    try {
        const toks = tokenize(src);
        if (toks.some((t) => t.k === "cmp" || t.k === "{")) throw err("This calculator works out one answer. Graphs go in the graphing calculator.");
        const tree = parseTokens(toks, new Set());
        if (tree.t === "tup") throw err("Use a point in the graphing calculator.");
        const u = usesOf(tree), bad = [...u.vars].filter((v) => v !== "A" && !(v in CONST));
        if (bad.length) throw err("This calculator doesn't use letters like " + bad[0] + ".");
        const v = compile(tree, {}, deg ? DEG : FUNCS)({ A: ans });
        if (Number.isNaN(v)) return { err: "Not a real number" };
        if (!Number.isFinite(v)) return { err: "Can't divide by zero" };
        return { v: Math.abs(v) < 1e-13 ? 0 : +v.toPrecision(14) };
    } catch (e) { return { err: e.gc ? e.message : "I couldn't read that." }; }
}
/** 0.75 as 3/4 and 2.5 as 5/2 (and 2 1/2 as a mixed number), when it is a fraction with a small bottom. */
export function fracOf(v, maxDen = 1000) {
    if (!Number.isFinite(v) || Number.isInteger(v)) return null;
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, x = Math.abs(v);
    for (let i = 0; i < 30; i++) {
        const a = Math.floor(x), h2 = a * h1 + h0, k2 = a * k1 + k0;
        if (k2 > maxDen) break;
        h0 = h1; h1 = h2; k0 = k1; k1 = k2;
        if (Math.abs(Math.abs(v) - h1 / k1) < 1e-10) {
            const sg = v < 0 ? "−" : "", w = Math.floor(h1 / k1), r = h1 % k1;
            return { top: h1, bot: k1, text: sg + h1 + "/" + k1, mixed: w ? sg + w + " " + r + "/" + k1 : null };
        }
        x = 1 / (x - a); if (!Number.isFinite(x)) break;
    }
    return null;
}
