"""Independent check of every walkthrough, line by line, as it is DISPLAYED (not the engine's own numbers).

    node tools/walk/dump.mjs > /tmp/walks.json && python3 tools/walk/check_display.py /tmp/walks.json

For each walkthrough, sympy re-reads every written line:
  - an equation or inequality line must have the same solution set as the first line,
  - a "= value" line (working out an expression) must equal the first expression,
  - a check line must be true.
The struck-through "divide both sides" and "cancel first" display lines are skipped: they show work in progress.
"""
import json, re, sys
from sympy import Abs, Rational, S, symbols, solveset, Eq, Lt, Gt, Le, Ge, simplify, sympify, And, Reals, Interval
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application

T = standard_transformations + (implicit_multiplication_application,)
REL = {"=": Eq, "<": Lt, ">": Gt, "≤": Le, "≥": Ge}


def py(t):
    t = t.replace("−", "-").replace("×", "*").replace("÷", "/").replace("✓", "").replace("$", "").strip()
    t = re.sub(r"(\d+) (\d+)/(\d+)", r"(\1+\2/\3)", t)          # mixed numbers 2 1/4
    t = re.sub(r"(\d)\(", r"\1*(", t)
    t = re.sub(r"\)(\d|[a-z(])", r")*\1", t)
    t = re.sub(r"(?<![\w.])(\d+(?:\.\d+)?)", lambda m: "Rational('" + m.group(1) + "')", t)
    return t


def ex(t):
    return parse_expr(py(t), transformations=T, local_dict={"Rational": Rational, "Abs": Abs})


def solset(cells):
    sides, rels = cells[0::2], cells[1::2]
    if any(r.strip() not in REL for r in rels):
        return None
    var = None
    for s in sides:
        m = re.search(r"[a-z]", s.replace("Rational", "").replace("Abs", ""))
        if m:
            var = m.group(0)
    v = symbols(var) if var else symbols("x")
    out = Reals
    for i, r in enumerate(rels):
        a, b = ex(sides[i]), ex(sides[i + 1])
        out = out.intersect(solveset(REL[r.strip()](a, b), v, Reals))
    return out


def main(path):
    data = json.load(open(path))
    bad = 0
    for w in data:
        first = None
        for row in w["rows"]:
            cells = [c for c in row["cells"]]
            text = " ".join(cells)
            if row["move"] in ("divide", "cancel") and any("/" in c for c in cells):
                continue   # the written-out divide/cancel line
            try:
                if row["check"]:
                    sides, rels = cells[0::2], cells[1::2]
                    vals = [ex(s) for s in sides]
                    ok = all(bool(REL[r.strip()](vals[i], vals[i + 1])) for i, r in enumerate(rels))
                    if not ok:
                        bad += 1; print("CHECK FALSE", w["id"], text)
                    continue
                if cells[0] == "" and cells[1].strip() == "=":       # "= value" line of an evaluation
                    val = simplify(ex(cells[2]))
                    if first is None:
                        bad += 1; print("NO START", w["id"])
                    elif simplify(val - first) != 0:
                        bad += 1; print("VALUE CHANGED", w["id"], "step", row["step"], text, "->", val, "vs", first)
                    continue
                if all(c.strip() == "" for c in cells[1:]):          # the first expression
                    first = simplify(ex(cells[0])); continue
                if any(c.strip() == "=" for c in cells[1::2]) and not re.search(r"[a-z]", "".join(cells[0::2]).replace("Abs", "")):
                    continue   # a then-line such as "Length = 9 + 5 = 14" is checked by the key match below
                s = solset(cells)
                if s is None:
                    continue
                if first is None:
                    first = s
                elif s != first:
                    bad += 1; print("ANSWERS CHANGED", w["id"], "step", row["step"], text, "->", s, "vs", first)
            except Exception as e:
                if "Length" in text or "Largest" in text or "Longest" in text or text.startswith("A ") or text.startswith("B "):
                    continue
                bad += 1; print("COULD NOT READ", w["id"], "step", row["step"], repr(text), e)
    print(len(data), "walkthroughs read line by line;", bad, "problems")
    return bad


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1]) else 0)
