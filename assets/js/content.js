// Loads the files in content/ and turns them into the shape the page code uses.
// scripts/check-content.cjs requires this file too, so the checker accepts exactly
// what the website understands.

const CONTENT_FILES = ['texts', 'hours', 'menu', 'contact', 'images', 'settings'];
const WEEKDAYS = [
  ['monday', 'Montag'], ['tuesday', 'Dienstag'], ['wednesday', 'Mittwoch'], ['thursday', 'Donnerstag'],
  ['friday', 'Freitag'], ['saturday', 'Samstag'], ['sunday', 'Sonntag'],
];
const IMAGE_DIR = 'content/images/';

const minutesOf = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// "12:00-14:00" → ["12:00", "14:00"], or null if it isn't a valid range.
function parseTimeRange(text) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})\s*$/.exec(String(text));
  if (!m || +m[1] > 23 || +m[2] > 59 || +m[3] > 24 || +m[4] > 59) return null;
  const open = `${m[1].padStart(2, '0')}:${m[2]}`;
  const close = `${m[3].padStart(2, '0')}:${m[4]}`;
  return minutesOf(open) < minutesOf(close) ? [open, close] : null;
}

function utcDate(year, month, day) {
  const t = Date.UTC(+year, +month - 1, +day);
  const d = new Date(t);
  return d.getUTCFullYear() === +year && d.getUTCMonth() === +month - 1 && d.getUTCDate() === +day ? t : null;
}

// "24.12.2026" or "27.07.2026 - 09.08.2026" → list of ISO dates ("2026-12-24", …), or null if invalid.
function parseClosed(text) {
  const date = '(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})';
  const m = new RegExp(`^\\s*${date}\\s*(?:[-–]\\s*${date}\\s*)?$`).exec(String(text));
  if (!m) return null;
  const start = utcDate(m[3], m[2], m[1]);
  const end = m[4] ? utcDate(m[6], m[5], m[4]) : start;
  if (start == null || end == null || end < start || end - start > 366 * 864e5) return null;
  const days = [];
  for (let t = start; t <= end; t += 864e5) days.push(new Date(t).toISOString().slice(0, 10));
  return days;
}

// "06144 89878" → "+49614489878" (German numbers without country code get +49).
function phoneLink(phone) {
  const digits = String(phone).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0')) return `+49${digits.slice(1)}`;
  return digits;
}

function buildSite(c) {
  const contact = c.contact;
  const place = `${contact.street} ${contact.zip} ${contact.city}`;
  return {
    texts: c.texts,
    menu: c.menu,
    images: c.images,
    contact: {
      ...contact,
      phoneLink: phoneLink(contact.phone),
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${contact.name} ${place}`)}`,
    },
    hours: WEEKDAYS.map(([key, label]) => ({
      day: label,
      slots: (c.hours.weekly[key] || []).map(parseTimeRange).filter(Boolean),
    })),
    hoursNote: c.hours.note || '',
    closed: (c.hours.closed || []).map(text => ({ text, days: parseClosed(text) || [] })),
    closedDates: new Set((c.hours.closed || []).flatMap(text => parseClosed(text) || [])),
    reservation: c.settings.reservation,
    menuCsv: c.settings.menuGoogleSheetCsv,
  };
}

async function loadContent() {
  const entries = await Promise.all(CONTENT_FILES.map(async name => {
    const res = await fetch(`content/${name}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`content/${name}.json: ${res.status}`);
    return [name, await res.json()];
  }));
  return buildSite(Object.fromEntries(entries));
}

if (typeof module !== 'undefined') {
  module.exports = { CONTENT_FILES, WEEKDAYS, IMAGE_DIR, parseTimeRange, parseClosed, phoneLink, buildSite };
}
