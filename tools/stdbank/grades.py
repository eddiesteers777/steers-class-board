"""Grades 2-6: problems for every Alabama standard in 2nd through 6th grade, 9 per standard (3 on-ramp, 3 on level,
3 stretch), each with 3 Vault Raid steps. Written by Gemini (Nov 24, 2026) and checked by Claude before import:
every problem solved again, codes and parts checked against tools/standards/elementary/, duplicates reworked,
steps rewritten where they gave the answer away, board markup ({3/4}, §, −, ×) throughout.

tools/stdbank/g<N>.json holds the problems in bank order; "src" is Gemini's id, kept only here for tracing.
Change a problem there and build again (python3 tools/stdbank/build.py)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
FIELDS = ("std", "part", "q", "a", "lvl", "choices", "also")


def load(mod):
    """(problems, steps by bank id) for g2..g6. Ids are numbered exactly as build.py numbers them."""
    rows = json.load(open(os.path.join(HERE, mod + ".json"), encoding="utf-8"))
    out, steps, count = [], {}, {}
    for r in rows:
        x = {k: r[k] for k in FIELDS if r.get(k) not in (None, "", [])}
        count[x["std"]] = count.get(x["std"], 0) + 1
        steps["%s-%02d" % (x["std"].replace(" ", ""), count[x["std"]])] = r["steps"]
        out.append(x)
    return out, steps
