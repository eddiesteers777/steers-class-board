/* ==========================================
   Anchor Board — Find a problem: the search behind the board's Find panel (js/findPanel.js).
   Eddie, 2026-11-24: "search up a standard, search up a specific topic, and then I can find an example immediately…
   input those easily into the board at any time." and "avoid any lagging issues… a direct connect to all of the examples".

   One index over the whole standards bank (js/stdBank.js: 7th, 8th and Algebra I, every problem with its checked answer).
   It is built once, the first time the panel needs it, and every keystroke after that is a plain loop over prepared
   strings: no network, no waiting. Pure functions, no DOM, so Node tests it (tools/board/find.test.mjs).

     buildIndex(items, standards)  → { rows, stds }        rows: one per problem; stds: one per standard code
     search(index, query, opts)     → { std, topics, rows, total }
       query  a standard code ("7.9", "8.25a", "alg 1.10", "a1 10"), a code start ("8.2" also offers 8.20–8.29),
              or topic words ("two-step equations", "slope", "pythag", "y = mx + b")
       opts   { course: "" | "7th" | "8th" | "alg1", limit }
     topicOf(code)  the short topic name a teacher would say for a standard ("Two-step equations & inequalities")
========================================== */

/* What each standard is about, in the words a teacher would type. The first name is the one shown.
   Written from the bank's own problems for each standard, so a search lands on problems that really fit. */
