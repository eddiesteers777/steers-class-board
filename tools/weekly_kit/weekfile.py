"""The week file: one JSON file that holds a whole week for every class.

Everything else (bellringer sheet, key, board site data, parent messages,
slide text) is generated from it, so the same fact is never typed twice.

Math markup used in any text field:
    {2/5}        stacked fraction          4{2/3}   mixed number
    {{1/2}/{1/4}} complex fraction         §        a dollar sign
Optional: wrap a whole expression in $...$ to set all of it as an equation in Word.
"""
import json, math, re
from datetime import date, timedelta
from fractions import Fraction

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ---------- markup ----------
def _match(s, i):
    d = 0
    for j in range(i, len(s)):
        if s[j] == "{": d += 1
        elif s[j] == "}":
            d -= 1
            if d == 0: return j
    raise ValueError("unbalanced braces: " + s)


def _bar(s):
    """{a/b} -> {a|b} at every nesting level (the Word builder's fraction syntax)."""
    out, i = "", 0
    while i < len(s):
        if s[i] == "{" and i and s[i - 1] == "^":       # an exponent: [base]^{exp}
            j = _match(s, i); out += "{" + _bar(s[i + 1:j]) + "}"; i = j + 1
        elif s[i] == "{":
            j = _match(s, i); inner = s[i + 1:j]; d = 0; cut = -1
            for k, ch in enumerate(inner):
                if ch == "{": d += 1
                elif ch == "}": d -= 1
                elif ch == "/" and d == 0: cut = k; break
            if cut < 0: raise ValueError("fraction needs a slash: " + s)
            out += "{" + _bar(inner[:cut]) + "|" + _bar(inner[cut + 1:]) + "}"; i = j + 1
        else:
            out += s[i]; i += 1
    return out


def to_word(s):
    """Week-file text -> mathdoc markup ($...$ equations with {a|b} fractions)."""
    s = str(s)
    if "^{" in s and "$" not in s: raise ValueError("wrap an exponent expression in $...$: " + s)
    if "$" in s:
        return re.sub(r"\$([^$]*)\$", lambda m: "$" + _bar(m.group(1)) + "$", s)
    out, i = "", 0
    while i < len(s):
        if s[i] == "{":
            j = _match(s, i)
            # pull a leading sign / whole number into the equation so "−1{1/2}" stays together
            m = re.search(r"[−-]?\d*$", out); lead = m.group(0) if m else ""
            if lead: out = out[:len(out) - len(lead)]
            out += "$" + lead + _bar(s[i:j + 1]) + "$"; i = j + 1
        else:
            out += s[i]; i += 1
    return out.replace("$$", "")


