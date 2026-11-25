"""Add (or refresh) the high school courses in data/standards.js without rebuilding the 7th/8th classes.

    python3 tools/standards/add_highschool.py

build.py needs the Drive docs in tools/standards/docs/; this needs only tools/standards/highschool/.
Every other class (7th, 8th, 8th-acc, g2..g6) is kept exactly as it is."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from highschool import highschool  # noqa: E402

path = os.path.join(ROOT, "data/standards.js")
text = open(path, encoding="utf-8").read()
cut = text.index("export const STANDARDS = ")
js = "import('" + path.replace("\\", "/") + "').then(m=>console.log(JSON.stringify(m.STANDARDS)))"
data = json.loads(subprocess.check_output(["node", "-e", js]))
data.update(highschool())
open(path, "w", encoding="utf-8").write(text[:cut] + "export const STANDARDS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
for k, v in data.items():
    print(k, len(v["standards"]), "standards")
