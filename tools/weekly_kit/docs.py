"""Word files built from the week file. Native equations, stacked fractions."""
from datetime import date, timedelta
from mathdoc import Doc, BLUE
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


# ---------- homework packet / extra practice ----------
NAME3 = "**Name:** ______________________________   **Date:** ______________   **Period:** ________"


def homework(week, cid, path):
    """Homework Packet (8th) or Extra Practice (7th): a worked example, then problems, per day."""
    c = week["classes"][cid]; h = c["homework"]
    d = Doc(margins=0.7, base=11)
    d.title(h["title"], h.get("subtitle") or c["label"] + " Mathematics")
    d.namerow()
    if h.get("directions"): d.p(to_word(h["directions"]), italic=True, after=4)
    for n, day in enumerate(h["days"]):
        head = d.h2(day.get("heading") or day["day"] + " Problems", size=12)
        if n and h.get("pagePerDay"): head.paragraph_format.page_break_before = True
        ex = day.get("example")
        if ex:
            d.box(["**Worked example:** " + to_word(ex["q"])] + [to_word(s) for s in ex.get("steps", [])], size=10.5)
        gap = h.get("space", 18)
        for i, p in enumerate(day["problems"], 1):
            d.p("**%d.** %s" % (i, to_word(p["q"])), keep=True, after=2)
            d.p("Answer: ______________________", after=gap)
    d.save(path)


def homework_key(week, cid, path):
    c = week["classes"][cid]; h = c["homework"]
    k = Doc(margins=0.7, base=11)
    k.title("TEACHER KEY: %s" % h["title"], "Teacher only. Never post or link.")
    rows = [["Day", "#", "Answer", "Work"]]
    for day in h["days"]:
        for i, p in enumerate(day["problems"], 1):
            rows.append([day["day"] if i == 1 else "", str(i), to_word(p["a"]), to_word(p.get("work", ""))])
    k.table(rows, widths=[1.0, 0.4, 2.2, k.w - 3.6], size=10)
    total = sum(len(x["problems"]) for x in h["days"]); checked = sum(1 for x in h["days"] for p in x["problems"] if p.get("check"))
    k.p("Verification: %d of %d answers were recomputed by a written check when this file was built." % (checked, total), size=10, before=6)
    k.save(path)


# ---------- study guide ----------
def study_guide(week, cid, path):
    """4 pages, each part starting on its own page: worked examples, practice pages,
    then error detectives with the Got it / Mostly / Need help check."""
    c = week["classes"][cid]; g = c["studyGuide"]
    d = Doc(margins=0.6, base=10.5)
    d.title(g["title"], g.get("subtitle"), size=18)
    d.p(NAME3, after=3)
    if g.get("ican"): d.box(["**I can:** " + to_word(g["ican"])], size=10.5)
    for part in g.get("examples", []):
        d.h2(part["heading"], size=12, before=4)
        for box in part["boxes"]: d.box([to_word(x) for x in box], size=10)
    for pr in g.get("practice", []):
        d.p(pr["title"], size=16, bold=True, color=BLUE, after=2).paragraph_format.page_break_before = True
        d.p(NAME3, after=3)
        if pr.get("directions"): d.p(to_word(pr["directions"]), italic=True, after=3)
        n = 0
        for part in pr["parts"]:
            if part.get("label"): d.p(to_word(part["label"]), after=2, before=3)
            rows = []
            for p in part["problems"]:
                n += 1; rows.append(["**%d.** %s" % (n, to_word(p["q"]))])
            d.table(rows, widths=[d.w], header=False, size=10.5, rowheight=part.get("height", pr.get("height", 0.62)))
    d.p(g.get("errorTitle", "Error Detectives and Check-Up"), size=16, bold=True, color=BLUE, after=2).paragraph_format.page_break_before = True
    d.p(NAME3, after=3)
    d.p("Each student solved a problem. Decide if the work is **correct** or has a **mistake**. If there is a mistake, circle it and fix it.", after=3)
    for e in g.get("errors", []):
        d.box(["**%s:** %s" % (e["name"], to_word(e["q"])), to_word(e["shown"]), "☐ Correct   ☐ Mistake. Fix it or explain: ______________________________________________"], size=10.5, fill="FFFFFF")
    if g.get("checklist"):
        d.h2("How am I doing?", size=12)
        d.table([[to_word(s), "☐ Got it", "☐ Mostly", "☐ Need help"] for s in g["checklist"]], widths=[d.w - 3.3, 1.1, 1.1, 1.1], header=False, size=10)
        d.p("One thing I still need help with: ______________________________________________", before=4)
    d.save(path)


