// Functional navigation: actual Firebase state, no profile/reading data or analytics.
const mounted = new WeakMap();
const languages = ['de','en','pl','ro','bg','hr','sk','hu','cs','uk','bs','sr','lt','sl','lv','et','ru','tr','ar','fr','it','es','pt','nl','el','sq','fa','th','da','fi','ga','mt','sv'];
export function languageDestinations(doc = document) {
  const origin = doc.defaultView.location.origin;
  const exact = new Map();
  for (const link of doc.querySelectorAll('link[rel="alternate"][hreflang]')) {
    const lang = link.hreflang.split('-')[0];
    try { const url = new URL(link.href, origin); if (languages.includes(lang) && (url.origin === origin || url.origin === 'https://dementiacoachapp.com') && !url.search && !url.hash) exact.set(lang, url.pathname); } catch { /* Ignore invalid alternatives. */ }
  }
  const current = doc.documentElement.lang.split('-')[0];
  if (languages.includes(current)) exact.set(current, doc.defaultView.location.pathname);
  return languages.map(lang => ({ lang, href: exact.get(lang) || `/${lang}/`, equivalent: exact.has(lang) }));
}
export function mountSharedNavigation(doc = document) {
  if (mounted.has(doc)) return mounted.get(doc);
  const host = doc.defaultView, en = !/^de(?:-|$)/i.test(doc.documentElement.lang);
  let container = doc.querySelector('header .e-wrap,header .nav-wrap,.start-top,.abo-top,.dl-header-row,header .top');
  if (!container && doc.querySelector('.web-account > a:first-child')) {
    const brand = doc.querySelector('.web-account > a:first-child'); container = doc.createElement('div'); container.className = 'dc-account-top'; brand.before(container); container.append(brand);
  }
  if (!container) return null;
  if (!doc.querySelector('link[href="/shared-navigation.css"]')) { const css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/shared-navigation.css'; doc.head.append(css); }
  container.classList.add('dc-navigation-host');
  const dock = doc.createElement('div'); dock.className = 'dc-navigation';
  const account = doc.createElement('a'); account.className = 'dc-navigation-account'; account.href = '/abo/konto.html?returnTo=' + encodeURIComponent(en ? '/en/dementia-translator/' : '/de/'); account.textContent = en ? 'Account' : 'Konto'; account.dataset.accountState = 'unknown';
  const status = doc.createElement('span'); status.className = 'dc-navigation-status'; status.setAttribute('role', 'status');
  let menu = container.querySelector('.site-menu,.e-menu');
  if (!menu) { menu = doc.createElement('details'); menu.className = 'e-menu'; const summary = doc.createElement('summary'); summary.textContent = en ? 'Menu' : 'Menü'; menu.append(summary); }
  menu.classList.add('dc-navigation-menu');
  const summary = menu.querySelector('summary');
  const oldNav = container.querySelector(':scope > nav');
  container.querySelector(':scope > .menu-button')?.remove();
  oldNav?.querySelector('.language-switch')?.remove();
  let items = menu.querySelector('nav,.e-menu-items');
  if (!items) {
    items = doc.createElement('nav'); items.setAttribute('aria-label', en ? 'Main navigation' : 'Hauptnavigation');
    if (oldNav) items.append(...[...oldNav.childNodes].filter(node => node !== menu && !node.contains?.(menu)));
    menu.append(items);
  }
  items.classList.add('dc-navigation-items');
  if (items.tagName !== 'NAV') items.setAttribute('role', 'navigation');
  items.setAttribute('aria-label', en ? 'Main navigation' : 'Hauptnavigation');
  for (const previous of items.querySelectorAll('a[href^="/abo/konto.html"]')) previous.remove();
  const pageLanguage = doc.documentElement.lang.split('-')[0];
  const homePath = `/${languages.includes(pageLanguage) ? pageLanguage : 'de'}/`;
  if (![...items.querySelectorAll('a')].some(a => a.getAttribute('href') === homePath)) { const home = doc.createElement('a'); home.href = homePath; home.textContent = en ? 'Everyday help' : 'Zur Alltagshilfe'; items.prepend(home); }
  const label = doc.createElement('label'); label.className = 'dc-navigation-language'; label.textContent = en ? 'Language' : 'Sprache';
  const select = doc.createElement('select'); select.setAttribute('aria-label', label.textContent);
  for (const item of languageDestinations(doc)) {
    const option = doc.createElement('option'); option.value = item.href;
    let name = item.lang; try { name = new Intl.DisplayNames([item.lang], { type: 'language' }).of(item.lang); } catch { /* Language code remains usable. */ }
    option.textContent = name + (item.equivalent ? '' : en ? ' · Home' : ' · Startseite'); option.lang = item.lang;
    option.selected = item.lang === doc.documentElement.lang.split('-')[0]; select.append(option);
  }
  const change = doc.createElement('button'); change.type = 'button'; change.textContent = en ? 'Change language' : 'Sprache wechseln';
  change.addEventListener('click', () => {
    if (select.value === host.location.pathname) { menu.open = false; summary.focus({ preventScroll: true }); return; }
    const draft = doc.querySelector('#translator-input');
    if (draft?.value?.trim() && !host.confirm(en ? 'Change page? Your unsent text is not automatically transferred.' : 'Seite wechseln? Deine ungesendete Eingabe wird nicht automatisch übernommen.')) return;
    host.location.assign(select.value);
  });
  label.append(select); items.append(label, change, status); dock.append(account, menu); container.append(dock); if (oldNav) oldNav.remove();
  const close = focus => { menu.open = false; if (focus) summary.focus({ preventScroll: true }); };
  doc.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.open) { event.preventDefault(); close(true); } });
  doc.addEventListener('pointerdown', event => { if (menu.open && !menu.contains(event.target)) close(false); });
  items.addEventListener('click', event => { if (event.target.closest('a')) close(false); });
  let version = 0, currentAuth, opening = false;
  const refresh = async () => {
    const request = ++version;
    try {
      if (!host.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      const { webAuth } = await import('/abo/web-auth.js'); const { auth } = await webAuth({ anonymous: false });
      if (request !== version || !dock.isConnected) return;
      currentAuth = auth; const user = auth.currentUser, signed = Boolean(user && user.isAnonymous === false);
      account.dataset.accountState = signed ? 'signed-in' : 'signed-out';
      account.textContent = signed ? (user.emailVerified ? (en ? '✓ Signed in' : '✓ Angemeldet') : (en ? 'Verify account' : 'Konto bestätigen')) : (en ? 'Sign in' : 'Anmelden');
      account.setAttribute('aria-label', signed ? (en ? 'Your account, signed in' : 'Dein Konto, angemeldet') : account.textContent);
    } catch { if (request === version) { account.dataset.accountState = 'unknown'; account.textContent = en ? 'Account' : 'Konto'; } }
  };
  account.addEventListener('click', async event => {
    if (currentAuth?.currentUser?.isAnonymous === false) return;
    event.preventDefault(); close(false); if (opening) return; opening = true;
    let card;
    try {
      if (!host.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      const { mountInlineSignup } = await import('/abo/inline-signup.js');
      card = doc.createElement('section'); card.hidden = true; doc.body.append(card);
      await mountInlineSignup(card, { bonus: 3, en, purpose: 'invitation', creditActive: false, returnFocus: account,
        returnTo: en ? '/en/dementia-translator/' : '/de/',
        canPresent: ({ auth }) => !auth.currentUser || auth.currentUser.isAnonymous === true });
    } catch { status.textContent = en ? 'Sign-in is temporarily unavailable. Please try again.' : 'Die Anmeldung ist gerade nicht verfügbar. Bitte versuche es erneut.'; menu.open = true; }
    finally { card?.remove(); opening = false; }
  });
  host.addEventListener('demenz-auth-changed', refresh); host.addEventListener('pageshow', refresh);
  if (!host.matchMedia('print').matches) void refresh();
  const api = { refresh, menu }; mounted.set(doc, api); return api;
}
export function bootSharedNavigation() {
  const boot = () => mountSharedNavigation();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
}
bootSharedNavigation();
