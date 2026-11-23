# Anchor Board — design rules

Adopted Nov 16, 2026. The principles and the spacing, radius, type and motion numbers come from
Eddie's other project's design system. Only the method was brought over: none of its colours,
branding or content. The colours and fonts below are the ones this site already uses.

## The idea: premium is calm
One quick glance, one clear action. The reader is a teacher mid-lesson, one hand on the
Chromebook, with students watching the board. If something makes the teacher pause, cut it.
The site works for the teacher; the teacher never works for the site. When in doubt: calmer,
simpler, one less thing.

## Name and logo (Nov 16, 2026)
- The site is called **Anchor Board**. Eddie wants a name he could sell, so the product name never includes "Steers".
  His own class details (Mr. Steers, Calera Middle School, the class pills) stay as content.
- Logo: the "Ring anchor" (Eddie picked option B on 2026-11-17 for the Anchor Board rebrand): the two rings open at
  the top and become an anchor's arms, white shank and crossbar, amber eye. `brand/logo.svg` (also `favicon.svg` and
  `icons/`). Symbol only, no letters. It replaced the earlier "progress rings" target. It must not look like the Southbound logo.
- `css/theme-rings.css` carries the logo onto the pages: the navy gradient (#173F86 → #0B2559 → #081B45),
  faint rings in the background, the rings mark on stage card titles and the learning target, and a
  four-colour line (paper, light blue #B9D3EE, sky, amber) under headers. Load it after `console.css`.
- The Anchor Board logo (`brand/logo.svg`) is on the projected board header. It replaced the Calera seal per Eddie on 2026-11-17.

## Rules
- **One screen, one job.** One main thing to look at, one primary action, at most one secondary.
- **Nothing covers the lesson.** Tools sit on the shelf beside the stage. Only something the
  teacher chose to float may sit over lesson content. Nothing ever covers a control.
- **Panels (Nov 18).** Every tool and lesson panel works the same way: on the shelf, floating, minimized to a
  live chip at the foot of the shelf, or off. One card style for panels wherever they sit (the ring-theme card).
  A layout sets the screen and the panels together. Panel controls on the projected board fade with the rest after 4 s.
- **Board Builder and stickers (Nov 21).** `studio.html` is the one place to build a board: Look, Panels, Stickers, Lesson.
  It is the Remote with a builder rail, so it edits the live board. Stickers are decoration the teacher chose, like a
  floated panel: they sit over the lesson and under the panels, and only the Board Builder can pick one up. Pictures and
  symbols come from a fixed list; word stickers are the teacher's own short text. No photos or uploads on stickers
  (a slide can hold the teacher's own pictures: see Slides).
  Since panels cover stickers on the board, a new sticker goes to an open spot the class can see, and a covered one
  shows faded in the builder. Controls for the picked panel or sticker sit outside the scrolling list, so picking
  something never moves what is under the finger.
  A saved board can be a lesson's own board (week + class + day, `tools.dayb`): the device that moves to that lesson
  (a day or period tap, the morning's fresh start, the bell timeline) switches to it; other screens just follow the state.
- **Slides (Nov 21).** The Board Builder's Slides side builds a lesson's slides the way Google Slides does: tools across
  the top, the day's slides down the left, the slide in the middle, notes under it. Nothing is a fixed format: the
  built-in screens (Today, Agenda, Bellringer, Notes) come in as ordinary pieces to move, restyle or delete, and live
  fields (`{{agenda}}`, `{{target}}`…) fill in each day's plan, so a teacher designs their own board once.
  - A lesson's slides (week + class + day) and the every-day slides (at most 6) are the board's **Slides** screen.
    Every-day slides open every lesson unless that day skips them. Next shows a slide's pieces one at a time, then the
    next slide; past the last slide it goes on to the next screen, and Back comes the other way.
  - The editor has its own week, class and day, so building ahead never moves the live board. Only **Show on board**
    does, and the board follows a lesson change to its slides unless a game, live notes or the seating chart is up.
  - One drawing (`js/slideView.js`, 1600 × 900 units) for every place a slide shows: editor, thumbnails, Present,
    board, Remote. Words shrink to fit their box instead of spilling out. Speaker notes show on the Remote and the
    builder, never on the board.
  - Pictures are the teacher's own, shrunk on the device (1600 px, under 720 KB) and kept in the teacher's own saved
    data (`slideimg/<id>`): not in Firebase Storage, which needs a paid plan, and never in the repo. With no wifi a
    picture still goes on the slide and goes up when the wifi is back.
  - **Screens list (Nov 21, Eddie: "get rid of some of those tabs"; Slides is the main one).** Slides comes first as
    a card ("6 slides for Monday", "Slide 2 of 6 on the board"). Tapping it puts the slides on the board and opens a
    list of that day's slides as small pictures (every-day ones tagged); tapping one shows it. Then the screens used
    every day (Seating Chart, Whiteboard, Timer, Student Game), then **More screens**. On a day with slides, Today,
    Bellringer, Guided Notes and the Agenda live in More screens, since the slides hold them; on a day without, they
    stay out front. Guided Notes and Speed Dating show only on days that have them. A screen that is up while tucked
    in More screens is named on the closed fold. Next and Back still walk every screen in order.
- **Premium finish and site colors (Nov 23).** Eddie asked for the Spotlight tab's premium look across the whole site
  ("not necessarily glass everywhere") and a setting that changes the site's colors. `css/skin.css` loads last on every
  teacher page and `js/scheme.js` loads first in `<head>` (so nothing flashes). Neither is on the projected board
  (board.html, sub.html, demo.html) or the student pages: the board keeps its Board look.
  - Glass only on what floats over the page: the top bar (sticky, frosted), menus, dialogs, the hero card's buttons.
    Everything else is a solid card: one hairline, one soft layered shadow, a small lift on hover for links.
  - Buttons and tabs echo the Spotlight toolbar: the scheme's gradient with a top highlight, Spotlight amber for the
    one next step, pill tabs on an inset track.
  - **Site colors** (Home > Settings): 9 accent schemes (Anchor navy, Royal, Ocean, Teal, Forest, Plum, Berry, Crimson,
    Slate) and Light / Night / Match device. Saved on the device (`anchorboard-scheme`) and in the account
    (`settings/site`); Home applies a newer choice from another device. Amber, green and red keep their meanings in
    every scheme.
  - How colors are wired: page styles use `var(--s-acc,#1B4FBF)` (scheme accents) and `var(--k-sub,#F6F9FD)`,
    `--k-ok-*`, `--k-bad-*`, `--k-warn-*`, `--k-ink`, `--k-mute`, `--k-bd` (Night swaps). The fallback is the old
    color, so a page without the skin looks exactly as before. New page CSS should use these names, not raw hex.
  - Anything drawn as the board (`#stage`, the tool shelf, Spotlight, slide drawings, look previews) is pinned back to
    the board palette, so the scheme and Night never change what students see. Printing is always light.
- **Never show the wrong thing while loading.** Show the shape of the screen (a skeleton) until
  the real state arrives. No spinners, and never a flash of another day or period.
- **Never claim what the site cannot know.** No "current period" without bell times. If the
  board is showing a day that is not today, say so and offer one tap back to today.
- **Never a bare screen, never a dead end.** Every empty state says what to do next and has a
  button for it.
- **Phone first for the teacher pages.** Check at 390px wide and on desktop. Single column,
  no sideways scroll. Tap targets at least 44px. Text at least 12px. A label on every field.
  On a phone the page must act like an app: nothing may make it wider than the screen (check the widest status
  message too, "Not connected…"; the Remote's bar and body clip sideways as a safety net), no double-tap zoom
  (`touch-action: manipulation` on every element, `css/console.css`), and fields at least 16px so Safari does not
  zoom in on a tap. Phone layout comes from the page's own width and the screen size, never `innerWidth`, which
  follows a zoom.
- **Restraint.** No new fonts, colours, shadows, gradients or corner styles without asking Eddie (the Nov 23 skin is the approved set).
- **Motion is quick and quiet.** About 240–260ms, never bouncy, and off for reduced-motion.
- **Student privacy.** Nothing a student could be identified by goes on the board unless the
  teacher puts it there (name picker, groups, the Seating Chart screen). No student data in this public repo, ever.

## Colours and fonts in use (the source of truth is the CSS)
- Stage (what students see), `css/board.css`: navy `#081B45`, deep `#0B2559`, blue `#10358A`,
  sky `#7FAEDD`, paper `#F6F9FD`, on-navy text `#F4F7FB`.
- Teacher console, `css/console.css`: background `#EEF1F6`, surface `#FFFFFF`, ink `#0E1B3A`,
  muted `#55627F`, line `#D5DCE9`. Amber `#F2B33D` marks the one primary action and "today".
  Green means live or saved, red means a problem or a test day.
- Fonts: Instrument Sans (text) and Bricolage Grotesque (headings). Printed sheets use Calibri.
- Colour by meaning: amber = do this next, green = fine, red = stop or look. Not decoration.

## Numbers to use on teacher pages
- Radius: card 16–20px, large button 16px, input 10–12px.
- Type: page title 32px on a phone, up to 44px on desktop, line height 1.1; heading 20px/1.3;
  body 16px/1.6; small 13px/1.5; never under 12px.
- Spacing: card padding 16px on a phone, 24px on desktop; gaps 16px / 32px; buttons 44–48px tall.
- Shadow: one soft card shadow, `0 8px 32px` at about 12% of the navy.
- The stage is different: it scales with the board, so its sizes are in `em`, not pixels.

## Open questions for Eddie
- The transfer notes named navy `#0E2A47`, light blue `#A8CCE8` / `#7FB3D5` and the Fredoka font.
  The live site uses the colours and fonts listed above, and amber as the action colour. Nothing
  was restyled. Say if the older palette or a single light-blue accent should replace them.
- The teacher pages have not yet been checked page by page against these rules (see QUEUE.md).

## How work gets done here
1. Read this file and `QUEUE.md`. Fetch `main` and check its head: two Claude threads push here.
2. **Scout first.** Look at the live page and the code, write down what is wrong and what will
   change, before building. For a design choice, show Eddie options and build what he picks.
3. Build, then test in a real browser (every page has a `?demo` or guest mode that needs no sign-in).
4. Re-check the head of `main`, push, and confirm the change on the live site.
5. Update `QUEUE.md` when an item moves.
