import '../abo/plan-data.js';

const data = window.DEMENZ_PLAN_DATA;
const { key, maxAge } = data.quizProgress;
const choices = { relation: data.relations, situation: data.situations, frequency: data.frequencies,
  dayTime: data.dayTimes, duration: data.durations, living: data.livings,
  goal: data.goals, burden: data.burdens, minutes: data.minutes };
const moments = new Set(data.situations.filter(item => item.say).map(item => item.key));
const images = { mama: 'v-umarmung.webp', papa: 'papa.webp', partner: 'paar.webp', grosseltern: 'grosseltern.webp', andere: 'chat-helferin-fragend-lossless.png' };
// Same original picture question as /start/ and the existing Home interlude.
export function createInlineEntry(doc = document, options = {}) {
  const section = doc.createElement('section'); section.className = 'content-funnel';
  const title = doc.createElement('h2'); title.textContent = 'Für wen suchst du Hilfe?'; section.append(title);
  const pictures = doc.createElement('div'); pictures.className = 'start-pics';
  const others = doc.createElement('div'); others.className = 'start-options';
  const short = { mama: 'Mutter', papa: 'Vater', partner: 'Partner', grosseltern: 'Oma oder Opa' };
  for (const relation of data.relations) {
    const button = doc.createElement('button'); button.type = 'button'; button.dataset.relation = relation.key;
    button.className = short[relation.key] ? 'start-pic' : 'start-option';
    if (short[relation.key]) {
      button.setAttribute('aria-label', relation.label);
      const image = doc.createElement('img'); image.src = '/assets/zeichnungen/' + images[relation.key];
      image.width = 200; image.height = 180; image.alt = ''; button.append(image);
    }
    const label = doc.createElement('span'); label.textContent = short[relation.key] || relation.label;
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
    for (const d of ['M5 12h14', 'm13 6 6 6-6 6']) { const path = doc.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); }
    if (short[relation.key]) { label.append(svg); button.append(label); pictures.append(button); }
    else { button.append(label, svg); others.append(button); }
  }
  section.append(pictures, others); enhanceInlineEntry(section, options); return section;
}
function previous() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!saved) return null;
    const context = JSON.parse(saved.context);
    if (saved.version !== 1 || !Number.isFinite(saved.at) || saved.at > Date.now() || Date.now() - saved.at >= maxAge
      || !Array.isArray(context) || context.length !== 2 || !/^[a-z0-9_-]{1,30}$/u.test(context[0])
      || !(context[1] === '' || moments.has(context[1])) || typeof saved.screen !== 'string'
      || !saved.choices || typeof saved.choices !== 'object' || Array.isArray(saved.choices) || !Array.isArray(saved.tries)) {
      sessionStorage.removeItem(key); return null;
    }
    const fixed = {};
    for (const [name, items] of Object.entries(choices)) if (items.some(item => item.key === saved.choices[name])) fixed[name] = saved.choices[name];
    return { ...saved, context, choices: fixed, tries: data.tries.filter(item => saved.tries.includes(item.key)).map(item => item.key) };
  } catch { return null; }
}
function handoff(relation, { source, contextKey }) {
  const old = previous();
  const context = window.DemenzSituationContext?.resolve(contextKey);
  const moment = old ? old.context[1] : moments.has(context?.planKey) ? context.planKey : '';
  const entrySource = old?.context[0] || source;
  const url = new URL('/start/', location.origin);
  url.searchParams.set('src', entrySource);
  if (moment) url.searchParams.set('m', moment);
  const fixed = { ...old?.choices, relation: relation.key };
  if (!fixed.situation && moment) fixed.situation = moment;
  // Existing same-tab checkpoint only: fixed choice keys, no second questionnaire.
  try { sessionStorage.setItem(key, JSON.stringify({ version: 1, at: Date.now(),
    context: JSON.stringify([entrySource, moment]), screen: old && old.screen !== 'relation' ? old.screen : 'name',
    choices: fixed, tries: old?.tries || [] })); } catch { /* The original first question still works without storage. */ }
  location.assign(url.pathname + url.search);
}
// Enhance the actual published /start/ relation cards; no second questionnaire.
export function enhanceInlineEntry(section, { source = 'home_inline', contextKey = '' } = {}) {
  if (!section || section.dataset.funnelReady) return;
  section.dataset.funnelReady = 'true';
  section.addEventListener('click', event => {
    const button = event.target.closest('[data-relation]');
    if (!button || !section.contains(button)) return;
    const relation = data.relations.find(item => item.key === button.dataset.relation);
    if (relation) handoff(relation, { source, contextKey });
  });
}