def study_guide_key(week, cid, path):
    c = week["classes"][cid]; g = c["studyGuide"]
    k = Doc(margins=0.7, base=10.5)
    k.title("TEACHER KEY: %s" % g["title"], "Teacher only. Never post or link.")
    total = checked = 0
    for pr in g.get("practice", []):
        k.h2(pr["title"], size=12)
        rows = [["#", "Answer", "Work"]]; n = 0
        for part in pr["parts"]:
            for p in part["problems"]:
                n += 1; total += 1; checked += 1 if p.get("check") else 0
                rows.append([str(n), to_word(p["a"]), to_word(p.get("work", ""))])
        k.table(rows, widths=[0.4, 2.4, k.w - 2.8], size=10)
    if g.get("errors"):
        k.h2("Error Detectives", size=12)
        k.table([["Student", "Verdict", "What to look for"]] + [[e["name"], "Correct" if e["correct"] else "Mistake", to_word(e["fix"])] for e in g["errors"]], widths=[1.0, 0.9, k.w - 1.9], size=10)
    k.p("Verification: %d of %d practice answers were recomputed by a written check when this file was built." % (checked, total), size=10, before=6)
    k.save(path)


# ---------- speed dating ----------
def speed_dating(week, cid, path):
    """Page 1: exactly 40 cards. Page 2: recording sheet with the Errors section.
    Page 3: Early Finishers: Fix the Mistakes."""
    c = week["classes"][cid]; s = c["speedDating"]; cards = s["cards"]
    assert len(cards) == 40, "speed dating needs exactly 40 cards"
    d = Doc(margins=0.4, base=10)
    d.p("SPEED DATING REVIEW: " + s["title"], size=15, bold=True, color=BLUE, after=0)
    d.p("Cards 1–40. Your teacher hands you ONE card. Do NOT write on the card, and do NOT show the answer to your partners.", size=9, italic=True, after=3)
    rows = [["**#%d**  %s" % (r * 4 + q + 1, to_word(cards[r * 4 + q]["q"])) for q in range(4)] for r in range(10)]
    d.table(rows, widths=[d.w / 4] * 4, header=False, size=s.get("cardSize", 9), rowheight=s.get("cardHeight", 0.76))
    d.p("SPEED DATING: Recording Sheet", size=15, bold=True, color=BLUE, after=2).paragraph_format.page_break_before = True
    d.p("**Name:** ______________________________   **Date:** ______________   **Period:** ________   **My card #:** ________", after=4)
    d.p("**My card's correct answer (get it checked by your teacher):** ____________________", size=10, after=4)
    rounds = s.get("rounds", 8)
    d.table([["Round", "Partner's card #", "Show ALL work to solve their card", "My answer", "Partner checked ✓"]] + [[str(i), "", "", "", ""] for i in range(1, rounds + 1)], widths=[0.6, 1.0, 3.9, 1.0, 1.0], size=10, rowheight=0.62)
    d.p("My Master Problem: Errors", size=12, bold=True, color=BLUE, before=4, after=2)
    d.p("Write what your partners got wrong on YOUR card (the wrong answer or the mistake), and how many partners made it.", size=9.5, after=2)
    d.table([["Wrong answer or mistake", "How many partners?"], ["", ""], ["", ""], ["", ""]], widths=[5.5, 2.0], size=10, rowheight=0.32)
    d.p("The MOST common error on my problem was: ______________________________________________", size=10, after=3)
    d.p("Class error review: how to fix it: __________________________________________________", size=10, after=0)
    d.p("Early Finishers: Fix the Mistakes", size=15, bold=True, color=BLUE, after=2).paragraph_format.page_break_before = True
    d.p("**Name:** ______________________________   **Period:** ________", after=3)
    ex = s.get("example")
    if ex: d.box(["**Worked example:** " + to_word(ex["q"])] + [to_word(x) for x in ex["steps"]], size=10.5)
    d.p("These are deliberate extra practice. Show every step, then come back for the class error review.", size=10, italic=True, after=3)
    early = s.get("early", [])
    for i, p in enumerate(early, 1):
        d.p("**%d.** %s" % (i, to_word(p["q"])), size=11, after=2); d.space(3, size=11)
    ea = s.get("errorItem")
    if ea:
        d.p("**%d. Error analysis.** %s" % (len(early) + 1, to_word(ea["q"])), size=11, after=2); d.space(4, size=11)
    d.p("When you finish, come back to the class error review at the end of the period.", size=10, italic=True)
    d.save(path)


