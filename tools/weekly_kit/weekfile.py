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
        if s[i] == "{":
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


def to_plain(s):
    """Week-file text -> plain text for messages and slides: {2/5} -> 2/5."""
    s = str(s).replace("$", "")
    while "{" in s:
        i = s.index("{"); j = _match(s, i); inner = to_plain(s[i + 1:j])
        s = s[:i] + ("(" + inner + ")" if "/" in inner.replace("/", "", 1) else inner) + s[j + 1:]
    return s.replace("§", "$")


def to_board(s):
    """Week-file text -> board site text (keeps {a/b}; drops $ wrappers)."""
    return str(s).replace("$", "").replace("§", "$")


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
        if not c.get("homeworkLine"): warn.append(tag + "no homeworkLine (parent message will have no homework line)")
    return err, warn
