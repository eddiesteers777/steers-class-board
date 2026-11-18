"""Pictures in week-file text, for the Word papers: coordinate graphs, tables and mapping diagrams.

The token is the same one the site draws (js/figures.js):
    [[graph {"x":[-5,5],"y":[-5,5],"pts":[[1,2]],"open":[],"seg":[],"line":[],"curve":[],"step":1}]]
    [[table {"cols":["x","y"],"rows":[[1,3],[2,5]],"across":false}]]
    [[map {"left":[1,2],"right":[3],"arrows":[[1,3],[2,3]],"lt":"Input","rt":"Output"}]]
to_word() swaps each token for a @@FIGn@@ placeholder; mathdoc.add_runs() puts the picture (PNG, 300 dpi) there.
"""
import json, os, re, tempfile

FIGS = []
_TYPES = re.compile(r"\[\[(graph|table|map)\s*")
_DIR = tempfile.mkdtemp(prefix="weekfigs_")


def parse_at(s, i):
    m = _TYPES.match(s, i)
    if not m: return None
    j = m.end()
    if j >= len(s) or s[j] != "{": return None
    d, in_str, k = 0, False, j
    while k < len(s):
        c = s[k]
        if in_str:
            if c == "\\": k += 1
            elif c == '"': in_str = False
        elif c == '"': in_str = True
        elif c == "{": d += 1
        elif c == "}":
            d -= 1
            if d == 0: break
        k += 1
    if d: return None
    e = k + 1
    while e < len(s) and s[e] == " ": e += 1
    if s[e:e + 2] != "]]": return None
    try: spec = json.loads(s[j:k + 1])
    except ValueError: return None
    return m.group(1), spec, e + 2


def take(s):
    """Replace each picture token with @@FIGn@@ and remember it."""
    out, i = "", 0
    while i < len(s):
        f = parse_at(s, i) if s.startswith("[[", i) else None
        if f:
            FIGS.append((f[0], f[1])); out += "@@FIG%d@@" % (len(FIGS) - 1); i = f[2]
        else:
            out += s[i]; i += 1
    return out


def strip(s):
    """The text without its pictures (messages, slides)."""
    out, i = "", 0
    while i < len(s):
        f = parse_at(s, i) if s.startswith("[[", i) else None
        if f: i = f[2]
        else: out += s[i]; i += 1
    return re.sub(r"\s{2,}", " ", out).strip()


def _num(v): return str(v).replace("-", "−") if str(v).startswith("-") else str(v)


