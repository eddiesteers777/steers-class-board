# CLAUDE.md — AnchorBoard (DRAFT, not yet in the repo)

<!-- DRAFT prepared Nov 27, 2026 by Muse. Do NOT add to the repo until Eddie says so.
     Purpose: make the AnchorBoard context load in EVERY new Claude Code session for
     repo eddiesteers777/steers-class-board, so a new chat never starts blank.
     Source: AnchorBoard-only starter pack v2 (Nov 27, 2026),
     ~/workspace/anchorboard-vision/anchorboard-code-chat-starter-pack-2026-11-27-v2-general-website.md
     Full context (threads 01-06, ACAP, timeline) stays in ~/workspace/anchorboard-vision/ —
     attach the specific thread file for a specific build. -->

# AnchorBoard

Teacher-led classroom board for Eddie Steers, middle school math teacher at Calera
Middle School (Shelby County, Alabama). Classes: 7th Regular, 8th Regular, 8th
Accelerated. 84 students across 5 periods. Live at https://anchorboard.web.app —
a Promethean board view for students plus a Chromebook Remote, Firestore-synced,
real timers, Google sign-in, teacher-only. It replaces daily Google Slides and is
used in class every day. This is not a rebuild. It is the next layer on top of
what exists.

- Repo: `eddiesteers777/steers-class-board` (public)
- Firebase project: `steers-class-board`
- Teacher UID: `qjry6kjyhdWXAlnpXHtYglOY4Cy1`
- Design: navy #081B45, amber #F2B33D, Instrument Sans / Bricolage Grotesque,
  ring logo. Premium, mobile-first, board-readable.

## Scope of this chat

General AnchorBoard website help. NOT question-bank-specific — the bank counts
below are background context only; do not start question-bank work unless Eddie
asks for it. Weekly Math Planning (agendas, guided notes, bellringers, homework,
slides, parent messages, modified versions) stays in the Weekly Math Planning
project, not here.

## What exists

- Board + Remote: 11 fixed screens sharing one state doc
  `teacher/{uid}/board/state`. Remote drives it from Eddie's Chromebook.
- Tools: 10 fixed widgets in `js/boardTools.js`. Games: 11 review games in
  `js/games.js` plus Vault Raid (`js/liveRoom.js`, `play.html`). Students join
  with a 6-digit code, anonymous guest sign-in, first name from the roster.
- Week pipeline: Plan the Week (`plan.html`) → Week Review (`review.html`) →
  Approve → board + Library. Week files in `data/weekN.js`, built by
  `tools/weekly_kit/build_week.py`. Standards tracking live at
  `teacher/{uid}/standards/progress` (Not yet / Teaching / Taught / Reteach).
- Standards: `data/standards.js` — Alabama Course of Study. 7th: 22 standards.
  8th: 30 standards (8.1–8.30).
- Student data today: game results at `teacher/{uid}/games/results`, Class Data
  imports at `teacher/{uid}/data/i_*`, rosters at `teacher/{uid}/rosters/all`
  (84 students, first name + last initial — the canonical key is
  period + first name + last initial).
- Does NOT exist yet: assignment builder, student answering flow, per-student
  longitudinal record, real graphs, grades. Plan → Review → Approve has never
  run end-to-end in Firestore yet.

## Problem bank (background context only, Nov 27, 2026)

Each problem is `{id, std, part?, q, a, lvl, choices?}`; lvl 1 = on-ramp,
2 = on level, 3 = stretch. The bank lives in `data/stdbank/` (g7.js, g8.js,
alg1.js, plus grades 2–6 and high school). Middle school now holds 3,276
problems, 27 per standard (Sets 1–3 complete Nov 27). High school holds 3,006,
18 per standard. Do not invent a third problem store.
Rules for new problems: levels must genuinely fit (L1 one-step entry, L2 on
grade level, L3 stretch with ACAP rigor — unfamiliar contexts, multi-step
reasoning, explain/compare/error-fix, NOT bigger numbers). Multiple choice for
every problem. Board notation (§, −, ×, ², etc.), not plain text. Even answer
positions. Part letter in its own field only.

## Open issues — check live before acting

- **Pack bug (URGENT, fix NOT yet applied):** a fresh-browser check inferred
  `starter` and persisted it to `teacher/{uid}/settings/pack`, hiding real data
  behind the sample pack. Rosters intact. Fix (branch-only): never
  infer-and-persist `starter`; on inconclusive inference return `calera` and
  write nothing; do not redirect on a provisional pack. Repair needs Eddie's
  go-ahead to set pack to `calera` / clear empty setup.
- **Week 6 (Nov 30) is not built yet.**
- **Vault Raid wrong set (Nov 23 audit):** defaulted to the wrong set for
  5th-period 7th Grade, and the choice did not stick after re-sign-in.
- Queue: sign-in popup second-try bug, ~8-sec board first paint, DESIGN.md check.
- Bell times stored Nov 16 with gaps — do NOT clear the "1 of 18 changed,
  NOT re-checked" notice without Eddie's say-so.
- YouTube / music panel (approved Nov 23, not built): paste a link or pick a
  saved instrumental; full video panel OR minimised corner bar. Apple Music /
  Spotify playback and Bluetooth / AirPlay mirroring cannot be built into a website.
- Desmos Trial Key: personal non-commercial / 90-day internal trial only; selling
  AnchorBoard counts as commercial and needs a paid plan or written addendum first.
  Never remove Desmos branding; keep the key confidential (key value NOT in this file).

## Vision — parked unless Eddie asks

Threads 01–06 in `~/workspace/anchorboard-vision/threads/`: progress/dashboard,
DeltaMath-style assignments, dynamic board, lesson planning, grades (LAST),
step-by-step walkthrough player. Plus ACAP readiness (periodic 20-question
cumulative check, Secure 80%+ / Developing 50–79% / Not yet <50%, one-tap
approve, never auto-assign) and foundational-skills fallback (never auto-place
a kid without Eddie's tap). Standards order LOCKED v1 (7th and 8th). Absence
dashboard is Phase 2, after ACAP Phase 1.

## Hard rules — not optional

- **Branch-only. Nothing merged or deployed until Eddie says "push it."**
  Read DESIGN.md and QUEUE.md first, and check the head of main before every
  push — two threads build this repo.
- **Ask Eddie before clicking anything that merges, deletes, or turns
  something off.** Explain in plain terms what it does, what it kills, and
  what stays working, then ask for the go-ahead.
- **First names only, everywhere.** No full names, dates of birth, student IDs,
  or personal data of any kind in the product.
- **Don't break what's working:** Week 5 is live in class, Vault Raid runs
  daily. Build alongside, and say plainly in each PR what you touched and what
  you deliberately did not.
- Scores only go up. Never copy IXL-style punitive scoring. Reward accuracy
  and strategy, not speed. Do not promise normed data, grade levels,
  percentiles, or state-test prediction.
- The week-file schema in `data/weekN.js` is the contract — do not change it
  without saying so in the PR.
- Discussion-first for new features: read what's already built, bring back a
  short phased plan before coding.
- Keep the model-training switch OFF on school accounts by default.
- If a detail here conflicts with the live repo, the live repo wins — say so
  and name the conflict.
- Verify against the live site / Firestore before calling anything done.
  A bare "done" is not enough — show the check.
