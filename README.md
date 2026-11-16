# Steers Class Board

Classroom display for Mr. Steers' math classes at Calera Middle School.
Live at https://eddiesteers777.github.io/steers-class-board/

- `index.html` home: this week, with Open Remote and Open Board.
- `remote.html` the Chromebook: pick class, day and screen, run timers, show answers.
- `board.html` the Promethean: full screen, follows the Remote.
- `js/boardApp.js` the app (screens, timers, whiteboard). `js/boardStore.js` saves live state under `teacher/{uid}/` in Firestore.
- `data/weekN.js` one file of lesson content per week; `data/weeks.js` lists them.

## Adding a week
1. Copy `data/week5.js` to `data/weekN.js` and replace the content (dates, agenda, supplies, reminders, learning targets, bellringer problems with verified answers, file links).
2. Add it to `data/weeks.js`. The newest week whose Monday has arrived opens by default.
3. Student-facing content only. Never add tests or teacher keys. The repo is public.

Teacher only. Students never sign in.

## Hosting + Google

- Live: https://eddiesteers777.github.io/steers-class-board/ via GitHub Pages (repo public, main branch, root folder). No custom domain — the `github.io` address is the official address unless Eddie buys a domain later.
- Google Search Console: property for the Pages URL, verified by HTML file, sitemap submitted. Google indexes only the public pages (`/` and `home.html`); every app page carries `noindex` and the classroom content sits behind teacher sign-in, so it is not searchable.
- SEO files in repo: `robots.txt`, `sitemap.xml`, `favicon.svg` + `icons/icon-192.png` / `icon-512.png` / `icon-maskable-512.png` (navy "S"), canonical + Open Graph tags on `index.html` and `home.html`, WebSite JSON-LD on `home.html`.