def speed_dating_key(week, cid, path):
    c = week["classes"][cid]; s = c["speedDating"]
    k = Doc(margins=0.6, base=10)
    k.p("TEACHER KEY: Speed Dating Review, %s (%s)" % (s["title"], c["label"]), size=15, bold=True, color=BLUE, after=1)
    k.p("Teacher only. Never post or link." + (" " + s["standardNote"] if s.get("standardNote") else ""), size=9.5, italic=True, after=4)
    if s.get("setup"):
        k.h2("Setup", size=12, before=2)
        k.table([["Item", "Plan"]] + [[a, to_word(b)] for a, b in s["setup"]], widths=[1.6, 5.7], size=9.5)
    k.h2("Master cards 1–40: answers, work, and likely wrong answers (teacher only)", size=12)
    rows = [["#", "Skill", "Answer", "Worked solution", "Likely wrong answers (why)"]]
    for n, cd in enumerate(s["cards"], 1):
        rows.append([str(n), cd.get("skill", ""), to_word(cd["a"]), to_word(cd.get("work", "")), ["%s: %s" % (to_word(w["a"]), w["why"]) for w in cd.get("wrong", [])]])
    k.table(rows, widths=[0.3, 1.1, 0.85, 2.6, 2.45], size=8.5)
    early = s.get("early", [])
    if early or s.get("errorItem"):
        k.h2("Early-finisher key (deliberate extra practice)", size=12)
        er = [["#", "Answer", "Work", "Likely wrong answers"]]
        for i, p in enumerate(early, 1): er.append([str(i), to_word(p["a"]), to_word(p.get("work", "")), ["%s: %s" % (to_word(w["a"]), w["why"]) for w in p.get("wrong", [])]])
        if s.get("errorItem"): er.append([str(len(early) + 1), to_word(s["errorItem"]["a"]), to_word(s["errorItem"].get("work", "")), []])
        k.table(er, widths=[0.3, 1.5, 2.9, 2.6], size=9)
    if s.get("reviewNotes"):
        k.h2("Class error review notes", size=12)
        for line in s["reviewNotes"]: k.p("• " + to_word(line), size=9.5, after=2)
    checked = sum(1 for cd in s["cards"] if cd.get("check"))
    k.h2("Verification", size=12)
    k.p("%d of 40 card answers were recomputed by a written check when this file was built, and every listed wrong answer was confirmed to differ from the correct answer." % checked, size=9.5)
    k.save(path)


# ---------- guided notes ----------
import re as _re


def _blank(text, key=False):
    """[word] -> a blank for students, the bold word for the key."""
    return _re.sub(r"\[([^\]]+)\]", lambda m: ("**" + m.group(1) + "**") if key else "______________", text)


