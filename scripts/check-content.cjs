#!/usr/bin/env node
// Checks the files in content/ before the website is published.
// Runs on GitHub for every change (.github/workflows/publish.yml); if it finds a problem,
// the change is not published and the old website stays online.
//
// Run locally: node scripts/check-content.cjs

const fs = require('fs');
const path = require('path');
const { CONTENT_FILES, WEEKDAYS, parseTimeRange, parseClosed, buildSite } = require('../assets/js/content.js');

const root = path.join(__dirname, '..');
const problems = [];
const report = (file, message) => problems.push(`content/${file}.json: ${message}`);

const isText = v => typeof v === 'string' && v.trim() !== '';
const isOptionalText = v => v === undefined || typeof v === 'string';

// "Unexpected token } in JSON at position 512" → line/column, so the owner can find the spot.
function syntaxHint(source, err) {
  const lineCol = /line (\d+) column (\d+)/.exec(err.message);
  if (lineCol) return `line ${lineCol[1]}, column ${lineCol[2]}`;
  const pos = /position (\d+)/.exec(err.message);
  if (!pos) return '';
  const before = source.slice(0, +pos[1]).split('\n');
  return `line ${before.length}, column ${before[before.length - 1].length + 1}`;
}

const data = {};
for (const name of CONTENT_FILES) {
  const file = path.join(root, 'content', `${name}.json`);
  if (!fs.existsSync(file)) { report(name, 'file is missing'); continue; }
  const source = fs.readFileSync(file, 'utf8');
  try {
    data[name] = JSON.parse(source);
  } catch (err) {
    const where = syntaxHint(source, err);
    report(name, `the file has a formatting error${where ? ` near ${where}` : ''}. ` +
      'Common causes: a missing or extra comma, a missing quote mark ("), or a missing bracket.');
  }
}

// --- texts.json ---------------------------------------------------------------
const t = data.texts;
if (t) {
  for (const key of ['eyebrow', 'title', 'subtitle']) if (!isText(t.hero?.[key])) report('texts', `"hero" needs a "${key}" text`);
  if (typeof t.notice?.show !== 'boolean') report('texts', '"notice" → "show" must be true or false (without quote marks)');
  if (t.notice?.show && !isText(t.notice.text)) report('texts', '"notice" is switched on but has no "text"');
  if (!isText(t.about?.title)) report('texts', '"about" needs a "title"');
  if (!Array.isArray(t.about?.paragraphs) || !t.about.paragraphs.every(isText)) report('texts', '"about" → "paragraphs" must be a list of texts in [ ]');
  for (const section of ['menu', 'offers', 'hours', 'contact']) if (!isText(t[section]?.title)) report('texts', `"${section}" needs a "title"`);
  if (!Array.isArray(t.offers?.cards)) report('texts', '"offers" → "cards" must be a list in [ ]');
  else t.offers.cards.forEach((c, i) => {
    if (!isText(c?.title) || !isText(c?.text)) report('texts', `offer card ${i + 1} needs a "title" and a "text"`);
  });
}

// --- hours.json ---------------------------------------------------------------
const h = data.hours;
if (h) {
  for (const [key] of WEEKDAYS) {
    const day = h.weekly?.[key];
    if (!Array.isArray(day)) { report('hours', `"${key}" is missing or not a list in [ ] (use [] for a closed day)`); continue; }
    day.forEach(range => {
      if (!parseTimeRange(range)) report('hours', `"${key}": "${range}" is not a valid time range – write it like "12:00-14:00"`);
    });
  }
  if (!Array.isArray(h.closed)) report('hours', '"closed" must be a list in [ ] (it can be empty: [])');
  else h.closed.forEach(entry => {
    if (!parseClosed(entry)) report('hours', `"closed": "${entry}" is not a valid date – write "24.12.2026" or "27.07.2026 - 09.08.2026"`);
  });
  if (!isOptionalText(h.note)) report('hours', '"note" must be a text');
}

