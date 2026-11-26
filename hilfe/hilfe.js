// Verkaufsseite /hilfe/ (A/B-Test gegen /start/, Daniel, 26. Nov 2026). Nur Darstellung und Weitergabe an den Fragebogen:
// Eintritt über dieselben Bildkarten wie /start/ (start/inline-entry.js), Stimmen aus start/stimmen.js, Messung über DemenzConsent.
// Ohne Skript bleiben alle Knöpfe normale Links auf /start/.
import { createInlineEntry } from '/start/inline-entry.js';

const params = new URLSearchParams(location.search);
const clean = (value, max = 30) => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, max);
const guessApp = () => {
  const agent = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|FBIOS/u.test(agent)) return 'fb_app';
  if (/Instagram/u.test(agent)) return 'ig_app';
  if (/musical_ly|BytedanceWebview|TikTok/iu.test(agent)) return 'tiktok_app';
  return 'ads';
};
// Quelle für den Fragebogen: „lp_“ + Kanal. So sind die Besucher dieser Seite in Statistik und Kasse vom alten Weg getrennt.
const channel = clean(params.get('src') || params.get('utm_source')) || guessApp();
const source = `lp_${channel}`.slice(0, 30);

const track = (name, extra = {}) => {
  try { window.DemenzConsent?.track?.(name, { entry: source, ...extra }); } catch { /* ohne Einwilligung nichts */ }
};

// Knöpfe: Adresse mit Quelle und Kampagnen-Angaben (k, a, utm_*) ergänzen.
const startUrl = () => {
  const url = new URL('/start/', location.origin);
  url.searchParams.set('src', source);
  for (const [key, value] of params) if (key === 'k' || key === 'a' || key.startsWith('utm_')) url.searchParams.set(key, value);
  return url.pathname + url.search;
};
for (const link of document.querySelectorAll('a[data-go]')) {
  link.href = startUrl();
  link.addEventListener('click', () => track('lp_cta_click', { where: link.dataset.go }));
}

// Eintritt: dieselbe erste Frage wie im Fragebogen („Für wen suchst du Hilfe?“). Ein Tipp geht direkt weiter.
for (const id of ['entry-top', 'entry-bottom']) {
  const slot = document.getElementById(id);
  if (!slot) continue;
  try {
    const entry = createInlineEntry(document, { source });
    entry.addEventListener('click', event => { if (event.target.closest('[data-relation]')) track('lp_entry_click', { where: id }); }, true);
    slot.replaceChildren(entry);
    slot.classList.add('is-ready');
  } catch { /* Der Link bleibt. */ }
}

// Beispiel-Situationen als Reiter.
const tabs = [...document.querySelectorAll('.lp-tabs [role="tab"]')];
const select = (tab, focus) => {
  for (const item of tabs) {
    const on = item === tab;
    item.setAttribute('aria-selected', String(on)); item.tabIndex = on ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
};
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => { select(tab); track('lp_example', { item: tab.id.replace('tab-', '') }); });
  tab.addEventListener('keydown', event => {
    const next = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (next) { event.preventDefault(); select(tabs[(index + next + tabs.length) % tabs.length], true); }
  });
});

// Stimmen: echte Texte (start/stimmen.js, Vornamen mit Zustimmung). Keine Sterne, keine Zahlen.
const voices = Array.isArray(window.DemenzStimmen) ? window.DemenzStimmen : [];
const section = document.getElementById('stimmen');
if (voices.length && section) {
  const card = (voice, clamp) => {
    const figure = document.createElement(clamp ? 'figure' : 'li');
    figure.className = 'lp-voice'; if (clamp) figure.setAttribute('role', 'listitem');
    const name = document.createElement('strong'); name.textContent = `${voice.name}, ${voice.rolle}`;
    const text = document.createElement('p'); text.textContent = `„${voice.text}“`;
    figure.append(name, text);
    if (clamp && voice.text.length > 150) {
      text.classList.add('is-clamped');
      const more = document.createElement('button'); more.type = 'button'; more.className = 'lp-link'; more.textContent = 'Mehr lesen'; more.setAttribute('aria-expanded', 'false');
      more.addEventListener('click', () => {
        const open = text.classList.toggle('is-clamped') === false;
        more.textContent = open ? 'Weniger' : 'Mehr lesen'; more.setAttribute('aria-expanded', String(open));
      });
      figure.append(more);
    }
    return figure;
  };
  document.getElementById('voices').append(...[0, 2, 3, 5, 10, 48, 49, 8].map(index => voices[index]).filter(Boolean).map(voice => card(voice, true)));
  document.getElementById('voices-all').append(...voices.map(voice => card(voice, false)));
  document.getElementById('voices-all-title').textContent = `Alle ${voices.length} Stimmen lesen`;
  section.hidden = false;
}

// Ein Ereignis, wenn jemand bis zum Preisabschnitt liest (ohne Einwilligung passiert nichts).
const trust = document.querySelector('.lp-trust');
if (trust && 'IntersectionObserver' in window) {
  const watcher = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { track('lp_read_price'); watcher.disconnect(); }
  }, { threshold: .5 });
  watcher.observe(trust);
}
