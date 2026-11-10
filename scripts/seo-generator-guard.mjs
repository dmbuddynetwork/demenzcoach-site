import {createHash} from 'node:crypto';

const origin = 'https://dementiacoachapp.com';
const attr = (tag, name) => new RegExp(`(?:^|\\s)${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
const tags = (html, tag) => html.match(new RegExp(`<${tag}\\b[^>]*>`, 'gi')) ?? [];
const hash = value => createHash('sha256').update(value).digest('hex');

// Read the one result container, respecting its nested divs. This never renders
// or rewrites a page; it isolates the exact server-generated answer for comparison.
export function generatorResultFragment(html) {
  const opening = [...html.matchAll(/<div\b[^>]*>/gi)].find(match => attr(match[0], 'id') === 'translator-result');
  if (!opening) return null;
  const start = opening.index + opening[0].length;
  const divs = /<\/?div\b[^>]*>/gi;
  divs.lastIndex = start;
  let depth = 1, match;
  while ((match = divs.exec(html))) {
    depth += /^<\//.test(match[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index);
  }
  return null;
}

// The same mechanical transformations used by the existing compiler: disable
// unhydrated signup controls and resolve local asset attributes. No care text,
// heading, answer structure or safety wording is transformed.
function reviewedStaticFragment(view, language) {
  const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  return view.replace(/<form class="translator-signup-form" novalidate="">[\s\S]*?<\/form>/g, form => form
    .replace('<form ', '<form inert ')
    .replace(/<(input|button|select|textarea)\b([^>]*)>/g, (_match, tag, attributes) => `<${tag}${attributes} disabled>`))
    .replace(/\b(href|src|action)="([^"#][^"]*)"/g, (match, key, value) => {
      if (/^(?:\/|[a-z]+:)/i.test(value)) return match;
      const url = new URL(decode(value), origin + `/${language}/`);
      return `${key}="${escape(url.pathname + url.search + url.hash)}"`;
    }).replace(/[ \t]+$/gm, '');
}

// Only a compiled, source-bound public app route may replace the old article
// contract. A marker alone never exempts a page from campaign/link checks.
export function inspectGeneratorPage({pathname, html, routes, inventory, sources}) {
  const candidates = routes.filter(route => route.path === pathname);
  const body = tags(html, 'body')[0] ?? '';
  if (!candidates.length) return {
    registered: false,
    errors: attr(body, 'data-translator-initial-situation') ? ['unregistered generator marker'] : []
  };
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  require(candidates.length === 1, 'duplicate public generator route');
  const route = candidates[0];
  const matches = inventory.filter(item => item.path === pathname);
  require(matches.length === 1, 'generator route missing unique inventory entry');
  const record = matches[0];
  for (const key of ['key', 'language', 'topicId', 'path', 'alternatePath', 'selfCare', 'safetyOnly']) {
    require(record && record[key] === route[key], `generator inventory mismatch: ${key}`);
  }
  require(['de', 'en'].includes(route.language), 'invalid generator language');
  const entries = (sources[route.language] ?? []).filter(entry => entry.key === route.key && entry.page?.path === pathname);
  require(entries.length === 1, 'generator route missing unique reviewed source');
  const entry = entries[0];
  require(entry?.reviewStatus === 'reviewed' && entry.page.topicId === route.topicId && entry.page.alternatePath === route.alternatePath, 'generator source metadata mismatch');
  require(entry && !!entry.selfCare === route.selfCare && !!entry.safetyOnly === route.safetyOnly, 'generator source safety flags mismatch');
  require(!record?.legacySourceSHA256 || entry?.page.legacySourceSHA256 === record.legacySourceSHA256, 'generator legacy source fingerprint mismatch');
  require(!route.safetyOnly || route.selfCare, 'urgent hash-only state is not a public generator page');

  const expectedGoal = route.language === 'de' && !route.selfCare ? 'jetzt' : '';
  for (const [key, value] of Object.entries({
    'data-translator-initial-situation': route.key,
    'data-translator-initial-goal': expectedGoal,
    'data-translator-app-path': `/${route.language}/`,
    'data-translator-state': 'answer',
    'data-situation-topic': route.topicId
  })) require(attr(body, key) === value, `generator app marker mismatch: ${key}`);
  const canonicals = tags(html, 'link').filter(tag => attr(tag, 'rel') === 'canonical');
  require(canonicals.length === 1 && attr(canonicals[0], 'href') === origin + pathname, 'generator canonical mismatch');
  require(tags(html, 'form').filter(tag => attr(tag, 'id') === 'translator-form').length === 1, 'generator needs exactly one primary form');
  require(tags(html, 'textarea').filter(tag => attr(tag, 'id') === 'translator-input').length === 1, 'generator needs exactly one primary input');
  const resultTags = tags(html, 'div').filter(tag => attr(tag, 'id') === 'translator-result');
  require(resultTags.length === 1, 'generator needs exactly one result container');
  require(tags(html, 'div').filter(tag => attr(tag, 'class') === 'translator-answer').length === 1, 'generator needs exactly one rendered answer');
  require((html.match(/<h1\b/gi) ?? []).length === 1, 'generator needs exactly one h1');
  const heading = entry?.view?.html?.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0];
  require(heading && html.includes(heading), 'generator heading differs from reviewed view');
  const actualAnswer = generatorResultFragment(html);
  const reviewedAnswer = entry?.view?.html ? reviewedStaticFragment(entry.view.html, route.language) : null;
  require(actualAnswer !== null && reviewedAnswer !== null && actualAnswer === reviewedAnswer, 'generator result differs from reviewed view');
  require(entry?.view?.key === route.key && entry.view.language === route.language && entry.view.goal === expectedGoal, 'generator reviewed view mismatch');

  const scripts = [...html.matchAll(/<script\b[^>]*id=["']translator-data["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let data;
  try { if (scripts.length === 1) data = JSON.parse(scripts[0][1]); } catch { /* Explicit contract error below. */ }
  require(data && hash(JSON.stringify(data)) === entry?.view?.bindings?.dataHash, 'generator app data differs from reviewed view');
  const clientEntries = Array.isArray(data?.entries) ? data.entries.filter(item => item.key === route.key) : [];
  require(clientEntries.length === 1 && !!clientEntries[0].selfCare === route.selfCare && !!clientEntries[0].safetyOnly === route.safetyOnly, 'generator client entry safety mismatch');
  require(Array.isArray(data?.generatorRoutes) && data.generatorRoutes.filter(item => item.path === pathname && item.key === route.key).length === 1, 'generator public route missing from app data');

  // Use actual crawlable links to other compiled topics, rather than requiring
  // the former article's classes or a paid/App Store CTA on caregiver support.
  const topicPaths = new Set(routes.filter(item => item.language === route.language && item.path !== pathname).map(item => item.path));
  const linkedTopics = new Set();
  for (const tag of tags(html, 'a')) {
    const href = attr(tag, 'href');
    if (!href) continue;
    try {
      const url = new URL(href.replaceAll('&amp;', '&'), origin + pathname);
      if (url.origin === origin && topicPaths.has(url.pathname)) linkedTopics.add(url.pathname);
    } catch { /* The existing site validator reports other malformed links. */ }
  }
  require(linkedTopics.size >= 2, 'generator needs crawlable links to two other public topics');
  return {registered: true, errors};
}
