"""Build data/standards.js from Eddie's Drive docs (saved by extract.py into docs/).
Standard wording, sub-parts, critical marks, objectives and prior skills come from the DIGS docs.
Units, pacing, learning targets and ACAP item specs come from the unit/topic docs.
Links, Schoology codes, tier notes and teacher notes are dropped on purpose (the repo is public).
8th Accelerated Units 4 (Pythagorean Theorem) and 10 (Volume) are not in the Drive Acc standards folder; their
docs are in the Weekly Math Planning project ("8th Acc Unit 04 - Pythagorean Theorem", "8th Acc Unit 10 - Volume").
Save them into docs/ as "8th Acc Unit 4 - Pythagorean Theorem.docx.md" and "8th Acc Unit 10 - Volume.docx.md"
with one "| Standard #: ... Learning Targets: ... Item Specs: ... |" row per standard before rebuilding."""
import json, os, re, sys, glob
HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.join(HERE, "docs")
OUT = sys.argv[1]

def clean(s):
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)      # [text](url) -> text
    s = re.sub(r"<https?://[^>]*>", "", s)
    s = s.replace("\\*", "*").replace("\\>", ">").replace("\\<", "<").replace("\\#", "#").replace("\\&", "&").replace("\\[", "[").replace("\\]", "]").replace("\\!", "!").replace("\\-", "-")
    s = s.replace("**", "")
    # The Docs export drops superscripts; put back the few the standards use.
    s = re.sub(r"\bi such that i =", "i such that i² =", s)
    s = re.sub(r"(\b[xy]|\))2(?=[\s.,)=+\-]|$)", r"\1²", s)
    s = re.sub(r"\(X0 = 1\)", "(X⁰ = 1)", s)
    return re.sub(r"[ \t]+", " ", s).strip()

LETTERS = "abcdefghij"

def parse_digs(path, grade):
    lines = open(path).read().split("\n")
    out, domain, cluster, cur, sect = [], "", "", None, None
    for raw in lines:
        ln = raw.strip()
        if not ln: continue
        if ln.startswith("## "): domain = clean(ln[3:]); continue
        if ln.startswith("#### "): cluster = clean(ln[5:]); continue
        m = re.match(r"^(\d+)\\?\.\s*(.*)$", ln)
        if m:
            text = clean(m.group(2)); crit = text.startswith("*")
            cur = {"n": int(m.group(1)), "code": f"{grade}.{m.group(1)}", "domain": domain, "cluster": cluster,
                   "text": text.lstrip("*").strip(), "critical": crit, "parts": [], "objectives": [], "prior": []}
            out.append(cur); sect = None; continue
        if cur is None: continue
        m = re.match(r"^([a-j])\.\s+(.*)$", ln)
        if m and sect is None:
            cur["parts"].append(clean(m.group(2))); continue
        if ln.startswith("**Learning Objectives"): sect = "objectives"; continue
        if ln.startswith("**Prior Knowledge"): sect = "prior"; continue
        m = re.match(r"^-\s+(.*)$", ln)
        if m and sect:
            t = clean(m.group(1))
            if sect == "objectives":
                mm = re.match(r"^(M\s?\.?[\d.]+):?\s*(?:\d+:\s*)?(.*)$", t)
                t = mm.group(2).strip() if mm else t
            cur[sect].append(t)
    for s in out:   # the docs repeat some letters (b, b); the Course of Study runs them in order
        s["parts"] = [{"l": LETTERS[i], "text": t} for i, t in enumerate(s["parts"])]
    return out

def norm(s): return re.sub(r"[^a-z0-9]", "", s.lower().replace("²", "2").replace("⁰", "0"))

def split_targets(s):
    s = re.sub(r"^I can…|^I can\.\.\.", "", s.strip())
    parts = re.split(r"(?<=[.)])(?=[A-Z])|(?<=[a-z])(?=[A-Z][a-z])", s)
    return [p.strip(" .") for p in parts if p.strip(" .")]

