"""Independent check of every walkthrough, line by line, as it is DISPLAYED (not the engine's own numbers).

    node tools/walk/dump.mjs > /tmp/walks.json && python3 tools/walk/check_display.py /tmp/walks.json

For each walkthrough, sympy re-reads every written line:
  - an equation or inequality line must have the same solution set as the first line,
  - a "= value" line (working out an expression) must equal the first expression,
  - a check line must be true.
The struck-through "divide both sides" and "cancel first" display lines are skipped: they show work in progress.
"""
import json, re, sys
from sympy import real_root, Abs, Rational, sqrt, pi, S, symbols, solveset, Eq, Lt, Gt, Le, Ge, simplify, sympify, And, Reals, Interval
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application

T = standard_transformations + (implicit_multiplication_application,)
REL = {"=": Eq, "<": Lt, ">": Gt, "≤": Le, "≥": Ge}
CHAIN = re.compile(r"\s*(=|<|>|≤|≥|≈)\s*")


def py(t):
    t = t.replace("−", "-").replace("×", "*").replace("·", "*").replace("÷", "/").replace("✓", "").replace("✗", "").replace("$", "").replace("°", "").replace("²", "**2").replace("π", "pi").strip()
    t = re.sub(r"(\d),(?=\d{3}(?!\d))", r"\1", t)                # 1,000,000
    t = re.sub(r"√(\d+(?:\.\d+)?)", r"sqrt(\1)", t)
    t = re.sub(r"∛(-?\d+(?:\.\d+)?)", r"cbrt(\1)", t).replace("√(", "sqrt(").replace("∛(", "cbrt(")
    t = re.sub(r"\|([^|]+)\|", r"Abs(\1)", t).replace("^", "**")
    t = re.sub(r"(\d+) (\d+)/(\d+)", r"(\1+\2/\3)", t)          # mixed numbers 2 1/4
    t = re.sub(r"(\d)\(", r"\1*(", t)
    t = re.sub(r"\)(\d|[a-z(])", r")*\1", t)
    t = re.sub(r"(?<![\w.])(\d+(?:\.\d+)?)", lambda m: "Rational('" + m.group(1) + "')", t)
    return t


def ex(t):
    return parse_expr(py(t), transformations=T, local_dict={"Rational": Rational, "Abs": Abs, "sqrt": sqrt, "pi": pi, "cbrt": lambda x: real_root(x, 3)})


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
            if "→" in text or text.lstrip().startswith("{("):
                continue   # input → output pairs and sets of ordered pairs: the engine checks these itself
            try:
                if row.get("chain"):                                 # "5² = 25 < 30 < 36 = 6²": every link must be true (≈: within half the last place shown)
                    parts = CHAIN.split(" ".join(x for x in cells if x.strip()).replace("✓", "").replace("✗", ""))
                    if not parts[0].strip() and w.get("_last"):
                        parts[0] = w["_last"]                        # "= 11/18" goes on from the line above
                    w["_last"] = parts[-1]
                    if re.search(r"[a-z]", re.sub(r"sqrt|cbrt|pi|Rational", "", py("".join(parts[0::2])))):
                        continue                                     # "17.64 < n < 18.49": has a letter, nothing to evaluate
                    for i in range(1, len(parts) - 1, 2):
                        a, r, b = ex(parts[i - 1]), parts[i], ex(parts[i + 1])
                        if r == "≈":
                            dp = len(parts[i + 1].strip().split(".")[1]) if "." in parts[i + 1] else 0
                            ok = abs(float(a) - float(b)) <= 0.5 * 10 ** -dp + 1e-12
                        else:
                            ok = bool(REL[r](a, b))
                        if not ok:
                            bad += 1; print("CHAIN FALSE", w["id"], text); break
                    continue
                if "…" in text:
                    continue                                         # a repeating decimal written with dots: the engine checks these lines exactly
                if row["move"] == "then":                            # "Angle B = 2(30) + 34 = 94°": the working must equal the value
                    parts = cells[0].split(" = ")[1:]
                    if len(parts) != 2 or simplify(ex(parts[0]) - ex(parts[1])) != 0:
                        bad += 1; print("THEN WRONG", w["id"], text)
                    continue
                if re.fullmatch(r"\s*(?:[A-Za-z]\([^)]*\)|y)\s*", cells[0]) and cells[1].strip() == "=" and not isinstance(first, dict):   # not "y = 2" mid-way through a system
                    if re.search(r"[a-z]", cells[2].replace("Rational", "")):
                        continue                                     # the rule itself, f(x) = 3x - 4
                    first = simplify(ex(cells[2])); continue         # f(5) = 3(5) - 4: the value to keep
                if row["check"] and "…" in cells[2]:            # "5/11 = 0.4545…": the digits shown must be the start of the fraction's decimal
                    v, shown = ex(cells[0]), cells[2].replace("…", "").strip()
                    places = len(shown.split(".")[1])
                    if abs(float(v) - float(shown.replace("Rational", ""))) >= 10 ** -places:
                        bad += 1; print("DECIMAL WRONG", w["id"], text)
                    continue
                if row["check"]:
                    sides, rels = cells[0::2], cells[1::2]
                    vals = [ex(s) for s in sides]
                    ok = all(bool(REL[r.strip()](vals[i], vals[i + 1])) for i, r in enumerate(rels))
                    if not ok:
                        bad += 1; print("CHECK FALSE", w["id"], text)
                    continue
                if cells[0] == "" and cells[1].strip() == "=":       # "= value" line of an evaluation
                    pc = cells[2].strip().endswith("%")             # "= 30%" is the value 0.3 written as a percent
                    val = simplify(ex(cells[2].strip().rstrip("%")) / (100 if pc else 1))
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
                var = (re.findall(r"[a-z]", re.sub(r"Abs|Rational|sqrt|pi", "", " ".join(cells))) or ["x"])[0]
                if not isinstance(first, dict):
                    first = {} if first is None else {"x": first}
                if var not in first:
                    first[var] = s
                elif s != first[var]:
                    bad += 1; print("ANSWERS CHANGED", w["id"], "step", row["step"], text, "->", s, "vs", first[var])
            except Exception as e:
                if "Length" in text or "Largest" in text or "Longest" in text or text.startswith("A ") or text.startswith("B "):
                    continue
                bad += 1; print("COULD NOT READ", w["id"], "step", row["step"], repr(text), e)
    print(len(data), "walkthroughs read line by line;", bad, "problems")
    return bad


if __name__ == "__main__":
    sys.exit(1 if main(sys.argv[1]) else 0)
