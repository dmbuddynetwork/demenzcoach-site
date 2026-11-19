// „Meine Sätze“ als eigene Seite (Daniel, 19. Nov): Überblick nach Situation, zum Ausdrucken.
// Die Sätze bleiben wie bisher nur in diesem Browser (translator-saved.js, localStorage) und werden nie gesendet.
// Ansehen und Drucken nur mit Konto (kostenlose Anmeldung per E-Mail-Link); ohne Konto ein Vorgeschmack.
const store = window.DemenzSavedPhrases;
const status = document.getElementById('ms-status');
const content = document.getElementById('ms-content');
const returnTo = '/de/meine-saetze/';
const signInURL = `/abo/konto.html?returnTo=${encodeURIComponent(returnTo)}`;

const el = (tag, className = '', text = '', attributes = {}) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
};
const track = (name, parameters = {}) => { try { window.websiteAnalytics?.track(name, parameters); } catch { /* Messung ist optional. */ } };

let situations = {};
let signedIn = false;
let lastRemoved = null;

const groupsOf = (items) => {
  const groups = new Map();
  // KI-Sätze (Schlüssel „ki“) gehören zu der Situation, die oben in der Sprechblase stand.
  for (const item of items) {
    const group = item.key === 'ki' ? `ki:${item.says}` : item.key;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  return [...groups.entries()].map(([group, list]) => {
    const key = list[0].key;
    const info = situations[key] ?? {};
    const feeling = key.startsWith('gefuehl-');
    const own = key === 'ki';
    const says = ((own ? list[0].says : info.says || list[0].says) || '').replace(/[.!]$/u, '');
    return { key, list, feeling, own, says, href: own ? '' : info.href || '', image: own ? '/assets/zeichnungen/chat-helferin.webp' : info.image || '' };
  });
};

const situationHead = (group) => {
  const head = el('div', 'ms-situation-head');
  if (group.image) head.append(el('img', 'ms-situation-art', '', { src: group.image, alt: '', width: '88', height: '88', loading: 'lazy', decoding: 'async' }));
  const text = el('div', 'ms-situation-text');
  text.append(el('p', 'ms-situation-label', group.feeling ? 'Gefühl' : group.own ? 'Deine Situation' : 'Wenn du hörst:'));
  text.append(el('h2', 'ms-situation-says', group.feeling || !group.says ? group.says || 'Eigene Situation' : `„${group.says}“`));
  if (group.href) {
    const link = el('a', 'ms-situation-link', 'Ganze Antwort ansehen', { href: group.href });
    text.append(link);
  }
  head.append(text);
  return head;
};

const removeButton = (item) => {
  const node = el('button', 'ms-remove', '', { type: 'button', 'aria-label': `Satz entfernen: ${item.text}` });
  node.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg><span>Entfernen</span>';
  node.addEventListener('click', () => {
    lastRemoved = item;
    store.remove(item);
    track('translator_save', { step: 'removed_page', result_key: item.key });
  });
  return node;
};

const undoBar = () => {
  if (!lastRemoved) return null;
  const bar = el('div', 'ms-undo', '', { role: 'status' });
  bar.append(el('span', '', 'Satz entfernt.'));
  const undo = el('button', 'ms-undo-button', 'Rückgängig', { type: 'button' });
  const item = lastRemoved;
  undo.addEventListener('click', () => { lastRemoved = null; store.toggle(item); });
  bar.append(undo);
  return bar;
};

const fullList = (items) => {
  const groups = groupsOf(items);
  const toolbar = el('div', 'ms-toolbar');
  toolbar.append(el('p', 'ms-count', items.length === 1 ? '1 Satz gemerkt' : `${items.length} Sätze gemerkt`));
  const print = el('button', 'ms-print', '', { type: 'button' });
  print.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><path d="M6 14h12v7H6z"/></svg><span>Ausdrucken</span>';
  print.addEventListener('click', () => { track('translator_save', { step: 'print' }); window.print(); });
  toolbar.append(print);
  const sections = groups.map((group) => {
    const section = el('section', 'ms-situation');
    section.append(situationHead(group));
    const list = el('ul', 'ms-phrases');
    for (const item of group.list) {
      const row = el('li', 'ms-phrase');
      row.append(el('q', '', item.text), removeButton(item));
      list.append(row);
    }
    section.append(list);
    return section;
  });
  return [toolbar, undoBar(), ...sections].filter(Boolean);
};

// Ohne Konto: erste Situation mit einem Satz sichtbar, der Rest verschwommen, darunter die Anmeldung.
const teaser = (items) => {
  const groups = groupsOf(items);
  const first = groups[0];
  const card = el('section', 'ms-teaser');
  card.append(el('p', 'ms-count', items.length === 1 ? 'Du hast 1 Satz gemerkt.' : `Du hast ${items.length} Sätze gemerkt.`));
  const preview = el('div', 'ms-preview');
  preview.append(situationHead({ ...first, href: '' }));
  const list = el('ul', 'ms-phrases');
  first.list.slice(0, 1).forEach((item) => { const row = el('li', 'ms-phrase'); row.append(el('q', '', item.text)); list.append(row); });
  items.filter((item) => item !== first.list[0]).slice(0, 3).forEach(() => {
    const row = el('li', 'ms-phrase ms-phrase-locked', '', { 'aria-hidden': 'true' });
    row.append(el('q', '', 'Dieser Satz ist nach der Anmeldung zu sehen.'));
    list.append(row);
  });
  preview.append(list);
  card.append(preview);
  const gate = el('div', 'ms-gate');
  gate.append(el('h2', '', 'Alle Sätze ansehen und ausdrucken'));
  const checks = el('ul', 'e-checks');
  ['Alle gemerkten Sätze auf einen Blick', 'Sortiert nach Situation', 'Als Blatt zum Ausdrucken'].forEach((text) => checks.append(el('li', '', text)));
  gate.append(checks);
  const link = el('a', 'button ms-signin', 'Kostenlos anmelden', { href: signInURL });
  link.addEventListener('click', () => track('translator_save', { step: 'page_signin' }));
  gate.append(link, el('p', 'ms-small', 'Mit deiner E-Mail-Adresse, ohne Passwort. Deine Sätze bleiben auf diesem Gerät.'));
  card.append(gate);
  return [card];
};

const empty = () => {
  const box = el('section', 'ms-empty');
  box.append(el('p', '', 'Du hast noch keine Sätze gemerkt. Tippe bei einer Antwort auf das Herz neben einem Satz.'));
  box.append(el('a', 'button', 'Zur Alltagshilfe', { href: '/de/' }));
  return [box];
};

const render = () => {
  const items = store ? store.list() : [];
  status.textContent = '';
  document.body.classList.toggle('ms-locked', !signedIn && items.length > 0);
  content.replaceChildren(...(!items.length ? [signedIn ? undoBar() : null, ...empty()].filter(Boolean) : signedIn ? fullList(items) : teaser(items)));
};

const authState = async () => {
  try {
    if (!window.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
    const { webAuth } = await import('/abo/web-auth.js');
    const { auth } = await webAuth({ anonymous: false });
    return Boolean(auth.currentUser && auth.currentUser.isAnonymous === false);
  } catch {
    return false;
  }
};

const start = async () => {
  try { situations = await (await fetch('/de/meine-saetze/situationen.json')).json(); } catch { situations = {}; }
  document.getElementById('ms-print-date').textContent = `Stand: ${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  signedIn = await authState();
  render();
  track('translator_save', { step: signedIn ? 'page_open' : 'page_teaser' });
  store?.onChange(render);
  window.addEventListener('demenz-auth-changed', async () => { signedIn = await authState(); render(); });
};
start();