export const TOPICS = {
    "7.1": "Unit rates with fractions; unit rate, rate per, complex fraction rates, miles per hour, price per ounce",
    "7.2": "Proportional relationships; proportional, constant of proportionality, unit rate, tables, graphs, y = kx, k",
    "7.3": "Percent problems; percent, tax, tip, gratuity, commission, markup, markdown, discount, sale, simple interest, percent increase, percent decrease, percent error",
    "7.4": "Integers and rational number operations; integers, negative numbers, adding integers, subtracting integers, multiplying integers, dividing integers, signed fractions, opposites, absolute value, number line",
    "7.5": "Rational number word problems; complex fractions, order of operations, rational numbers, fractions, decimals, negative fractions",
    "7.6": "Simplify, factor and expand expressions; combine like terms, distributive property, expand, factor, simplify, linear expressions, like terms",
    "7.7": "Equivalent expressions in context; equivalent expressions, rewrite expressions, writing expressions, perimeter expression",
    "7.8": "Multi-step rational number problems; multi-step, estimation, reasonable answers, money, decimals, fractions, convert forms",
    "7.9": "Two-step equations & inequalities; two-step equations, 2 step equations, solve equations, inequalities, solve inequalities, graph inequalities, write equations, one-variable equations, px + q = r, distributive equations",
    "7.10": "Samples and populations; sampling, random sample, biased sample, population, predictions, survey",
    "7.11": "Comparing data sets; compare distributions, overlap, mean absolute deviation, MAD, median, IQR",
    "7.12": "Mean, median, MAD and IQR; mean, median, mode, range, mean absolute deviation, MAD, interquartile range, IQR, measures of center, variability",
    "7.13": "Probability as a number from 0 to 1; probability, likely, unlikely, impossible, certain, chance",
    "7.14": "Probability models; probability model, theoretical probability, uniform, number cube, spinner, P(event)",
    "7.15": "Experimental probability; experimental probability, relative frequency, simulation, predictions, theoretical vs experimental",
    "7.16": "Compound probability and sample spaces; compound events, sample space, tree diagram, outcomes, counting, independent events",
    "7.17": "Scale drawings; scale drawing, scale factor, maps, floor plan, actual length, actual area",
    "7.18": "Constructing triangles; triangle inequality, unique triangle, side lengths, angles, construct shapes",
    "7.19": "Cross sections of 3D figures; cross section, slicing, prisms, pyramids, cones, cylinders",
    "7.20": "Circles: area and circumference; circle, circumference, area of a circle, radius, diameter, pi",
    "7.21": "Angle relationships; complementary, supplementary, vertical angles, adjacent angles, angle equations, missing angle",
    "7.22": "Area, volume and surface area; area, volume, surface area, prisms, triangles, trapezoid, composite figures, polygons",
    "8.1": "Rational and irrational numbers; irrational, rational, real numbers, repeating decimals, terminating decimals, convert fractions to decimals",
    "8.2": "Estimating square roots; square roots, estimate, approximate, irrational, number line, compare, order, between which whole numbers",
    "8.3": "Exponent rules; exponents, integer exponents, properties of exponents, negative exponents, zero exponent, product rule, power rule, quotient rule, laws of exponents",
    "8.4": "Square and cube roots; square root, cube root, perfect squares, perfect cubes, x² = p, x³ = p",
    "8.5": "Scientific notation: compare and estimate; scientific notation, powers of ten, large numbers, small numbers, compare",
    "8.6": "Scientific notation operations; scientific notation, multiply, divide, add, subtract, operations, units",
    "8.7": "Proportional or not; proportional, non-proportional, y = kx, constant of proportionality",
    "8.8": "Graphing proportional relationships; graph proportional, unit rate, slope, origin, rate of change",
    "8.9": "Slope and y = mx + b; slope, y-intercept, slope-intercept form, y = mx + b, rate of change, linear equations, slope formula, similar triangles",
    "8.10": "Comparing linear relationships; compare proportional, non-proportional, tables, graphs, equations, rate of change",
    "8.11": "Multi-step equations; multi-step equations, variables on both sides, distributive property, combine like terms, one solution, no solution, infinitely many solutions",
    "8.12": "Systems of equations; systems of equations, substitution, graphing systems, intersection, solution of a system",
    "8.13": "Functions; function, relation, input, output, mapping, vertical line test",
    "8.14": "Evaluating functions; evaluate functions, f(x), function notation, input output, function rule",
    "8.15": "Comparing functions; compare functions, linear, nonlinear, non-linear, rate of change, tables, graphs",
    "8.16": "Writing linear functions; linear function, model, rate of change, initial value, y = mx + b, word problems",
    "8.17": "Graphs of relationships; increasing, decreasing, linear, nonlinear, describe a graph, sketch a graph",
    "8.18": "Scatter plots; scatter plot, association, positive, negative, no association, outliers, clusters, correlation",
    "8.19": "Line of fit; line of best fit, line of fit, trend line, scatter plot",
    "8.20": "Linear models; linear model, prediction, slope meaning, y-intercept meaning, interpret",
    "8.21": "Two-way tables; two-way table, relative frequency, categorical data, frequency table",
    "8.22": "Rigid motions; rigid motion, rotation, reflection, translation, congruent, transformations",
    "8.23": "Transformations on the coordinate plane; transformations, dilation, translation, rotation, reflection, coordinates, scale factor",
    "8.24": "Similar and congruent figures; similar figures, congruent, dilation, similarity, sequence of transformations",
    "8.25": "Angles: parallel lines and triangles; parallel lines, transversal, alternate interior, corresponding angles, triangle angle sum, exterior angle, isosceles",
    "8.26": "Pythagorean Theorem and its converse; pythagorean theorem, converse, right triangle, a² + b² = c²",
    "8.27": "Distance on the coordinate plane; distance between points, distance formula, pythagorean theorem, coordinate plane",
    "8.28": "Pythagorean Theorem: missing sides; pythagorean theorem, hypotenuse, legs, right triangle, missing side, word problems",
    "8.29": "Cones, cylinders and spheres compared; volume of cones, spheres, cylinders, compare volumes",
    "8.30": "Volume of cylinders, cones and spheres; volume, cylinder, cone, sphere, pi, radius",
    "Alg I.1": "Rational exponents; rational exponents, fractional exponents, radicals, roots, nth root",
    "Alg I.2": "Simplifying radicals and exponents; simplify radicals, square roots, rational exponents, properties of exponents",
    "Alg I.3": "Imaginary numbers; imaginary number, i, complex numbers, powers of i",
    "Alg I.4": "Interpreting expressions; interpret expressions, parts of an expression, growth factor, context",
    "Alg I.5": "Factoring and rewriting expressions; factor, factoring, GCF, difference of squares, structure",
    "Alg I.6": "Forms of quadratics; factor quadratics, zeros, vertex form, factored form, standard form, completing the square",
    "Alg I.7": "Polynomial operations; polynomials, add polynomials, subtract polynomials, multiply polynomials, FOIL, binomials",
    "Alg I.8": "Absolute value equations; absolute value, extraneous solutions, check solutions",
    "Alg I.9": "Solving quadratic equations; quadratic equations, quadratic formula, factoring, square roots, completing the square",
    "Alg I.10": "Systems: elimination and substitution; systems of equations, elimination, substitution, linear systems",
    "Alg I.11": "Equations and inequalities in context; write equations, inequalities, word problems, one variable, solve",
    "Alg I.12": "Equations in two variables; two variables, graph equations, write equations, context",
    "Alg I.13": "Constraints and systems of inequalities; constraints, systems of inequalities, linear programming, viable solutions",
    "Alg I.14": "Graphs as solution sets; graph of an equation, solutions, ordered pairs, points on a line",
    "Alg I.15": "Functions, domain and range; function notation, domain, range, evaluate, f(x)",
    "Alg I.16": "Relations vs functions; function or not, relation, vertical line test",
    "Alg I.17": "Combining and composing functions; combine functions, composition, f(g(x)), sum of functions",
    "Alg I.18": "Linear-quadratic systems; systems, parabola and line, quadratic system, graphing",
    "Alg I.19": "Solving f(x) = g(x) with graphs; intersection, f(x) = g(x), graphing to solve, tables",
    "Alg I.20": "Graphing linear inequalities; linear inequalities, half-plane, systems of inequalities, shading, boundary line",
    "Alg I.21": "Comparing functions in different forms; compare functions, maximum, minimum, rate of change",
    "Alg I.22": "Sequences; arithmetic sequence, geometric sequence, recursive formula, explicit formula, next term",
    "Alg I.23": "Transformations of functions; shifts, translations, stretches, reflections, f(x) + k, f(x − h), parent functions",
    "Alg I.24": "Linear vs exponential; linear or exponential, growth, decay, equal differences, equal ratios",
    "Alg I.25": "Writing linear and exponential functions; write a function, linear function, exponential function, two points, sequences",
    "Alg I.26": "Exponential beats linear; exponential growth, compare growth, eventually exceeds",
    "Alg I.27": "Interpreting parameters; interpret slope, y-intercept, growth rate, decay rate, initial value, context",
    "Alg I.28": "Key features of graphs; maximum, minimum, vertex, intercepts, increasing, decreasing, key features",
    "Alg I.29": "Average rate of change; average rate of change, slope, interval, rate of change",
    "Alg I.30": "Graphing functions; graph functions, quadratic graphs, piecewise, step functions, absolute value graphs, intercepts, vertex",
    "Alg I.31": "Modeling with functions; modeling cycle, real-world models, projectile, validate a model",
    "Alg I.32": "Categorical data and risk; two-way tables, association, causation, risk",
    "Alg I.33": "Investigating associations; investigation, association, categorical variables, survey",
    "Alg I.34": "Quantitative vs categorical data; quantitative, categorical, data types, displays",
    "Alg I.35": "Two-way tables: associations; two-way tables, joint frequency, marginal frequency, conditional frequency, association",
    "Alg I.36": "Two-way tables to solve problems; two-way tables, Simpson's paradox, combine data",
    "Alg I.37": "Sample spaces and events; sample space, events, union, intersection, complement, outcomes",
    "Alg I.38": "Independent events; independent events, independence, tree diagrams, two-way tables",
    "Alg I.39": "Conditional probability; conditional probability, P(A|B), given, tree diagrams, two-way tables",
    "Alg I.40": "Conditional probability in words; conditional probability, independence, everyday language",
    "Alg I.41": "Conditional probability formula; conditional probability, P(A and B), P(B), given",
};

