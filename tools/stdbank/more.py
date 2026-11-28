"""More standards-bank problems, added after the first 810.

more_2026_11.json holds 845 problems first drafted in Gemini (Nov 2026), then checked by hand one by one: every answer
re-solved, every code matched to data/standards.js, every key found in its choices, no repeats of the live bank, and
the text rewritten in the board's notation (− for minus, {a/b} fractions, ² ³ and ^{...} powers, § for a dollar sign).
They are added at the END of each course's list, so the ids of the first 810 (and their Vault Raid steps) don't move.

more_2026_11_set2.json (Nov 26, 2026) is Set 2: 9 more Gemini problems per standard (837 for 7th, 8th and Algebra I),
checked the same way, added after Set 1 so no earlier id moves. "src" is Gemini's id, kept only in the JSON for tracing
(and for matching Vault Raid steps when they are written); it is not copied into the bank.

more_2026_11_set3.json (Nov 27, 2026) is Set 3: 9 more Gemini problems per standard (837 for 7th, 8th and Algebra I),
checked the same way and added after Set 2, so no earlier id moves. 6th Set 3 is appended to g6.json.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def more(course):
    out = []
    for name in ("more_2026_11.json", "more_2026_11_set2.json", "more_2026_11_set3.json"):
        with open(os.path.join(HERE, name), encoding="utf-8") as f:
            out += [{k: v for k, v in x.items() if k != "src"} for x in json.load(f).get(course, [])]
    return out