def parse_unit(path, grade, stds):
    txt = open(path).read()
    first = txt.split("\n", 1)[0]
    rows = [r for r in txt.split("\n") if r.startswith("| Standard") or r.startswith("| Accelerated Standard")]
    name = pacing = None
    m = re.search(r"\| TOPIC \\#(\w+)\s*:\s*([^|]+)\|\s*Pacing:\s*([^|]*)\|", txt)
    if m: num, name, pacing = m.group(1), m.group(2).strip(), m.group(3).strip()
    else:
        mm = re.match(r"^(?:TOPIC # ?|Unit )(\w+):?\s+(.*?)(?:\s+8th Grade.*)?$", clean(first))
        num, name = mm.group(1), mm.group(2).strip()
    t8 = re.search(r"8th Grade Topic \w+ - (.*?)(?: \(\d\))*\.docx", os.path.basename(path))
    if t8: name = t8.group(1).replace("_", "/")
    first_c = clean(first)
    mm = re.match(r"^(?:TOPIC # ?|Unit )(\w+)", first_c)
    if mm: num = mm.group(1)
    items = {}
    for r in rows:
        r = clean(r.strip("| ").rstrip("|"))
        if r.startswith("Accelerated Standard"): continue      # 7th Accelerated rows are not Eddie's 7th class
        m = re.match(r"^Standard #?:?\s*\[?(?:" + grade + r"\.)?(\d+)", r)
        if not m: continue
        n = int(m.group(1)); s = next((x for x in stds if x["n"] == n), None)
        if not s: continue
        body = norm(r)
        letters = [p["l"] for p in s["parts"] if norm(p["text"])[:40] in body]
        mt = re.search(r"Learning Targets:\s*(.*?)\s*Item Specs:", r)
        targets = split_targets(mt.group(1)) if mt else []
        ms = re.search(r"Item Specs:\s*(ACAP[^|]*?)(?:\s*Assign|$)", r)
        spec = ms.group(1).strip() if ms else ""
        it = items.setdefault(s["code"], {"code": s["code"], "parts": [], "targets": [], "specs": []})
        for l in letters:
            if l not in it["parts"]: it["parts"].append(l)
        for t in targets:
            if t not in it["targets"]: it["targets"].append(t)
        if spec and spec not in it["specs"]: it["specs"].append(spec)
    return {"id": num, "name": name, "pacing": pacing or "", "standards": list(items.values())}

def unit_sort(u):
    m = re.match(r"(\d+)([A-Z]?)", u["id"]); return (int(m.group(1)), m.group(2)) if m else (99, "")

g7 = parse_digs(os.path.join(D, "Grade 7.md"), "7")
g8 = parse_digs(os.path.join(D, "Grade 8.md"), "8")
u7 = sorted([parse_unit(p, "7", g7) for p in glob.glob(os.path.join(D, "7th Grade - Topic*.md"))], key=unit_sort)
u8 = sorted([parse_unit(p, "8", g8) for p in glob.glob(os.path.join(D, "8th Grade Topic*.md"))], key=unit_sort)

