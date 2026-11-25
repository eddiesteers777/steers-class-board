"""High school courses for data/standards.js, from tools/standards/highschool/<key>.json.

Each file is the standards export Eddie supplied (Nov 25, 2026): 2019 Alabama Course of Study wording, domains,
clusters and part letters. No district units or DIGS critical marks exist for these courses, so units is empty
and critical is false for all. Used by build.py (full rebuild) and add_highschool.py (adds these courses to the
current data/standards.js without the Drive docs)."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
COURSES = [("geo", "Geometry", "Geometry with Data Analysis"), ("alg2", "Algebra II", "Algebra II with Statistics"),
           ("precalc", "Precalculus", "Precalculus"), ("mm", "Math Modeling", "Mathematical Modeling"),
           ("afm", "Finite Math", "Applications of Finite Mathematics")]


def highschool():
    out = {}
    for key, label, course in COURSES:
        src = json.load(open(os.path.join(HERE, "highschool", key + ".json"), encoding="utf-8"))
        stds = []
        for s in src["standards"]:
            stds.append({"n": int(s["code"].split(".")[1]), "code": s["code"], "domain": s["domain"], "cluster": s["cluster"],
                         "text": s["text"], "critical": False, "parts": s["parts"], "objectives": s.get("objectives", []),
                         "prior": s.get("prior", [])})
        out[key] = {"label": label, "course": course, "standards": stds, "units": [], "unitWord": "Topic"}
    return out
