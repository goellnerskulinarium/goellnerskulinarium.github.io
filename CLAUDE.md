# Göllner's Kulinarium – Website

Static website for a German restaurant in Bischofsheim. No build step, no framework: plain HTML, CSS and JavaScript.
The people asking for changes are usually the restaurant owners, not developers. Answer them in simple German.

## Where things live

| What | File |
|---|---|
| Opening hours, phone, address, notice banner, "Über uns" text, highlight cards, social links | `content/site.json` |
| Reservation form settings (time slots, closed dates, email key) | `content/site.json` → `reservation` |
| Menu (Speisekarte) | `content/menu.json`, or a Google Sheet if `sources.menuCsv` in `site.json` is set |
| Page structure | `index.html` |
| Colours, fonts, layout | `assets/css/style.css` (colour tokens at the top in `:root`) |
| Photos and logo | `assets/img/` |
| Impressum / Datenschutz | `impressum.html`, `datenschutz.html` |

## Rules for changes

- Text changes (prices, dishes, hours, the notice banner) go into the JSON files. Never hard-code content into `index.html`.
- To hide the notice banner, set `"notice": { "active": false }`. Don't delete it.
- Closed days use `"slots": []`. Times are `"HH:MM"`, 24-hour clock.
- Prices are strings with a German decimal comma, without "€", e.g. `"18,90"`.
- After changing any CSS or JS file, bump the `?v=` number on its `<link>`/`<script>` tags in all HTML files,
  otherwise phones keep using the cached old file (GitHub Pages caches for 10 minutes).
- Keep JSON valid. After editing, check it with `python3 -m json.tool content/site.json`.
- Keep the design consistent: dark background, gold accents, Cormorant Garamond for headings, Jost for body text.
  Don't introduce new colours or fonts unless asked.
- New photos: compress to max. 1600 px wide, JPG, under ~400 KB.
- Don't load anything from third-party servers (Google Fonts, Maps embeds, tracking). The site is deliberately
  DSGVO-friendly; adding such things requires a cookie banner and Datenschutz changes.
- Don't change `impressum.html` or `datenschutz.html` without being explicitly asked. They are legal texts.

## Reservation form

"Tisch reservieren" opens a request form (`assets/js/reservation.js`). Guests pick a date and a time
within the opening hours; the request is emailed to the restaurant via Web3Forms. There is no live
availability: the restaurant confirms by replying to the guest's email.

- Holidays / Betriebsferien: add dates to `reservation.closedDates`, e.g. `"2026-12-24"`.
- `lastSeatingMinutesBeforeClose`: last bookable time before closing (60 → kitchen closes 21:30, last slot 20:30).
- `leadMinutes`: how far ahead same-day requests must be made.
- `web3formsKey` empty = demo mode: the form shows a confirmation but sends nothing.

## Preview

```bash
python3 -m http.server 4321
```
Then open http://localhost:4321.

## Before launch

- Remove the `<meta name="robots" content="noindex, nofollow">` line from `index.html` (it hides the demo from Google).
- Set `reservation.web3formsKey` in `content/site.json`. Create the key at web3forms.com with the restaurant's
  email address; requests are sent to that address. Without it, reservations are silently not sent.
