// Fills the page from the files in content/ (loaded by content.js).
// Text and photos live in those files (or a published Google Sheet), never in index.html.

const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// --- Site content -----------------------------------------------------------

function renderSite(site) {
  document.querySelectorAll('[data-bind]').forEach(el => {
    const value = get(site, el.dataset.bind);
    if (value != null) el.textContent = value;
  });

  const links = {
    tel: `tel:${site.contact.phoneLink}`,
    mail: `mailto:${site.contact.email}`,
    maps: site.contact.mapsUrl,
    instagram: site.contact.instagram,
    facebook: site.contact.facebook,
  };
  document.querySelectorAll('[data-href]').forEach(el => {
    const href = links[el.dataset.href];
    if (href) el.href = href; else el.hidden = true;
  });

  const { notice, about, offers } = site.texts;
  document.getElementById('notice').hidden = !(notice && notice.show && notice.text);

  document.getElementById('about-paragraphs').replaceChildren(
    ...about.paragraphs.map(text => Object.assign(document.createElement('p'), { textContent: text }))
  );

  document.getElementById('highlights').replaceChildren(...offers.cards.map(h => {
    const card = document.createElement('article');
    card.className = 'card reveal';
    card.innerHTML = '<h3></h3><p></p>';
    card.querySelector('h3').textContent = h.title;
    card.querySelector('p').textContent = h.text;
    return card;
  }));

  renderImages(site.images);
  renderHours(site);
}

function renderImages(images) {
  const src = file => IMAGE_DIR + file;
  document.querySelector('.hero-bg').style.backgroundImage = `url('${src(images.hero)}')`;
  for (const [id, img] of [['about-large', images.about.large], ['about-small', images.about.small]]) {
    Object.assign(document.getElementById(id), { src: src(img.file), alt: img.alt || '' });
  }
  document.getElementById('gallery').replaceChildren(...images.gallery.map(img =>
    Object.assign(document.createElement('img'), { src: src(img.file), alt: img.alt || '', loading: 'lazy' })
  ));
}

// --- Opening hours ----------------------------------------------------------

function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map(p => [p.type, p.value])
  );
  return { day: DAYS_EN.indexOf(parts.weekday), minutes: +parts.hour * 60 + +parts.minute };
}

const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// Berlin calendar date `offset` days from today, as "YYYY-MM-DD".
function berlinISODate(offset = 0) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value])
  );
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day + offset)).toISOString().slice(0, 10);
}

function renderHours(site) {
  const { hours, closedDates } = site;
  const now = berlinNow();
  const table = document.getElementById('hours');
  table.replaceChildren(...hours.map((d, i) => {
    const tr = document.createElement('tr');
    if (!d.slots.length) tr.classList.add('closed');
    if (i === now.day) tr.classList.add('today');
    const th = Object.assign(document.createElement('th'), { scope: 'row', textContent: d.day });
    const td = Object.assign(document.createElement('td'), {
      textContent: d.slots.length ? d.slots.map(s => `${s[0]} – ${s[1]}`).join('  ·  ') : 'Ruhetag',
    });
    tr.append(th, td);
    return tr;
  }));

  // Upcoming closures (holidays, Betriebsferien) under the table; past ones are hidden.
  const today = berlinISODate();
  const upcoming = site.closed.filter(c => c.days.length && c.days[c.days.length - 1] >= today);
  const closures = document.getElementById('closures');
  closures.textContent = upcoming.length ? `Zusätzlich geschlossen: ${upcoming.map(c => c.text.trim().replace(/\s*[-–]\s*/, ' – ')).join(' · ')}` : '';
  closures.hidden = !upcoming.length;

  const status = document.getElementById('open-status');
  const todaySlots = closedDates.has(today) ? [] : hours[now.day].slots;
  const current = todaySlots.find(([a, b]) => now.minutes >= toMin(a) && now.minutes < toMin(b));
  if (current) {
    status.textContent = `Jetzt geöffnet · bis ${current[1]} Uhr`;
    status.classList.add('open');
  } else {
    status.textContent = `Gerade geschlossen · ${nextOpening(hours, closedDates, now)}`;
  }
  status.hidden = false;
}

