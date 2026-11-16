#!/usr/bin/env python3
"""Build everything that comes from one week file.

    python3 build_week.py WEEKFILE.json --out OUTDIR [--site REPO_ROOT] [--no-pdf]

Writes, per class: the bellringer sheet (.docx + .pdf), its teacher key, the parent
message (.txt) and the slide text (.md). With --site it also writes data/<id>.js for
the board site. It stops before building anything if the week file has an error.
"""
import argparse, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import docs, outputs, weekfile  # noqa: E402

NAMES = {"7th": "7th Grade", "8th": "8th Grade", "8th-acc": "8th Grade Accelerated"}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("weekfile"); ap.add_argument("--out", required=True)
    ap.add_argument("--site"); ap.add_argument("--no-pdf", action="store_true"); a = ap.parse_args()
    week = weekfile.load(a.weekfile)
    err, warn = weekfile.validate(week)
    for w in warn: print("WARNING:", w)
    if err:
        for e in err: print("ERROR:", e)
        print("\nStopped: fix the %d error(s) in the week file first. Nothing was built." % len(err)); sys.exit(1)
    os.makedirs(a.out, exist_ok=True); made = []
    for cid, c in week["classes"].items():
        tag = NAMES.get(cid, c["label"])
        if any(d.get("problems") for d in c["days"]):
            s = os.path.join(a.out, "0 Weekly - Bellringer (Mon-Fri) (%s).docx" % tag)
            k = os.path.join(a.out, "0 Weekly - TEACHER KEY - Bellringer (%s).docx" % tag)
            docs.bellringer(week, cid, s); docs.bellringer_key(week, cid, k); made += [s, k]
        for name, text in (("Parent Message (%s).txt" % tag, outputs.parent_message(week, cid)), ("Slide Text (%s).md" % tag, outputs.slide_text(week, cid))):
            p = os.path.join(a.out, name); open(p, "w", encoding="utf-8").write(text + "\n"); made.append(p)
    if not a.no_pdf:
        docx = [m for m in made if m.endswith(".docx")]
        if docx: subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", a.out] + docx, check=True, capture_output=True)
    if a.site:
        p = os.path.join(a.site, "data", week["id"] + ".js"); open(p, "w", encoding="utf-8").write(outputs.board_js(week)); made.append(p)
        print("Board site: wrote %s. Add it to data/weeks.js and raise the ?v= numbers." % p)
    n = sum(len(d.get("problems") or []) for c in week["classes"].values() for d in c["days"])
    print("Built %d files from %s (%d bellringer problems, %d warnings)." % (len(made), os.path.basename(a.weekfile), n, len(warn)))


if __name__ == "__main__":
    main()
