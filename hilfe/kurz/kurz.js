// Kurzweg (27. Nov 2026): Situation eintippen → sofort eine echte KI-Antwort → darunter das Angebot.
// Dritter Arm der Werbe-Weiche /hilfe/ab.html (a = Fragebogen /start/, b = Verkaufsseite /hilfe/, c = diese Seite).
// KI: window.DemenzTranslatorAI (demenz-uebersetzer/translator-ai.js), derselbe Dienst und dieselben Prüfungen wie der Übersetzer.
// Angebot: Knopf zur bestehenden Angebotsseite /start/?direkt=1 (Daniel, 27. Nov 2026: „Verwende die Angebotsseite, die wir haben“).
// Quelle: src=kw_<kanal>. Zustimmungsfreie Summen über abo/zaehler.js (nur Schritt + Tag).

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const config = window.DEMENZ_ABO_CONFIG || {};
const clean = (value, max = 30) => String(value || '').toLowerCase().replace(/[^a-z0-9_-]/gu, '').slice(0, max);
const guessApp = () => {
  const agent = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|FBIOS/u.test(agent)) return 'fb_app';
  if (/Instagram/u.test(agent)) return 'ig_app';
  if (/musical_ly|BytedanceWebview|TikTok/iu.test(agent)) return 'tiktok_app';
  return 'ads';
};
const source = `kw_${clean(params.get('src') || params.get('utm_source')) || guessApp()}`.slice(0, 30);
const track = (name, extra = {}) => {
  try { window.DemenzConsent?.track?.(name, { entry: source, ...extra }); } catch { /* ohne Einwilligung nichts */ }
};

// ---- Zähler ohne Einwilligung (abo/zaehler.js): nur Schritt und Tag, je Seitenaufruf einmal ----------------------------
const count = step => { try { window.DemenzZaehler?.once(step); } catch { /* Zählen stört nie */ } };

// ---- Eine kostenlose Antwort je Browser. Danach direkt das Angebot. ---------------------------------------------------
const usedKey = 'demenzcoach.kurzweg.v1';
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

// ---- Angebot: Knopf zur bestehenden Angebotsseite /start/?direkt=1 (Daniel, 27. Nov 2026) ----------------------------
// Alle Parameter der Anzeige (utm_*, k, a, fbclid …) bleiben erhalten. src wird kw_<kanal>, die Kasse führt es als direkt_kw_<kanal>.
const offerURL = (() => {
  const next = new URLSearchParams(location.search);
  for (const key of ['neu', 'arm', 'quiz', 'embed']) next.delete(key);
  next.set('direkt', '1');
  // Testläufe bleiben Testläufe (Zähler und Kasse erkennen src=test).
  if (clean(next.get('src')) !== 'test') next.set('src', source);
  return `/start/?${next.toString()}`;
})();
$('next').href = offerURL;
$('next').addEventListener('click', () => { count('kw_cta'); track('kw_cta'); });
let offerShown = false;
const showOffer = (title = '') => {
  if (title) $('offer-title').textContent = title;
  $('offer').hidden = false;
  if (offerShown) return;
  offerShown = true;
  count('kw_offer');
  track('kw_offer');
};

// ---- Antwort anzeigen ----------------------------------------------------------------------------------------------
const block = (title, children) => el('div', { class: 'kw-block' }, [el('h3', { class: 'kw-step', text: title }), ...[].concat(children)]);
const lines = items => el('ul', { class: 'lp-lines kw-lines' }, items.filter(hasText).map(text => el('li', { text })));
const para = (text, cls = '') => el('p', cls ? { class: cls, text } : { text });