export const COURSES = [["", "All"], ["7th", "7th"], ["8th", "8th"], ["alg1", "Alg I"]];
// 7th, 8th and Algebra I only: the 2nd-6th grade bank (g2..g6) stays out of Find, so the board's search is unchanged.
const courseOf = (code) => (/^7\./.test(code) ? "7th" : /^8\./.test(code) ? "8th" : /^Alg I\./.test(code) ? "alg1" : "");
/** True when Find searches this standard's problems (7th, 8th, Algebra I). */
export const inFind = (code) => !!courseOf(code);
/** The course chip a board class starts on: 7th → 7th, 8th → 8th, 8th Accelerated → All (it teaches 8th and Algebra I). */
export const courseFor = (cls) => (cls === "7th" ? "7th" : cls === "8th" ? "8th" : "");

export function topicOf(code) { const t = TOPICS[code]; return t ? t.split(";")[0].trim() : ""; }

/* ---------- text ---------- */
/** Bank markup to plain words for searching: fractions, money sign, figures and super/subscripts. */
export function plain(t) {
    return String(t == null ? "" : t)
        .replace(/\[\[[\s\S]*?\]\]/g, " ")
        .replace(/§/g, "$")
        .replace(/(\d)\{(\d+)\/(\d+)\}/g, "$1 $2/$3")
        .replace(/\{([^{}]*)\/([^{}]*)\}/g, "$1/$2")
        .replace(/[{}]/g, "")
        .replace(/\s+/g, " ").trim();
}
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const WORDNUM = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
/** Lower case, one kind of dash and minus, no accents or odd punctuation, number words as digits ("two-step" → "2 step"). */
export function norm(t) {
    return String(t == null ? "" : t).toLowerCase()
        .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => SUP[c])
        .replace(/[−–—‑]/g, "-")
        .replace(/π/g, " pi ").replace(/√/g, " sqrt ").replace(/∛/g, " cbrt ").replace(/°/g, " deg ")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)(?=[\s-]?(step|way|variable|digit)s?\b)/g, (w) => WORDNUM[w])
        .replace(/(\d)\s*-\s*(step|way)/g, "$1 $2")
        .replace(/[^a-z0-9.%$=+*/<>|()^, -]/g, " ")
        .replace(/\s+/g, " ").trim();
}
const STOP = new Set(["a", "an", "the", "of", "and", "or", "to", "for", "in", "on", "with", "problems", "problem", "examples", "example", "questions", "question", "practice", "how", "find"]);
/** Search words: each a prefix to match ("pythag" finds Pythagorean). Plurals match their singular ("equations" finds "equation"). */
export function words(q) {
    return norm(q).replace(/[(),]/g, " ").split(" ").map((w) => w.replace(/^[.=+*/<>|^-]+|[.=+*/<>|^-]+$/g, "")).filter((w) => w && !STOP.has(w))
        .map((w) => (w.length > 4 && /[^s]s$/.test(w) && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w));
}