function nextOpening(hours, closedDates, now) {
  for (let offset = 0; offset < 60; offset++) {
    if (closedDates.has(berlinISODate(offset))) continue;
    const idx = (now.day + offset) % 7;
    const slot = hours[idx].slots.find(([a]) => offset > 0 || toMin(a) > now.minutes);
    if (slot) {
      const date = new Date(`${berlinISODate(offset)}T00:00:00Z`)
        .toLocaleDateString('de-DE', { timeZone: 'UTC', day: 'numeric', month: 'numeric' });
      const when = offset === 0 ? 'heute' : offset === 1 ? 'morgen' : offset < 7 ? `am ${hours[idx].day}` : `am ${hours[idx].day}, ${date}`;
      return `öffnet ${when} um ${slot[0]} Uhr`;
    }
  }
  return 'Öffnungszeiten siehe unten';
}

// --- Menu -------------------------------------------------------------------

// Google Sheet → File → Share → Publish to web → CSV. Columns:
// Kategorie | Gericht | Beschreibung | Preis | Hinweis
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function menuFromCSV(text) {
  const [, ...rows] = parseCSV(text);
  const categories = [];
  for (const [cat, name, description, price, note] of rows) {
    if (!cat || !name) continue;
    let group = categories.find(c => c.name === cat.trim());
    if (!group) categories.push(group = { name: cat.trim(), items: [] });
    group.items.push({
      name: name.trim(), description: (description || '').trim(), price: (price || '').trim(),
      tags: note ? note.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
  }
  return { categories };
}

const formatPrice = p => {
  if (p === '' || p == null) return '';
  const s = String(p).replace('€', '').trim();
  return `${s} €`;
};

function renderMenu(menu) {
  const tabs = document.getElementById('menu-tabs');
  const panels = document.getElementById('menu-panels');
  tabs.replaceChildren(); panels.replaceChildren();

  menu.categories.forEach((cat, i) => {
    const id = `menu-${i}`;
    const tab = Object.assign(document.createElement('button'), {
      className: 'menu-tab', type: 'button', textContent: cat.name, id: `${id}-tab`,
    });
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', id);
    tab.setAttribute('aria-selected', String(i === 0));

    const panel = Object.assign(document.createElement('div'), { className: 'menu-panel', id, hidden: i !== 0 });
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);

    for (const item of cat.items) {
      const dish = document.createElement('div');
      dish.className = 'dish';
      dish.innerHTML = '<div class="dish-top"><h3 class="dish-name"></h3><span class="dish-line"></span><span class="dish-price"></span></div><p class="dish-desc"></p>';
      const nameEl = dish.querySelector('.dish-name');
      nameEl.textContent = item.name;
      for (const t of item.tags || []) {
        nameEl.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: t }));
      }
      dish.querySelector('.dish-price').textContent = formatPrice(item.price);
      const desc = dish.querySelector('.dish-desc');
      if (item.description) desc.textContent = item.description; else desc.remove();
      panel.append(dish);
    }

    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.menu-tab').forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      panels.querySelectorAll('.menu-panel').forEach(p => { p.hidden = p !== panel; });
    });
    tabs.append(tab); panels.append(panel);
  });

  document.getElementById('menu-note').textContent = menu.note || '';
}

async function loadMenu(site) {
  const csvUrl = site.menuCsv;
  const fallback = site.menu;
  if (!csvUrl) return fallback;
  try {
    const res = await fetch(csvUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const menu = menuFromCSV(await res.text());
    if (!menu.categories.length) throw new Error('empty sheet');
    return { ...menu, note: fallback.note };
  } catch (err) {
    console.warn('Google Sheet could not be loaded, using content/menu.json:', err);
    return fallback;
  }
}

// --- UI ---------------------------------------------------------------------

function setupUI() {
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('nav');
  const setOpen = open => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });

  // In-page links scroll without writing #section into the URL, so a reload starts at the top
  // instead of jumping back to the last clicked section.
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]:not([data-action]):not(.skip)');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const target = id === 'top' ? document.body : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (id === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('year').textContent = new Date().getFullYear();
}

function setupReveal() {
  document.querySelectorAll('.section-head, .about-text, .about-media, .visit-grid > *').forEach(el => el.classList.add('reveal'));
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

// Deep links (e.g. …/#speisekarte) still work, but only once: jump after the content has
// rendered (so the position is right), then drop the hash so a reload starts at the top.
function handleInitialHash() {
  const id = location.hash.slice(1);
  if (!id) return;
  const target = id !== 'reservieren' && document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: 'instant' });
  history.replaceState(null, '', location.pathname + location.search);
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

(async function init() {
  setupUI();
  try {
    const site = await loadContent();
    renderSite(site);
    initReservation(site);
    renderMenu(await loadMenu(site));
  } catch (err) {
    console.error(err);
  }
  setupReveal();
  handleInitialHash();
})();
