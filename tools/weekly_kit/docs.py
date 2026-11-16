"""Word files built from the week file. Native equations, stacked fractions."""
from datetime import date, timedelta
from mathdoc import Doc
from weekfile import DAYS, to_word


def _daydate(week, i):
    d = date.fromisoformat(week["monday"]) + timedelta(days=i)
    return "%d/%d/%s" % (d.month, d.day, str(d.year)[2:])


def bellringer(week, cid, path):
    """Student bellringer sheet: one block per day, an answer line under each problem."""
    c = week["classes"][cid]; b = c.get("bellringer") or {}
    d = Doc(margins=0.7, base=11)
    d.title(b.get("title") or "Weekly Bellringer: Week of " + week["dates"].split("–")[0], b.get("subtitle") or c["label"] + " Mathematics")
    d.namerow()
    d.p(b.get("directions") or "Do these problems at the start of class each day. Show your work.", italic=True, after=4)
    for i, day in enumerate(c["days"]):
        probs = day.get("problems") or []
        if not probs: continue
        note = day.get("bellNote") or ("Review of Earlier Topics" if i == 4 else "")
        d.h2("%s %s%s" % (DAYS[i], _daydate(week, i), " (%s)" % note if note else ""), size=12)
        gap = b.get("space", 16 if len(probs) <= 3 else 9)
        for n, p in enumerate(probs, 1):
            d.p("**%d.** %s" % (n, to_word(p["q"])), keep=True, after=2)
            d.p("Answer: ______________________", after=gap)
    d.save(path)


def bellringer_key(week, cid, path):
    """Teacher key: answers by day, then the worked line for each problem."""
    c = week["classes"][cid]
    k = Doc(margins=0.7, base=11)
    k.title("TEACHER KEY: Bellringers (%s, %s)" % (c["label"], week["label"]), "Teacher only. Never post or link.")
    width = max(len(day.get("problems") or []) for day in c["days"]) or 1
    rows = [["Day"] + [str(n) for n in range(1, width + 1)]]
    for i, day in enumerate(c["days"]):
        ans = [to_word(p["a"]) for p in day.get("problems") or []]
        if ans: rows.append([DAYS[i]] + ans + [""] * (width - len(ans)))
    k.table(rows, widths=[1.2] + [(k.w - 1.2) / width] * width, size=11)
    any_work = False
    for i, day in enumerate(c["days"]):
        work = [(n, p) for n, p in enumerate(day.get("problems") or [], 1) if p.get("work")]
        if not work: continue
        if not any_work: k.h2("Worked solutions", size=13); any_work = True
        k.p("**%s**" % DAYS[i], after=1)
        for n, p in work: k.p("%d. %s" % (n, to_word(p["work"])), size=10.5, after=1)
    checked = sum(1 for day in c["days"] for p in day.get("problems") or [] if p.get("check"))
    total = sum(len(day.get("problems") or []) for day in c["days"])
    k.p("Verification: %d of %d answers were recomputed by a written check when this file was built." % (checked, total), size=10, before=8)
    k.save(path)
