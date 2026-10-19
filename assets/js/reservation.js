// Reservation request: the guest picks a date and a time inside the opening hours, and the
// request is emailed to the restaurant via Web3Forms. No availability check: the restaurant
// confirms by replying to the guest. Without `reservation.web3formsKey` nothing is sent (demo mode).

function initReservation(site) {
  const cfg = site.reservation || {};
  const slotStep = cfg.slotMinutes || 30;
  const lastSeating = cfg.lastSeatingMinutesBeforeClose ?? 60;
  const lead = cfg.leadMinutes ?? 120;
  const closedDates = site.closedDates; // holidays / Betriebsferien from content/hours.json

  const dialog = document.getElementById('reserve');
  const form = document.getElementById('reserve-form');
  const done = document.getElementById('reserve-done');
  const dateBox = document.getElementById('r-dates');
  const guestBox = document.getElementById('r-guests');
  const timeBox = document.getElementById('r-times');
  const errorEl = document.getElementById('r-error');
  const submitBtn = form.querySelector('[type="submit"]');

  const pad = n => String(n).padStart(2, '0');
  const fmtTime = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  // Dates are midnight UTC timestamps for Berlin calendar days, so format them in UTC.
  const longDate = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const weekdayShort = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'short' });
  const dayMonth = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: 'numeric', month: 'short' });

  let days = [];

  function berlinToday() {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
        .formatToParts(new Date()).map(x => [x.type, x.value])
    );
    return Date.UTC(+p.year, +p.month - 1, +p.day);
  }

  // Bookable start times per opening slot, e.g. [[720, 750, 780], [1020, ...]].
  function timeGroups(date, isToday) {
    const weekday = (date.getUTCDay() + 6) % 7;
    const earliest = isToday ? berlinNow().minutes + lead : 0;
    return site.hours[weekday].slots
      .map(([open, close]) => {
        const times = [];
        for (let t = toMin(open); t <= toMin(close) - lastSeating; t += slotStep) {
          if (t >= earliest) times.push(t);
        }
        return times;
      })
      .filter(times => times.length);
  }

  function chip(name, value, html, { checked = false, disabled = false } = {}) {
    const label = document.createElement('label');
    label.className = disabled ? 'chip is-closed' : 'chip';
    label.innerHTML = `<input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${html}</span>`;
    return label;
  }

  function buildDates() {
    const start = berlinToday();
    days = [];
    for (let i = 0; i < (cfg.daysAhead || 30); i++) {
      const date = new Date(start + i * 864e5);
      const iso = date.toISOString().slice(0, 10);
      // Closed days stay visible (greyed out) so guests see why they can't pick them.
      const closed = !site.hours[(date.getUTCDay() + 6) % 7].slots.length ? 'Ruhetag'
        : closedDates.has(iso) ? 'Geschlossen' : null;
      const groups = closed ? [] : timeGroups(date, i === 0);
      if (!closed && !groups.length) continue; // today, but too late to book online
      days.push({ date, iso, offset: i, groups, closed });
    }
    dateBox.replaceChildren(...days.map(d => {
      const top = d.offset === 0 ? 'Heute' : d.offset === 1 ? 'Morgen' : weekdayShort.format(d.date).replace('.', '');
      const note = d.closed ? `<small class="chip-note">${d.closed}</small>` : '';
      return chip('date', d.iso, `<small>${top}</small>${dayMonth.format(d.date)}${note}`, { disabled: Boolean(d.closed) });
    }));
    dateBox.scrollLeft = 0;
  }

  function buildGuests() {
    const max = cfg.maxGuests || 8;
    guestBox.replaceChildren(...Array.from({ length: max }, (_, i) => chip('guests', i + 1, String(i + 1), { checked: i === 1 })));
  }

  function renderTimes(day) {
    if (!day) {
      timeBox.replaceChildren(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Bitte zuerst ein Datum wählen.' }));
      return;
    }
    const names = day.groups.length === 2 ? ['Mittag', 'Abend'] : [];
    timeBox.replaceChildren(...day.groups.flatMap((times, i) => {
      const row = document.createElement('div');
      row.className = 'chips';
      row.append(...times.map(t => chip('time', fmtTime(t), fmtTime(t))));
      if (!names[i]) return [row];
      return [Object.assign(document.createElement('p'), { className: 'chip-group', textContent: names[i] }), row];
    }));
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function open() {
    form.reset();
    form.hidden = false;
    done.hidden = true;
    errorEl.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
    buildDates();
    buildGuests();
    renderTimes(null);
    dialog.showModal();
    document.body.classList.add('modal-open');
  }

  form.addEventListener('input', () => { errorEl.hidden = true; });

  dateBox.addEventListener('change', () => {
    renderTimes(days.find(d => d.iso === form.elements.date.value));
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.hidden = true;
    const data = new FormData(form);
    const name = (data.get('name') || '').trim();
    const email = (data.get('email') || '').trim();
    const note = (data.get('note') || '').trim();
    const emailField = form.elements.email;
    const nameField = form.elements.name;

    const missing = [];
    if (!data.get('date')) missing.push('Datum');
    if (!data.get('time')) missing.push('Uhrzeit');
    nameField.toggleAttribute('aria-invalid', !name);
    if (!name) missing.push('Name');
    const emailOk = email && emailField.checkValidity();
    emailField.toggleAttribute('aria-invalid', !emailOk);
    if (!emailOk) missing.push('gültige E-Mail-Adresse');
    if (missing.length) return showError(`Bitte noch ergänzen: ${missing.join(', ')}.`);
    if (data.get('botcheck')) return; // honeypot filled in → bot

    const day = days.find(d => d.iso === data.get('date'));
    const guests = Number(data.get('guests'));
    const guestsLabel = `${guests} ${guests === 1 ? 'Person' : 'Personen'}`;
    const dateLabel = longDate.format(day.date);
    const time = data.get('time');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Wird gesendet …';
    try {
      if (cfg.web3formsKey) {
        const res = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: cfg.web3formsKey,
            subject: `Reservierungsanfrage: ${dateLabel}, ${time} Uhr – ${guestsLabel} – ${name}`,
            from_name: `Website ${site.contact.name}`,
            name,
            email, // Web3Forms sets this as reply-to, so the owner can answer the guest directly
            Datum: dateLabel,
            Uhrzeit: `${time} Uhr`,
            Personen: guestsLabel,
            Anmerkung: note || '–',
            botcheck: '',
          }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) throw new Error(result.message || res.status);
      } else {
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      document.getElementById('r-summary').textContent =
        `${name}, Ihre Anfrage für ${guestsLabel} am ${dateLabel} um ${time} Uhr ist bei uns eingegangen.`;
      document.getElementById('r-demo').hidden = Boolean(cfg.web3formsKey);
      form.hidden = true;
      done.hidden = false;
      done.querySelector('[data-close]').focus();
    } catch (err) {
      console.error('Reservierung fehlgeschlagen:', err);
      showError(`Das hat leider nicht geklappt. Bitte rufen Sie uns an: ${site.contact.phone}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tisch anfragen';
    }
  });

  dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => dialog.close()));
  document.querySelectorAll('[data-action="reserve"]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); open(); });
  });
  if (location.hash === '#reservieren') open();
}
