// Verkaufsseite /hilfe/ (A/B-Test gegen /start/, Daniel, 26. Nov 2026). Nur Darstellung und Weitergabe an den Fragebogen:
// Live-Demo mit Sätzen aus abo/plan-data.js, Eintritt über dieselben Bildkarten wie /start/ (start/inline-entry.js),
// Stimmen aus start/stimmen.js, Messung über DemenzConsent. Ohne Skript bleiben alle Knöpfe normale Links auf /start/.
import '/abo/plan-data.js';
import { createInlineEntry } from '/start/inline-entry.js';

const $ = id => document.getElementById(id);
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

const data = window.DEMENZ_PLAN_DATA || {};
const items = [...(data.situations || []), ...(data.weeks || [])].filter(item => item.key && item.say?.length);
const moments = new Set((data.situations || []).filter(item => item.say).map(item => item.key));
let chosen = 'nachhause';

// Knöpfe: Adresse mit Quelle, gewählter Situation (m) und Kampagnen-Angaben (k, a, utm_*).
const startUrl = () => {
  const url = new URL('/start/', location.origin);
  url.searchParams.set('src', source);
  if (moments.has(chosen)) url.searchParams.set('m', chosen);
  for (const [key, value] of params) if (key === 'k' || key === 'a' || key.startsWith('utm_')) url.searchParams.set(key, value);
  return url.pathname + url.search;
};
const links = () => document.querySelectorAll('a[data-go]');
for (const link of links()) link.addEventListener('click', () => track('lp_cta_click', { where: link.dataset.go }));
const syncLinks = () => { for (const link of links()) link.href = startUrl(); };
syncLinks();

// Eintritt: dieselbe erste Frage wie im Fragebogen („Für wen suchst du Hilfe?“). Mit der gewählten Demo-Situation als Moment.
const mountEntry = id => {
  const slot = $(id);
  if (!slot) return;
  try {
    const entry = createInlineEntry(document, { source, contextKey: moments.has(chosen) ? chosen : '' });
    entry.addEventListener('click', event => { if (event.target.closest('[data-relation]')) track('lp_entry_click', { where: id, item: chosen }); }, true);
    slot.replaceChildren(entry);
    slot.classList.add('is-ready');
  } catch { /* Der Link bleibt. */ }
};
const mountEntries = () => { mountEntry('entry-top'); mountEntry('entry-bottom'); };
mountEntries();

// Live-Demo: Satz antippen, Antwort sofort sehen. Nur feste, geprüfte Texte, keine KI-Anfrage.
const art = { nachhause: 'nach-hause.webp', wiederholt: 'ruhig-uhrzeit.webp', arbeit: 'work.webp', mutter: 'ruhig-mutter.webp',
  wer: 'ruhig-wer.webp', geld: 'ruhig-geld.webp', waschen: 'ruhig-waschen.webp', schongegessen: 'ruhig-gegessen.webp' };
const chips = [...document.querySelectorAll('[data-demo]')];
const show = (key, { focus = false, user = false } = {}) => {
  const item = items.find(entry => entry.key === key);
  if (!item) return;
  chosen = key;
  for (const chip of chips) { const on = chip.dataset.demo === key; chip.setAttribute('aria-checked', String(on)); chip.tabIndex = on ? 0 : -1; if (on && focus) chip.focus(); }
  $('a-quote').textContent = `„${item.quote}“`;
  $('a-meaning').textContent = item.meaning || '';
  $('a-meaning').hidden = !item.meaning;
  $('a-say').textContent = item.say[0];
  $('a-more').replaceChildren(...item.say.slice(1).map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  $('a-tip').textContent = item.tip || '';
  const image = $('a-art');
  if (art[key]) { image.src = `/assets/zeichnungen/${art[key]}`; image.hidden = false; } else image.hidden = true;
  const card = $('answer'); card.classList.remove('is-new'); void card.offsetWidth; card.classList.add('is-new');
  syncLinks(); mountEntries();
  if (user) track('lp_demo', { item: key });
};
chips.forEach((chip, index) => {
  if (!items.some(entry => entry.key === chip.dataset.demo)) { chip.remove(); return; }
  chip.addEventListener('click', () => show(chip.dataset.demo, { user: true }));
  chip.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const list = chips.filter(item => item.isConnected);
    const next = list[(list.indexOf(chip) + step + list.length) % list.length];
    show(next.dataset.demo, { focus: true, user: true });
  });
});
// Vorschau aus der Anzeige: ?zeige=<schlüssel> zeigt diese Situation zuerst.
const wanted = clean(params.get('zeige'));
if (wanted && chips.some(chip => chip.dataset.demo === wanted)) show(wanted);
for (const name of Object.values(art)) { const pre = new Image(); pre.src = `/assets/zeichnungen/${name}`; }

// Stimmen: echte Texte (start/stimmen.js, Vornamen mit Zustimmung). Keine Sterne, keine Zahlen.
const voices = Array.isArray(window.DemenzStimmen) ? window.DemenzStimmen : [];
const section = $('stimmen');
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
  $('voices').append(...[0, 2, 3, 5, 10, 48, 49, 8].map(index => voices[index]).filter(Boolean).map(voice => card(voice, true)));
  $('voices-all').append(...voices.map(voice => card(voice, false)));
  $('voices-all-title').textContent = `Alle ${voices.length} Stimmen lesen`;
  section.hidden = false;
}

// Feste Knopfleiste unten: nur wenn keine Bildkarten sichtbar sind.
const sticky = $('sticky');
if (sticky && 'IntersectionObserver' in window) {
  const visible = new Map();
  const watcher = new IntersectionObserver(entries => {
    for (const entry of entries) visible.set(entry.target, entry.isIntersecting);
    const anyEntry = [...visible.values()].some(Boolean);
    const scrolled = window.scrollY > 400;
    sticky.hidden = anyEntry || !scrolled;
  }, { threshold: 0 });
  for (const id of ['entry-top', 'entry-bottom']) watcher.observe($(id));
  addEventListener('scroll', () => { if (window.scrollY <= 400) sticky.hidden = true; else if (![...visible.values()].some(Boolean)) sticky.hidden = false; }, { passive: true });
}

// Ein Ereignis, wenn jemand bis zum Preisabschnitt liest (ohne Einwilligung passiert nichts).
const trust = document.querySelector('.lp-path');
if (trust && 'IntersectionObserver' in window) {
  const watcher = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { track('lp_read_price'); watcher.disconnect(); }
  }, { threshold: .5 });
  watcher.observe(trust);
}
