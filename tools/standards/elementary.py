"""Grades 2-6 for data/standards.js, from tools/standards/elementary/grade<N>.json.

Each file is the standards export Eddie supplied (Nov 24, 2026): 2019 Alabama Course of Study wording, domains,
clusters and part letters. No district units or DIGS critical marks exist for these grades, so units is empty
and critical is false for all. Used by build.py (full rebuild) and add_elementary.py (adds these grades to the
current data/standards.js without the Drive docs)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
GRADES = [("g2", "2nd Grade", "Grade 2", 2), ("g3", "3rd Grade", "Grade 3", 3), ("g4", "4th Grade", "Grade 4", 4),
          ("g5", "5th Grade", "Grade 5", 5), ("g6", "6th Grade", "Grade 6", 6)]


def elementary():
    out = {}
    for key, label, course, n in GRADES:
        src = json.load(open(os.path.join(HERE, "elementary", "grade%d.json" % n), encoding="utf-8"))
        stds = []
        for s in src["standards"]:
            stds.append({"n": int(s["code"].split(".")[1]), "code": s["code"], "domain": s["domain"], "cluster": s["cluster"],
                         "text": s["text"], "critical": False, "parts": s["parts"], "objectives": s.get("objectives", []),
                         "prior": s.get("prior", [])})
        out[key] = {"label": label, "course": course, "standards": stds, "units": [], "unitWord": "Topic"}
    return out
