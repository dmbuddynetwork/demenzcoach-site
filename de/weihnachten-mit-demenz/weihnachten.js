// Weihnachts-Seite (28. Nov 2026, Lehre B der Diagnose-Auswertung): Ziel der Weihnachts-Reels.
// Ablauf wie der Kurzweg (hilfe/kurz/kurz.js): Situation eintippen oder Moment antippen → echte KI-Antwort → Angebot.
// KI: window.DemenzTranslatorAI (demenz-uebersetzer/translator-ai.js), derselbe Dienst und dieselben Prüfungen wie der Übersetzer.
// Angebot: bestehende Angebotsseite /start/?direkt=1 mit src=xmas_<kanal> (Kasse: „direkt_xmas_<kanal>“).
// Zählen ohne Einwilligung über abo/zaehler.js (Weg „xmas“, nur Schritt + Tag). GA4 nur mit Einwilligung.

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const clean = (value, max = 30) => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, max);
const guessApp = () => {
  const agent = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|FBIOS/u.test(agent)) return 'fb_app';
  if (/Instagram/u.test(agent)) return 'ig_app';
  if (/musical_ly|BytedanceWebview|TikTok/iu.test(agent)) return 'tiktok_app';
  return 'web';
};
// Reels verlinken ?src=fbreel&utm_content=<reel>. Ohne src: App aus dem Browser-Kennzeichen, sonst „web“.
const source = `xmas_${clean(params.get('src') || params.get('utm_source')) || guessApp()}`.slice(0, 30);
const track = (name, extra = {}) => {
  try { window.DemenzConsent?.track?.(name, { entry: source, ...extra }); } catch { /* ohne Einwilligung nichts */ }
};
const count = step => { try { window.DemenzZaehler?.once(step); } catch { /* Zählen stört nie */ } };

// ---- Eine kostenlose Antwort je Browser. Danach direkt das Angebot. ---------------------------------------------------
const usedKey = 'demenzcoach.weihnachten.v1';
const readUsed = () => { try { return JSON.parse(localStorage.getItem(usedKey) || 'null'); } catch { return null; } };
const saveUsed = value => { try { localStorage.setItem(usedKey, JSON.stringify(value)); } catch { /* privates Fenster */ } };

const el = (tag, props = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
};
const hasText = value => typeof value === 'string' && value.trim().length > 0;

const form = $('form'), field = $('text'), send = $('send'), errorBox = $('error');
const showError = text => { errorBox.textContent = text; errorBox.hidden = !text; };

// ---- Angebot: alle Werbe-Parameter bleiben erhalten, src wird xmas_<kanal> ------------------------------------------
const offerURL = (() => {
  const next = new URLSearchParams(location.search);
  for (const key of ['neu', 'arm', 'quiz', 'embed']) next.delete(key);
  next.set('direkt', '1');
  if (clean(next.get('src')) !== 'test') next.set('src', source);
  return `/start/?${next.toString()}`;
})();
for (const link of document.querySelectorAll('[data-xm-offer]')) {
  link.href = offerURL;
  link.addEventListener('click', () => { count('xmas_cta'); track('xmas_cta', { where: link.closest('#offer') ? 'answer' : 'band' }); });
}
let offerShown = false;
const showOffer = (title = '') => {
  if (title) $('offer-title').textContent = title;
  $('offer').hidden = false;
  if (offerShown) return;
  offerShown = true;
  count('xmas_offer');
  track('xmas_offer');
};

// ---- Antwort anzeigen (gleiche Arten wie im Kurzweg) ----------------------------------------------------------------
const block = (title, children) => el('div', { class: 'xm-block' }, [el('h3', { class: 'xm-step', text: title }), ...[].concat(children)]);
const lines = items => el('ul', { class: 'lp-lines xm-lines' }, items.filter(hasText).map(text => el('li', { text })));
const para = (text, cls = '') => el('p', cls ? { class: cls, text } : { text });