/* ---------- standard codes ---------- */
/** "7.9" → { code: "7.9" }, "8.25a" → { code: "8.25", part: "a" }, "alg 1.10" / "alg i 10" / "a1.10" → "Alg I.10",
    "8.2" also counts as a start ("8.2", "8.20"…"8.29"), "7." → every 7th grade standard. Anything else → null. */
export function parseCode(q) {
    const s = String(q || "").trim().toLowerCase().replace(/\s+/g, " ");
    let m = s.match(/^(?:alg(?:ebra)?\s*(?:i|1)|a1|ai)\s*[.\s-]?\s*(\d{1,2})?([a-z])?\.?$/);
    if (m) return { pre: "Alg I.", num: m[1] || "", part: m[2] || "" };
    m = s.match(/^([78])\s*\.\s*(\d{1,2})?([a-g])?$/);
    if (m) return { pre: m[1] + ".", num: m[2] || "", part: m[3] || "" };
    return null;
}

/* ---------- the index ---------- */
/** One row per bank problem with its search text ready, and one entry per standard with its topic and count. */
export function buildIndex(items, standards) {
    const stdText = {};
    Object.values(standards || {}).forEach((c) => (c.standards || []).forEach((s) => { if (!stdText[s.code]) stdText[s.code] = { text: s.text || "", domain: s.domain || "" }; }));
    const stds = {}, rows = [];
    (items || []).forEach((x, i) => {
        if (!x || !x.id || !x.std || !courseOf(x.std)) return;
        const code = x.std, st = stds[code] || (stds[code] = { code, course: courseOf(code), topic: topicOf(code) || code, n: 0, order: 0,
            tags: " " + norm((TOPICS[code] || "").replace(/;/g, ",")) + " ", text: " " + norm((stdText[code] || {}).text + " " + (stdText[code] || {}).domain) + " " });
        st.n++;
        rows.push({ id: x.id, std: code, part: x.part || "", lvl: x.lvl || 2, course: st.course, i, item: x, q: " " + norm(plain(x.q)) + " ", a: " " + norm(plain(x.a)) + " " });
    });
    // standards in course order (7th, 8th, Alg I), then by number
    const num = (c) => +String(c).split(".").pop() || 0, ci = { "7th": 0, "8th": 1, alg1: 2 };
    Object.values(stds).sort((a, b) => ci[a.course] - ci[b.course] || num(a.code) - num(b.code)).forEach((s, i) => { s.order = i; });
    return { rows, stds };
}

/* A word is found when some word in the text starts with it ("pythag" → " pythagorean"), or it is inside a longer
   stretch like "y=mx+b" / "x^2". The leading space in every prepared string makes " word" a word start. */
const has = (hay, w) => hay.includes(" " + w) || (w.length > 2 && /[=+^/<>|]/.test(w) && hay.includes(w));
const hasAll = (hay, ws) => ws.every((w) => has(hay, w));

