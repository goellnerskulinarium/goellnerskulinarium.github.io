# Editing the website

Everything you can change on the website is in this folder.

| File | What's in it |
|---|---|
| `menu.json` | The menu: categories, dishes, prices |
| `hours.json` | Opening hours, extra closing days (holidays, Betriebsferien) |
| `texts.json` | Headline, banner, "Über uns", offer cards, section titles |
| `contact.json` | Name, phone, email, address, Instagram/Facebook |
| `images.json` | Which photo is shown where |
| `images/` | The photos themselves |
| `settings.json` | Technical settings – usually no need to touch |

## How to change something

1. Click the file, then the **pencil icon** (top right).
2. Change the text between the quote marks `" "`.
3. Click **Commit changes…** and confirm.

The website updates after 1–2 minutes. If something in the file is broken, the change is **not** published,
the old website stays online, and you get an email from GitHub saying what's wrong.

## Rules

- Text always goes in quote marks: `"Jägerschnitzel"`
- Between entries there is a comma – but **not** after the last one in a list or block.
- Prices with a comma and without €: `"18,90"`
- Times as `"12:00-14:00"`, dates as `"24.12.2026"`
- `true` / `false` and numbers go **without** quote marks.

## Examples

**Change a price** (`menu.json`):
```json
{ "name": "Jägerschnitzel", "description": "Pilzrahmsauce, Bratkartoffeln", "price": "19,50" },
```

**Add a dish** – copy an existing line, change it, keep the comma between dishes:
```json
{ "name": "Rinderroulade", "description": "Rotkohl, Klöße", "price": "23,50" },
```

**Mark a dish** as vegetarian, vegan etc.:
```json
{ "name": "Kürbissuppe", "description": "Kürbiskernöl", "price": "7,50", "tags": ["vegetarisch"] },
```

**Several sizes** – leave `price` empty, the website shows "ab 36,90 €" and the sizes below:
```json
{ "name": "Rumpsteak", "description": "…", "price": "",
  "sizes": [{ "size": "200 g", "price": "36,90" }, { "size": "300 g", "price": "42,90" }] },
```

**Extra for a surcharge** – shown as "mit Baguette + 3,00 €":
```json
{ "name": "Marinierte Oliven", "description": "…", "price": "9,90",
  "extras": [{ "name": "mit Baguette", "price": "3,00" }] },
```

**Closed on extra days** (`hours.json`) – single days or a range:
```json
"closed": ["24.12.2026", "31.12.2026", "27.07.2027 - 09.08.2027"],
```
These days are shown on the website and can't be booked in the reservation form.

**Change opening hours** (`hours.json`) – `[]` means closed (Ruhetag):
```json
"monday": [],
"friday": ["12:00-14:00", "17:00-22:00"],
```

**Show or hide the banner** at the top (`texts.json`):
```json
"notice": { "show": true, "text": "Am 24.12. haben wir geschlossen." },
```
Set `"show": false` to hide it.

**New photo**:
1. Open the `images` folder → **Add file** → **Upload files**, upload the photo (JPG, ideally under 1 MB).
2. In `images.json`, put its exact file name where it should appear, e.g. `"hero": "terrasse.jpg"`.