const render = (result, text) => {
  const body = $('r-body');
  const nodes = [];
  let free = true; // Darf danach das Angebot erscheinen?
  let counts = true; // Zählt als die kostenlose Antwort?
  $('r-quote').textContent = `Du hast geschrieben: „${text}“`;

  const safety = result.safetyLevel === 'urgent' || result.kind === 'safety' && result.safetyLevel === 'urgent';
  if (result.kind === 'safety' || safety) {
    // Akute Lage: nur Sicherheit, kein Verkauf.
    const message = (hasText(result.safetyMessage) ? result.safetyMessage : hasText(result.message) ? result.message : '')
      .replace(/^\s*Bitte handle jetzt\.?\s*/u, '').trim() || 'Wenn jemand in Gefahr ist, ruf sofort den Notruf 112.';
    nodes.push(el('div', { class: 'kw-alert' }, [
      el('h3', { text: 'Bitte handle jetzt.' }),
      para(message),
      result.safetyLevel === 'urgent' ? el('a', { class: 'lp-btn kw-call', href: 'tel:112', text: 'Notruf 112 anrufen' }) : null
    ]));
    if (result.kind === 'answer' && Array.isArray(result.phrases)) nodes.push(block('Das kannst du sagen', lines(result.phrases)));
    free = result.safetyLevel !== 'urgent';
  } else if (result.kind === 'answer') {
    if (result.safetyLevel === 'concern' && hasText(result.safetyMessage)) nodes.push(el('div', { class: 'kw-alert kw-alert-soft' }, [el('h3', { text: 'Zusätzlich wichtig' }), para(result.safetyMessage)]));
    nodes.push(block('Das kannst du sagen', lines(result.phrases.slice(0, 3))));
    if (hasText(result.avoid)) nodes.push(para(`Besser nicht: „${result.avoid.replace(/^„|“$/gu, '')}“`, 'kw-avoid'));
    if (hasText(result.meaning)) nodes.push(block('Was dahintersteckt', para(result.meaning)));
    if (hasText(result.nextStep)) nodes.push(block('Das kannst du tun', para(result.nextStep)));
  } else if (result.kind === 'self_support') {
    nodes.push(block('Das kann dir jetzt helfen', lines(result.steps)));
    if (hasText(result.meaning)) nodes.push(block('Was dahintersteckt', para(result.meaning)));
    if (hasText(result.nextStep)) nodes.push(block('Das kannst du tun', para(result.nextStep)));
    if (hasText(result.avoid)) nodes.push(para(`Das hilft dir nicht: ${result.avoid}`, 'kw-avoid'));
  } else if (result.kind === 'clarification') {
    // Rückfrage: nützliche Erklärung zeigen, dann darf die Person genauer beschreiben. Zählt nicht als Antwort.
    counts = false;
    if (hasText(result.meaning)) nodes.push(block('Was dahintersteckt', para(result.meaning)));
    if (hasText(result.nextStep)) nodes.push(block('Das kannst du tun', para(result.nextStep)));
    nodes.push(el('div', { class: 'kw-alert kw-alert-soft' }, [el('h3', { text: 'Eine Rückfrage' }), para(result.question), para('Schreib oben noch ein paar Worte dazu.', 'kw-quiet')]));
  } else {
    return false;
  }
  body.replaceChildren(...nodes);
  // Feste Sicherheitstexte kommen vom Server, nicht von der KI.
  document.querySelector('.kw-ai').hidden = result.kind === 'safety';
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
  // Leeres Feld + Absenden: das gerade gezeigte Beispiel gilt als Eingabe (wie auf der Startseite).
  if (!field.value.trim()) { const example = window.DcBeispiele?.current?.(field) || ''; if (example) { field.value = example; field.dataset.dcBeispiele = 'off'; } }
  const text = field.value.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (Array.from(text).length < 6) { showError('Schreib bitte ein paar Worte: Was sagt oder tut dein Angehöriger?'); field.focus(); return; }
  if (Array.from(text).length > 200) { showError('Bitte kürzer, höchstens 200 Zeichen.'); field.focus(); return; }
  showError('');
  const ai = window.DemenzTranslatorAI;
  if (!ai?.ask) { showError('Die Antwort lädt gerade nicht. Bitte lade die Seite neu.'); return; }
  count('kw_ask');
  track('kw_ask');
  $('examples').hidden = true;
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
    track('kw_error', { reason: clean(result?.reason) || 'unknown' });
    showError(result?.reason === 'busy' ? 'Gerade fragen sehr viele. Bitte versuch es gleich noch einmal.' : 'Das hat gerade nicht geklappt. Bitte versuch es noch einmal.');
    scrollTo($('ask'));
    // Keine Sackgasse: Das Angebot steht trotzdem darunter.
    showOffer('Oder starte gleich mit 7 Tagen kostenlos');
    return;
  }
  count('kw_answer');
  track('kw_answer', { kind: clean(result.kind) });
  if (shown.counts) {
    saveUsed({ at: Date.now() });
    $('ask').hidden = true;
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
for (const chip of document.querySelectorAll('[data-example]')) {
  chip.addEventListener('click', () => {
    field.value = chip.dataset.example;
    field.dataset.dcBeispiele = 'off';
    track('kw_example');
    ask();
  });
}
// Wechselnde Beispielsätze im leeren Feld (wie auf der Startseite).
const attachExamples = () => { try { window.DcBeispiele?.attach?.(field, { maxChars: 120 }); } catch { /* normaler Platzhalter */ } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attachExamples, { once: true }); else attachExamples();

count('kw_view');
track('kw_view');

// Schon einmal gefragt (gleicher Browser): keine zweite kostenlose Antwort, gleich das Angebot.
if (readUsed() && params.get('neu') !== '1') {
  $('ask').hidden = true;
  $('result').hidden = false;
  $('r-quote').textContent = '';
  $('r-body').replaceChildren(el('div', { class: 'kw-block' }, [
    el('h2', { text: 'Deine kostenlose Antwort hast du schon bekommen.' }),
    para('Im Probe-Zugang fragst du so oft du willst. Auch Nachfragen zu deiner Situation.', 'kw-lead-left')
  ]));
  document.querySelector('.kw-ai').hidden = true;
  showOffer('7 Tage kostenlos testen');
}
