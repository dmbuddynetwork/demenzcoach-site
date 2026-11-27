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
  // „Anmelden“ öffnet den Anmelde-Layer von unten statt der Seite (Daniel, 26. Nov). Mit Cmd/Strg-Klick oder ohne Layer-Unterstützung bleibt der Link ein normaler Link.
  account.addEventListener('click', (event) => {
    if (account.dataset.accountState !== 'signed-out' || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    import('/abo/account-layer.js').then(layer => layer.openAccountLayer({ returnTo: new URL(account.href, host.location.href).searchParams.get('returnTo') || (en ? '/en/dementia-translator/' : '/de/'), en, returnFocus: account, fallback: account.href }))
      .catch(() => host.location.assign(account.href));
  });
  const status = doc.createElement('span'); status.className = 'dc-navigation-status'; status.setAttribute('role', 'status');
  let menu = container.querySelector('.site-menu,.e-menu');
  if (!menu) { menu = doc.createElement('details'); menu.className = 'e-menu'; const summary = doc.createElement('summary'); summary.textContent = en ? 'Menu' : 'Menü'; menu.append(summary); }
  menu.classList.add('dc-navigation-menu');
  const summary = menu.querySelector('summary');
  // Drei ruhige Striche vor „Menü“ (27. Nov 2026, hochwertiger Kopf). Das Wort bleibt sichtbar: für Menschen über 60 klarer als nur ein Symbol.
  if (summary && !summary.querySelector('.dc-menu-icon')) { const icon = doc.createElement('span'); icon.className = 'dc-menu-icon'; icon.setAttribute('aria-hidden', 'true'); icon.append(doc.createElement('i'), doc.createElement('i'), doc.createElement('i')); summary.prepend(icon); }
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
  // „Abo verwalten“ im Menü: Stripe-Kundenportal mit E-Mail-Login, für alle Web-Käufer (Daniel, 27. Nov 2026). Link wie in /abo/abo-config.js.
  if (!items.querySelector('.dc-navigation-portal')) { const portal = doc.createElement('a'); portal.className = 'dc-navigation-portal'; portal.href = 'https://billing.stripe.com/p/login/dRmbJ17QQ8TP85s79Z1ZS00'; portal.textContent = en ? 'Manage subscription' : 'Abo verwalten'; items.append(portal); }
  const label = doc.createElement('label'); label.className = 'dc-navigation-language'; label.textContent = en ? 'Language' : 'Sprache';
  const select = doc.createElement('select'); select.setAttribute('aria-label', label.textContent);
  for (const item of languageDestinations(doc)) {
    const option = doc.createElement('option'); option.value = item.href;
    let name = item.lang; try { name = new Intl.DisplayNames([item.lang], { type: 'language' }).of(item.lang); } catch { /* Language code remains usable. */ }
    option.textContent = name + (item.equivalent ? '' : en ? ' · Home' : ' · Startseite'); option.lang = item.lang;
    option.selected = item.lang === doc.documentElement.lang.split('-')[0]; select.append(option);
  }
  // Remember edited controls, never their values. Programmatically prefilled defaults are not drafts.
  const editedFields = new WeakSet();
  const edited = event => {
    const field = event.target?.closest?.('input,textarea,select,[contenteditable="true"]');
    if (field && !field.closest('.dc-navigation')) editedFields.add(field);
  };
  doc.addEventListener('input', edited); doc.addEventListener('change', edited);
  const change = doc.createElement('button'); change.type = 'button'; change.textContent = en ? 'Change language' : 'Sprache wechseln';
  change.addEventListener('click', () => {
    if (select.value === host.location.pathname) { menu.open = false; summary.focus({ preventScroll: true }); return; }
    const draft = [...doc.querySelectorAll('input,textarea,select,[contenteditable="true"]')].some(field => {
      if (field.closest('.dc-navigation') || field.disabled || field.readOnly || !field.getClientRects().length || host.getComputedStyle(field).visibility === 'hidden') return false;
      if (field.id === 'translator-input') return Boolean(field.value?.trim());
      if (field.isContentEditable) return editedFields.has(field);
      if (field.dataset.formDraft === 'v1' && field.dataset.formEdited !== 'true') return false;
      if (field.matches('input[type="hidden"],input[type="button"],input[type="submit"],input[type="reset"],input[type="image"]')) return false;
      if (field.matches('input[type="checkbox"],input[type="radio"]')) return field.checked !== field.defaultChecked;
      if (field.tagName === 'SELECT') {
        if (field.multiple) return [...field.options].some(option => option.selected !== option.defaultSelected);
        const initial = [...field.options].findIndex(option => option.defaultSelected);
        return field.selectedIndex !== Math.max(0, initial);
      }
      return field.value !== field.defaultValue && Boolean(String(field.value || '').trim());
    });
    if (draft && !host.confirm(en ? 'Change page? Your unsent text is not automatically transferred.' : 'Seite wechseln? Deine ungesendete Eingabe wird nicht automatisch übernommen.')) return;
    host.location.assign(select.value);
  });
  // Auf dem Handy steht „Anmelden“ im Menü statt in der Kopfleiste (Daniel, 26. Nov). Der Menü-Eintrag löst denselben Klick aus.
  const menuAccount = doc.createElement('button'); menuAccount.type = 'button'; menuAccount.className = 'dc-navigation-menu-account'; menuAccount.textContent = account.textContent;
  menuAccount.addEventListener('click', () => { menu.open = false; account.click(); });
  items.prepend(menuAccount);
  label.append(select); items.append(label, change, status);
  // Der App-Store-Knopf im Kopf (26. Nov) entfällt mit dem Landingpage-Kopf (27. Nov). „Zur App“ steht unten bei den Einstellungen und in der Fußzeile.
  // Kopf wie eine Landingpage (Daniel, 27. Nov 2026: „mach es wie eine Landingpage … das Logo zentriert lieber und clean“).
  // Auf normalen Seiten steht oben nur das Logo in der Mitte. Konto, Abo, Schrift, App und Sprache stehen unten über der Fußzeile.
  const landing = container.matches('.e-header .e-wrap');
  if (landing) {
    container.classList.add('dc-landing-head');
    menuAccount.remove(); account.classList.add('dc-foot-account'); items.classList.remove('e-menu-items');
    const title = doc.createElement('h2'); title.className = 'dc-foot-title'; title.textContent = en ? 'Account and settings' : 'Konto und Einstellungen';
    dock.classList.add('dc-foot-tools'); dock.setAttribute('aria-label', title.textContent); dock.setAttribute('role', 'region');
    const row = doc.createElement('div'); row.className = 'dc-foot-row'; row.append(account);
    dock.append(title, row, items);
    const footer = doc.querySelector('footer.e-footer');
    if (footer) footer.before(dock); else doc.body.append(dock);
    menu.remove();
  } else {
    dock.append(account, menu); container.append(dock);
  }
  if (oldNav) oldNav.remove();
  // Markenname bleibt einzeilig: erst „App“ weglassen, dann nur das Logo zeigen (Daniel, 26. Nov: „nicht zweizeilig“).
  const brandText = container.querySelector('.e-brand > span');
  if (brandText && !brandText.querySelector('.dc-brand-app')) {
    const match = brandText.textContent.match(/^(.*\S)\s+(App)$/);
    if (match) { brandText.textContent = match[1]; const app = doc.createElement('span'); app.className = 'dc-brand-app'; app.textContent = ' ' + match[2]; brandText.append(app); }
  }
  const fitBrand = () => {
    if (!brandText?.isConnected) return;
    container.classList.remove('dc-brand-short', 'dc-brand-mark');
    const overflows = () => brandText.scrollWidth > brandText.clientWidth + 1 || container.scrollWidth > container.clientWidth + 1;
    if (overflows()) container.classList.add('dc-brand-short');
    if (overflows()) container.classList.add('dc-brand-mark');
  };
  if (brandText) { fitBrand(); host.ResizeObserver ? new host.ResizeObserver(fitBrand).observe(container) : host.addEventListener('resize', fitBrand); host.document.fonts?.ready?.then(fitBrand); doc.querySelector('link[href="/shared-navigation.css"]')?.addEventListener('load', fitBrand); host.addEventListener('load', fitBrand); }
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
      menuAccount.textContent = account.textContent;
      fitBrand();
    } catch { if (request === version) { account.dataset.accountState = 'unknown'; account.textContent = en ? 'Account' : 'Konto'; menuAccount.textContent = account.textContent; fitBrand(); } }
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