/** Search the index. Returns the standard the query names (if any), matching topics (standards), and problem rows, best first. */
export function search(ix, query, opts = {}) {
    const course = opts.course || "", limit = opts.limit || 60;
    const inCourse = (c) => !course || c === course;
    const q = String(query || "").trim();
    const out = { std: null, part: "", topics: [], rows: [], total: 0 };
    if (!ix || !q) return out;

    // 1. A standard code: that standard's problems, on-level first; a code start offers the matching standards as topics
    const pc = parseCode(q);
    if (pc) {
        const all = Object.values(ix.stds).filter((s) => s.code.startsWith(pc.pre));
        const exact = pc.num ? ix.stds[pc.pre + pc.num] : null;
        const starts = all.filter((s) => (pc.num ? s.code.slice(pc.pre.length).startsWith(pc.num) : true)).sort((a, b) => a.order - b.order);
        out.topics = starts.filter((s) => s !== exact).slice(0, 12);
        if (exact) {
            out.std = exact; out.part = pc.part;
            const rows = ix.rows.filter((r) => r.std === exact.code && (!pc.part || r.part === pc.part));
            out.total = rows.length;
            out.rows = rows.slice().sort((a, b) => Math.abs(a.lvl - 2) - Math.abs(b.lvl - 2) || a.lvl - b.lvl || a.i - b.i).slice(0, limit);
            return out;
        }
        if (starts.length) return out;
    }

    // 2. Words: score every problem; a word in the standard's topic names counts most, then the problem, then the standard's wording
    const ws = words(q);
    if (!ws.length) return out;
    const phrase = " " + ws.join(" ");
    const stdHit = {};
    Object.values(ix.stds).forEach((s) => {
        if (!inCourse(s.course)) return;
        const tagAll = hasAll(s.tags, ws), textAll = hasAll(s.text, ws);
        let sc = 0;
        if (tagAll) sc += 40 + (s.tags.includes(phrase) ? 30 : 0) + (" " + norm(s.topic) + " ").includes(phrase) * 25;
        else if (textAll) sc += 14;
        else { const n = ws.filter((w) => has(s.tags, w)).length; if (n) sc += n * 6; }
        if (sc) stdHit[s.code] = sc;
    });
    const scored = [];
    ix.rows.forEach((r) => {
        if (!inCourse(r.course)) return;
        const s = ix.stds[r.std]; let sc = stdHit[r.std] || 0;
        let found = 0;
        ws.forEach((w) => { if (has(r.q, w)) { sc += 9; found++; } else if (has(r.a, w)) { sc += 3; found++; } else if (has(s.tags, w) || has(s.text, w)) found++; });
        if (found < ws.length) return;                       // every word has to be somewhere: problem, answer or standard
        if (r.q.includes(phrase)) sc += 12;
        sc += (2 - Math.abs(r.lvl - 2)) * 0.5;               // on level a little ahead of on-ramp and stretch
        scored.push([sc, r]);
    });
    scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i);
    out.total = scored.length;
    out.rows = scored.slice(0, limit).map((x) => x[1]);
    out.topics = Object.keys(stdHit).map((c) => ix.stds[c]).sort((a, b) => stdHit[b.code] - stdHit[a.code] || a.order - b.order).filter((s) => stdHit[s.code] >= 14).slice(0, 6);
    return out;
}

/** Every standard of a course, in order, for the browse list when the search box is empty. */
export function browse(ix, course) {
    if (!ix) return [];
    return Object.values(ix.stds).filter((s) => !course || s.course === course).sort((a, b) => a.order - b.order);
}

/** Another problem from the same standard (and part), after this one, wrapping around. */
export function another(ix, id) {
    const r = ix && ix.rows.find((x) => x.id === id); if (!r) return null;
    const same = ix.rows.filter((x) => x.std === r.std);
    return same[(same.indexOf(r) + 1) % same.length] || null;
}

/** Find panels: up to four at once (Eddie, 2026-11-24: an anchor chart for each standard on a quiz or test). */
export const FIND_KEYS = ["find", "find2", "find3", "find4"];
export const isFind = (k) => FIND_KEYS.includes(k);
/** The saved state of every Find panel (tools.find): { find: {…}, find2: {…} }. */
export function cleanFinds(d) {
    const o = {}; if (!d || typeof d !== "object") return o;
    FIND_KEYS.forEach((k) => { const f = cleanFind(d[k]); if (f.id) o[k] = f; });
    return o;
}
/** One Find panel's state: which problem is up and how much of it is showing. */
export function cleanFind(d) {
    const o = { id: "", ans: false, hint: 0, at: 0 };
    if (!d || typeof d !== "object") return o;
    if (typeof d.id === "string" && /^[\w. -]{1,40}$/.test(d.id)) o.id = d.id;
    o.ans = !!d.ans && !!o.id;
    o.hint = o.id ? Math.max(0, Math.min(4, Math.floor(+d.hint || 0))) : 0;
    o.at = Number.isFinite(+d.at) ? Math.max(0, Math.floor(+d.at)) : 0;
    return o;
}
