// Gesprächs-Simulator (Deutsch und Englisch): Die übende Person wählt oder beschreibt eine Situation,
// die gespielte Person reagiert auf jeden Satz, danach folgt eine kurze Rückmeldung.
// Gesendet wird nur: die Situation (höchstens 200 Zeichen), der bisherige Verlauf (höchstens 12 Zeilen)
// und die Sprache. Der Server speichert nichts (store: false). Statistik (nach Einwilligung) bekommt nur
// feste Wörter und Zahlen, nie eingetippte Texte.
(() => {
  const root = document.getElementById('sim');
  const dataElement = document.getElementById('sim-data');
  if (!root || !dataElement) return;
  const data = JSON.parse(dataElement.textContent);
  const ui = data.ui;
  const english = data.lang === 'en';
  const maxRounds = 5;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  // Nur zum Testen auf dem eigenen Rechner darf die Adresse der KI überschrieben werden.
  const endpoint = (local && new URLSearchParams(location.search).get('api')) || data.endpoint;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const formalKey = 'demenzcoach.simulatorFormal.v1';
  const moods = ['upset', 'unsure', 'calmer', 'calm'];

  const track = (name, parameters) => {
    if (typeof websiteAnalytics !== 'undefined') websiteAnalytics.track(name, parameters);
  };
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
  const icon = (path, size = 24) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('e-icon');
    svg.innerHTML = path;
    return svg;
  };
  const sendIcon = '<path fill="currentColor" d="M21.6 2.4a.9.9 0 0 0-.95-.2L2.9 9.1a.9.9 0 0 0-.05 1.67l7.2 3.17 3.17 7.2a.9.9 0 0 0 1.67-.05l6.9-17.75a.9.9 0 0 0-.2-.95ZM10.6 12.2 5.6 10l12.2-4.75-7.2 6.95Zm1.2 1.2 6.95-7.2L14 18.4l-2.2-5Z"/>';
  const heartIcon = (on) => `<path fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6c0 5.6-7.5 10.2-7.5 10.2Z"/>`;
  const checkIcon = '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';
  const scrollTo = (node) => node?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });

  const stopwords = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'der', 'die', 'das', 'und', 'oder', 'mein', 'meine', 'meinen', 'meinem', 'meiner', 'dein', 'deine',
    'sein', 'seine', 'ihre', 'will', 'wollen', 'mama', 'papa', 'mutter', 'vater', 'oma', 'opa', 'sagt', 'sagen', 'nachts', 'immer', 'wieder', 'dann', 'wenn', 'nicht', 'mich', 'mir',
    'with', 'that', 'this', 'what', 'when', 'wants', 'mother', 'father', 'says', 'again', 'always', 'have', 'from', 'about', 'they', 'then', 'will', 'does', 'doesn']);
  const words = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !stopwords.has(word)).map((word) => word.slice(0, 5));
  const vocab = data.situations.map((situation) => ({ situation, stems: new Set(words([situation.says, ...situation.kw].join(' '))) }));
  // Freie Beschreibung: Das Bild der Situation mit den meisten gemeinsamen Wortanfängen, sonst zwei Hände.
  const pictureFor = (text) => {
    const found = words(text);
    const ranked = vocab.map(({ situation, stems }) => ({ situation, score: found.filter((stem) => stems.has(stem)).length })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
    return ranked[0]?.situation ?? null;
  };

  const state = { view: 'home', formal: false, showAll: false, session: 0, sit: null, person: null, turns: [], mood: 'unsure', round: 0, choices: [], choicesState: 'idle',
    feedback: [], busy: false, preparing: false, done: false, wrapUp: null, error: null, safety: null, offTopic: false, saved: new Set() };
  try { state.formal = !english && localStorage.getItem(formalKey) === '1'; } catch { /* ohne Speicher: nur für diese Sitzung */ }

  // ---------- Verbindung zur KI ----------
  const call = async (body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 32000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal
      });
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
    turns: state.turns.map(({ from, text }) => ({ from, text })), ...(state.turns.at(-1)?.from === 'you' ? { mood: state.mood } : {}), ...(english ? { language: 'en' } : { formal: state.formal })
  });

  // ---------- Ablauf ----------
  const begin = async (sit) => {
    state.session += 1;
    const session = state.session;
    Object.assign(state, { view: 'scene', sit, person: null, turns: [], mood: 'unsure', round: 0, choices: [], choicesState: 'loading', feedback: [], busy: false,
      preparing: sit.mode === 'description', done: false, wrapUp: null, error: null, safety: null, offTopic: false });
    if (sit.mode === 'line') state.turns = [{ from: 'person', text: sit.text }];
    track('simulator_start', { situation_key: sit.key || 'free', mode: sit.mode });
    render();
    scrollTo(root);
    const result = await call(requestBody());
    if (session !== state.session) return;
    state.preparing = false;
    if (result.kind === 'safety') { state.safety = result.message; state.choicesState = 'idle'; return render(); }
    if (result.kind === 'off_topic') { state.offTopic = true; state.choicesState = 'idle'; return render(); }
    if (result.kind === 'error') {
      state.choicesState = 'error';
      if (sit.mode === 'description') state.error = result.reason;
      else state.error = null;
      return render();
    }
    state.person = result.person;
    state.mood = result.mood;
    state.choices = result.choices;
    state.choicesState = 'ready';
    if (sit.mode === 'description') {
      state.turns = [{ from: 'person', text: result.reaction }];
      if (!sit.picture) sit.picture = pictureFor(sit.text);
    }
    render();
  };

  const loadChoices = async () => {
    const session = state.session;
    state.choicesState = 'loading';
    render();
    const result = await call(requestBody());
    if (session !== state.session) return;
    if (result.kind === 'sim') {
      state.person ||= result.person;
      state.choices = result.choices;
      state.choicesState = 'ready';
    } else state.choicesState = 'error';
    render();
  };

  const say = async (value) => {
    const text = value.replace(/\s+/g, ' ').trim();
    if (!text || state.busy || state.done || state.preparing || state.turns.length === 0) return;
    const session = state.session;
    state.busy = true;
    state.error = null;
    const previousChoices = state.choices;
    state.choices = [];
    state.turns = [...state.turns, { from: 'you', text: text.slice(0, 200) }];
    state.round += 1;
    render();
    const result = await call(requestBody());
    if (session !== state.session) return;
    state.busy = false;
    if (result.kind === 'error') {
      // Den Satz zurücknehmen, damit er erneut gesagt werden kann.
      state.turns = state.turns.slice(0, -1);
      state.round -= 1;
      state.error = result.reason;
      state.choices = previousChoices;
      state.choicesState = previousChoices.length ? 'ready' : 'error';
      return render();
    }
    if (result.kind === 'safety') { state.safety = result.message; return render(); }
    if (result.kind === 'off_topic') { state.offTopic = true; return render(); }
    state.mood = result.mood;
    state.turns = [...state.turns, { from: 'person', text: result.reaction }];
    state.feedback[state.round - 1] = result.feedback;
    state.choices = result.done ? [] : result.choices;
    state.choicesState = result.done ? 'idle' : 'ready';
    if (result.done) { state.done = true; state.wrapUp = result.wrapUp; }
    track('simulator_turn', { round: state.round, rating: result.feedback.rating, mood: result.mood });
    if (result.done) {
      const good = state.feedback.filter((item) => item?.rating === 'good').length;
      track('simulator_done', { final_mood: result.mood, rounds: state.round, good_count: good, situation_key: state.sit.key || 'free' });
    }
    render();
    // Zur Rückmeldung zum gerade gesagten Satz, nicht ans Ende der Seite.
    scrollTo(root.querySelector(`[data-feedback="${state.round - 1}"]`) || root.querySelector('.sim-done'));
  };

  // ---------- Darstellung ----------
  const moodStepper = () => h('div', { class: 'sim-mood' },
    h('p', { class: 'sim-mood-title', text: ui.moodTitle }),
    h('ol', { class: 'sim-mood-steps', 'aria-label': ui.moodTitle }, moods.map((mood, index) => h('li', {
      class: `sim-mood-step is-${mood}${index <= moods.indexOf(state.mood) ? ' is-on' : ''}${mood === state.mood ? ' is-now' : ''}`,
      'aria-current': mood === state.mood ? 'step' : undefined
    }, h('span', { class: 'sim-mood-bar', 'aria-hidden': 'true' }), h('span', { class: 'sim-mood-label', text: ui.moods[mood] })))));

  const picture = () => {
    const sit = state.sit;
    const base = sit.picture || sit;
    const calm = state.done && ['calm', 'calmer'].includes(state.mood) && base.afterImage;
    const image = calm ? base.afterImage : base.image;
    return image ? h('img', { class: 'sim-picture', src: image.src, width: image.width, height: image.height, alt: '' }) : h('img', { class: 'sim-picture', src: data.fallbackImage, width: 480, height: 420, alt: '' });
  };

  const saveButton = (phrase) => {
    if (!window.DemenzSavedPhrases) return null;
    const item = { key: 'ki', says: state.sit.text, text: phrase };
    const saved = window.DemenzSavedPhrases.has(item);
    const button = h('button', { type: 'button', class: 'sim-save', 'aria-pressed': saved ? 'true' : 'false', 'aria-label': saved ? ui.saved : ui.save }, icon(heartIcon(saved), 22), h('span', { text: saved ? ui.saved : ui.save }));
    button.addEventListener('click', () => { window.DemenzSavedPhrases.toggle(item); render(); });
    return button;
  };

  const feedbackCard = (feedback, index) => h('section', { class: `sim-feedback is-${feedback.rating}`, 'data-feedback': String(index), 'aria-label': ui.feedbackLabel },
    h('p', { class: 'sim-verdict' }, icon(feedback.rating === 'good' ? checkIcon : '<circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6.2M12 16.6v.4" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>', 24), h('span', { text: ui.verdict[feedback.rating] })),
    h('p', { class: 'sim-why', text: feedback.why }),
    h('p', { class: 'sim-better-title', text: feedback.rating === 'good' ? ui.betterGood : ui.betterOther }),
    h('div', { class: 'sim-bubble sim-better' }, h('q', { text: feedback.better }), saveButton(feedback.better)));

  const chat = () => {
    const nodes = [];
    let yourIndex = 0;
    state.turns.forEach((turn, position) => {
      if (turn.from === 'person') {
        nodes.push(h('div', { class: `sim-line sim-person${position === state.turns.length - 1 && !state.done ? ' is-latest' : ''}` },
          h('p', { class: 'sim-who', text: fill(ui.says, { who: state.person?.label || ui.thePerson }) }),
          h('div', { class: 'sim-bubble', text: `${turn.text}` })));
      } else {
        nodes.push(h('div', { class: 'sim-line sim-you' }, h('p', { class: 'sim-who', text: ui.you }), h('div', { class: 'sim-bubble', text: turn.text })));
        const feedback = state.feedback[yourIndex];
        const answered = state.turns[position + 1]?.from === 'person';
        if (feedback && answered) nodes.push(feedbackCard(feedback, yourIndex));
        yourIndex += 1;
      }
    });
    if (state.busy) nodes.push(h('div', { class: 'sim-line sim-person sim-thinking', role: 'status' },
      h('p', { class: 'sim-who', text: fill(ui.thinking, { who: state.person?.label || ui.thePerson }) }),
      h('div', { class: 'sim-bubble' }, h('span', { class: 'sim-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')))));
    return nodes;
  };

  const errorNote = () => {
    if (!state.error) return null;
    const retry = state.sit.mode === 'description' && state.turns.length === 0 ? h('button', { type: 'button', class: 'button', text: ui.retry, onclick: () => begin(state.sit) }) : null;
    const links = h('p', { class: 'sim-fallback' }, ui.fallbackBefore, ' ', h('a', { class: 'text-link', href: data.trainerHref, text: ui.fallbackLink }), '.');
    return h('div', { class: 'sim-note is-error', role: 'alert' }, h('p', { text: state.error === 'busy' ? ui.busy : ui.unavailable }), retry, links);
  };

  const inputArea = () => {
    if (state.done) return null;
    if (state.turns.length === 0) return null;
    const field = h('textarea', { id: 'sim-say', rows: '3', maxlength: '200', placeholder: ui.sayPlaceholder, enterkeyhint: 'send', 'aria-label': ui.sayLabel, disabled: state.busy || undefined });
    field.value = state.draft || '';
    field.addEventListener('input', () => { state.draft = field.value; });
    const form = h('form', { class: 'sim-say', autocomplete: 'off' },
      h('label', { class: 'sim-say-label', for: 'sim-say', text: fill(ui.sayLabelRound, { round: Math.min(state.round + 1, maxRounds), max: maxRounds }) }),
      field,
      h('button', { class: 'button', type: 'submit', disabled: state.busy || undefined }, icon(sendIcon), h('span', { text: ui.sayButton })));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = field.value;
      state.draft = '';
      say(value);
    });
    const choices = h('div', { class: 'sim-choices' },
      h('p', { class: 'sim-choices-title', text: ui.choicesTitle }),
      state.choicesState === 'loading' || (state.busy && !state.choices.length) ? h('p', { class: 'sim-choices-wait', role: 'status', text: ui.choicesLoading }) : null,
      state.choicesState === 'error' && !state.busy ? h('button', { type: 'button', class: 'sim-retry', text: ui.choicesRetry, onclick: loadChoices }) : null,
      state.choices.map((choice) => h('button', { type: 'button', class: 'sim-choice', disabled: state.busy || undefined, onclick: () => say(choice) }, h('span', { text: choice }))));
    return h('div', { class: 'sim-input' }, form, state.choicesState !== 'idle' || state.choices.length ? choices : null);
  };

  const doneArea = () => {
    if (!state.done) return null;
    const good = state.feedback.filter((item) => item?.rating === 'good').length;
    const total = state.feedback.filter(Boolean).length;
    const realHref = state.sit.realHref || data.translatorHref;
    const cta = (label, href, name, secondary = false) => h('a', { class: secondary ? 'sim-link' : 'button', href, onclick: () => track('simulator_cta_click', { target: name }) }, h('span', { text: label }));
    return h('section', { class: 'sim-done', 'aria-labelledby': 'sim-done-title' },
      h('h2', { id: 'sim-done-title', tabindex: '-1', text: ui.doneTitle[state.mood] }),
      h('p', { class: 'sim-done-stats', text: fill(ui.doneStats, { good, total }) }),
      h('div', { class: 'sim-wrap-card' },
        h('h3', { text: ui.workedTitle }), h('p', { text: state.wrapUp.worked }),
        h('h3', { text: ui.nextTitle }), h('p', { text: state.wrapUp.nextTime })),
      h('div', { class: 'sim-done-actions' },
        h('button', { type: 'button', class: 'button', text: ui.again, onclick: () => begin(state.sit) }),
        h('button', { type: 'button', class: 'sim-light', text: ui.other, onclick: () => { state.session += 1; state.view = 'home'; render(); scrollTo(root); } }),
        cta(ui.real, realHref, 'translator', true)),
      h('aside', { class: 'sim-app' },
        h('h3', { text: ui.appTitle }),
        h('p', { text: ui.appText }),
        h('a', { class: 'button', href: data.appHref, 'data-store-link': 'simulator-done', onclick: () => track('simulator_cta_click', { target: 'app' }) }, h('span', { text: ui.appButton })),
        data.planHref ? h('a', { class: 'sim-link', href: data.planHref, onclick: () => track('simulator_cta_click', { target: 'plan' }), text: ui.planLink }) : null));
  };

  const scene = () => {
    const back = h('div', { class: 'sim-top' },
      h('button', { type: 'button', class: 'sim-back', onclick: () => { state.session += 1; state.view = 'home'; render(); scrollTo(root); } }, icon('<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', 22), h('span', { text: ui.back })),
      state.turns.length > 1 || state.done ? h('button', { type: 'button', class: 'sim-back', onclick: () => begin(state.sit) }, h('span', { text: ui.restart })) : null);
    const head = h('div', { class: 'sim-scene' }, picture(), h('div', { class: 'sim-scene-text' },
      h('p', { class: 'sim-practice', text: ui.practicing }),
      h('h2', { class: 'sim-situation', text: state.sit.mode === 'line' ? `„${state.sit.text}“` : state.sit.text })));
    const mood = moodStepper();
    if (state.safety) return [back, head, h('div', { class: 'sim-note is-safety', role: 'alert' }, h('p', { class: 'sim-note-title', text: ui.safetyTitle }), h('p', { text: state.safety }),
      h('button', { type: 'button', class: 'sim-light', text: ui.other, onclick: () => { state.view = 'home'; render(); } }))];
    if (state.offTopic) return [back, head, h('div', { class: 'sim-note', role: 'alert' }, h('p', { text: ui.offTopic }),
      h('p', {}, ui.offTopicMore, ' ', h('a', { class: 'text-link', href: data.translatorHref, text: ui.translatorLink }), '.'),
      h('button', { type: 'button', class: 'button', text: ui.other, onclick: () => { state.view = 'home'; render(); } }))];
    if (state.preparing) return [back, head, mood, h('p', { class: 'sim-preparing', role: 'status', text: ui.preparing })];
    return [back, head, mood, h('div', { class: 'sim-chat', 'aria-live': 'polite' }, chat()), errorNote(), doneArea(), inputArea(),
      state.done ? null : h('p', { class: 'sim-note-small', text: ui.disclaimer })];
  };

  const home = () => {
    const form = h('form', { class: 'sim-free', autocomplete: 'off' });
    const field = h('textarea', { id: 'sim-free', rows: '2', maxlength: '200', placeholder: ui.freePlaceholder, enterkeyhint: 'go', 'aria-describedby': 'sim-free-note' });
    const hint = h('p', { class: 'sim-hint', role: 'status' });
    const formalToggle = english ? null : h('fieldset', { class: 'sim-address' },
      h('legend', { text: ui.addressLabel }),
      [['du', false], ['Sie', true]].map(([label, formal]) => {
        const id = `sim-address-${label}`;
        const input = h('input', { type: 'radio', name: 'sim-address', id, value: label, checked: state.formal === formal || undefined });
        input.addEventListener('change', () => { state.formal = formal; try { localStorage.setItem(formalKey, formal ? '1' : '0'); } catch { /* egal */ } });
        return h('label', { for: id, class: 'sim-radio' }, input, h('span', { text: label }));
      }));
    form.append(
      h('label', { class: 'sim-free-label', for: 'sim-free', text: ui.freeLabel }), field,
      h('button', { class: 'button', type: 'submit' }, icon(sendIcon), h('span', { text: ui.freeButton })), hint,
      h('p', { class: 'sim-hint-small', id: 'sim-free-note' }, ui.freeNote, ' ', h('a', { href: data.termsHref, text: ui.termsLink }), ' ', ui.and, ' ', h('a', { href: data.privacyHref, text: ui.privacyLink }), ' ', ui.freeNoteEnd));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = field.value.replace(/\s+/g, ' ').trim();
      if ([...text].length < 3) { hint.textContent = ui.freeTooShort; field.focus(); return; }
      begin({ key: '', text, mode: 'description', picture: null });
    });
    const shown = state.showAll ? data.situations : data.situations.slice(0, data.firstCount);
    const tiles = h('div', { class: 'sim-tiles' }, shown.map((situation) => h('button', { type: 'button', class: 'sim-tile', onclick: () => begin({ key: situation.key, text: situation.says, mode: 'line', who: situation.who, image: situation.image, afterImage: situation.afterImage, realHref: situation.realHref }) },
      h('img', { src: situation.image.src, width: situation.image.width, height: situation.image.height, alt: '', loading: 'lazy' }),
      h('span', { class: 'sim-tile-label', text: situation.says }))));
    const more = state.showAll ? null : h('button', { type: 'button', class: 'sim-light sim-more', text: fill(ui.more, { count: data.situations.length - data.firstCount }), onclick: () => { state.showAll = true; render(); } });
    return [
      h('section', { class: 'sim-pick' }, h('h2', { text: ui.pickTitle }), formalToggle, tiles, more),
      h('section', { class: 'sim-card' }, form),
      h('p', { class: 'sim-note-small', text: ui.disclaimer })
    ];
  };

  function render() {
    const focusId = document.activeElement?.id;
    root.replaceChildren(...(state.view === 'home' ? home() : scene()).filter(Boolean));
    if (focusId && root.querySelector(`#${focusId}`) && focusId !== 'sim-say') root.querySelector(`#${focusId}`)?.focus({ preventScroll: true });
  }

  // Direkter Einstieg über #situation=<key> (zum Beispiel von einer Situationsseite).
  const start = decodeURIComponent(location.hash.replace(/^#situation=/, ''));
  const direct = location.hash.startsWith('#situation=') ? data.situations.find((situation) => situation.key === start) : null;
  if (direct) begin({ key: direct.key, text: direct.says, mode: 'line', who: direct.who, image: direct.image, afterImage: direct.afterImage, realHref: direct.realHref });
  else render();
})();
