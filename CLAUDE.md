# Göllner's Kulinarium – Website

Static website for a German restaurant in Bischofsheim. No build step, no framework: plain HTML, CSS and JavaScript.
The people asking for changes are usually the restaurant owners, not developers. Answer them in simple German.

## Where things live

| What | File |
|---|---|
| Opening hours, phone, address, notice banner, "Über uns" text, highlight cards, social links | `content/site.json` |
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
- Keep JSON valid. After editing, check it with `python3 -m json.tool content/site.json`.
- Keep the design consistent: dark background, gold accents, Cormorant Garamond for headings, Jost for body text.
  Don't introduce new colours or fonts unless asked.
- New photos: compress to max. 1600 px wide, JPG, under ~400 KB.
- Don't load anything from third-party servers (Google Fonts, Maps embeds, tracking). The site is deliberately
  DSGVO-friendly; adding such things requires a cookie banner and Datenschutz changes.
- Don't change `impressum.html` or `datenschutz.html` without being explicitly asked. They are legal texts.

## Preview

```bash
python3 -m http.server 4321
```
Then open http://localhost:4321.

## Before launch

- Remove the `<meta name="robots" content="noindex, nofollow">` line from `index.html` (it hides the demo from Google).