_SUP = str.maketrans("0123456789-−+n", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁻⁺ⁿ")


def _powers(s):
    """[base]^{exp} -> base with a raised exponent, for places that cannot draw one."""
    return re.sub(r"\[([^\[\]]*)\]\^\{([^{}]*)\}", lambda m: m.group(1) + m.group(2).translate(_SUP), s)


def to_plain(s):
    """Week-file text -> plain text for messages and slides: {2/5} -> 2/5."""
    s = _powers(str(s)).replace("$", "")
    def frac(t):
        out, i = "", 0
        while i < len(t):
            if t[i] == "{":
                j = _match(t, i); inner = t[i + 1:j]; d = 0; cut = -1
                for k, ch in enumerate(inner):
                    if ch == "{": d += 1
                    elif ch == "}": d -= 1
                    elif ch == "/" and d == 0: cut = k; break
                if cut < 0: raise ValueError("fraction needs a slash: " + t)
                n, m = frac(inner[:cut]).strip(), frac(inner[cut + 1:]).strip()
                wrap = lambda x: "(" + x + ")" if "/" in x else x
                out += (" " if out[-1:].isdigit() else "") + wrap(n) + "/" + wrap(m); i = j + 1
            else:
                out += t[i]; i += 1
        return out
    s = frac(s)
    return s.replace("§", "$")


def to_board(s):
    """Week-file text -> board site text (keeps {a/b}; drops $ wrappers)."""
    return _powers(str(s)).replace("$", "").replace("§", "$")


# ---------- checks ----------
_SAFE = {"F": Fraction, "Fraction": Fraction, "sqrt": math.sqrt, "abs": abs, "round": round, "math": math}


def check_problem(p):
    """A problem's "check" is a Python expression that must be True, e.g.
    "F(-2,5)+F(3,10)==F(-1,10)". Returns (ok, message)."""
    c = p.get("check")
    if not c: return None, "no check written"
    try:
        ok = eval(c, {"__builtins__": {}}, dict(_SAFE))
    except Exception as e:  # noqa: BLE001
        return False, "check could not run: %s" % e
    return (ok is True), ("ok" if ok is True else "check is FALSE: " + c)


def validate(week):
    """Returns (errors, warnings). Errors must be fixed before anything is built."""
    err, warn = [], []
    for k in ("id", "label", "dates", "monday", "classes"):
        if not week.get(k): err.append("week is missing '%s'" % k)
    try:
        mon = date.fromisoformat(week["monday"])
        if mon.weekday() != 0: err.append("'monday' %s is not a Monday" % week["monday"])
    except Exception:  # noqa: BLE001
        mon = None; err.append("'monday' must look like 2026-11-16")
    for cid, c in (week.get("classes") or {}).items():
        tag = "[%s] " % cid
        for k in ("label", "cls", "weekLT", "days"):
            if not c.get(k): err.append(tag + "missing '%s'" % k)
        days = c.get("days") or []
        if len(days) != 5: err.append(tag + "needs exactly 5 days, has %d" % len(days))
        for i, d in enumerate(days[:5]):
            dt = tag + DAYS[i] + ": "
            if d.get("name") != DAYS[i]: err.append(dt + "name should be '%s'" % DAYS[i])
            for k in ("date", "agendaLine", "short", "bell", "agenda", "supplies", "lt"):
                if not d.get(k): err.append(dt + "missing '%s'" % k)
            if mon and d.get("date"):
                want = mon + timedelta(days=i)
                if str(want.day) not in re.findall(r"\d+", d["date"]): err.append(dt + "date '%s' does not match %s" % (d["date"], want.isoformat()))
            for n, p in enumerate(d.get("problems") or [], 1):
                if not p.get("q") or not p.get("a"): err.append(dt + "problem %d needs both q and a" % n); continue
                ok, msg = check_problem(p)
                if ok is False: err.append(dt + "problem %d: %s" % (n, msg))
                elif ok is None: warn.append(dt + "problem %d has no check (answer not machine-verified)" % n)
                for field in ("q", "a"):
                    try: to_word(p[field])
                    except ValueError as e: err.append(dt + "problem %d %s: %s" % (n, field, e))
        a = c.get("assessment") or {}
        if a.get("type") in ("quiz", "test"):
            if a.get("day") not in DAYS: err.append(tag + "assessment.day must be a weekday name")
            else:
                d = days[DAYS.index(a["day"])] if len(days) == 5 else {}
                blob = " ".join([d.get("agendaLine", "")] + d.get("agenda", [])).lower()
                if a["type"] not in blob: warn.append(tag + "%s is on %s but that day's agenda does not say '%s'" % (a["type"], a["day"], a["type"]))
        for lk in c.get("links") or []:
            t = (lk.get("t", "") + " " + lk.get("u", "")).lower()
            if re.search(r"\bkey\b|teacher|\btest\b|jeopardy", t): err.append(tag + "link '%s' looks like a key, test or Jeopardy board. Never link those." % lk.get("t"))
        def probs(tag2, items, need_wrong=False):
            for n, p in enumerate(items or [], 1):
                if not p.get("q") or not p.get("a"): err.append(tag + "%s %d needs both q and a" % (tag2, n)); continue
                ok, msg = check_problem(p)
                if ok is False: err.append(tag + "%s %d: %s" % (tag2, n, msg))
                elif ok is None: warn.append(tag + "%s %d has no check" % (tag2, n))
                for w in p.get("wrong") or []:
                    if to_plain(w.get("a", "")).strip() == to_plain(p["a"]).strip(): err.append(tag + "%s %d: a listed wrong answer equals the correct answer" % (tag2, n))
                if need_wrong and not p.get("wrong"): err.append(tag + "%s %d has no likely wrong answers" % (tag2, n))
                for f in ("q", "a", "work"):
                    try: to_word(p.get(f, ""))
                    except ValueError as e: err.append(tag + "%s %d %s: %s" % (tag2, n, f, e))
        h = c.get("homework")
        if h:
            for day in h.get("days") or []: probs("homework %s problem" % day.get("day", "?"), day.get("problems"))
        g = c.get("studyGuide")
        if g:
            for pr in g.get("practice") or []:
                for part in pr.get("parts") or []: probs("study guide '%s' problem" % pr.get("title", "?"), part.get("problems"))
            for e in g.get("errors") or []:
                if "correct" not in e or not e.get("fix"): err.append(tag + "study guide error item '%s' needs 'correct' and 'fix'" % e.get("name"))
            if g.get("errors") and not any(e.get("correct") for e in g["errors"]): warn.append(tag + "Error Detectives has no correct example (the rule is to include one)")
        for i, d in enumerate(days[:5]):
            n = d.get("notes")
            if not n: continue
            nt = "notes %s " % DAYS[i]
            if not n.get("title"): err.append(tag + nt + "needs a title")
            probs(nt + "warm-up", n.get("warmup")); probs(nt + "exit ticket", n.get("exit"))
            for part in n.get("practice") or []: probs(nt + "practice", part.get("problems"))
            for e in n.get("examples") or []:
                if not e.get("q") or not e.get("steps"): err.append(tag + nt + "example needs q and steps")
            for v in (n.get("vocab") or {}).get("items") or []:
                if "[" not in v: warn.append(tag + nt + "vocabulary line has no [blank]: " + v[:40])
        sd = c.get("speedDating")
        if sd:
            n = len(sd.get("cards") or [])
            if n != 40: err.append(tag + "speed dating has %d cards; it must have exactly 40" % n)
            probs("speed dating card", sd.get("cards"), need_wrong=True); probs("speed dating early finisher", sd.get("early"))
            qs = [to_plain(x.get("q", "")) for x in sd.get("cards") or []]
            if len(set(qs)) != len(qs): err.append(tag + "speed dating has duplicate cards")
        if not c.get("homeworkLine"): warn.append(tag + "no homeworkLine (parent message will have no homework line)")
    return err, warn
