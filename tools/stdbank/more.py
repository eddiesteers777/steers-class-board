"""More standards-bank problems, added after the first 810.

more_2026_11.json holds 845 problems first drafted in Gemini (Nov 2026), then checked by hand one by one: every answer
re-solved, every code matched to data/standards.js, every key found in its choices, no repeats of the live bank, and
the text rewritten in the board's notation (− for minus, {a/b} fractions, ² ³ and ^{...} powers, § for a dollar sign).
They are added at the END of each course's list, so the ids of the first 810 (and their Vault Raid steps) don't move.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def more(course):
    with open(os.path.join(HERE, "more_2026_11.json"), encoding="utf-8") as f:
        return json.load(f).get(course, [])