const render = (result, text) => {
  const body = $('r-body');
  const nodes = [];
  let free = true; // Darf danach das Angebot erscheinen?
  let counts = true; // Zählt als die kostenlose Antwort?
  $('r-quote').textContent = `Du hast geschrieben: „${text}“`;

  const urgent = result.safetyLevel === 'urgent';
  if (result.kind === 'safety' || urgent) {
    // Akute Lage: nur Sicherheit, kein Verkauf.
    const message = (hasText(result.safetyMessage) ? result.safetyMessage : hasText(result.message) ? result.message : '')
      .replace(/^\s*Bitte handle jetzt\.?\s*/u, '').trim() || 'Wenn jemand in Gefahr ist, ruf sofort den Notruf 112.';
    nodes.push(el('div', { class: 'xm-alert' }, [
      el('h3', { text: 'Bitte handle jetzt.' }),
      para(message),
      urgent ? el('a', { class: 'lp-btn xm-call', href: 'tel:112', text: 'Notruf 112 anrufen' }) : null
    ]));
    if (result.kind === 'answer' && Array.isArray(result.phrases)) nodes.push(block('Das kannst du sagen', lines(result.phrases)));
    free = !urgent;
  } else if (result.kind === 'answer') {
    if (result.safetyLevel === 'concern' && hasText(result.safetyMessage)) nodes.push(el('div', { class: 'xm-alert xm-alert-soft' }, [el('h3', { text: 'Zusätzlich wichtig' }), para(result.safetyMessage)]));
    nodes.push(block('Das kannst du sagen', lines(result.phrases.slice(0, 3))));
    if (hasText(result.avoid)) nodes.push(para(`Besser nicht: „${result.avoid.replace(/^„|“$/gu, '')}“`, 'xm-avoid'));
    if (hasText(result.meaning)) nodes.push(block('Was dahintersteckt', para(result.meaning)));
    if (hasText(result.nextStep)) nodes.push(block('Das kannst du tun', para(result.nextStep)));
  } else if (result.kind === 'self_support') {
    nodes.push(block('Das kann dir jetzt helfen', lines(result.steps)));
    if (hasText(result.meaning)) nodes.push(block('Was dahintersteckt', para(result.meaning)));
    if (hasText(result.nextStep)) nodes.push(block('Das kannst du tun', para(result.nextStep)));
    if (hasText(result.avoid)) nodes.push(para(`Das hilft dir nicht: ${result.avoid}`, 'xm-avoid'));
  } else if (result.kind === 'clarification') {
    // Rückfrage: Erklärung zeigen, dann darf die Person genauer beschreiben. Zählt nicht als Antwort.
    counts = false;
    if (hasText(result.meaning)) nodes.push(block('Was dahintersteckt', para(result.meaning)));
    if (hasText(result.nextStep)) nodes.push(block('Das kannst du tun', para(result.nextStep)));
    nodes.push(el('div', { class: 'xm-alert xm-alert-soft' }, [el('h3', { text: 'Eine Rückfrage' }), para(result.question), para('Schreib oben noch ein paar Worte dazu.', 'xm-quiet')]));
  } else {
    return false;
  }
  body.replaceChildren(...nodes);
  document.querySelector('.xm-ai').hidden = result.kind === 'safety';
  $('result').hidden = false;
  return { free, counts };
};

// ---- Fragen ---------------------------------------------------------------------------------------------------------
let busy = false;
let waitTimers = [];
const setWaiting = on => {
  busy = on;
  send.disabled = on;
  field.readOnly = on;
  $('wait').hidden = !on;
  waitTimers.forEach(clearTimeout); waitTimers = [];
  const steps = [...$('wait-steps').children];
  steps.forEach((step, index) => step.classList.toggle('is-on', index === 0 && on));
  if (on) steps.slice(1).forEach((step, index) => waitTimers.push(setTimeout(() => step.classList.add('is-on'), 1600 * (index + 1))));
};
const scrollTo = node => { try { node.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); } catch { node.scrollIntoView(); } };