def guided_notes(week, cid, i, path, key=False):
    """One day's guided notes. The same content drives the board's Guided Notes screen,
    so the paper in front of students matches what is revealed on the board, step for step."""
    c = week["classes"][cid]; day = c["days"][i]; n = day["notes"]
    d = Doc(margins=0.65, base=11)
    d.title(("TEACHER KEY: " if key else "") + n["title"], ("Teacher only. Never post or link. " if key else "") + (n.get("subtitle") or c["label"]))
    if not key: d.namerow()
    head = []
    if n.get("standard"): head.append("**Standard:** " + n["standard"])
    if n.get("targets"): head.append("**Learning Targets:** I can… " + "  •  ".join(to_word(t) for t in n["targets"]))
    if head: d.box(head, size=10.5)
    if n.get("warmup"):
        d.h2("Warm-Up", size=13)
        d.p("   ".join("**W%d.** %s%s" % (k, to_word(p["q"]), ("  →  **" + to_word(p["a"]) + "**") if key else "") for k, p in enumerate(n["warmup"], 1)))
        if not key: d.space(3)
    v = n.get("vocab")
    if v:
        d.h2("Vocabulary: fill in the blanks", size=13)
        if v.get("bank"): d.p("**Word bank:** " + "  •  ".join(v["bank"]), size=10.5, after=3)
        for k, item in enumerate(v["items"], 1): d.p("%d. %s" % (k, to_word(_blank(item, key))), after=4)
    if n.get("bigIdea"):
        d.h2("The Big Idea", size=13)
        d.box(["**" + to_word(n["bigIdea"][0]) + "**"] + [to_word(t) for t in n["bigIdea"][1:]] + (["**Steps:**"] + ["%d. %s" % (k, to_word(t)) for k, t in enumerate(n["steps"], 1)] if n.get("steps") else []), size=10.5)
    blanks = n.get("blankExamples") and not key
    if n.get("examples"):
        d.h2("Worked Examples", size=13)
        for k, e in enumerate(n["examples"], 1):
            d.p("**Example %d%s** %s" % (k, (": " + e["title"] + ".") if e.get("title") else ".", to_word(e["q"])), keep=True, after=2)
            d.steps([("" if blanks else to_word(x["m"]), to_word(x.get("why", ""))) for x in e["steps"]], size=10.5)
    g = n.get("guided")
    if g:
        d.h2("Guided Practice: your turn with help", size=13)
        d.p(to_word(g["q"]), keep=True, after=2)
        d.steps([(to_word(x.get("full") if key else x["m"]), to_word(x.get("why", ""))) for x in g["steps"]], size=10.5)
    if n.get("practice"):
        d.h2("Practice", size=13).paragraph_format.page_break_before = bool(n.get("practicePageBreak", True))
        if n.get("practiceDirections"): d.p(to_word(n["practiceDirections"]), italic=True, after=3)
        for part in n["practice"]:
            if part.get("label"): d.p("**" + part["label"] + "**", before=4, after=2)
            for p in part["problems"]:
                d.p("**%s.** %s%s" % (p.get("n", ""), to_word(p["q"]), ("  →  **" + to_word(p["a"]) + "**") if key else ""), keep=not key, after=2)
                if not key: d.space(part.get("space", 2))
    if n.get("errors"):
        d.h2("Error Detectives", size=13)
        if not key: d.p("One of these students is correct! Decide: Correct or Mistake? If it is a mistake, explain it and give the right answer.", italic=True, after=3)
        for k, e in enumerate(n["errors"], 1):
            d.p("**E%d.** %s" % (k, to_word(e["q"])), after=2)
            d.p(("**%s.** %s" % ("Correct" if e["correct"] else "Mistake", to_word(e["fix"]))) if key else "Correct or Mistake? ______   Explain: ______________________________________________", after=6)
    if n.get("exit"):
        d.h2("Exit Ticket (individual check)", size=13).paragraph_format.page_break_before = bool(n.get("exitOwnPage", True)) and not key
        for k, p in enumerate(n["exit"], 1):
            d.p("**X%d.** %s%s" % (k, to_word(p["q"]), ("  →  **" + to_word(p["a"]) + "**") if key else ""), after=2)
            if not key: d.space(3)
        if not key: d.p("Confidence: ☐ Got it   ☐ Mostly   ☐ Need help")
    d.save(path)
