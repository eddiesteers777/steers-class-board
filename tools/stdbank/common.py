"""Helpers for the standards Question Bank.

Every computed answer comes from the same numbers that write the question, so a key cannot drift from its question.
Writing follows the week files: − for minus, {a/b} for a stacked fraction, 1{1/2} for a mixed number, § for a dollar
sign, ² ³ for squares and cubes.
"""
from fractions import Fraction as F
import math

MINUS = "−"


def num(x, mixed=True, paren=False):
    """A number the way the board writes it. Fractions stack; improper ones become mixed numbers."""
    if isinstance(x, float):
        x = F(str(x))
    x = F(x)
    neg = x < 0
    x = abs(x)
    if x.denominator == 1:
        s = str(x.numerator)
    elif mixed and x > 1:
        w = x.numerator // x.denominator
        r = x - w
        s = "%d{%d/%d}" % (w, r.numerator, r.denominator)
    else:
        s = "{%d/%d}" % (x.numerator, x.denominator)
    if neg:
        s = MINUS + s
        if paren:
            s = "(" + s + ")"
    return s


def dec(x, places=None, paren=False):
    """A decimal: no trailing zeros unless places is given."""
    x = F(x) if not isinstance(x, float) else F(str(x))
    neg = x < 0
    x = abs(x)
    if places is None:
        # exact decimal if it terminates
        d = x.denominator
        for p in (2, 5):
            while d % p == 0:
                d //= p
        assert d == 1, "not a terminating decimal: %s" % x
        s = format(float(x), ".10f").rstrip("0").rstrip(".")
        if s == "":
            s = "0"
    else:
        s = format(round(float(x) + 1e-12, places), "." + str(places) + "f")
    if s.startswith("."):
        s = "0" + s
    if neg and float(x) != 0:
        s = MINUS + s
        if paren:
            s = "(" + s + ")"
    return s


def money(x):
    x = F(x) if not isinstance(x, float) else F(str(x))
    neg = x < 0
    s = "§" + format(float(abs(x)) + 1e-9, ",.2f")
    return (MINUS + s) if neg else s


def term(c, v="x", first=True):
    """c·v as written in an expression: 3x, −x, {1/2}x, and + / − joins after the first term."""
    c = F(c)
    if c == 0:
        return ""
    body = ("" if abs(c) == 1 else num(abs(c), mixed=False)) + v if v else num(abs(c), mixed=False)
    if first:
        return (MINUS if c < 0 else "") + body
    return (" " + MINUS + " " if c < 0 else " + ") + body


def lin(a, b, v="x"):
    """a·v + b, written plainly."""
    s = term(a, v, True)
    if b:
        s = (s + term(b, "", not s)) if s else num(b)
    return s or "0"


def item(std, q, a, lvl=2, part=None, choices=None, also=None):
    o = {"std": std, "q": q, "a": a, "lvl": lvl}
    if part:
        o["part"] = part
    if choices:
        assert a in choices, (q, a, choices)
        o["choices"] = choices
    if also:
        o["also"] = also
    return o


def frac_str(n, d):
    return "{%d/%d}" % (n, d)


def pct(x):
    """A percent value as text, 12.5 -> 12.5%"""
    return dec(x) + "%"


def repeating(n, d):
    """Decimal expansion of n/d with a repeating block shown with a bar written as (…), e.g. 0.1(6)."""
    assert n >= 0 and d > 0
    w, r = divmod(n, d)
    digits, seen = [], {}
    while r and r not in seen:
        seen[r] = len(digits)
        r *= 10
        digits.append(str(r // d))
        r %= d
    if not r:
        return str(w) + ("." + "".join(digits) if digits else "")
    i = seen[r]
    return str(w) + "." + "".join(digits[:i]) + "".join(digits[i:]) + "…", "".join(digits[:i]), "".join(digits[i:])
