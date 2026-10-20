# Göllner's Kulinarium – Website

Static website for a German restaurant in Bischofsheim. No build step, no framework: plain HTML, CSS and JavaScript.
The people asking for changes are usually the restaurant owners, not developers. Answer them in simple German.

## Where things live

All editable content is in `content/` (see `content/README.md`, the owner's editing guide):

| What | File |
|---|---|
| Menu (Speisekarte) | `content/menu.json`, or a Google Sheet if `menuGoogleSheetCsv` in `settings.json` is set |
| Opening hours, extra closing days | `content/hours.json` |
| Headline, notice banner, "Über uns", offer cards, section titles | `content/texts.json` |
| Name, phone, email, address, social links | `content/contact.json` |
| Which photo goes where | `content/images.json`; the photos are in `content/images/` |
| Reservation form settings, Web3Forms key | `content/settings.json` |
| Loading and parsing of those files | `assets/js/content.js` (shared with the checker) |
| Page structure | `index.html` |
| Colours, fonts, layout | `assets/css/style.css` (colour tokens at the top in `:root`) |
| Logo | `assets/img/logo.png` |
| Impressum / Datenschutz | `impressum.html` (contact block filled from `contact.json`), `datenschutz.html` |

## Rules for changes

- Content changes go into the files in `content/`. Never hard-code content into `index.html`.
- To hide the notice banner, set `"notice": { "show": false, … }`. Don't delete it.
- Opening hours: `"wednesday": ["12:00-14:00", "17:00-21:30"]`; `[]` = closed (Ruhetag).
- Extra closing days: `"closed": ["24.12.2026", "27.07.2027 - 09.08.2027"]` (German date format, ranges allowed).
  They are shown on the page, used for the open/closed status and blocked in the reservation form.
- Prices are strings with a German decimal comma, without "€", e.g. `"18,90"`.
- Run `node scripts/check-content.cjs` after editing content. GitHub runs the same check on every push
  (`.github/workflows/publish.yml`) and only publishes `main` if it passes. Keep the checker in sync when
  you change the shape of a content file.
- After changing any CSS or JS file, bump the `?v=` number on its `<link>`/`<script>` tags in all HTML files,
  otherwise phones keep using the cached old file (GitHub Pages caches for 10 minutes).
- Keep the design consistent: dark background, gold accents, Cormorant Garamond for headings, Jost for body text.
  Don't introduce new colours or fonts unless asked.
- New photos: compress to max. 1600 px wide, JPG, under ~400 KB, put them in `content/images/`.
- Don't load anything from third-party servers (Google Fonts, Maps embeds, tracking). The site is deliberately
  DSGVO-friendly; adding such things requires a cookie banner and Datenschutz changes.
- Don't change `impressum.html` or `datenschutz.html` without being explicitly asked. They are legal texts.
  `datenschutz.html` sections 3 (no cookies), 5 (GitHub Pages hosting), 7 (Web3Forms) and 10 (links) describe
  what the site actually uses: if a service is added, removed or replaced, point out that they need updating.

## Reservation form

"Tisch reservieren" opens a request form (`assets/js/reservation.js`). Guests pick a date and a time
within the opening hours; the request is emailed to the restaurant via Web3Forms. There is no live
availability: the restaurant confirms by replying to the guest's email.

Settings in `content/settings.json` → `reservation`:
- `lastSeatingMinutesBeforeClose`: last bookable time before closing (60 → kitchen closes 21:30, last slot 20:30).
- `leadMinutes`: how far ahead same-day requests must be made.
- `web3formsKey` empty = demo mode: the form shows a confirmation but sends nothing.

## Publishing

GitHub Pages is published by the Actions workflow, not from the branch directly. A push to `main` is live
1–2 minutes after the "Check and publish website" run succeeds.

## Preview

```bash
python3 -m http.server 4321
```
Then open http://localhost:4321.

## Before launch

- Remove the `<meta name="robots" content="noindex, nofollow">` line from `index.html` (it hides the demo from Google).
- `reservation.web3formsKey` in `content/settings.json` currently sends to a test inbox. Replace it with a key
  created for the restaurant's address (or switch to a server-side mailer).
- Connect the domain `goellnerskulinarium.de`, then rename the repo (e.g. to `goellnerskulinarium`).
