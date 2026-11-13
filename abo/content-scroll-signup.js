// Functional, once-per-tab-visit registration invitation. No analytics or care request.
export const scrollSignupKey = 'demenzcoach.contentSignupShown.v1';
export function publicContentPage(pathname, pageType = '') {
  if (/^\/(?:abo|start|teller|plate|vorschau|__review)(?:\/|$)/.test(pathname)) return false;
  if (/(?:privacy|terms|datenschutz|nutzungsbedingungen|impressum|imprint|kontakt|contact|cookie|widerruf|kuendig|cancel|login|signin|sign-in|anmeld|bestaetig|verify|registr|account|konto|checkout|kasse|payment|garantie|agb|404)/i.test(pathname)) return false;
  return /^\/[a-z]{2}\/$/.test(pathname) || pathname === '/de/demenz-alltagstipps.html'
    || /^(?:translator-|seo-)/.test(pageType) || /^\/alltagstricks\//.test(pathname);
}
export function readingBoundary(blocks, viewportHeight) {
  const passed = blocks.filter(rect => rect.top < viewportHeight * .65).length;
  if (passed < 3) return false;
  // Keep old batch boundaries after append: never chase an expanding page percentage.
  return blocks.some((rect, index) => ((index + 1) % 6 === 0 || index + 1 === blocks.length)
    && rect.top < viewportHeight + 220 && rect.bottom > -viewportHeight * .35);
}
function visible(node) { return Boolean(node?.getClientRects().length); }
function readingNodes(doc) {
  const feed = doc.querySelector('.content-feed');
  if (feed) return [...feed.querySelectorAll('[data-content-item]')].filter(visible);
  const cards = [...doc.querySelectorAll('main .translator-trick, main .tips .tip')].filter(visible);
  if (cards.length) return cards;
  const result = doc.querySelector('#translator-result:not([hidden])');
  const root = result || doc.querySelector('main');
  return root ? [...root.querySelectorAll('p,blockquote,li')].filter(node => visible(node)
    && node.textContent.trim().length >= 40
    && !node.closest('form,nav,footer,dialog,.dc-signup,.translator-other-goals,.translator-sources,.translator-signup,.translator-privacy,.e-privacy,.ki-angebot,.content-feed-status')
    && ![...node.children].some(child => ['P','BLOCKQUOTE','LI'].includes(child.tagName))) : [];
}
function editableOrPending(doc) {
  if (doc.visibilityState === 'hidden' || doc.defaultView.matchMedia?.('print').matches) return true;
  if (doc.querySelector('dialog[open],.dc-signup-sheet,.ki-angebot,.e-menu[open]')) return true;
  if ([...doc.querySelectorAll('[aria-modal="true"],.consent-banner:not([hidden]),.translator-ai-wait,[aria-busy="true"],.safety-urgent')].some(visible)) return true;
  if (doc.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return true;
  return [...doc.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,[contenteditable="true"]')]
    .some(node => visible(node) && String(node.value ?? node.textContent ?? '').trim());
}
const controllers = new WeakMap();
export function mountContentScrollSignup({ doc = document, now = Date.now, minReadMS = 6000 } = {}) {
  if (controllers.has(doc)) return controllers.get(doc);
  const host = doc.defaultView;
  if (!/^(?:de|en)(?:-|$)/i.test(doc.documentElement.lang) || !publicContentPage(host.location.pathname, doc.body?.dataset.pageType) || !doc.querySelector('main')) return null;
  let seen = false, opening = false, firstRead = 0, intentAt = 0, distance = 0, previousY = host.scrollY, timer, sheet;
  const readVisit = () => { try { return host.sessionStorage.getItem(scrollSignupKey); } catch { return 'blocked'; } };
  seen = Boolean(readVisit());
  const markShown = () => { seen = true; try { host.sessionStorage.setItem(scrollSignupKey, 'shown'); } catch { /* Current-page suppression still applies. */ } };
  const noticeOtherSheet = () => { if (doc.querySelector('.dc-signup-sheet[open]')) markShown(); };
  const modalObserver = new host.MutationObserver(noticeOtherSheet);
  modalObserver.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  noticeOtherSheet();
  const eligible = () => !seen && !editableOrPending(doc) && distance >= host.innerHeight * .5
    && firstRead > 0 && now() - firstRead >= minReadMS
    && readingBoundary(readingNodes(doc).map(node => node.getBoundingClientRect()), host.innerHeight);
  async function invite() {
    if (opening || !eligible() || readVisit()) return;
    opening = true; let card;
    try {
      // Resolve existing Firebase state without creating an anonymous account.
      if (!host.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      if (host.DEMENZ_ABO_CONFIG?.signIn?.emailLink !== true) return;
      const { webAuth } = await import('/abo/web-auth.js');
      const { auth } = await webAuth({ anonymous: false });
      if (auth.currentUser && !auth.currentUser.isAnonymous) { seen = true; return; }
      if (!eligible() || readVisit()) return;
      try { host.sessionStorage.setItem(scrollSignupKey, 'pending'); } catch { seen = true; return; }
      const { mountInlineSignup } = await import('/abo/inline-signup.js');
      card = doc.createElement('section'); card.hidden = true; card.dataset.contentSignup = ''; doc.body.append(card);
      const en = /^en(?:-|$)/i.test(doc.documentElement.lang);
      await mountInlineSignup(card, { bonus: 3, en, purpose: 'invitation', creditActive: false,
        returnTo: en ? '/en/dementia-translator/' : '/de/',
        canPresent({ auth: current }) {
          return eligible() && readVisit() === 'pending' && (!current.currentUser || current.currentUser.isAnonymous === true);
        },
        onPresented(value) { sheet = value; markShown(); }
      });
    } catch { seen = true; /* Unknown auth/status fails closed for this page visit. */ }
    finally {
      card?.remove(); opening = false;
      if (!seen && readVisit() === 'pending') try { host.sessionStorage.removeItem(scrollSignupKey); } catch {}
    }
  }
  const progress = () => {
    const y = host.scrollY, down = y - previousY; previousY = y;
    if (seen || down <= 0 || now() - intentAt > 1500) return;
    distance += down; firstRead ||= now();
    clearTimeout(timer);
    if (now() - firstRead >= minReadMS) void invite();
    else timer = host.setTimeout(() => { if (eligible()) void invite(); }, Math.max(1, minReadMS - (now() - firstRead)));
  };
  const intent = event => {
    if (!event.isTrusted || event.target?.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (event.type === 'wheel' && event.deltaY <= 0) return;
    if (event.type === 'keydown' && (event.target?.closest?.('button') || !['ArrowDown','PageDown','End',' '].includes(event.key))) return;
    intentAt = now();
  };
  const beforePrint = () => { clearTimeout(timer); sheet?.close('print'); };
  host.addEventListener('wheel', intent, { passive: true }); host.addEventListener('touchmove', intent, { passive: true }); host.addEventListener('keydown', intent);
  host.addEventListener('scroll', progress, { passive: true }); host.addEventListener('beforeprint', beforePrint);
  const api = { dispose() { clearTimeout(timer); modalObserver.disconnect(); host.removeEventListener('wheel', intent); host.removeEventListener('touchmove', intent); host.removeEventListener('keydown', intent); host.removeEventListener('scroll', progress); host.removeEventListener('beforeprint', beforePrint); }, seen: () => seen };
  controllers.set(doc, api); return api;
}
export function bootContentScrollSignup() {
  const start = () => mountContentScrollSignup();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