const ask = async () => {
  if (busy) return;
  // Schon einmal gefragt (gleicher Browser): keine zweite kostenlose Antwort, gleich das Angebot.
  if (readUsed() && params.get('neu') !== '1') { showUsed(); return; }
  // Leeres Feld + Absenden: das gerade gezeigte Beispiel gilt als Eingabe (wie auf der Startseite).
  if (!field.value.trim()) { const example = window.DcBeispiele?.current?.(field) || ''; if (example) { field.value = example; field.dataset.dcBeispiele = 'off'; } }
  const text = field.value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (Array.from(text).length < 6) { showError('Schreib bitte ein paar Worte: Was sagt oder tut dein Angehöriger?'); field.focus(); return; }
  if (Array.from(text).length > 200) { showError('Bitte kürzer, höchstens 200 Zeichen.'); field.focus(); return; }
  showError('');
  const ai = window.DemenzTranslatorAI;
  if (!ai?.ask) { showError('Die Antwort lädt gerade nicht. Bitte lade die Seite neu.'); return; }
  count('xmas_ask');
  track('xmas_ask');
  setWaiting(true);
  $('result').hidden = true;
  scrollTo($('wait'));
  const once = async () => { try { return await ai.ask(text, { formal: false }); } catch { return { kind: 'error', reason: 'unavailable' }; } };
  let result = await once();
  // Ein stiller zweiter Versuch, wenn der Dienst kurz nicht antwortet (nicht bei „zu viele Anfragen“).
  if (result?.kind === 'error' && result.reason === 'unavailable') { await new Promise(done => setTimeout(done, 1500)); result = await once(); }
  setWaiting(false);

  if (result?.kind === 'off_topic') {
    showError('Das habe ich nicht verstanden. Beschreib bitte kurz, was dein Angehöriger sagt oder tut.');
    scrollTo($('ask')); field.focus();
    return;
  }
  const shown = result && result.kind !== 'error' ? render(result, text) : false;
  if (!shown) {
    track('xmas_error', { reason: clean(result?.reason) || 'unknown' });
    showError(result?.reason === 'busy' ? 'Gerade fragen sehr viele. Bitte versuch es gleich noch einmal.' : 'Das hat gerade nicht geklappt. Bitte versuch es noch einmal.');
    scrollTo($('ask'));
    showOffer('Oder starte gleich mit 7 Tagen kostenlos');
    return;
  }
  count('xmas_answer');
  track('xmas_answer', { kind: clean(result.kind) });
  if (shown.counts) {
    saveUsed({ at: Date.now() });
    $('ask').hidden = true;
    $('momente').hidden = true;
  } else {
    field.focus();
  }
  scrollTo($('result'));
  if (shown.free && shown.counts) showOffer();
};

form.addEventListener('submit', event => { event.preventDefault(); ask(); });
field.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); ask(); }
});
field.addEventListener('input', () => { if (!errorBox.hidden) showError(''); });
for (const tile of document.querySelectorAll('[data-example]')) {
  tile.addEventListener('click', () => {
    field.value = tile.dataset.example;
    field.dataset.dcBeispiele = 'off';
    track('xmas_moment');
    ask();
  });
}

// ---- Teilen mit der Familie (Weihnachten = Familie trifft sich) ------------------------------------------------------
$('share').addEventListener('click', async () => {
  const url = 'https://dementiacoachapp.com/de/weihnachten-mit-demenz/?src=teilen';
  const text = 'Weihnachten mit Demenz: Hier stehen gute Sätze für die Feiertage.';
  track('xmas_share');
  try {
    if (navigator.share) { await navigator.share({ title: 'Weihnachten mit Demenz', text, url }); return; }
  } catch { return; /* abgebrochen */ }
  location.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
});

// Weihnachtliche Beispiele tippen sich im leeren Feld (eingabe-beispiele.js, eigene Liste).
const EXAMPLES = [
  'Mama erkennt ihren Enkel nicht.',
  'Papa will mitten in der Feier nach Hause.',
  'Oma fragt nach Opa. Er ist gestorben.',
  'Es ist ihr zu laut am Tisch.',
  'Er fragt immer wieder, wann wir kommen.',
  'Sie will das Essen allein kochen.'
];
const attachExamples = () => { try { window.DcBeispiele?.attach?.(field, { maxChars: 120, examples: EXAMPLES }); } catch { /* normaler Platzhalter */ } };
if (window.DcBeispiele) attachExamples(); else document.addEventListener('dc-beispiele-ready', attachExamples, { once: true });

count('xmas_view');
track('xmas_view');

// Wiederkehrende Besucher sehen die ganze Seite (Tricks, Teilen). Erst beim Fragen kommt das Angebot.
function showUsed() {
  $('ask').hidden = true;
  $('momente').hidden = true;
  $('result').hidden = false;
  $('r-quote').textContent = '';
  $('r-body').replaceChildren(el('div', { class: 'xm-block' }, [
    el('h2', { text: 'Deine kostenlose Antwort hast du schon bekommen.' }),
    para('Im Probe-Zugang fragst du so oft du willst. Auch Nachfragen zu deiner Situation.', 'xm-lead-left')
  ]));
  document.querySelector('.xm-ai').hidden = true;
  showOffer('7 Tage kostenlos testen');
  scrollTo($('result'));
}