def png(n):
    """(path, width in inches) for placeholder n."""
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Ellipse, FancyArrowPatch
    kind, g = FIGS[n]
    path = os.path.join(_DIR, "fig%d.png" % n)
    plt.rcParams.update({"font.family": ["Carlito", "DejaVu Sans"], "font.size": 8})
    if kind == "graph":
        x0, x1 = g.get("x", [-5, 5]); y0, y1 = g.get("y", [-5, 5]); step = g.get("step", 1)
        w = 0.16 * (x1 - x0) + 0.3; h = w * (y1 - y0) / (x1 - x0)
        fig, ax = plt.subplots(figsize=(w, h))
        ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.axis("off")
        x = x0
        while x <= x1 + 1e-9: ax.plot([x, x], [y0, y1], color="#bbbbbb", lw=0.4, zorder=0); x += step
        y = y0
        while y <= y1 + 1e-9: ax.plot([x0, x1], [y, y], color="#bbbbbb", lw=0.4, zorder=0); y += step
        arrow = dict(arrowstyle="<|-|>", color="black", lw=0.9, mutation_scale=6)
        if y0 <= 0 <= y1: ax.add_patch(FancyArrowPatch((x0, 0), (x1, 0), **arrow))
        if x0 <= 0 <= x1: ax.add_patch(FancyArrowPatch((0, y0), (0, y1), **arrow))
        every = 2 * step if (x1 - x0) / step > 12 else step
        v = (int(x0 / every)) * every
        while v <= x1:
            if v not in (0, x0, x1): ax.text(v, max(y0, min(0, y1)) - 0.45 * step, _num(v), ha="center", va="top", fontsize=6.5)
            v += every
        v = (int(y0 / every)) * every
        while v <= y1:
            if v not in (0, y0, y1): ax.text(max(x0, min(0, x1)) - 0.25 * step, v, _num(v), ha="right", va="center", fontsize=6.5)
            v += every
        for a, b in g.get("seg", []): ax.plot([a[0], b[0]], [a[1], b[1]], color="black", lw=1.4, solid_capstyle="round")
        for a, b in g.get("line", []):
            dx, dy = b[0] - a[0], b[1] - a[1]; ts = []
            if dx: ts += [(x0 - a[0]) / dx, (x1 - a[0]) / dx]
            if dy: ts += [(y0 - a[1]) / dy, (y1 - a[1]) / dy]
            ins = sorted([(a[0] + t * dx, a[1] + t * dy) for t in ts if x0 - 1e-9 <= a[0] + t * dx <= x1 + 1e-9 and y0 - 1e-9 <= a[1] + t * dy <= y1 + 1e-9])
            if len(ins) >= 2: ax.add_patch(FancyArrowPatch(ins[0], ins[-1], arrowstyle="<|-|>", color="black", lw=1.4, mutation_scale=7))
        c = g.get("curve", [])
        if len(c) > 1:
            xs, ys = [], []
            for k in range(len(c) - 1):
                p0, p1, p2, p3 = c[max(k - 1, 0)], c[k], c[k + 1], c[min(k + 2, len(c) - 1)]
                for t in [i / 20 for i in range(21)]:
                    t2, t3 = t * t, t * t * t
                    xs.append(0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3))
                    ys.append(0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3))
            ax.plot(xs, ys, color="black", lw=1.4)
        for px, py in g.get("pts", []): ax.plot(px, py, "o", color="black", ms=3.4, zorder=5)
        for px, py in g.get("open", []): ax.plot(px, py, "o", mfc="white", mec="black", mew=1, ms=3.6, zorder=5)
        width = min(2.6, w)
    elif kind == "table":
        cols, rows = g.get("cols", ["x", "y"]), g.get("rows", [])
        cells = [[_num(h)] + [_num(r[j]) for r in rows] for j, h in enumerate(cols)] if g.get("across") else [[_num(v) for v in r] for r in rows]
        ncol = len(cells[0]) if g.get("across") else len(cols); nrow = len(cells) + (0 if g.get("across") else 1)
        fig, ax = plt.subplots(figsize=(0.55 * ncol, 0.24 * nrow)); ax.axis("off")
        t = ax.table(cellText=cells if g.get("across") else cells, colLabels=None if g.get("across") else [_num(h) for h in cols], cellLoc="center", loc="center", bbox=[0, 0, 1, 1])
        t.auto_set_font_size(False); t.set_fontsize(8.5)
        for (r, cidx), cell in t.get_celld().items():
            cell.set_linewidth(0.8)
            if (not g.get("across") and r == 0) or (g.get("across") and cidx == 0): cell.set_facecolor("#e6ebf3"); cell.get_text().set_fontweight("bold")
        width = 0.55 * ncol
    else:
        L, R, arrows = g.get("left", []), g.get("right", []), g.get("arrows", [])
        n = max(len(L), len(R), 1); eh = n * 0.42 + 0.35; cy = eh / 2; top = eh + (0.45 if g.get("lt") or g.get("rt") else 0.1)
        fig, ax = plt.subplots(figsize=(2.0, (top + 0.1) * 0.5)); ax.set_xlim(0, 4); ax.set_ylim(-0.1, top); ax.axis("off")
        for cx in (0.8, 3.2): ax.add_patch(Ellipse((cx, cy), 1.0, eh, fill=False, lw=1))
        yof = lambda lst, k: cy + ((len(lst) - 1) * 0.42) / 2 - k * 0.42
        if g.get("lt"): ax.text(0.8, eh + 0.12, g["lt"], ha="center", va="bottom", fontsize=7.5, fontweight="bold")
        if g.get("rt"): ax.text(3.2, eh + 0.12, g["rt"], ha="center", va="bottom", fontsize=7.5, fontweight="bold")
        for k, v in enumerate(L): ax.text(0.8, yof(L, k), _num(v), ha="center", va="center", fontsize=8.5)
        for k, v in enumerate(R): ax.text(3.2, yof(R, k), _num(v), ha="center", va="center", fontsize=8.5)
        for a, b in arrows:
            i = next((k for k, v in enumerate(L) if str(v) == str(a)), None); j = next((k for k, v in enumerate(R) if str(v) == str(b)), None)
            if i is None or j is None: continue
            ax.add_patch(FancyArrowPatch((1.1, yof(L, i)), (2.85, yof(R, j)), arrowstyle="-|>", color="black", lw=0.8, mutation_scale=7))
        width = 2.0
    fig.savefig(path, dpi=300, bbox_inches="tight", pad_inches=0.03, transparent=False, facecolor="white")
    plt.close(fig)
    return path, width
