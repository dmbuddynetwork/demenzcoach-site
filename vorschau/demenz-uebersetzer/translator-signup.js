// E-Mail-Liste unter der Antwort (Daniel, 8. Nov 2026): eigene Brevo-Liste „Demenz-Übersetzer“
// mit Double-Opt-in; die Willkommensmail bringt die Liste mit allen Sätzen zum Ausdrucken.
// Brevo-Formular „Demenz-Übersetzer (DE)“; der Bestätigungslink führt zurück auf ?bestaetigt.
// Ist formURL leer, erscheint kein Kasten.
// Gesendet wird nur, was die Person selbst ins E-Mail-Feld tippt, und nur beim Absenden.
// Der übersetzte Satz, die KI-Antwort oder sonst etwas von der Seite gehen nie an Brevo.
(function (root) {
  const formURL = 'https://dec91d68.sibforms.com/serve/MUIFALjTPrtulR3_pbWZasFlp2rp0I3qK7mXYVC3KPxVznmdzl5zJcBcHNQiuQXilaqGKzd7Y81EDGqt0Ho9tpwQ03SIAGBPrNlnZmT4-JP71DtgDYfd8GrQ11Bg7dNW8tibwtNvt9az78pC4_-kaczKbgGgb_IXoNCZKWhxM8olcup0XJhMqKiLQmUhpO6tpo4UNTUP3JXYHknJrg==';

  // Häufige Tippfehler in der E-Mail-Domain (wie auf /teller/).
  const typos = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.de': 'gmail.com',
    'gmail.con': 'gmail.com', 'gmx.dee': 'gmx.de', 'gxm.de': 'gmx.de', 'gmx.d': 'gmx.de', 'web.d': 'web.de', 'wed.de': 'web.de',
    'web.dee': 'web.de', 'weg.de': 'web.de', 'tonline.de': 't-online.de', 't-onlin.de': 't-online.de'
  };
  const suggest = (value) => {
    const at = value.lastIndexOf('@');
    if (at < 1) return '';
    const domain = value.slice(at + 1).toLowerCase();
    const fix = typos[domain] || (/\.con$/.test(domain) ? domain.replace(/\.con$/, '.com') : '');
    return fix ? value.slice(0, at + 1) + fix : '';
  };
  const inboxes = [
    [/^(gmail|googlemail)\./, 'https://mail.google.com/mail/u/0/#search/from%3Adementiacoachapp.com', 'Gmail öffnen'],
    [/^web\.de$/, 'https://web.de/', 'WEB.DE öffnen'],
    [/^gmx\./, 'https://www.gmx.net/', 'GMX öffnen'],
    [/^t-online\.de$/, 'https://email.t-online.de/', 'T-Online Mail öffnen'],
    [/^yahoo\./, 'https://mail.yahoo.com/', 'Yahoo Mail öffnen'],
    [/^(outlook|hotmail|live|msn)\./, 'https://outlook.live.com/mail/', 'Outlook öffnen'],
    [/^(icloud|me|mac)\.com$/, 'https://www.icloud.com/mail', 'iCloud Mail öffnen']
  ];

  let counter = 0;
  let signedUp = false;

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  // track: optionale Messfunktion der Seite; sie bekommt nur feste Schritte, nie die Adresse.
  const box = (track = () => {}) => {
    if (!formURL || signedUp) return null;
    counter += 1;
    const id = `translator-email-${counter}`;
    const wrap = make('aside', 'translator-signup');
    wrap.setAttribute('aria-label', 'Kostenlose Liste per E-Mail');
    const form = make('form', 'translator-signup-form');
    form.noValidate = true;
    const label = make('label', '', 'Alle Sätze mit Antworten als Liste zum Ausdrucken. Kostenlos per E-Mail:');
    label.htmlFor = id;
    const input = make('input');
    Object.assign(input, { id, type: 'email', name: 'EMAIL', autocomplete: 'email', placeholder: 'Deine E-Mail-Adresse', required: true });
    input.setAttribute('inputmode', 'email');
    const button = make('button', 'button', 'Liste kostenlos holen');
    button.type = 'submit';
    const small = make('small', '', 'Ab und zu ein neuer Satz mit Antwort. Abmelden mit einem Klick. ');
    const privacy = make('a', 'text-link', 'Datenschutz');
    privacy.href = '/datenschutz.html#e-mail-liste';
    small.append(privacy);
    const status = make('p', 'translator-signup-status');
    status.setAttribute('role', 'status');
    form.append(label, input, button, small);
    wrap.append(form, status);

    let typoShown = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value || !input.checkValidity()) {
        status.textContent = 'Bitte gib deine E-Mail-Adresse ein.';
        input.focus();
        return;
      }
      const better = suggest(value);
      if (better && !typoShown) {
        typoShown = true;
        status.textContent = 'Meintest du ';
        const fix = make('button', 'text-link', better);
        fix.type = 'button';
        fix.addEventListener('click', () => { input.value = better; status.textContent = ''; input.focus(); });
        status.append(fix, '?');
        return;
      }
      const data = new FormData();
      data.append('EMAIL', value);
      data.append('email_address_check', '');
      data.append('locale', 'de');
      button.disabled = true;
      status.textContent = 'Einen Moment …';
      let ok = false;
      try {
        const response = await fetch(formURL, { method: 'POST', body: data, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
        const json = await response.json().catch(() => ({ success: response.ok }));
        ok = Boolean(json?.success);
      } catch {
        ok = false;
      }
      if (!ok) {
        button.disabled = false;
        status.textContent = 'Das hat leider nicht geklappt. Bitte prüf deine E-Mail-Adresse und versuch es noch einmal.';
        track('failed');
        return;
      }
      signedUp = true;
      track('sent');
      const domain = value.split('@').pop().toLowerCase();
      const inbox = inboxes.find(([pattern]) => pattern.test(domain));
      const done = make('div', 'translator-signup-done');
      done.append(
        make('strong', '', 'Fast geschafft!'),
        make('p', '', 'Wir haben dir eine E-Mail geschickt. Bitte tippe dort auf den Link zum Bestätigen. Danach kommt die Liste.')
      );
      if (inbox) {
        const link = make('a', 'text-link', inbox[2]);
        link.href = inbox[1];
        link.target = '_blank';
        link.rel = 'noopener';
        done.append(link);
      }
      wrap.replaceChildren(done);
    });
    return wrap;
  };

  // Rückkehr aus dem Bestätigungslink: kurz danken, kein weiterer Anmeldekasten.
  if (new URLSearchParams(location.search).has('bestaetigt')) {
    signedUp = true;
    const note = make('div', 'translator-signup-done translator-signup-confirmed');
    note.setAttribute('role', 'status');
    note.append(make('strong', '', 'Danke, du bist dabei!'), make('p', '', 'Die Liste mit Sätzen und Antworten ist unterwegs in dein Postfach.'));
    const form = document.getElementById('translator-form');
    if (form) form.before(note);
    history.replaceState(null, '', location.pathname + location.hash);
  }

  root.DemenzTranslatorSignup = { box, formURL };
})(window);