def parse_acc(path, pool):
    """8th Accelerated unit docs number standards their own way (8ACC.13, 8.Acc.6, 7ACC.25, Alg I.3…).
    Match each row to the Grade 8 or Algebra I standard by its wording instead of trusting the number."""
    txt = open(path).read()
    mm = re.search(r"8th Acc Unit (\w+) - (.*?)(?: \(\d\))*\.docx", os.path.basename(path))
    num, name = mm.group(1), mm.group(2).replace("_", "/")
    rows = []
    for r in txt.split("\n"):
        if not r.startswith("|"): continue
        cells = [clean(c) for c in r.strip().strip("|").split("|")]
        first = cells[0]
        if first.startswith("Standards"): continue
        if first.startswith("Standard"): rows.append((first, None))
        elif re.match(r"^\d+\\?\.\s", r.strip("| ")) and len(cells) > 1: rows.append((first, cells[1]))   # Unit 3 table rows
    items, extra = {}, []
    for body, tcol in rows:
        nb = norm(body)
        best = None
        for s in pool:
            stem = norm(s["text"])[:45]
            letters = [p["l"] for p in s["parts"] if norm(p["text"])[:40] in nb]
            if stem and stem in nb or letters:
                score = (bool(stem in nb)) * 2 + len(letters)
                if not best or score > best[0]: best = (score, s, letters)
        if tcol is not None: targets = split_targets(re.sub(r"^I CAN:\s*", "", tcol))
        else:
            mt = re.search(r"Learning Targets?:\s*(.*?)(?:\s*Item Specs:|$)", body)
            targets = split_targets(mt.group(1)) if mt else []
        targets = [t for t in targets if not t.startswith("[Grade") and "Haven’t checked" not in t]
        ms = re.search(r"Item Specs:\s*(ACAP[^|]*?)(?:\s*Assign|\s*Haven|$)", body)
        spec = ms.group(1).strip() if ms else ""
        if not best:
            mc = re.match(r"^Standard\s*#?:?\s*([0-9A-Za-z. ]+?)\.?\s+([A-Z].*?)\s*(?:Learning Targets?:|$)", body)
            extra.append({"label": mc.group(1).strip() if mc else "", "text": mc.group(2).strip() if mc else body[:200], "targets": targets}); continue
        s, letters = best[1], best[2]
        it = items.setdefault(s["code"], {"code": s["code"], "parts": [], "targets": [], "specs": []})
        for l in letters:
            if l not in it["parts"]: it["parts"].append(l)
        for t in targets:
            if t not in it["targets"]: it["targets"].append(t)
        if spec and spec not in it["specs"]: it["specs"].append(spec)
    out = {"id": num, "name": name, "pacing": "", "standards": list(items.values())}
    if extra: out["extra"] = extra     # rows whose wording matches no Grade 8 or Algebra I standard; shown as written
    return out

a1 = parse_digs(os.path.join(D, "Algebra I.md"), "AI")
for x in a1: x["code"] = "Alg I." + str(x["n"]); x["domain"] = "Algebra I with Probability: " + x["domain"]
uacc = sorted([parse_acc(p, g8 + a1) for p in glob.glob(os.path.join(D, "8th Acc Unit*.md"))], key=unit_sort)
used = {x["code"] for u in uacc for x in u["standards"]}

data = {
    "7th": {"label": "7th Grade", "course": "Grade 7", "standards": g7, "units": u7, "unitWord": "Topic"},
    "8th": {"label": "8th Grade", "course": "Grade 8", "standards": g8, "units": u8, "unitWord": "Topic"},
    "8th-acc": {"label": "8th Accelerated", "course": "Grade 8 Accelerated", "standards": g8 + a1, "units": uacc, "unitWord": "Unit"},
}
head = """// Alabama Course of Study math standards for each class, grouped by the district's units.
// GENERATED from Eddie's Drive docs (Critical Standards "DIGS" docs and the unit/topic docs). Do not hand-edit;
// rebuild instead. Standard wording is copied as written. A * in the DIGS docs marks a critical standard.
// Links, Schoology codes and district teacher notes are left out on purpose: this repo is public.
"""
open(OUT, "w").write(head + "export const STANDARDS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
for k, v in data.items():
    print(k, len(v["standards"]), "standards,", sum(s["critical"] for s in v["standards"]), "critical,", len(v["units"]), "units")
    for u in v["units"]:
        if u.get("extra"): print("      EXTRA:", u["extra"])
        print("   ", u["id"], u["name"], "|", u["pacing"], "|", ", ".join(s["code"] + "".join(s["parts"]) + f"({len(s['targets'])}t)" for s in u["standards"]))