// --- menu.json ----------------------------------------------------------------
const m = data.menu;
if (m) {
  if (!isOptionalText(m.note)) report('menu', '"note" must be a text');
  if (!Array.isArray(m.categories) || !m.categories.length) report('menu', '"categories" must be a list in [ ] with at least one category');
  else m.categories.forEach((cat, i) => {
    const where = isText(cat?.name) ? `category "${cat.name}"` : `category ${i + 1}`;
    if (!isText(cat?.name)) report('menu', `${where} needs a "name"`);
    if (!Array.isArray(cat?.items)) { report('menu', `${where}: "items" must be a list in [ ]`); return; }
    cat.items.forEach((item, j) => {
      const dish = isText(item?.name) ? `"${item.name}"` : `dish ${j + 1}`;
      if (!isText(item?.name)) report('menu', `${where}, ${dish} needs a "name"`);
      if (!isOptionalText(item?.description)) report('menu', `${where}, ${dish}: "description" must be a text`);
      if (typeof item?.price !== 'string' || !/^(\d{1,4}(,\d{2})?)?$/.test(item.price.trim())) {
        report('menu', `${where}, ${dish}: price "${item?.price}" should look like "18,90" (in quote marks, comma, no €)`);
      }
      if (item?.tags !== undefined && !(Array.isArray(item.tags) && item.tags.every(isText))) {
        report('menu', `${where}, ${dish}: "tags" must be a list of texts like ["vegetarisch"]`);
      }
    });
  });
}

// --- contact.json -------------------------------------------------------------
const c = data.contact;
if (c) {
  for (const key of ['name', 'phone', 'email', 'street', 'zip', 'city']) if (!isText(c[key])) report('contact', `"${key}" is missing`);
  if (isText(c.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) report('contact', `"email" "${c.email}" doesn't look like an email address`);
  if (isText(c.phone) && c.phone.replace(/\D/g, '').length < 6) report('contact', `"phone" "${c.phone}" looks too short`);
  for (const key of ['instagram', 'facebook']) {
    if (c[key] !== undefined && c[key] !== '' && !/^https:\/\//.test(c[key])) report('contact', `"${key}" must be a full link starting with https:// (or "" to hide it)`);
  }
}

// --- images.json --------------------------------------------------------------
const img = data.images;
if (img) {
  // Exact name match: GitHub's servers treat "Foto.JPG" and "foto.jpg" as different files.
  const dir = path.join(root, 'content', 'images');
  const available = new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  const checkFile = (file, where) => {
    if (!isText(file)) { report('images', `${where}: "file" is missing`); return; }
    if (!available.has(file)) {
      report('images', `${where}: "${file}" was not found in content/images/ – check the spelling, including upper/lower case`);
    }
  };
  checkFile(img.hero, '"hero"');
  for (const size of ['large', 'small']) checkFile(img.about?.[size]?.file, `"about" → "${size}"`);
  if (!Array.isArray(img.gallery)) report('images', '"gallery" must be a list in [ ]');
  else img.gallery.forEach((g, i) => checkFile(g?.file, `gallery photo ${i + 1}`));
}

// --- settings.json ------------------------------------------------------------
const s = data.settings;
if (s) {
  const r = s.reservation || {};
  for (const key of ['slotMinutes', 'lastSeatingMinutesBeforeClose', 'leadMinutes', 'daysAhead', 'maxGuests']) {
    if (!Number.isInteger(r[key]) || r[key] < 0) report('settings', `"reservation" → "${key}" must be a whole number (without quote marks)`);
  }
  if (typeof r.web3formsKey !== 'string') report('settings', '"reservation" → "web3formsKey" must be a text ("" = demo mode)');
  if (!isOptionalText(s.menuGoogleSheetCsv) || (s.menuGoogleSheetCsv && !/^https:\/\//.test(s.menuGoogleSheetCsv))) {
    report('settings', '"menuGoogleSheetCsv" must be "" or a link starting with https://');
  }
}

// Finally: can the website actually be built from these files?
if (!problems.length) {
  try { buildSite(data); } catch (err) { problems.push(`The website could not read the content: ${err.message}`); }
}

if (problems.length) {
  console.error(`\n✗ Found ${problems.length} problem${problems.length > 1 ? 's' : ''}. The website was NOT updated – the previous version stays online.\n`);
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nFix the file(s) above and save again.\n');
  process.exit(1);
}
console.log('✓ All content files are OK.');
