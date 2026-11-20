// Gespräche üben (Deutsch und Englisch). Ein Schritt pro Bildschirm:
// 1. Situation wählen (Bild) oder eigene schreiben.  2. Die Person sagt etwas, du tippst einen von drei Sätzen an.
// 3. Kurze Rückmeldung, die Person antwortet. Nach höchstens fünf Sätzen: Ende.
// Ab dem zweiten Satz: kostenlose Anmeldung (siehe „Anmeldung“). Ab der zweiten Übung: Paywall (siehe „Paywall“).
// Gesendet wird nur die Situation, der bisherige Verlauf und die Sprache. Der Server speichert nichts.
// Statistik (nach Einwilligung) bekommt nur feste Wörter und Zahlen, nie eingetippte Texte.
(() => {
  const root = document.getElementById('sim');
  const dataElement = document.getElementById('sim-data');
  if (!root || !dataElement) return;
  const data = JSON.parse(dataElement.textContent);
  const ui = data.ui;
  const english = data.lang === 'en';
  const moods = ['upset', 'unsure', 'calmer', 'calm'];
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  // Nur zum Testen auf dem eigenen Rechner darf die Adresse der KI überschrieben werden.
  const endpoint = (local && new URLSearchParams(location.search).get('api')) || data.endpoint;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const track = (name, parameters) => { if (typeof websiteAnalytics !== 'undefined') websiteAnalytics.track(name, parameters); };
  const fill = (text, values = {}) => text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
  const h = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (name === 'class') node.className = value;
      else if (name === 'text') node.textContent = value;
      else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
      else node.setAttribute(name, value === true ? '' : value);
    }
    for (const child of children.flat()) if (child !== undefined && child !== null && child !== false) node.append(child);
    return node;
  };
  const svg = (path, size) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    node.setAttribute('viewBox', '0 0 24 24'); node.setAttribute('width', size); node.setAttribute('height', size);
    node.setAttribute('aria-hidden', 'true'); node.setAttribute('focusable', 'false');
    node.innerHTML = path;
    return node;
  };
  const chevronPath = '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
  const checkPath = '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>';
  const bulbPath = '<path fill="currentColor" d="M12 2.5a7 7 0 0 0-4.2 12.6c.6.5 1 1.2 1 2V18h6.4v-.9c0-.8.4-1.5 1-2A7 7 0 0 0 12 2.5ZM9 19.5h6v.6A1.9 1.9 0 0 1 13.1 22h-2.2A1.9 1.9 0 0 1 9 20.1v-.6Z"/>';
  const top = () => root.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  const upper = (text) => text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
  const shuffle = (list) => { const copy = [...list]; for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };

  // Eigene Beschreibung: das Bild der Situation mit den meisten gemeinsamen Wortanfängen, sonst zwei Hände.
  const stopwords = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'der', 'die', 'das', 'und', 'oder', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'dein', 'deine',
    'sein', 'seine', 'ihre', 'will', 'wollen', 'mama', 'papa', 'mutter', 'vater', 'oma', 'opa', 'sagt', 'sagen', 'nachts', 'immer', 'wieder', 'dann', 'wenn', 'nicht', 'mich', 'mir',
    'with', 'that', 'this', 'what', 'when', 'wants', 'mother', 'father', 'says', 'again', 'always', 'have', 'from', 'about', 'they', 'then', 'will', 'does', 'doesn']);
  const words = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stopwords.has(word)).map((word) => word.slice(0, 5));
  const vocab = data.situations.map((situation) => ({ situation, stems: new Set(words([situation.says, ...situation.kw].join(' '))) }));
  const pictureFor = (text) => {
    const found = words(text);
    const best = vocab.map(({ situation, stems }) => ({ situation, score: found.filter((stem) => stems.has(stem)).length })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score)[0];
    return best?.situation ?? null;
  };

  const fresh = () => ({ person: null, turns: [], mood: 'unsure', round: 0, choices: [], feedback: null, busy: false, done: false, wrapUp: null, error: null, safety: null, offTopic: false, writing: false, good: 0, pending: null, tried: [], waiting: null, counted: false });
  const state = { view: 'home', showAll: false, session: 0, sit: null, ...fresh() };

  // ---------- Verbindung zur KI ----------
  const call = async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 32000);
    try {
      const response = await fetch(endpoint, { method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      if (response.status === 429) return { kind: 'error', reason: 'busy' };
      if (!response.ok) return { kind: 'error', reason: 'unavailable' };
      const value = await response.json();
      const text = (item, min, max) => typeof item === 'string' && [...item.trim()].length >= min && [...item.trim()].length <= max;
      if (value?.kind === 'off_topic') return { kind: 'off_topic' };
      if (value?.kind === 'safety') return text(value.message, 5, 1200) ? { kind: 'safety', message: value.message } : { kind: 'error', reason: 'unavailable' };
      const valid = value?.kind === 'sim' && text(value.reaction, 2, 220) && moods.includes(value.mood) && Array.isArray(value.choices) && value.choices.length === 3
        && value.choices.every((choice) => text(choice, 3, 140)) && text(value.person?.label, 3, 30)
        && (value.phase !== 'turn' || (['good', 'ok', 'tricky'].includes(value.feedback?.rating) && text(value.feedback?.why, 5, 340) && text(value.feedback?.better, 3, 180)))
        && (value.done !== true || (text(value.wrapUp?.worked, 5, 340) && text(value.wrapUp?.nextTime, 5, 340)));
      return valid ? value : { kind: 'error', reason: 'unavailable' };
    } catch {
      return { kind: 'error', reason: 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  };
  const requestBody = () => ({
    situation: state.sit.text, mode: state.sit.mode, ...(state.sit.who ? { who: state.sit.who } : {}),
    turns: state.turns.map(({ from, text }) => ({ from, text })),
    ...(state.turns.at(-1)?.from === 'you' ? { mood: state.mood } : {}), ...(english ? { language: 'en' } : {})
  });

  // ---------- Ablauf ----------
  const begin = async (sit) => {
    if (practicesDone() >= freePractices && !(await member())) return paywall();
    state.session += 1;
    const session = state.session;
    Object.assign(state, { view: 'scene', sit, ...fresh(), busy: true });
    if (sit.mode === 'line') state.turns = [{ from: 'person', text: sit.text }];
    track('simulator_start', { situation_key: sit.key || 'free', mode: sit.mode });
    render();
    top();
    const result = await call(requestBody());
    if (session !== state.session) return;
    state.busy = false;
    if (result.kind === 'safety') state.safety = result.message;
    else if (result.kind === 'off_topic') state.offTopic = true;
    else if (result.kind === 'error') { state.error = result.reason; state.writing = sit.mode === 'line'; }
    else {
      state.person = result.person;
      state.mood = result.mood;
      state.choices = shuffle(result.choices);
      if (sit.mode === 'description') {
        state.turns = [{ from: 'person', text: result.reaction }];
        sit.picture ||= pictureFor(sit.text);
      }
    }
    render();
  };

  const say = async (value, allowed = false) => {
    const text = value.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!text || state.busy || state.done || state.turns.at(-1)?.from !== 'person') return;
    if (!allowed && state.round >= freeRounds && !(await signedIn())) return askSignup(text);
    const session = state.session;
    const before = { choices: state.choices };
    Object.assign(state, { busy: true, error: null, choices: [], writing: false });
    state.turns = [...state.turns, { from: 'you', text }];
    state.round += 1;
    render();
    const result = await call(requestBody());
    if (session !== state.session) return;
    state.busy = false;
    if (result.kind === 'error') {
      // Satz zurücknehmen, damit man ihn noch einmal sagen kann.
      state.turns = state.turns.slice(0, -1);
      state.round -= 1;
      Object.assign(state, { error: result.reason, choices: before.choices, writing: before.choices.length === 0 });
      return render();
    }
    if (result.kind === 'safety') { state.safety = result.message; return render(); }
    if (result.kind === 'off_topic') { state.offTopic = true; return render(); }
    // Wie bei Lern-Apps: erst die Rückmeldung unten, die Person antwortet erst nach „Weiter“.
    state.pending = { result, before };
    if (!state.counted) { state.counted = true; countPractice(); }
    if (state.round >= freeRounds) loadAuth().catch(() => {});
    track('simulator_turn', { round: state.round, rating: result.feedback.rating, mood: result.mood });
    render();
    root.querySelector('.sim-bar .button')?.focus({ preventScroll: true });
  };

  const next = () => {
    const { result } = state.pending;
    state.pending = null;
    state.tried = [];
    state.mood = result.mood;
    state.turns = [...state.turns, { from: 'person', text: result.reaction }];
    if (result.feedback.rating === 'good') state.good += 1;
    state.choices = result.done ? [] : shuffle(result.choices);
    if (result.done) {
      state.done = true;
      state.wrapUp = result.wrapUp;
      track('simulator_done', { final_mood: result.mood, rounds: state.round, good_count: state.good, situation_key: state.sit.key || 'free' });
    }
    render();
    top();
  };

  // Nochmal versuchen: dieselbe Stelle, dieselben Sätze, der gewählte Satz ist ausgegraut.
  const retry = () => {
    const { before } = state.pending;
    const said = state.turns.at(-1)?.text;
    state.pending = null;
    state.turns = state.turns.slice(0, -1);
    state.round -= 1;
    state.choices = before.choices;
    if (said) state.tried = [...state.tried, said];
    track('simulator_retry', { round: state.round + 1 });
    render();
    top();
  };

  // ---------- Anmeldung ----------
  // Das erste Ergebnis ist frei. Ab dem zweiten Satz braucht man ein kostenloses Konto (Google oder E-Mail-Link).
  // Die Anmeldung kommt aus /abo/ (dieselbe wie beim Übersetzer). Ohne erreichbare Anmeldung geht das Üben weiter.
  const freeRounds = 1;
  let authPromise;
  const loadAuth = () => (authPromise ||= (async () => {
    if (!window.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
    const { webAuth } = await import('/abo/web-auth.js');
    return (await webAuth({ anonymous: false })).auth;
  })().catch((error) => { authPromise = null; throw error; }));
  const signedIn = async () => {
    try { const user = (await loadAuth()).currentUser; return Boolean(user && user.isAnonymous === false); } catch { return true; }
  };
  const askSignup = async (text) => {
    state.waiting = text;
    track('simulator_signup_shown', { round: state.round + 1 });
    let card;
    try {
      if (!window.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      const { mountInlineSignup } = await import('/abo/inline-signup.js');
      card = h('section', { hidden: true });
      document.body.append(card);
      await mountInlineSignup(card, { bonus: 3, en: english, purpose: 'invitation', creditActive: false, returnTo: location.pathname,
        returnFocus: root.querySelector('.sim-choice'), canPresent: ({ auth }) => !auth.currentUser || auth.currentUser.isAnonymous === true });
    } catch { /* Anmeldung gerade nicht erreichbar: weiter üben. */ }
    // Kein Fenster geöffnet (schon angemeldet oder Fehler): direkt weiter.
    if (card && !card.isConnected && document.querySelector('.dc-signup-sheet')) return;
    card?.remove();
    if (state.waiting === text) { state.waiting = null; say(text, true); }
  };
  // ---------- Paywall ----------
  // Die erste Übung ist frei (mit Anmeldung ab dem zweiten Satz). Jede weitere Übung braucht eine Mitgliedschaft.
  // Gezählt wird eine Übung, sobald ihre erste Rückmeldung da war. Der Zähler liegt nur auf diesem Gerät.
  const practiceKey = 'demenzcoach.simulatorPractices.v1';
  const freePractices = 1;
  const practicesDone = () => { try { return Number(localStorage.getItem(practiceKey)) || 0; } catch { return 0; } };
  const countPractice = () => { try { localStorage.setItem(practiceKey, String(practicesDone() + 1)); } catch { /* privat: zählt nicht */ } };
  const member = async () => {
    try {
      if (!window.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      const { subscriberState } = await import('/abo/konto.js');
      return ['active', 'error'].includes(await subscriberState(window.DEMENZ_ABO_CONFIG));
    } catch { return true; }
  };
  const paywall = () => {
    track('simulator_paywall_shown', { practices: practicesDone() });
    try { localStorage.setItem('demenzCoachKi', JSON.stringify({ returnTo: location.pathname })); } catch { /* */ }
    location.assign('/abo/?src=web_simulator');
  };

  window.addEventListener('demenz-auth-changed', async () => {
    const text = state.waiting;
    if (!text || !(await signedIn()) || state.waiting !== text) return;
    state.waiting = null;
    track('simulator_signup_done', { round: state.round + 1 });
    say(text, true);
  });

  const home = () => { state.session += 1; state.view = 'home'; render(); top(); };

  // ---------- Bausteine ----------
  const picture = () => {
    const base = state.sit.picture || state.sit;
    const calm = state.mood === 'calm' && base.afterImage;
    const image = calm ? base.afterImage : (base.image || { src: data.fallbackImage, width: 480, height: 420 });
    return h('img', { class: 'sim-picture', src: image.src, width: image.width, height: image.height, alt: '' });
  };

  const feedbackBar = () => {
    if (!state.pending) return null;
    const feedback = state.pending.result.feedback;
    const good = feedback.rating === 'good';
    return h('div', { class: `sim-bar ${good ? 'is-good' : 'is-hint'}`, role: 'dialog', 'aria-labelledby': 'sim-verdict' },
      h('div', { class: 'sim-bar-inner' },
        h('div', { class: 'sim-bar-head' },
          h('span', { class: 'sim-fb-icon', 'aria-hidden': 'true' }, svg(good ? checkPath : bulbPath, 24)),
          h('div', {},
            h('p', { class: 'sim-verdict', id: 'sim-verdict', text: ui.verdict[feedback.rating] }),
            good ? h('p', { text: feedback.why }) : h('p', {}, ui.better, ' ', h('q', { text: feedback.better })))),
        good
          ? h('button', { type: 'button', class: 'button', text: ui.next, onclick: next })
          : [h('button', { type: 'button', class: 'button', text: ui.tryAgain, onclick: retry }),
            h('button', { type: 'button', class: 'sim-light', text: ui.next, onclick: next })]));
  };

  const personBubble = () => {
    const who = upper(state.person?.label) || ui.thePerson;
    const last = state.turns.at(-1);
    if (state.busy) {
      return [
        state.turns.length && last?.from === 'you' ? h('div', { class: 'sim-bubble is-you', text: last.text }) : null,
        h('div', { class: 'sim-bubble is-person is-wait', role: 'status', 'aria-label': ui.wait }, h('span', { class: 'sim-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')))
      ];
    }
    if (state.pending) {
      const previous = state.turns.at(-2);
      return [
        previous ? h('div', { class: 'sim-line' }, h('p', { class: 'sim-who', text: fill(ui.says, { who }) }), h('div', { class: 'sim-bubble is-person', text: previous.text })) : null,
        h('div', { class: 'sim-bubble is-you', text: last.text })
      ];
    }
    if (!last || last.from !== 'person') return null;
    return h('div', { class: 'sim-line' }, h('p', { class: 'sim-who', text: fill(ui.says, { who }) }), h('div', { class: 'sim-bubble is-person', text: last.text }));
  };

  const answerArea = () => {
    if (state.busy || state.done || state.pending || state.turns.at(-1)?.from !== 'person') return null;
    const field = h('textarea', { id: 'sim-say', rows: '2', maxlength: '200', placeholder: ui.ownPlaceholder, enterkeyhint: 'send', 'aria-label': ui.ownLabel });
    const form = h('form', { class: 'sim-own', autocomplete: 'off' }, field, h('button', { class: 'button', type: 'submit', text: ui.sayButton }));
    form.addEventListener('submit', (event) => { event.preventDefault(); say(field.value); });
    return h('section', { class: 'sim-answer', 'aria-labelledby': 'sim-ask' },
      h('h2', { id: 'sim-ask', text: ui.ask }),
      state.choices.map((choice, index) => {
        const mark = 'ABC'[index];
        const tried = state.tried.includes(choice);
        return h('button', { type: 'button', class: `sim-choice${tried ? ' is-tried' : ''}`, disabled: tried || undefined, 'aria-label': `${ui.answer} ${mark}: ${choice}`, onclick: () => say(choice) },
          h('span', { class: 'sim-mark', 'aria-hidden': 'true', text: mark }),
          h('span', { class: 'sim-choice-text', text: choice }),
          svg(chevronPath, 20));
      }),
      state.writing
        ? form
        : h('button', { type: 'button', class: 'sim-textbutton', text: ui.ownOpen, onclick: () => { state.writing = true; render(); root.querySelector('#sim-say')?.focus(); } }));
  };

  const errorNote = () => state.error ? h('div', { class: 'sim-note', role: 'alert' },
    h('p', { text: state.error === 'busy' ? ui.busy : ui.unavailable }),
    state.turns.length === 0 ? h('button', { type: 'button', class: 'button', text: ui.retry, onclick: () => begin(state.sit) }) : null) : null;

  const doneArea = () => {
    if (!state.done) return null;
    const who = upper(state.person?.label) || ui.thePerson;
    const calm = ['calm', 'calmer'].includes(state.mood);
    return h('section', { class: 'sim-done', 'aria-labelledby': 'sim-done-title' },
      h('h2', { id: 'sim-done-title', text: fill(ui.doneTitle[state.mood], { who }) }),
      h('p', { text: calm ? state.wrapUp.worked : state.wrapUp.nextTime }),
      h('button', { type: 'button', class: 'button', text: ui.again, onclick: () => begin(state.sit) }),
      h('button', { type: 'button', class: 'sim-light', text: ui.other, onclick: home }),
      h('a', { class: 'sim-textbutton', href: data.appHref, 'data-store-link': 'simulator-done', onclick: () => track('simulator_cta_click', { target: 'app' }), text: ui.app }));
  };

  // ---------- Bildschirme ----------
  const scene = () => {
    const back = h('button', { type: 'button', class: 'sim-back', onclick: home, text: ui.back });
    if (state.safety || state.offTopic) {
      return [back, h('div', { class: `sim-note${state.safety ? ' is-safety' : ''}`, role: 'alert' },
        h('p', { text: state.safety || ui.offTopic }),
        h('button', { type: 'button', class: 'button', text: ui.other, onclick: home }))];
    }
    return [back, picture(), personBubble(), errorNote(), doneArea(), answerArea(), feedbackBar()];
  };

  const start = () => {
    const shown = state.showAll ? data.situations : data.situations.slice(0, data.firstCount);
    const tiles = h('div', { class: 'sim-tiles' }, shown.map((situation) => h('button', { type: 'button', class: 'sim-tile', onclick: () => begin({ key: situation.key, text: situation.says, mode: 'line', who: situation.who, image: situation.image, afterImage: situation.afterImage }) },
      h('img', { src: situation.image.src, width: situation.image.width, height: situation.image.height, alt: '', loading: 'lazy' }),
      h('span', { text: situation.says }))));
    const field = h('textarea', { id: 'sim-free', rows: '2', maxlength: '200', placeholder: ui.freePlaceholder, enterkeyhint: 'go' });
    const hint = h('p', { class: 'sim-hint', role: 'status' });
    const form = h('form', { class: 'sim-free', autocomplete: 'off' },
      h('label', { for: 'sim-free', text: ui.freeLabel }), field, hint,
      h('button', { class: 'button', type: 'submit', text: ui.freeButton }),
      h('p', { class: 'sim-small' }, ui.freeNote, ' ', h('a', { href: data.privacyHref, text: ui.privacyLink })));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = field.value.replace(/\s+/g, ' ').trim();
      if ([...text].length < 3) { hint.textContent = ui.freeTooShort; field.focus(); return; }
      begin({ key: '', text, mode: 'description', picture: null });
    });
    return [tiles,
      state.showAll ? null : h('button', { type: 'button', class: 'sim-light', text: ui.more, onclick: () => { state.showAll = true; render(); } }),
      form];
  };

  function render() {
    root.replaceChildren(...(state.view === 'home' ? start() : scene()).flat().filter(Boolean));
    document.body.classList.toggle('sim-playing', state.view === 'scene');
    document.body.classList.toggle('sim-bar-open', Boolean(state.pending) && state.view === 'scene');
  }

  // Direkter Einstieg über #situation=<key>.
  const key = decodeURIComponent(location.hash.replace(/^#situation=/, ''));
  const direct = location.hash.startsWith('#situation=') ? data.situations.find((situation) => situation.key === key) : null;
  if (direct) begin({ key: direct.key, text: direct.says, mode: 'line', who: direct.who, image: direct.image, afterImage: direct.afterImage });
  else render();
})();
