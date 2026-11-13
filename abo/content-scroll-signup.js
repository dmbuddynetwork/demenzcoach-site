// Functional, reading-based registration invitations. No analytics or care request.
import { contentInvitationPolicy, scrollSignupKey, readInvitationCadence, invitationCadenceAllows, nextInvitationCadence } from './content-invitation-policy.js';
import { contentAccessState } from './content-access.js';
export { scrollSignupKey };
export function publicContentPage(pathname, pageType = '') {
  if (/^\/(?:abo|start|teller|plate|vorschau|__review)(?:\/|$)/.test(pathname)) return false;
  if (/(?:privacy|terms|datenschutz|nutzungsbedingungen|impressum|imprint|kontakt|contact|cookie|widerruf|kuendig|cancel|login|signin|sign-in|anmeld|bestaetig|verify|registr|account|konto|checkout|kasse|payment|garantie|agb|404)/i.test(pathname)) return false;
  return /^\/[a-z]{2}\/$/.test(pathname) || pathname === '/de/demenz-alltagstipps.html'
    || /^(?:translator-|seo-)/.test(pageType) || /^\/alltagstricks\//.test(pathname);
}
export function readingBoundary(blocks, viewportHeight, minimum = 2) {
  return blocks.filter(rect => rect.top < viewportHeight * .7).length >= minimum
    && (minimum === 1 ? blocks.some(rect => rect.bottom <= viewportHeight * .95)
      : blocks.some(rect => rect.top < viewportHeight && rect.bottom > 0));
}
function visible(node) { return Boolean(node?.getClientRects().length); }
function readingNodes(doc) {
  const feed = doc.querySelector('.content-feed');
  if (feed) return [...feed.querySelectorAll('[data-content-item]')].filter(visible);
  const detail = doc.querySelector('.tip-detail-art')?.closest('.tricks-intro');
  if (detail) return [detail].filter(visible);
  const cards = [...doc.querySelectorAll('main .translator-trick, main .tips .tip')].filter(visible);
  if (cards.length) return cards;
  const result = doc.querySelector('#translator-result:not([hidden])');
  const root = result || doc.querySelector('main');
  return root ? [...root.querySelectorAll('p,blockquote,li')].filter(node => visible(node)
    && node.textContent.trim().length >= 40
    && !node.closest('form,nav,footer,dialog,.dc-signup,.translator-other-goals,.translator-sources,.translator-signup,.translator-privacy,.e-privacy,.ki-angebot,.content-feed-status')
    && ![...node.children].some(child => ['P','BLOCKQUOTE','LI'].includes(child.tagName))) : [];
}
export function contentInteractionBusy(doc) {
  if (doc.visibilityState === 'hidden' || doc.defaultView.matchMedia?.('print').matches) return true;
  if (doc.querySelector('dialog[open],.dc-signup-sheet,.ki-angebot,.e-menu[open],.site-menu[open]')) return true;
  if ([...doc.querySelectorAll('[aria-modal="true"],.consent-banner:not([hidden]),.translator-ai-wait,[aria-busy="true"],.safety-urgent')].some(visible)) return true;
  if (doc.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return true;
  return [...doc.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea,[contenteditable="true"]')]
    .some(node => visible(node) && String(node.value ?? node.textContent ?? '').trim());
}
const controllers = new WeakMap();
export function mountContentScrollSignup({ doc = document, now = Date.now, minReadMS = contentInvitationPolicy.firstReadMS, policy = contentInvitationPolicy } = {}) {
  if (controllers.has(doc)) return controllers.get(doc);
  const host = doc.defaultView;
  if (!/^(?:de|en)(?:-|$)/i.test(doc.documentElement.lang) || !publicContentPage(host.location.pathname, doc.body?.dataset.pageType) || !doc.querySelector('main')) return null;
  let suspended = false;
  let disabled = false, shown = 0, opening = false, firstRead = 0, intentAt = 0, distance = 0, previousY = host.scrollY, timer, sheet;
  let highWater = 0, lastPromptProgress = null, lastOpen = null, ownPendingUntil = 0;
  const counted = new WeakSet();
  const readVisit = () => { try { return readInvitationCadence(host.sessionStorage.getItem(scrollSignupKey), now(), policy); } catch { return null; } };
  const writeVisit = value => { try { host.sessionStorage.setItem(scrollSignupKey, JSON.stringify(value)); return true; } catch { disabled = true; return false; } };
  if (!readVisit()) disabled = true;
  const markShown = dialog => {
    lastOpen = dialog;
    if (counted.has(dialog)) return;
    counted.add(dialog); shown++; lastPromptProgress = highWater;
    const value = readVisit(); if (value) writeVisit(nextInvitationCadence(value, now(), policy)); else disabled = true;
  };
  const resetReading = () => { firstRead = 0; distance = 0; intentAt = 0; previousY = host.scrollY; clearTimeout(timer); };
  const recordClosed = () => {
    if (!lastOpen) return;
    lastOpen = null; resetReading();
    const value = readVisit(); if (value) writeVisit({ ...value, lastAt: now(), pendingUntil: 0 });
  };
  const noticeOtherSheet = () => {
    const dialog = doc.querySelector('.dc-signup-sheet[open]');
    if (dialog) { markShown(dialog); return; }
    recordClosed();
  };
  const modalObserver = new host.MutationObserver(noticeOtherSheet);
  modalObserver.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
  noticeOtherSheet();
  const eligible = () => !suspended && !disabled && !contentInteractionBusy(doc)
    && invitationCadenceAllows(readVisit(), now(), policy, ownPendingUntil)
    && distance >= Math.max(180, host.innerHeight * policy.minimumScrollFraction)
    && firstRead > 0 && now() - firstRead >= minReadMS
    && (lastPromptProgress === null || highWater >= lastPromptProgress + policy.furtherBlocks)
    && readingBoundary(readingNodes(doc).map(node => node.getBoundingClientRect()), host.innerHeight, doc.querySelector('.content-feed') ? 2 : 1);
  async function invite() {
    if (opening || !eligible()) return;
    opening = true; let card;
    try {
      // Resolve existing Firebase state without creating an anonymous account.
      if (!host.DEMENZ_ABO_CONFIG) await import('/abo/abo-config.js');
      if (host.DEMENZ_ABO_CONFIG?.signIn?.emailLink !== true) return;
      const { webAuth } = await import('/abo/web-auth.js');
      const { auth } = await webAuth({ anonymous: false });
      if (auth.currentUser && !auth.currentUser.isAnonymous) { disabled = true; return; }
      if (!eligible()) return;
      ownPendingUntil = now() + 15000;
      if (!writeVisit({ ...readVisit(), pendingUntil: ownPendingUntil })) return;
      const { mountInlineSignup, signupStyles } = await import('/abo/inline-signup.js');
      await signupStyles();
      if (!eligible()) return;
      if (auth.currentUser && !auth.currentUser.isAnonymous) { disabled = true; return; }
      const checked = auth.currentUser;
      const identity = checked ? { uid: checked.uid, anonymous: checked.isAnonymous, verified: checked.emailVerified } : null;
      const sameIdentity = current => {
        const user = current.currentUser;
        return identity ? Boolean(user && user.uid === identity.uid && user.isAnonymous === identity.anonymous && user.emailVerified === identity.verified) : !user;
      };
      if (await contentAccessState(auth, doc) !== 'free') { disabled = true; return; }
      if (!eligible() || !sameIdentity(auth)) return;
      card = doc.createElement('section'); card.hidden = true; card.dataset.contentSignup = ''; doc.body.append(card);
      const en = /^en(?:-|$)/i.test(doc.documentElement.lang);
      const returnFocus = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement
        : readingNodes(doc).find(node => { const rect = node.getBoundingClientRect(); return rect.bottom > 0 && rect.top < host.innerHeight; }) || doc.querySelector('main');
      await mountInlineSignup(card, { bonus: 3, en, purpose: 'invitation', creditActive: false, returnFocus,
        returnTo: en ? '/en/dementia-translator/' : '/de/',
        canPresent({ auth: current }) {
          return eligible() && sameIdentity(current) && (!current.currentUser || current.currentUser.isAnonymous === true);
        },
        onPresented(value) { sheet = value; markShown(value.dialog); }
      });
    } catch { disabled = true; /* Unknown auth/status fails closed for this page visit. */ }
    finally {
      card?.remove(); opening = false;
      const value = readVisit();
      if (ownPendingUntil && value?.pendingUntil === ownPendingUntil) writeVisit({ ...value, pendingUntil: 0 });
      ownPendingUntil = 0;
    }
  }
  const progress = () => {
    const y = host.scrollY, down = y - previousY; previousY = y;
    if (disabled || down <= 0 || now() - intentAt > 1500) return;
    distance += down; firstRead ||= now();
    highWater = Math.max(highWater, readingNodes(doc).filter(node => node.getBoundingClientRect().top < host.innerHeight * .7).length);
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
  const pageHide = () => {
    suspended = true; resetReading();
    // Only close this controller's sheet; never restore focus while leaving a page.
    sheet?.close('pagehide'); sheet = null; recordClosed();
    const value = readVisit();
    if (ownPendingUntil && value?.pendingUntil === ownPendingUntil) writeVisit({ ...value, pendingUntil: 0 });
    ownPendingUntil = 0;
  };
  const pageShow = () => { suspended = false; resetReading(); noticeOtherSheet(); };
  const beforePrint = () => { clearTimeout(timer); sheet?.close('print'); };
  host.addEventListener('wheel', intent, { passive: true }); host.addEventListener('touchmove', intent, { passive: true }); host.addEventListener('keydown', intent);
  host.addEventListener('scroll', progress, { passive: true }); host.addEventListener('beforeprint', beforePrint); host.addEventListener('pagehide', pageHide); host.addEventListener('pageshow', pageShow);
  const api = { dispose() { clearTimeout(timer); modalObserver.disconnect(); host.removeEventListener('wheel', intent); host.removeEventListener('touchmove', intent); host.removeEventListener('keydown', intent); host.removeEventListener('scroll', progress); host.removeEventListener('beforeprint', beforePrint); host.removeEventListener('pagehide', pageHide); host.removeEventListener('pageshow', pageShow); }, seen: () => shown > 0 };
  controllers.set(doc, api); return api;
}
export function bootContentScrollSignup() {
  const start = () => mountContentScrollSignup();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}
